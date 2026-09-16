import { Test, TestingModule } from '@nestjs/testing';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { getRepositoryToken } from '@nestjs/typeorm';
import { of, throwError } from 'rxjs';
import { AxiosResponse } from 'axios';
import {
  BadGatewayException,
  UnauthorizedException,
  BadRequestException,
} from '@nestjs/common';
import { Bitrix24Service } from './bitrix24.service';
import { BitrixToken } from '../../database/entities/bitrix-token.entity';

describe('Bitrix24Service', () => {
  let service: Bitrix24Service;
  let httpService: HttpService;
  let tokenRepo: any;
  let configService: ConfigService;

  const createMockToken = (overrides?: Partial<BitrixToken>): BitrixToken => {
    const token = new BitrixToken();
    token.id = 1;
    token.domain = 'test.bitrix24.vn';
    token.accessToken = 'valid_access_token';
    token.refreshToken = 'valid_refresh_token';
    token.expiresAt = new Date(Date.now() + 3600 * 1000);
    token.memberId = 'member_123';
    token.clientEndpoint = 'https://test.bitrix24.vn/rest/';
    Object.assign(token, overrides);
    return token;
  };

  beforeEach(async () => {
    tokenRepo = {
      findOne: jest.fn(),
      save: jest.fn().mockImplementation((val) => Promise.resolve(val)),
      create: jest.fn().mockImplementation((val) => Object.assign(new BitrixToken(), val)),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        Bitrix24Service,
        {
          provide: getRepositoryToken(BitrixToken),
          useValue: tokenRepo,
        },
        {
          provide: HttpService,
          useValue: {
            post: jest.fn(),
            get: jest.fn(),
          },
        },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string) => {
              if (key === 'BITRIX24_DOMAIN') return 'test.bitrix24.vn';
              if (key === 'CLIENT_ID') return 'client_id_123';
              if (key === 'CLIENT_SECRET') return 'client_secret_xyz';
              return null;
            }),
          },
        },
      ],
    }).compile();

    service = module.get<Bitrix24Service>(Bitrix24Service);
    httpService = module.get<HttpService>(HttpService);
    configService = module.get<ConfigService>(ConfigService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getValidToken', () => {
    it('should return stored token when valid and not expired', async () => {
      const mockToken = createMockToken();
      jest.spyOn(tokenRepo, 'findOne').mockResolvedValue(mockToken);

      const result = await service.getValidToken('test.bitrix24.vn');
      expect(result).toBe(mockToken);
      expect(tokenRepo.findOne).toHaveBeenCalledWith({ where: { domain: 'test.bitrix24.vn' } });
    });

    it('should fallback to latest token when specific domain not found', async () => {
      const mockToken = createMockToken();
      jest
        .spyOn(tokenRepo, 'findOne')
        .mockResolvedValueOnce(null) // by domain
        .mockResolvedValueOnce(mockToken); // order by updatedAt

      const result = await service.getValidToken('other.bitrix24.vn');
      expect(result).toBe(mockToken);
      expect(tokenRepo.findOne).toHaveBeenCalledWith({ order: { updatedAt: 'DESC' } });
    });

    it('should throw UnauthorizedException when no token exists in database', async () => {
      jest.spyOn(tokenRepo, 'findOne').mockResolvedValue(null);

      await expect(service.getValidToken()).rejects.toThrow(UnauthorizedException);
    });

    it('should proactively refresh token if token isExpired() returns true', async () => {
      const expiredToken = createMockToken({
        expiresAt: new Date(Date.now() - 1000), // expired
      });
      jest.spyOn(tokenRepo, 'findOne').mockResolvedValue(expiredToken);

      const refreshResponse: AxiosResponse = {
        data: {
          access_token: 'proactive_refreshed_access',
          refresh_token: 'proactive_refreshed_refresh',
          expires_in: 3600,
          client_endpoint: 'https://test.bitrix24.vn/rest/',
        },
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {} as any,
      };
      jest.spyOn(httpService, 'get').mockReturnValue(of(refreshResponse));

      const result = await service.getValidToken('test.bitrix24.vn');
      expect(httpService.get).toHaveBeenCalledTimes(1);
      expect(result.accessToken).toBe('proactive_refreshed_access');
      expect(tokenRepo.save).toHaveBeenCalled();
    });
  });

  describe('refreshToken', () => {
    it('should exchange refresh_token for new tokens and persist to SQLite', async () => {
      const token = createMockToken();
      const refreshResponse: AxiosResponse = {
        data: {
          access_token: 'new_access_token_abc',
          refresh_token: 'new_refresh_token_xyz',
          expires_in: 3600,
          client_endpoint: 'https://test.bitrix24.vn/rest/',
          member_id: 'member_new_456',
        },
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {} as any,
      };

      jest.spyOn(httpService, 'get').mockReturnValue(of(refreshResponse));

      const updated = await service.refreshToken(token);
      expect(updated.accessToken).toBe('new_access_token_abc');
      expect(updated.refreshToken).toBe('new_refresh_token_xyz');
      expect(updated.memberId).toBe('member_new_456');
      expect(tokenRepo.save).toHaveBeenCalledWith(token);
    });

    it('should throw UnauthorizedException if refresh request fails', async () => {
      const token = createMockToken();
      jest.spyOn(httpService, 'get').mockReturnValue(
        throwError(() => ({
          response: { status: 400, data: { error: 'invalid_grant' } },
          message: 'Request failed with status code 400',
        })),
      );

      await expect(service.refreshToken(token)).rejects.toThrow(UnauthorizedException);
    });
  });

  describe('callBitrixAPI', () => {
    it('TC-BITRIX-01: should call Bitrix API successfully with auth token injection', async () => {
      const mockToken = createMockToken();
      jest.spyOn(tokenRepo, 'findOne').mockResolvedValue(mockToken);

      const mockResponse: AxiosResponse = {
        data: { result: [{ ID: '1', NAME: 'Nguyễn Văn A' }] },
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {} as any,
      };

      jest.spyOn(httpService, 'post').mockReturnValue(of(mockResponse));

      const result = await service.callBitrixAPI('crm.contact.list', { select: ['ID', 'NAME'] });

      expect(result).toEqual([{ ID: '1', NAME: 'Nguyễn Văn A' }]);
      expect(httpService.post).toHaveBeenCalledWith(
        'https://test.bitrix24.vn/rest/crm.contact.list.json',
        {
          select: ['ID', 'NAME'],
          auth: 'valid_access_token',
        },
        expect.objectContaining({
          timeout: 10000,
          headers: { 'Content-Type': 'application/json' },
        }),
      );
    });

    it('TC-BITRIX-02: should automatically refresh token when expired_token received and retry once', async () => {
      const mockToken = createMockToken();
      jest.spyOn(tokenRepo, 'findOne').mockResolvedValue(mockToken);

      const expiredError = {
        response: {
          status: 401,
          data: {
            error: 'expired_token',
            error_description: 'The access token provided has expired.',
          },
        },
      };

      const refreshResponse: AxiosResponse = {
        data: {
          access_token: 'new_refreshed_access_token',
          refresh_token: 'new_refreshed_refresh_token',
          expires_in: 3600,
        },
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {} as any,
      };

      const successResponse: AxiosResponse = {
        data: { result: 42 },
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {} as any,
      };

      jest.spyOn(httpService, 'get').mockReturnValue(of(refreshResponse));
      jest
        .spyOn(httpService, 'post')
        .mockReturnValueOnce(throwError(() => expiredError))
        .mockReturnValueOnce(of(successResponse));

      const result = await service.callBitrixAPI('crm.contact.add', {
        fields: { NAME: 'Test' },
      });

      expect(result).toBe(42);
      expect(httpService.get).toHaveBeenCalledTimes(1); // refreshed
      expect(httpService.post).toHaveBeenCalledTimes(2); // original + retry
    });

    it('TC-BITRIX-03: should catch timeout error (ECONNABORTED) and throw BadGatewayException', async () => {
      const mockToken = createMockToken();
      jest.spyOn(tokenRepo, 'findOne').mockResolvedValue(mockToken);

      const timeoutError = {
        code: 'ECONNABORTED',
        message: 'timeout of 10000ms exceeded',
      };

      jest.spyOn(httpService, 'post').mockReturnValue(throwError(() => timeoutError));

      await expect(service.callBitrixAPI('crm.contact.list')).rejects.toThrow(
        BadGatewayException,
      );
    });

    it('TC-BITRIX-04: should catch network failure (ENOTFOUND) and throw BadGatewayException', async () => {
      const mockToken = createMockToken();
      jest.spyOn(tokenRepo, 'findOne').mockResolvedValue(mockToken);

      const networkError = {
        code: 'ENOTFOUND',
        message: 'getaddrinfo ENOTFOUND test.bitrix24.vn',
      };

      jest.spyOn(httpService, 'post').mockReturnValue(throwError(() => networkError));

      await expect(service.callBitrixAPI('crm.contact.list')).rejects.toThrow(
        BadGatewayException,
      );
    });

    it('should catch 200 OK response with Bitrix error in body and throw BadGatewayException', async () => {
      const mockToken = createMockToken();
      jest.spyOn(tokenRepo, 'findOne').mockResolvedValue(mockToken);

      const errorResponse: AxiosResponse = {
        data: {
          error: 'ERROR_CORE',
          error_description: 'Access denied or invalid parameter',
        },
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {} as any,
      };

      jest.spyOn(httpService, 'post').mockReturnValue(of(errorResponse));

      await expect(service.callBitrixAPI('crm.contact.get', { id: 999 })).rejects.toThrow(
        BadGatewayException,
      );
    });
  });

  describe('saveToken', () => {
    it('should create and save token if not exists', async () => {
      jest.spyOn(tokenRepo, 'findOne').mockResolvedValue(null);

      const result = await service.saveToken({
        domain: 'portal.bitrix24.vn',
        accessToken: 'tok_1',
        refreshToken: 'ref_1',
      });

      expect(tokenRepo.create).toHaveBeenCalled();
      expect(tokenRepo.save).toHaveBeenCalled();
      expect(result.domain).toBe('portal.bitrix24.vn');
    });

    it('should update existing token if domain exists', async () => {
      const existingToken = createMockToken({ domain: 'portal.bitrix24.vn' });
      jest.spyOn(tokenRepo, 'findOne').mockResolvedValue(existingToken);

      const result = await service.saveToken({
        domain: 'portal.bitrix24.vn',
        accessToken: 'updated_access',
      });

      expect(tokenRepo.save).toHaveBeenCalled();
      expect(result.accessToken).toBe('updated_access');
    });

    it('should throw BadRequestException if domain is missing and not in config', async () => {
      jest.spyOn(configService, 'get').mockReturnValue(null);

      await expect(
        service.saveToken({
          accessToken: 'tok_no_domain',
        }),
      ).rejects.toThrow(BadRequestException);
    });
  });
});
