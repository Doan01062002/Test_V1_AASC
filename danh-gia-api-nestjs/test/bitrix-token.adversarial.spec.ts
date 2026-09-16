import { BitrixToken } from '../src/database/entities/bitrix-token.entity';

describe('Adversarial Stress-Testing: BitrixToken Entity', () => {
  let token: BitrixToken;

  beforeEach(() => {
    token = new BitrixToken();
    token.id = 1;
    token.domain = 'adversarial.bitrix24.com';
    token.accessToken = 'test-access-token';
    token.refreshToken = 'test-refresh-token';
  });

  describe('Boundary Conditions on isExpired()', () => {
    it('exact boundary: expiresAt at exactly Date.now() + 60,000ms should return true (buffer boundary)', () => {
      const now = 1_700_000_000_000;
      jest.spyOn(Date, 'now').mockReturnValue(now);

      token.expiresAt = new Date(now + 60_000);
      expect(token.isExpired()).toBe(true);

      jest.restoreAllMocks();
    });

    it('1ms outside buffer: expiresAt at Date.now() + 60,001ms should return false (not yet expired)', () => {
      const now = 1_700_000_000_000;
      jest.spyOn(Date, 'now').mockReturnValue(now);

      token.expiresAt = new Date(now + 60_001);
      expect(token.isExpired()).toBe(false);

      jest.restoreAllMocks();
    });

    it('1ms inside buffer: expiresAt at Date.now() + 59,999ms should return true (within buffer)', () => {
      const now = 1_700_000_000_000;
      jest.spyOn(Date, 'now').mockReturnValue(now);

      token.expiresAt = new Date(now + 59_999);
      expect(token.isExpired()).toBe(true);

      jest.restoreAllMocks();
    });

    it('exact expiration moment: expiresAt at exactly Date.now() should return true', () => {
      const now = 1_700_000_000_000;
      jest.spyOn(Date, 'now').mockReturnValue(now);

      token.expiresAt = new Date(now);
      expect(token.isExpired()).toBe(true);

      jest.restoreAllMocks();
    });

    it('past expiration: expiresAt at Date.now() - 1ms should return true', () => {
      const now = 1_700_000_000_000;
      jest.spyOn(Date, 'now').mockReturnValue(now);

      token.expiresAt = new Date(now - 1);
      expect(token.isExpired()).toBe(true);

      jest.restoreAllMocks();
    });

    it('far past expiration: expiresAt 1 year ago should return true', () => {
      const now = 1_700_000_000_000;
      jest.spyOn(Date, 'now').mockReturnValue(now);

      token.expiresAt = new Date(now - 365 * 24 * 3600 * 1000);
      expect(token.isExpired()).toBe(true);

      jest.restoreAllMocks();
    });
  });

  describe('Negative expiresAt Values', () => {
    it('negative timestamp Date(-1) (pre-epoch 1969-12-31T23:59:59.999Z) should return true', () => {
      token.expiresAt = new Date(-1);
      expect(token.isExpired()).toBe(true);
    });

    it('deep pre-epoch Date(-100,000,000,000) should return true', () => {
      token.expiresAt = new Date(-100_000_000_000);
      expect(token.isExpired()).toBe(true);
    });

    it('negative number assigned to expiresAt should evaluate as expired', () => {
      (token as any).expiresAt = -5000;
      expect(token.isExpired()).toBe(true);
    });
  });

  describe('Time Zone Offsets Equivalence', () => {
    it('should evaluate identically regardless of time zone offset representation for the same UTC instant', () => {
      // Future instant: 2030-01-01T12:00:00Z
      const utcString = '2030-01-01T12:00:00.000Z';
      const vietnamString = '2030-01-01T19:00:00.000+07:00';
      const usEasternString = '2030-01-01T07:00:00.000-05:00';
      const indiaString = '2030-01-01T17:30:00.000+05:30';

      (token as any).expiresAt = utcString;
      const resUtc = token.isExpired();

      (token as any).expiresAt = vietnamString;
      const resVn = token.isExpired();

      (token as any).expiresAt = usEasternString;
      const resUs = token.isExpired();

      (token as any).expiresAt = indiaString;
      const resIndia = token.isExpired();

      expect(resUtc).toBe(false);
      expect(resVn).toBe(false);
      expect(resUs).toBe(false);
      expect(resIndia).toBe(false);
    });

    it('should evaluate identically for expired timestamp across different timezone representations', () => {
      // Past instant: 2020-05-10T08:00:00Z
      const utcPast = '2020-05-10T08:00:00.000Z';
      const vnPast = '2020-05-10T15:00:00.000+07:00';
      const usPast = '2020-05-10T04:00:00.000-04:00';

      (token as any).expiresAt = utcPast;
      expect(token.isExpired()).toBe(true);

      (token as any).expiresAt = vnPast;
      expect(token.isExpired()).toBe(true);

      (token as any).expiresAt = usPast;
      expect(token.isExpired()).toBe(true);
    });
  });

  describe('Invalid Dates and Edge Cases (Fail-Open / Fail-Closed Behavior)', () => {
    it('null expiresAt: new Date(null).getTime() evaluates to 0 (epoch), returning true', () => {
      (token as any).expiresAt = null;
      expect(token.isExpired()).toBe(true);
    });

    it('empirical finding: invalid Date object new Date("invalid") results in NaN', () => {
      token.expiresAt = new Date('invalid');
      const time = token.expiresAt.getTime();
      expect(Number.isNaN(time)).toBe(true);

      // Current implementation returns false because Date.now() >= NaN - 60000 is false
      // This is a documented fail-open vulnerability
      const result = token.isExpired();
      expect(result).toBe(false);
    });

    it('empirical finding: invalid string "garbage-date" results in NaN and returns false', () => {
      (token as any).expiresAt = 'garbage-non-date';
      const parsed = new Date((token as any).expiresAt).getTime();
      expect(Number.isNaN(parsed)).toBe(true);

      const result = token.isExpired();
      expect(result).toBe(false);
    });

    it('empirical finding: undefined expiresAt results in NaN and returns false', () => {
      (token as any).expiresAt = undefined;
      const result = token.isExpired();
      expect(result).toBe(false);
    });

    it('leap second representation "2016-12-31T23:59:60Z" produces NaN in V8 engine', () => {
      const leapSecondStr = '2016-12-31T23:59:60Z';
      const parsedTime = new Date(leapSecondStr).getTime();
      expect(Number.isNaN(parsedTime)).toBe(true);

      (token as any).expiresAt = leapSecondStr;
      expect(token.isExpired()).toBe(false);
    });
  });
});
