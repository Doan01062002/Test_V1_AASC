import axios, { AxiosError, AxiosInstance } from 'axios';
import { config } from '../config/env';
import {
  Bitrix24AddResponse,
  Bitrix24ContactPayload,
  Bitrix24ErrorResponse,
} from '../types/bitrix24.types';
import { NormalizedContact } from '../types/common.types';
import { logger } from '../utils/logger';

export class Bitrix24Error extends Error {
  public readonly statusCode: number;
  public readonly errorCode?: string;
  public readonly details?: unknown;

  constructor(message: string, statusCode: number = 502, errorCode?: string, details?: unknown) {
    super(message);
    this.name = 'Bitrix24Error';
    this.statusCode = statusCode;
    this.errorCode = errorCode;
    this.details = details;
    Object.setPrototypeOf(this, Bitrix24Error.prototype);
  }
}

export class Bitrix24Service {
  private client: AxiosInstance;
  private webhookBaseUrl: string;

  constructor(webhookBaseUrl: string = config.BITRIX24_WEBHOOK_URL, client?: AxiosInstance) {
    this.webhookBaseUrl = webhookBaseUrl.endsWith('/') ? webhookBaseUrl : `${webhookBaseUrl}/`;
    this.client =
      client ||
      axios.create({
        timeout: config.REQUEST_TIMEOUT_MS,
        headers: {
          'Content-Type': 'application/json; charset=utf-8',
        },
      });
  }

  /**
   * Builds the Bitrix24 crm.contact.add REST payload.
   */
  public buildContactPayload(contact: NormalizedContact): Bitrix24ContactPayload {
    const fields: Bitrix24ContactPayload['fields'] = {
      NAME: contact.name,
      PHONE: [{ VALUE: contact.phone, VALUE_TYPE: 'WORK' }],
      EMAIL: [{ VALUE: contact.email, VALUE_TYPE: 'WORK' }],
    };

    if (contact.lastName) {
      fields.LAST_NAME = contact.lastName;
    }

    return {
      fields,
      params: {
        REGISTER_SONET_EVENT: 'N',
      },
    };
  }

  /**
   * Normalizes the method endpoint URL to ensure trailing slash before method.
   */
  public getMethodUrl(method: string = 'crm.contact.add.json'): string {
    const cleanBase = this.webhookBaseUrl.replace(/\/+$/, '');
    const cleanMethod = method.replace(/^\/+/, '');
    return `${cleanBase}/${cleanMethod}`;
  }

  /**
   * Calls Bitrix24 REST API crm.contact.add.json to create a new CRM Contact.
   */
  public async createContact(contact: NormalizedContact): Promise<number> {
    const url = this.getMethodUrl('crm.contact.add.json');
    const payload = this.buildContactPayload(contact);
    const startTime = Date.now();

    logger.info(`[Bitrix24] Dispatching crm.contact.add to ${url}`, {
      contactName: contact.name,
      contactLastName: contact.lastName,
      email: contact.email,
      phone: contact.phone,
      submissionId: contact.submissionId,
    });

    try {
      const response = await this.client.post<Bitrix24AddResponse>(url, payload);
      const latencyMs = Date.now() - startTime;
      const contactId = response.data?.result;

      if (!contactId || typeof contactId !== 'number') {
        throw new Bitrix24Error(
          `Bitrix24 API responded with 200 OK but missing contact ID in "result": ${JSON.stringify(response.data)}`,
          502,
          'MISSING_RESULT',
          response.data
        );
      }

      logger.info(`[Bitrix24] Contact created successfully with ID ${contactId}`, {
        contactId,
        latencyMs,
        duration: response.data.time?.duration,
      });

      return contactId;
    } catch (err) {
      const latencyMs = Date.now() - startTime;

      if (err instanceof Bitrix24Error) {
        logger.error(`[Bitrix24] Logical Error: ${err.message}`, { details: err.details });
        throw err;
      }

      const axiosErr = err as AxiosError<Bitrix24ErrorResponse>;

      if (axiosErr.response) {
        const status = axiosErr.response.status;
        const errData = axiosErr.response.data;
        const errCode = errData?.error || 'BITRIX24_API_ERROR';
        const errDesc = errData?.error_description || axiosErr.message;

        logger.error(`[Bitrix24] Upstream rejected request with HTTP ${status}: ${errDesc}`, {
          status,
          errorCode: errCode,
          latencyMs,
          errorResponse: errData,
        });

        throw new Bitrix24Error(
          `Bitrix24 API error (${status}): ${errDesc}`,
          status >= 400 && status < 500 ? 502 : status,
          errCode,
          errData
        );
      }

      if (axiosErr.code === 'ECONNABORTED' || axiosErr.message.includes('timeout')) {
        logger.error(`[Bitrix24] Request timed out after ${config.REQUEST_TIMEOUT_MS}ms`, {
          code: axiosErr.code,
          latencyMs,
        });
        throw new Bitrix24Error(
          `Bitrix24 connection timed out after ${config.REQUEST_TIMEOUT_MS}ms`,
          504,
          'TIMEOUT'
        );
      }

      logger.error(`[Bitrix24] Network connection error: ${axiosErr.message}`, {
        code: axiosErr.code,
        latencyMs,
      });

      throw new Bitrix24Error(
        `Failed to reach Bitrix24 API (${axiosErr.code || 'NETWORK_ERROR'}): ${axiosErr.message}`,
        502,
        axiosErr.code || 'NETWORK_ERROR'
      );
    }
  }
}

export const bitrix24Service = new Bitrix24Service();
