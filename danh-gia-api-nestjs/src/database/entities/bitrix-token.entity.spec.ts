import { BitrixToken } from './bitrix-token.entity';

describe('BitrixToken Entity', () => {
  it('should instantiate correctly with default and custom values', () => {
    const token = new BitrixToken();
    token.id = 1;
    token.domain = 'test.bitrix24.vn';
    token.accessToken = 'test_access_token';
    token.refreshToken = 'test_refresh_token';
    token.expiresAt = new Date(Date.now() + 3600 * 1000);
    token.memberId = 'member123';
    token.clientEndpoint = 'https://test.bitrix24.vn/rest/';

    expect(token.id).toBe(1);
    expect(token.domain).toBe('test.bitrix24.vn');
    expect(token.accessToken).toBe('test_access_token');
    expect(token.refreshToken).toBe('test_refresh_token');
    expect(token.memberId).toBe('member123');
    expect(token.clientEndpoint).toBe('https://test.bitrix24.vn/rest/');
  });

  describe('isExpired()', () => {
    it('should return false when token expires in the future (> 60s)', () => {
      const token = new BitrixToken();
      token.expiresAt = new Date(Date.now() + 300 * 1000); // 5 minutes in future
      expect(token.isExpired()).toBe(false);
    });

    it('should return true when token is within 60s margin of expiration', () => {
      const token = new BitrixToken();
      token.expiresAt = new Date(Date.now() + 30 * 1000); // 30s in future (inside 60s buffer)
      expect(token.isExpired()).toBe(true);
    });

    it('should return true when token is already expired', () => {
      const token = new BitrixToken();
      token.expiresAt = new Date(Date.now() - 10 * 1000); // 10s in past
      expect(token.isExpired()).toBe(true);
    });

    it('should handle string date values gracefully', () => {
      const token = new BitrixToken();
      (token as any).expiresAt = new Date(Date.now() + 3600 * 1000).toISOString();
      expect(token.isExpired()).toBe(false);
    });

    it('should return true (fail-closed) when expiresAt is null or undefined', () => {
      const token = new BitrixToken();
      (token as any).expiresAt = null;
      expect(token.isExpired()).toBe(true);

      (token as any).expiresAt = undefined;
      expect(token.isExpired()).toBe(true);
    });

    it('should return true (fail-closed) when expiresAt is an invalid Date object or NaN', () => {
      const token = new BitrixToken();
      token.expiresAt = new Date('invalid');
      expect(token.isExpired()).toBe(true);

      (token as any).expiresAt = 'garbage-non-date';
      expect(token.isExpired()).toBe(true);
    });
  });
});
