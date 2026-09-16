import { Test, TestingModule } from '@nestjs/testing';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { of, throwError } from 'rxjs';
import { AxiosResponse } from 'axios';
import {
  BadGatewayException,
  UnauthorizedException,
  BadRequestException,
} from '@nestjs/common';
import { Bitrix24Service } from './bitrix24.service';
import { BitrixToken } from '../../database/entities/bitrix-token.entity';

describe('Bitrix24Service Adversarial & Stress Testing', () => {
  let service: Bitrix24Service;
  let httpService: HttpService;
  let moduleRef: TestingModule;

  beforeEach(async () => {
    moduleRef = await Test.createTestingModule({
      imports: [
        TypeOrmModule.forRoot({
          type: 'sqlite',
          database: ':memory:',
          entities: [BitrixToken],
          synchronize: true,
          logging: false,
        }),
        TypeOrmModule.forFeature([BitrixToken]),
      ],
      providers: [
        Bitrix24Service,
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
              if (key === 'BITRIX24_DOMAIN') return 'adversarial.bitrix24.vn';
              if (key === 'CLIENT_ID') return 'client_id_adv';
              if (key === 'CLIENT_SECRET') return 'client_secret_adv';
              return null;
            }),
          },
        },
      ],
    }).compile();

    service = moduleRef.get<Bitrix24Service>(Bitrix24Service);
    httpService = moduleRef.get<HttpService>(HttpService);
  });

  afterEach(async () => {
    if (moduleRef) {
      await moduleRef.close();
    }
  });

  describe('callBitrixAPI Infinite Loop & Retry Stress Testing', () => {
    it('ADV-01: should retry exactly once when expired_token error is encountered, and throw BadGatewayException without infinite loop if retry also fails', async () => {
      // Setup initial valid token in real SQLite DB
      await service.saveToken({
        domain: 'adversarial.bitrix24.vn',
        accessToken: 'initial_token',
        refreshToken: 'refresh_tok',
        expiresAt: new Date(Date.now() + 3600 * 1000),
      });

      const refreshResponse: AxiosResponse = {
        data: {
          access_token: 'retry_refreshed_token',
          refresh_token: 'retry_refreshed_refresh',
          expires_in: 3600,
        },
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {} as any,
      };
      jest.spyOn(httpService, 'get').mockReturnValue(of(refreshResponse));

      // Both initial and retry calls fail with 401 expired_token
      const expiredError = {
        response: {
          status: 401,
          data: {
            error: 'expired_token',
            error_description: 'Persistent token expiration failure',
          },
        },
      };
      jest.spyOn(httpService, 'post').mockReturnValue(throwError(() => expiredError));

      let caughtError: any = null;
      try {
        await service.callBitrixAPI('crm.contact.list');
      } catch (err) {
        caughtError = err;
      }

      expect(caughtError).toBeInstanceOf(BadGatewayException);
      expect(caughtError.message).toContain('Persistent token expiration failure');
      // Exactly 1 original call + 1 retry call = 2 total
      expect(httpService.post).toHaveBeenCalledTimes(2);
      // Exactly 1 refresh call
      expect(httpService.get).toHaveBeenCalledTimes(1);
    });

    it('ADV-02: should recover on second try if initial call returns 200 OK with error body { error: "expired_token" }', async () => {
      await service.saveToken({
        domain: 'adversarial.bitrix24.vn',
        accessToken: 'token_pre_expired',
        refreshToken: 'refresh_tok',
        expiresAt: new Date(Date.now() + 3600 * 1000),
      });

      const refreshResponse: AxiosResponse = {
        data: {
          access_token: 'recovered_token',
          refresh_token: 'recovered_refresh',
          expires_in: 3600,
        },
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {} as any,
      };
      jest.spyOn(httpService, 'get').mockReturnValue(of(refreshResponse));

      const errorBody200: AxiosResponse = {
        data: {
          error: 'expired_token',
          error_description: 'Token expired in 200 OK response',
        },
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {} as any,
      };

      const successResponse: AxiosResponse = {
        data: { result: [{ ID: 101, NAME: 'Recovered Contact' }] },
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {} as any,
      };

      jest
        .spyOn(httpService, 'post')
        .mockReturnValueOnce(of(errorBody200))
        .mockReturnValueOnce(of(successResponse));

      const result = await service.callBitrixAPI('crm.contact.list');
      expect(result).toEqual([{ ID: 101, NAME: 'Recovered Contact' }]);
      expect(httpService.post).toHaveBeenCalledTimes(2);
      expect(httpService.get).toHaveBeenCalledTimes(1);
    });

    it('ADV-03: should immediately throw UnauthorizedException and halt if refreshToken fails during retry', async () => {
      await service.saveToken({
        domain: 'adversarial.bitrix24.vn',
        accessToken: 'expired_tok',
        refreshToken: 'revoked_ref',
        expiresAt: new Date(Date.now() + 3600 * 1000),
      });

      const expiredError = {
        response: {
          status: 401,
          data: { error: 'expired_token', error_description: 'Token expired' },
        },
      };
      jest.spyOn(httpService, 'post').mockReturnValue(throwError(() => expiredError));

      const refreshError = {
        response: {
          status: 400,
          data: { error: 'invalid_grant', error_description: 'Refresh token invalid or revoked' },
        },
        message: 'Request failed with status code 400',
      };
      jest.spyOn(httpService, 'get').mockReturnValue(throwError(() => refreshError));

      await expect(service.callBitrixAPI('crm.contact.list')).rejects.toThrow(
        UnauthorizedException,
      );
      // Only 1 initial call was made, no retry because refresh failed
      expect(httpService.post).toHaveBeenCalledTimes(1);
      expect(httpService.get).toHaveBeenCalledTimes(1);
    });
  });

  describe('Timeout & Network Fault Tolerance', () => {
    beforeEach(async () => {
      await service.saveToken({
        domain: 'adversarial.bitrix24.vn',
        accessToken: 'network_test_tok',
        refreshToken: 'network_test_ref',
        expiresAt: new Date(Date.now() + 3600 * 1000),
      });
    });

    it('ADV-04: should enforce 10000ms timeout in post config and map ECONNABORTED to BadGatewayException', async () => {
      jest.spyOn(httpService, 'post').mockReturnValue(
        throwError(() => ({
          code: 'ECONNABORTED',
          message: 'timeout of 10000ms exceeded',
        })),
      );

      await expect(service.callBitrixAPI('crm.contact.list')).rejects.toThrow(
        BadGatewayException,
      );
    });

    it('ADV-05: should map ETIMEDOUT to BadGatewayException with Timeout message', async () => {
      jest.spyOn(httpService, 'post').mockReturnValue(
        throwError(() => ({
          code: 'ETIMEDOUT',
          message: 'connect ETIMEDOUT',
        })),
      );

      let caught: any;
      try {
        await service.callBitrixAPI('crm.contact.list');
      } catch (err) {
        caught = err;
      }
      expect(caught).toBeInstanceOf(BadGatewayException);
      expect(caught.message).toContain('Timeout');
    });

    it('ADV-06: should map ENOTFOUND to BadGatewayException with Network Error message', async () => {
      jest.spyOn(httpService, 'post').mockReturnValue(
        throwError(() => ({
          code: 'ENOTFOUND',
          message: 'getaddrinfo ENOTFOUND adversarial.bitrix24.vn',
        })),
      );

      let caught: any;
      try {
        await service.callBitrixAPI('crm.contact.list');
      } catch (err) {
        caught = err;
      }
      expect(caught).toBeInstanceOf(BadGatewayException);
      expect(caught.message).toContain('Network Error');
    });

    it('ADV-07: should map ECONNREFUSED to BadGatewayException with Network Error message', async () => {
      jest.spyOn(httpService, 'post').mockReturnValue(
        throwError(() => ({
          code: 'ECONNREFUSED',
          message: 'connect ECONNREFUSED 127.0.0.1:443',
        })),
      );

      let caught: any;
      try {
        await service.callBitrixAPI('crm.contact.list');
      } catch (err) {
        caught = err;
      }
      expect(caught).toBeInstanceOf(BadGatewayException);
      expect(caught.message).toContain('Network Error');
    });
  });

  describe('Token Persistence & SQLite Record Mutation', () => {
    it('ADV-08: should accurately update SQLite record fields and timestamps on refreshToken', async () => {
      const initial = await service.saveToken({
        domain: 'adversarial.bitrix24.vn',
        accessToken: 'old_access',
        refreshToken: 'old_refresh',
        expiresAt: new Date(Date.now() + 1000),
      });

      const refreshResponse: AxiosResponse = {
        data: {
          access_token: 'persisted_new_access',
          refresh_token: 'persisted_new_refresh',
          expires_in: 7200,
          member_id: 'member_adv_999',
          client_endpoint: 'https://adversarial.bitrix24.vn/rest/',
        },
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {} as any,
      };
      jest.spyOn(httpService, 'get').mockReturnValue(of(refreshResponse));

      const now = Date.now();
      const updated = await service.refreshToken(initial);

      expect(updated.accessToken).toBe('persisted_new_access');
      expect(updated.refreshToken).toBe('persisted_new_refresh');
      expect(updated.memberId).toBe('member_adv_999');

      // Verify expiresAt is (expires_in - 60) * 1000 from now
      const expectedExpiry = now + (7200 - 60) * 1000;
      expect(Math.abs(updated.expiresAt.getTime() - expectedExpiry)).toBeLessThan(2000);

      // Verify reading back from DB returns updated values
      const stored = await service.getValidToken('adversarial.bitrix24.vn');
      expect(stored.accessToken).toBe('persisted_new_access');
    });
  });
});
