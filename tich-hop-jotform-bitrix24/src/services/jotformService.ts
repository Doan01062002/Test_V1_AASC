import axios, { AxiosError, AxiosInstance } from 'axios';
import { config } from '../config/env';
import {
  JotformSubmissionItem,
  JotformSubmissionsApiResponse,
} from '../types/jotform.types';
import { NormalizedContact } from '../types/common.types';
import { createResilientHttpsAgent } from '../utils/dnsResolver';
import { logger } from '../utils/logger';
import { normalizeJotformSubmission } from './normalizer';

export class JotformError extends Error {
  public readonly statusCode: number;
  public readonly responseCode?: number;
  public readonly details?: unknown;

  constructor(message: string, statusCode: number = 502, responseCode?: number, details?: unknown) {
    super(message);
    this.name = 'JotformError';
    this.statusCode = statusCode;
    this.responseCode = responseCode;
    this.details = details;
    Object.setPrototypeOf(this, JotformError.prototype);
  }
}

export class JotformService {
  private client: AxiosInstance;
  private defaultFormId: string;
  private apiKey: string;

  constructor(
    apiKey: string = config.JOTFORM_API_KEY,
    defaultFormId: string = config.JOTFORM_FORM_ID,
    client?: AxiosInstance
  ) {
    this.apiKey = apiKey;
    this.defaultFormId = defaultFormId;
    this.client =
      client ||
      axios.create({
        baseURL: 'https://api.jotform.com',
        timeout: config.REQUEST_TIMEOUT_MS,
        httpsAgent: createResilientHttpsAgent(),
      });
  }

  /**
   * Fetches raw submission list from Jotform REST API for a specific form.
   */
  public async getRawSubmissions(
    formId: string = this.defaultFormId,
    apiKey: string = this.apiKey
  ): Promise<JotformSubmissionItem[]> {
    if (!apiKey) {
      logger.warn('[Jotform] JOTFORM_API_KEY is not configured; API sync will likely fail with 401');
    }

    const endpoint = `/form/${formId}/submissions`;
    const headers: Record<string, string> = {};
    if (apiKey) {
      headers['APIKEY'] = apiKey;
    }

    logger.info(`[Jotform] Querying submissions for form ${formId} via Jotform API`, {
      endpoint,
      hasApiKey: Boolean(apiKey),
    });

    try {
      const response = await this.client.get<JotformSubmissionsApiResponse>(endpoint, {
        headers,
        params: {
          apiKey: apiKey || undefined,
        },
      });

      if (response.data.responseCode !== 200) {
        throw new JotformError(
          `Jotform API returned responseCode ${response.data.responseCode}: ${response.data.message}`,
          response.data.responseCode === 401 ? 401 : 502,
          response.data.responseCode,
          response.data
        );
      }

      const submissions = response.data.content || [];
      logger.info(`[Jotform] Successfully fetched ${submissions.length} submissions for form ${formId}`);
      return submissions;
    } catch (err) {
      if (err instanceof JotformError) {
        logger.error(`[Jotform] Logical error: ${err.message}`, { details: err.details });
        throw err;
      }

      const axiosErr = err as AxiosError<any>;

      if (axiosErr.response) {
        const status = axiosErr.response.status;
        const msg = axiosErr.response.data?.message || axiosErr.message;
        logger.error(`[Jotform] Upstream API error ${status}: ${msg}`, {
          status,
          responseData: axiosErr.response.data,
        });
        throw new JotformError(
          `Jotform API error (${status}): ${msg}`,
          status,
          axiosErr.response.data?.responseCode || status,
          axiosErr.response.data
        );
      }

      if (axiosErr.code === 'ECONNABORTED' || axiosErr.message.includes('timeout')) {
        logger.error(`[Jotform] Request timed out after ${config.REQUEST_TIMEOUT_MS}ms`);
        throw new JotformError(
          `Jotform connection timed out after ${config.REQUEST_TIMEOUT_MS}ms`,
          504
        );
      }

      logger.error(`[Jotform] Network error: ${axiosErr.message}`, { code: axiosErr.code });
      throw new JotformError(
        `Failed to connect to Jotform API (${axiosErr.code || 'NETWORK_ERROR'}): ${axiosErr.message}`,
        502
      );
    }
  }

  /**
   * Fetches submissions and maps them into normalized contact records.
   */
  public async getNormalizedSubmissions(
    formId: string = this.defaultFormId,
    apiKey: string = this.apiKey
  ): Promise<NormalizedContact[]> {
    const rawList = await this.getRawSubmissions(formId, apiKey);
    return rawList.map(normalizeJotformSubmission);
  }
}

export const jotformService = new JotformService();
