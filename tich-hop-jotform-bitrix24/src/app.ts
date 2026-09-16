import express, { Express, Request, Response, NextFunction } from 'express';
import multer from 'multer';
import { getHealth, getRoot } from './controllers/healthController';
import { handleJotformSync, handleJotformWebhook } from './controllers/webhookController';
import { logger } from './utils/logger';

export function createApp(): Express {
  const app: Express = express();
  const upload = multer();

  // 1. Core parsing middlewares supporting multiple webhook payload types
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true, limit: '10mb' }));
  app.use(upload.none()); // Handles multipart/form-data without file uploads

  // 2. SyntaxError interceptor for malformed JSON bodies
  app.use((err: any, req: Request, res: Response, next: NextFunction) => {
    if (err instanceof SyntaxError && 'body' in err) {
      logger.warn(`Malformed JSON body received from ${req.ip || 'unknown'}: ${err.message}`);
      res.status(400).json({
        success: false,
        error: 'Invalid JSON payload format',
        code: 'MALFORMED_JSON',
        timestamp: new Date().toISOString(),
      });
      return;
    }
    next(err);
  });

  // 3. Application Routes
  app.get('/', getRoot);
  app.get('/health', getHealth);
  app.post('/webhook/jotform', handleJotformWebhook);
  app.post('/sync/jotform', handleJotformSync);
  app.get('/sync/jotform', handleJotformSync);

  // 4. 404 Route Not Found handler
  app.use((req: Request, res: Response) => {
    res.status(404).json({
      success: false,
      error: `Route not found: ${req.method} ${req.originalUrl}`,
      code: 'NOT_FOUND',
      timestamp: new Date().toISOString(),
    });
  });

  // 5. Global internal error boundary
  app.use((err: any, req: Request, res: Response, next: NextFunction) => {
    logger.error(`[Unhandled Error Boundary] ${err.message}`, {
      stack: err.stack,
      url: req.originalUrl,
      method: req.method,
    });

    res.status(500).json({
      success: false,
      error: 'An unexpected internal server error occurred',
      code: 'INTERNAL_SERVER_ERROR',
      timestamp: new Date().toISOString(),
    });
  });

  return app;
}

export const app = createApp();
