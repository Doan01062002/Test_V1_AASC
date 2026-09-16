import { Test, TestingModule } from '@nestjs/testing';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { BadRequestException } from '@nestjs/common';
import { of, throwError } from 'rxjs';
import { AxiosResponse } from 'axios';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { Bitrix24Service } from '../bitrix24/bitrix24.service';
import { BitrixToken } from '../../database/entities/bitrix-token.entity';

describe('AuthModule (AuthService & AuthController)', () => {
  let authService: AuthService;
  let authController: AuthController;
  let bitrixService: Bitrix24Service;
  let httpService: HttpService;
  let configService: ConfigService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [
        AuthService,
        {
          provide: Bitrix24Service,
          useValue: {
            saveToken: jest.fn().mockImplementation((data: Partial<BitrixToken>) => {
              const token = new BitrixToken();
              Object.assign(token, data);
              return Promise.resolve(token);
            }),
          },
        },
        {
          provide: HttpService,
          useValue: {
            get: jest.fn(),
            post: jest.fn(),
          },
        },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string) => {
              if (key === 'CLIENT_ID') return 'test_client_id';
              if (key === 'CLIENT_SECRET') return 'test_client_secret';
              if (key === 'BITRIX24_DOMAIN') return 'default.bitrix24.vn';
              return null;
            }),
          },
        },
      ],
    }).compile();

    authService = module.get<AuthService>(AuthService);
    authController = module.get<AuthController>(AuthController);
    bitrixService = module.get<Bitrix24Service>(Bitrix24Service);
    httpService = module.get<HttpService>(HttpService);
    configService = module.get<ConfigService>(ConfigService);
  });

  it('should be defined', () => {
    expect(authService).toBeDefined();
    expect(authController).toBeDefined();
  });

  describe('AuthService - processInstall', () => {
    it('TC-AUTH-01: should handle direct iframe tokens (AUTH_ID & REFRESH_ID)', async () => {
      const payload = {
        domain: 'portal.bitrix24.vn',
        member_id: 'member_999',
        AUTH_ID: 'iframe_access_token_123',
        REFRESH_ID: 'iframe_refresh_token_456',
        AUTH_EXPIRES: '3600',
        client_endpoint: 'https://portal.bitrix24.vn/rest/',
      };

      const result = await authService.processInstall(payload);

      expect(result.success).toBe(true);
      expect(result.status).toBe('installed');
      expect(result.domain).toBe('portal.bitrix24.vn');
      expect(bitrixService.saveToken).toHaveBeenCalledWith(
        expect.objectContaining({
          domain: 'portal.bitrix24.vn',
          accessToken: 'iframe_access_token_123',
          refreshToken: 'iframe_refresh_token_456',
          memberId: 'member_999',
          clientEndpoint: 'https://portal.bitrix24.vn/rest/',
        }),
      );
    });

    it('TC-AUTH-02: should exchange authorization code with Bitrix24 OAuth server', async () => {
      const payload = {
        code: 'auth_code_xyz123',
        domain: 'oauth-portal.bitrix24.vn',
        member_id: 'member_888',
      };

      const mockExchangeResponse: AxiosResponse = {
        data: {
          access_token: 'exchanged_access_token',
          refresh_token: 'exchanged_refresh_token',
          expires_in: 3600,
          client_endpoint: 'https://oauth-portal.bitrix24.vn/rest/',
          member_id: 'member_888',
          domain: 'oauth-portal.bitrix24.vn',
        },
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {} as any,
      };

      jest.spyOn(httpService, 'get').mockReturnValue(of(mockExchangeResponse));

      const result = await authService.processInstall(payload);

      expect(result.success).toBe(true);
      expect(result.status).toBe('installed');
      expect(result.domain).toBe('oauth-portal.bitrix24.vn');
      expect(httpService.get).toHaveBeenCalledWith(
        'https://oauth.bitrix.info/oauth/token/',
        expect.objectContaining({
          params: {
            grant_type: 'authorization_code',
            client_id: 'test_client_id',
            client_secret: 'test_client_secret',
            code: 'auth_code_xyz123',
          },
          timeout: 10000,
        }),
      );
      expect(bitrixService.saveToken).toHaveBeenCalledWith(
        expect.objectContaining({
          domain: 'oauth-portal.bitrix24.vn',
          accessToken: 'exchanged_access_token',
          refreshToken: 'exchanged_refresh_token',
          memberId: 'member_888',
        }),
      );
    });

    it('TC-AUTH-03: should throw BadRequestException if code exchange fails', async () => {
      const payload = {
        code: 'bad_code_789',
        domain: 'oauth-portal.bitrix24.vn',
      };

      jest.spyOn(httpService, 'get').mockReturnValue(
        throwError(() => ({
          response: {
            status: 400,
            data: { error: 'invalid_grant', error_description: 'Code expired' },
          },
          message: 'Request failed with status code 400',
        })),
      );

      await expect(authService.processInstall(payload)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('TC-AUTH-04: should throw BadRequestException if payload has neither code nor tokens', async () => {
      const payload = {
        domain: 'empty-portal.bitrix24.vn',
      };

      await expect(authService.processInstall(payload)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('TC-AUTH-05: should throw BadRequestException if payload is null or invalid', async () => {
      await expect(authService.processInstall(null)).rejects.toThrow(
        BadRequestException,
      );
      await expect(authService.processInstall('invalid_string')).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('AuthController endpoints', () => {
    it('handleInstallGet should delegate to authService.processInstall', async () => {
      const query = { code: 'get_code_123', domain: 'test.bitrix24.vn' };
      const expected = { success: true, status: 'installed', domain: 'test.bitrix24.vn' };
      jest.spyOn(authService, 'processInstall').mockResolvedValue(expected as any);

      const result = await authController.handleInstallGet(query);
      expect(result).toBe(expected);
      expect(authService.processInstall).toHaveBeenCalledWith(query);
    });

    it('handleInstallPost should delegate to authService.processInstall', async () => {
      const body = { AUTH_ID: 'post_token', REFRESH_ID: 'post_ref', domain: 'test.bitrix24.vn' };
      const expected = { success: true, status: 'installed', domain: 'test.bitrix24.vn' };
      jest.spyOn(authService, 'processInstall').mockResolvedValue(expected as any);

      const result = await authController.handleInstallPost(body);
      expect(result).toBe(expected);
      expect(authService.processInstall).toHaveBeenCalledWith(body);
    });
  });
});
