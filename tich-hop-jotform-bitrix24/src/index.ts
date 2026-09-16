import { app } from './app';
import { config } from './config/env';
import { logger } from './utils/logger';

// 1. Process-level defensive exception handlers (Zero-Crash Policy)
process.on('uncaughtException', (err: Error) => {
  logger.error(`[FATAL] Uncaught Exception: ${err.message}`, {
    stack: err.stack,
  });
  // Maintain server availability for webhook ingestion unless fatal OS crash
});

process.on('unhandledRejection', (reason: unknown) => {
  logger.error(`[FATAL] Unhandled Promise Rejection: ${String(reason)}`, {
    reason,
  });
});

// 2. Start HTTP Server
const server = app.listen(config.PORT, () => {
  logger.info(`========================================================`);
  logger.info(` Jotform & Bitrix24 CRM Integration Server Started`);
  logger.info(` Listening on port: ${config.PORT}`);
  logger.info(` Environment: ${config.NODE_ENV}`);
  logger.info(` Bitrix24 Webhook: ${config.BITRIX24_WEBHOOK_URL}`);
  logger.info(` Jotform Form ID: ${config.JOTFORM_FORM_ID}`);
  logger.info(` DNS Fallback Servers: [${config.DNS_SERVERS.join(', ')}]`);
  logger.info(` Health Check: http://localhost:${config.PORT}/health`);
  logger.info(` Webhook Endpoint: http://localhost:${config.PORT}/webhook/jotform`);
  logger.info(`========================================================`);
});

// 3. Graceful shutdown handler
function gracefulShutdown(signal: string) {
  logger.info(`Received ${signal}. Initiating graceful shutdown...`);
  server.close(() => {
    logger.info('HTTP server closed. Exiting process.');
    process.exit(0);
  });

  // Force close if graceful shutdown takes longer than 10 seconds
  setTimeout(() => {
    logger.error('Could not close connections in time, forcefully shutting down');
    process.exit(1);
  }, 10000);
}

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));
