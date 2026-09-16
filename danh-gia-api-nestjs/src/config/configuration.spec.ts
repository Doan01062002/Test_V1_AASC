import configuration from './configuration';

describe('Configuration', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it('should return default values when environment variables are not set', () => {
    delete process.env.PORT;
    delete process.env.API_KEY;
    delete process.env.CLIENT_ID;
    delete process.env.CLIENT_SECRET;
    delete process.env.BITRIX24_DOMAIN;
    delete process.env.DATABASE_PATH;

    const config = configuration();

    expect(config.port).toBe(3000);
    expect(config.apiKey).toBe('default-secret-api-key');
    expect(config.databasePath).toBe('data/bitrix24.sqlite');
  });

  it('should return configured values when environment variables are set', () => {
    process.env.PORT = '4000';
    process.env.API_KEY = 'custom-api-key';
    process.env.CLIENT_ID = 'test-client-id';
    process.env.CLIENT_SECRET = 'test-client-secret';
    process.env.BITRIX24_DOMAIN = 'custom.bitrix24.vn';
    process.env.DATABASE_PATH = 'custom/path.sqlite';

    const config = configuration();

    expect(config.port).toBe(4000);
    expect(config.apiKey).toBe('custom-api-key');
    expect(config.clientId).toBe('test-client-id');
    expect(config.clientSecret).toBe('test-client-secret');
    expect(config.bitrixDomain).toBe('custom.bitrix24.vn');
    expect(config.databasePath).toBe('custom/path.sqlite');
  });
});
