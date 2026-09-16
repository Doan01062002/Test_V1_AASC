export default () => ({
  port: parseInt(process.env.PORT, 10) || 3000,
  apiKey: process.env.API_KEY || 'default-secret-api-key',
  clientId: process.env.CLIENT_ID || '',
  clientSecret: process.env.CLIENT_SECRET || '',
  bitrixDomain: process.env.BITRIX24_DOMAIN || '',
  databasePath: process.env.DATABASE_PATH || 'data/bitrix24.sqlite',
  PORT: parseInt(process.env.PORT, 10) || 3000,
  API_KEY: process.env.API_KEY || 'default-secret-api-key',
  CLIENT_ID: process.env.CLIENT_ID || '',
  CLIENT_SECRET: process.env.CLIENT_SECRET || '',
  BITRIX24_DOMAIN: process.env.BITRIX24_DOMAIN || '',
  DATABASE_PATH: process.env.DATABASE_PATH || 'data/bitrix24.sqlite',
});
