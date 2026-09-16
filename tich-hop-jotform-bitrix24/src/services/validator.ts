import { NormalizedContact, ValidationResult } from '../types/common.types';

export class ValidationError extends Error {
  public readonly errors: string[];
  public readonly statusCode: number = 400;

  constructor(errors: string[]) {
    super(`Validation failed: ${errors.join(', ')}`);
    this.name = 'ValidationError';
    this.errors = errors;
    Object.setPrototypeOf(this, ValidationError.prototype);
  }
}

// RFC 5322 compliant regex for email validation (strict dot-atom local-part, valid domain and TLD)
// Disallows leading dots, trailing dots, and consecutive dots in the local part per RFC 5322 Section 3.4.1
const RFC_5322_EMAIL_REGEX =
  /^[a-zA-Z0-9!#$%&'*+/=?^_`{|}~-]+(?:\.[a-zA-Z0-9!#$%&'*+/=?^_`{|}~-]+)*@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$/;

// E.164 and international phone format: optional leading '+' followed by 9 to 15 digits
const PHONE_REGEX = /^\+?[0-9]{9,15}$/;

/**
 * Validates whether a given email string matches RFC 5322 format.
 */
export function isValidEmail(email?: string): boolean {
  if (!email || typeof email !== 'string') return false;
  return RFC_5322_EMAIL_REGEX.test(email.trim());
}

/**
 * Validates whether a given phone string has 9-15 valid digits.
 */
export function isValidPhone(phone?: string): boolean {
  if (!phone || typeof phone !== 'string') return false;
  return PHONE_REGEX.test(phone);
}

/**
 * Validates whether a given name is non-empty.
 */
export function isValidName(name?: string): boolean {
  if (!name || typeof name !== 'string') return false;
  return name.trim().length >= 1;
}

/**
 * Validates a normalized contact payload.
 * Checks for non-empty name, RFC 5322 email, and valid phone number.
 */
export function validateContact(contact: NormalizedContact): ValidationResult {
  const errors: string[] = [];

  if (!isValidName(contact.name)) {
    errors.push('Name is required and must not be empty');
  }

  if (!contact.email) {
    errors.push('Email is required');
  } else if (!isValidEmail(contact.email)) {
    errors.push(`Invalid email format according to RFC 5322: "${contact.email}"`);
  }

  if (!contact.phone) {
    errors.push('Phone number is required');
  } else if (!isValidPhone(contact.phone)) {
    errors.push(
      `Invalid phone number format (must contain 9-15 digits): "${contact.phone}"`
    );
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}

/**
 * Throws a ValidationError if the contact does not pass validation.
 */
export function validateContactOrThrow(contact: NormalizedContact): void {
  const result = validateContact(contact);
  if (!result.isValid) {
    throw new ValidationError(result.errors);
  }
}
