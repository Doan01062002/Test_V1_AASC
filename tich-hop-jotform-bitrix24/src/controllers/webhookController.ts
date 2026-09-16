import { Request, Response } from 'express';
import { bitrix24Service, Bitrix24Error } from '../services/bitrix24Service';
import { jotformService } from '../services/jotformService';
import { normalizeWebhookPayload } from '../services/normalizer';
import { validateContact, ValidationError } from '../services/validator';
import { ApiResponse } from '../types/common.types';
import { logger } from '../utils/logger';

/**
 * Handles incoming Jotform Webhook submissions (POST /webhook/jotform).
 */
export async function handleJotformWebhook(req: Request, res: Response): Promise<void> {
  const receiveTimestamp = new Date().toISOString();
  const remoteIp = req.ip || req.socket.remoteAddress || 'unknown';

  logger.info(`[Webhook] Received submission from IP: ${remoteIp}`, {
    timestamp: receiveTimestamp,
    contentType: req.headers['content-type'],
    bodyKeys: Object.keys(req.body || {}),
    hasRawRequest: Boolean(req.body?.rawRequest),
  });

  try {
    // 1. Normalize payload across multipart/form-data, urlencoded, and json
    const normalized = normalizeWebhookPayload(req.body);

    logger.info('[Webhook] Normalized submission payload', {
      name: normalized.name,
      lastName: normalized.lastName,
      email: normalized.email,
      phone: normalized.phone,
      submissionId: normalized.submissionId,
      formId: normalized.formId,
    });

    // 2. Validate input fields strictly before calling CRM
    const validation = validateContact(normalized);
    if (!validation.isValid) {
      logger.warn('[Webhook] Submission rejected due to validation failure', {
        errors: validation.errors,
        normalized,
      });

      const responseBody: ApiResponse = {
        success: false,
        error: 'Validation failed',
        code: 'VALIDATION_ERROR',
        details: validation.errors,
        timestamp: new Date().toISOString(),
      };

      res.status(400).json(responseBody);
      return;
    }

    // 3. Dispatch to Bitrix24 CRM to create Contact record
    const contactId = await bitrix24Service.createContact(normalized);

    logger.info(`[Webhook] Successfully created Bitrix24 Contact #${contactId}`, {
      contactId,
      submissionId: normalized.submissionId,
      email: normalized.email,
    });

    const responseBody: ApiResponse<{ contactId: number; normalized: typeof normalized }> = {
      success: true,
      message: 'Contact created successfully in Bitrix24 CRM',
      data: {
        contactId,
        normalized,
      },
      timestamp: new Date().toISOString(),
    };

    res.status(200).json(responseBody);
  } catch (err) {
    const errorTimestamp = new Date().toISOString();

    if (err instanceof ValidationError) {
      logger.warn(`[Webhook] ValidationError: ${err.message}`, { errors: err.errors });
      res.status(400).json({
        success: false,
        error: err.message,
        code: 'VALIDATION_ERROR',
        details: err.errors,
        timestamp: errorTimestamp,
      });
      return;
    }

    if (err instanceof Bitrix24Error) {
      logger.error(`[Webhook] Bitrix24 Error (${err.statusCode}): ${err.message}`, {
        code: err.errorCode,
        details: err.details,
      });
      res.status(err.statusCode).json({
        success: false,
        error: err.message,
        code: err.errorCode || 'BITRIX24_ERROR',
        timestamp: errorTimestamp,
      });
      return;
    }

    const unexpected = err as Error;
    logger.error(`[Webhook] Unexpected internal error: ${unexpected.message}`, {
      stack: unexpected.stack,
    });

    res.status(500).json({
      success: false,
      error: 'Internal server error while processing webhook submission',
      code: 'INTERNAL_ERROR',
      timestamp: errorTimestamp,
    });
  }
}

/**
 * Handles manual sync from Jotform API (GET or POST /sync/jotform).
 */
export async function handleJotformSync(req: Request, res: Response): Promise<void> {
  const formId = (req.query.formId as string) || undefined;
  const apiKey = (req.query.apiKey as string) || undefined;

  logger.info('[Sync] Manual Jotform API synchronization triggered', { formId });

  try {
    const normalizedList = await jotformService.getNormalizedSubmissions(formId, apiKey);
    const results: Array<{ submissionId?: string; contactId?: number; error?: string }> = [];

    for (const contact of normalizedList) {
      const validation = validateContact(contact);
      if (!validation.isValid) {
        results.push({
          submissionId: contact.submissionId,
          error: `Validation failed: ${validation.errors.join(', ')}`,
        });
        continue;
      }

      try {
        const contactId = await bitrix24Service.createContact(contact);
        results.push({
          submissionId: contact.submissionId,
          contactId,
        });
      } catch (crmErr) {
        results.push({
          submissionId: contact.submissionId,
          error: (crmErr as Error).message,
        });
      }
    }

    res.status(200).json({
      success: true,
      message: `Processed ${normalizedList.length} submissions from Jotform API`,
      data: {
        total: normalizedList.length,
        results,
      },
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    logger.error(`[Sync] Sync failed: ${(err as Error).message}`);
    res.status(502).json({
      success: false,
      error: (err as Error).message,
      timestamp: new Date().toISOString(),
    });
  }
}
