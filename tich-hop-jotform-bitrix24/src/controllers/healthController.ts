import { Request, Response } from 'express';
import { config } from '../config/env';

export function getHealth(req: Request, res: Response): void {
  res.status(200).json({
    status: 'ok',
    service: 'tich-hop-jotform-bitrix24',
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
    env: config.NODE_ENV,
    config: {
      port: config.PORT,
      bitrixWebhookConfigured: Boolean(config.BITRIX24_WEBHOOK_URL),
      jotformFormId: config.JOTFORM_FORM_ID,
      dnsServers: config.DNS_SERVERS,
    },
  });
}

export function getRoot(req: Request, res: Response): void {
  res.status(200).json({
    message: 'Jotform & Bitrix24 CRM Integration Service',
    docs: {
      health: 'GET /health',
      webhook: 'POST /webhook/jotform',
    },
    timestamp: new Date().toISOString(),
  });
}
