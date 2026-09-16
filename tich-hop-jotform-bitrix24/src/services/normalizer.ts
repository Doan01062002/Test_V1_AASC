import {
  JotformEmailField,
  JotformNameField,
  JotformPhoneField,
  JotformSubmissionItem,
  JotformWebhookPayload,
} from '../types/jotform.types';
import { NormalizedContact } from '../types/common.types';
import { logger } from '../utils/logger';

/**
 * Safely coerces any value into a clean, trimmed string.
 * Defensively handles non-string primitives (numbers, booleans, bigints),
 * null/undefined, symbols, functions, and nested objects without throwing TypeErrors.
 */
export function toSafeString(val: unknown): string {
  if (val == null) {
    return '';
  }
  if (typeof val === 'string') {
    return val.trim();
  }
  if (typeof val === 'number' || typeof val === 'bigint') {
    return !Number.isFinite(val) && typeof val === 'number' ? '' : String(val).trim();
  }
  if (typeof val === 'boolean') {
    return String(val).trim();
  }
  if (typeof val === 'object') {
    try {
      const str = String(val);
      return str === '[object Object]' ? '' : str.trim();
    } catch {
      return '';
    }
  }
  return '';
}

/**
 * Normalizes name from either compound object ({ first, last }) or flat string.
 */
export function extractName(
  field?: JotformNameField
): { name: string; lastName?: string } {
  if (field == null || field === '') {
    return { name: '' };
  }

  if (typeof field === 'object' && field !== null) {
    const compound = field as Record<string, unknown>;
    const first = toSafeString(compound.first);
    const last = toSafeString(compound.last);

    if (first && last) {
      return { name: first, lastName: last };
    }
    if (first) {
      return { name: first };
    }
    if (last) {
      return { name: last };
    }

    // Fallback: If compound object lacks first/last, check full, name, value, or text
    const fallback = toSafeString(
      compound.name ?? compound.full ?? compound.value ?? compound.text
    );
    if (fallback) {
      return { name: fallback };
    }

    return { name: '' };
  }

  return { name: toSafeString(field) };
}

/**
 * Normalizes email by trimming and converting to lowercase.
 */
export function extractEmail(field?: JotformEmailField): string {
  if (field == null || field === '') {
    return '';
  }

  if (typeof field === 'object' && field !== null) {
    const compound = field as Record<string, unknown>;
    return toSafeString(compound.email).toLowerCase();
  }

  return toSafeString(field).toLowerCase();
}

/**
 * Normalizes phone number from string or compound object.
 * Sanitizes formatting characters (spaces, dashes, parens) while preserving international '+' prefix.
 */
export function extractPhone(field?: JotformPhoneField): string {
  if (field == null || field === '') {
    return '';
  }

  let rawPhone = '';

  if (typeof field === 'object' && field !== null) {
    const compound = field as Record<string, unknown>;
    if (compound.full != null) {
      rawPhone = toSafeString(compound.full);
    } else {
      const parts = [
        toSafeString(compound.code),
        toSafeString(compound.area),
        toSafeString(compound.phone),
      ].filter(Boolean);
      rawPhone = parts.join('');
    }
  } else {
    rawPhone = toSafeString(field);
  }

  const trimmed = rawPhone.trim();
  if (!trimmed) {
    return '';
  }

  const hasLeadingPlus = trimmed.startsWith('+');
  const digits = trimmed.replace(/\D/g, '');

  if (!digits) {
    return '';
  }

  return hasLeadingPlus ? `+${digits}` : digits;
}

/**
 * Safely parses rawRequest JSON string if present.
 */
function parseRawRequest(rawRequest: unknown): Record<string, unknown> | null {
  if (!rawRequest) return null;
  if (typeof rawRequest === 'object' && rawRequest !== null && !Array.isArray(rawRequest)) {
    return rawRequest as Record<string, unknown>;
  }
  if (typeof rawRequest === 'string') {
    try {
      const parsed = JSON.parse(rawRequest);
      if (typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)) {
        return parsed as Record<string, unknown>;
      }
      return null;
    } catch (err) {
      logger.warn(`Failed to parse rawRequest JSON: ${(err as Error).message}`, {
        rawRequestPreview: rawRequest.slice(0, 100),
      });
      return null;
    }
  }
  return null;
}

/**
 * Normalizes Jotform Webhook payload into internal NormalizedContact format.
 * Polymorphic: handles rawRequest JSON, direct q3/q4/q5 keys, and fallback field names.
 */
export function normalizeWebhookPayload(body: JotformWebhookPayload): NormalizedContact {
  const parsedRaw = parseRawRequest(body?.rawRequest);

  // Merge rawRequest fields with top-level fields (top-level taking priority)
  const merged: Record<string, any> = {
    ...(parsedRaw || {}),
    ...(body || {}),
  };

  // 1. Extract Name (q3_name, name, fullName)
  const nameField =
    merged.q3_name ??
    merged.name ??
    merged.fullName ??
    merged.q3_fullName;
  const { name, lastName } = extractName(nameField);

  // 2. Extract Email (q4_email, email)
  const emailField = merged.q4_email ?? merged.email ?? merged.q4_emailAddress;
  const email = extractEmail(emailField);

  // 3. Extract Phone (q5_phoneNumber, phoneNumber, phone)
  const phoneField =
    merged.q5_phoneNumber ??
    merged.phoneNumber ??
    merged.phone ??
    merged.q5_phone;
  const phone = extractPhone(phoneField);

  // 4. Metadata
  const submissionId =
    merged.submission_id ??
    merged.submissionID ??
    merged.id ??
    merged.slug;
  const formId = merged.formID ?? merged.form_id ?? merged.formId;

  const safeSubId = toSafeString(submissionId);
  const safeFormId = toSafeString(formId);

  return {
    name,
    ...(lastName ? { lastName } : {}),
    email,
    phone,
    ...(safeSubId ? { submissionId: safeSubId } : {}),
    ...(safeFormId ? { formId: safeFormId } : {}),
  };
}

/**
 * Normalizes submission item received from Jotform REST API (/form/{formId}/submissions).
 */
export function normalizeJotformSubmission(submission: JotformSubmissionItem): NormalizedContact {
  const answers = submission?.answers || {};

  // Question 3: Full Name / Name
  const q3 = answers['3']?.answer;
  const { name, lastName } = extractName(q3);

  // Question 4: Email
  const q4 = answers['4']?.answer;
  const email = extractEmail(q4);

  // Question 5: Phone Number
  const q5 = answers['5']?.answer;
  const phone = extractPhone(q5);

  const safeSubId = toSafeString(submission?.id);
  const safeFormId = toSafeString(submission?.form_id);

  return {
    name,
    ...(lastName ? { lastName } : {}),
    email,
    phone,
    ...(safeSubId ? { submissionId: safeSubId } : {}),
    ...(safeFormId ? { formId: safeFormId } : {}),
  };
}
