import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ApiKeyGuard } from './api-key.guard';

describe('ApiKeyGuard', () => {
  let guard: ApiKeyGuard;
  let configService: ConfigService;

  beforeEach(() => {
    configService = {
      get: jest.fn((key: string) => {
        if (key === 'API_KEY' || key === 'apiKey') {
          return 'valid-secret-key-123';
        }
        return null;
      }),
    } as unknown as ConfigService;

    guard = new ApiKeyGuard(configService);
  });

  function createMockContext(headers: Record<string, string | undefined>): ExecutionContext {
    return {
      switchToHttp: () => ({
        getRequest: () => ({ headers }),
      }),
    } as unknown as ExecutionContext;
  }

  it('should be defined', () => {
    expect(guard).toBeDefined();
  });

  describe('canActivate', () => {
    it('TC-GUARD-01: should allow request when x-api-key matches configured key', () => {
      const context = createMockContext({ 'x-api-key': 'valid-secret-key-123' });
      expect(guard.canActivate(context)).toBe(true);
    });

    it('TC-GUARD-02: should allow request when X-API-KEY header is uppercase', () => {
      const context = createMockContext({ 'X-API-KEY': 'valid-secret-key-123' });
      expect(guard.canActivate(context)).toBe(true);
    });

    it('TC-GUARD-03: should throw UnauthorizedException with "Thiếu header x-api-key" when header is missing', () => {
      const context = createMockContext({});
      expect(() => guard.canActivate(context)).toThrow(UnauthorizedException);
      expect(() => guard.canActivate(context)).toThrow('Thiếu header x-api-key');
    });

    it('TC-GUARD-04: should throw UnauthorizedException with "Thiếu header x-api-key" when header is empty string', () => {
      const context = createMockContext({ 'x-api-key': '' });
      expect(() => guard.canActivate(context)).toThrow(UnauthorizedException);
      expect(() => guard.canActivate(context)).toThrow('Thiếu header x-api-key');
    });

    it('TC-GUARD-05: should throw UnauthorizedException with "API Key không hợp lệ" when key is incorrect', () => {
      const context = createMockContext({ 'x-api-key': 'wrong-api-key' });
      expect(() => guard.canActivate(context)).toThrow(UnauthorizedException);
      expect(() => guard.canActivate(context)).toThrow('API Key không hợp lệ');
    });

    it('TC-GUARD-06: should fallback to process.env.API_KEY or default when configService returns null', () => {
      const prevEnv = process.env.API_KEY;
      process.env.API_KEY = 'env-secret-key';
      const nullConfigService = {
        get: jest.fn().mockReturnValue(null),
      } as unknown as ConfigService;
      const envGuard = new ApiKeyGuard(nullConfigService);

      const context = createMockContext({ 'x-api-key': 'env-secret-key' });
      expect(envGuard.canActivate(context)).toBe(true);

      process.env.API_KEY = prevEnv;
    });
  });
});
