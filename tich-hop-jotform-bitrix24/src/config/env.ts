import dotenv from 'dotenv';
import path from 'path';

// Load environment variables from .env file
dotenv.config();

export interface AppConfig {
  PORT: number;
  NODE_ENV: string;
  LOG_LEVEL: 'info' | 'warn' | 'error' | 'debug';
  BITRIX24_WEBHOOK_URL: string;
  JOTFORM_API_KEY: string;
  JOTFORM_FORM_ID: string;
  DNS_SERVERS: string[];
  REQUEST_TIMEOUT_MS: number;
}

function normalizeUrl(url: string): string {
  if (!url) return '';
  return url.endsWith('/') ? url : `${url}/`;
}

function parseDnsServers(serversStr?: string): string[] {
  if (!serversStr || !serversStr.trim()) {
    return ['8.8.8.8', '1.1.1.1'];
  }
  return serversStr
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

export const config: AppConfig = {
  PORT: parseInt(process.env.PORT || '3000', 10),
  NODE_ENV: process.env.NODE_ENV || 'development',
  LOG_LEVEL: (process.env.LOG_LEVEL?.toLowerCase() as AppConfig['LOG_LEVEL']) || 'info',
  BITRIX24_WEBHOOK_URL: normalizeUrl(
    process.env.BITRIX24_WEBHOOK_URL ||
      'https://your-domain.bitrix24.vn/rest/1/your_webhook_key_here/'
  ),
  JOTFORM_API_KEY: process.env.JOTFORM_API_KEY || '',
  JOTFORM_FORM_ID: process.env.JOTFORM_FORM_ID || '262582117734055',
  DNS_SERVERS: parseDnsServers(process.env.DNS_SERVERS),
  REQUEST_TIMEOUT_MS: parseInt(process.env.REQUEST_TIMEOUT_MS || '10000', 10),
};
