import {
  isValidEmail,
  isValidName,
  isValidPhone,
  validateContact,
  validateContactOrThrow,
  ValidationError,
} from '../../src/services/validator';
import { NormalizedContact } from '../../src/types/common.types';

describe('Validator Service Unit Tests', () => {
  describe('isValidName', () => {
    it('should return true for non-empty names', () => {
      expect(isValidName('Nguyen Van A')).toBe(true);
      expect(isValidName('John')).toBe(true);
      expect(isValidName('Đỗ Bá Phước')).toBe(true);
    });

    it('should return false for empty or whitespace-only names', () => {
      expect(isValidName('')).toBe(false);
      expect(isValidName('   ')).toBe(false);
      expect(isValidName(undefined)).toBe(false);
    });
  });

  describe('isValidEmail (RFC 5322)', () => {
    it('should accept valid email formats', () => {
      expect(isValidEmail('test@example.com')).toBe(true);
      expect(isValidEmail('user.name+tag@sub.domain.co.uk')).toBe(true);
      expect(isValidEmail('developer@bitrix24.vn')).toBe(true);
    });

    it('should reject malformed email formats', () => {
      expect(isValidEmail('plainaddress')).toBe(false);
      expect(isValidEmail('@missingusername.com')).toBe(false);
      expect(isValidEmail('username@.com')).toBe(false);
      expect(isValidEmail('username@domain')).toBe(false); // missing TLD
      expect(isValidEmail('user name@domain.com')).toBe(false); // whitespace
      expect(isValidEmail('')).toBe(false);
      expect(isValidEmail(undefined)).toBe(false);
    });

    it('should reject emails with consecutive dots in local part', () => {
      expect(isValidEmail('user..name@example.com')).toBe(false);
      expect(isValidEmail('first...last@example.com')).toBe(false);
      expect(isValidEmail('a..b@sub.domain.org')).toBe(false);
      expect(isValidEmail('user..@example.com')).toBe(false);
      expect(isValidEmail('..user@example.com')).toBe(false);
    });

    it('should reject emails with leading or trailing dots in local part', () => {
      expect(isValidEmail('.user@example.com')).toBe(false);
      expect(isValidEmail('user.@example.com')).toBe(false);
      expect(isValidEmail('.user.@example.com')).toBe(false);
      expect(isValidEmail('.@example.com')).toBe(false);
      expect(isValidEmail('..@example.com')).toBe(false);
    });

    it('should reject emails with consecutive or trailing dots in domain part', () => {
      expect(isValidEmail('user@domain..com')).toBe(false);
      expect(isValidEmail('user@.domain.com')).toBe(false);
      expect(isValidEmail('user@domain.com.')).toBe(false);
    });

    it('should reject non-email string values produced by stringified compound/numeric fields', () => {
      expect(isValidEmail('12345')).toBe(false);
      expect(isValidEmail('[object Object]')).toBe(false);
      expect(isValidEmail('true')).toBe(false);
      expect(isValidEmail('null')).toBe(false);
    });

    it('should accept valid complex RFC 5322 emails with allowed special characters and single dots', () => {
      expect(isValidEmail('user!name@domain.com')).toBe(true);
      expect(isValidEmail("user#name$tag@domain.com")).toBe(true);
      expect(isValidEmail('user-name_part@domain.co.uk')).toBe(true);
      expect(isValidEmail('user.name+filter@domain.com')).toBe(true);
      expect(isValidEmail('admin@mailserver1.domain.org')).toBe(true);
      expect(isValidEmail('x@example.com')).toBe(true);
      expect(isValidEmail('user@domain.corporate')).toBe(true);
    });

    it('should reject emails with invalid dot placement in local part (strict RFC 5322)', () => {
      expect(isValidEmail('user..name@domain.com')).toBe(false); // consecutive dots
      expect(isValidEmail('.user@domain.com')).toBe(false); // leading dot
      expect(isValidEmail('user.@domain.com')).toBe(false); // trailing dot
      expect(isValidEmail('user...name@domain.com')).toBe(false); // multiple consecutive dots
      expect(isValidEmail('.user.name.@domain.com')).toBe(false); // leading and trailing dots
      expect(isValidEmail('.@domain.com')).toBe(false); // single dot only
      expect(isValidEmail('..@domain.com')).toBe(false); // double dot only
    });
  });

  describe('isValidPhone', () => {
    it('should accept valid phone numbers with 9 to 15 digits', () => {
      expect(isValidPhone('0901234567')).toBe(true); // 10 digits
      expect(isValidPhone('+84901234567')).toBe(true); // 12 digits with +
      expect(isValidPhone('123456789')).toBe(true); // 9 digits
      expect(isValidPhone('+123456789012345')).toBe(true); // 15 digits
    });

    it('should reject invalid phone numbers', () => {
      expect(isValidPhone('12345678')).toBe(false); // 8 digits (too short)
      expect(isValidPhone('12345678901234567')).toBe(false); // 17 digits (too long)
      expect(isValidPhone('phone-number')).toBe(false); // non-digits
      expect(isValidPhone('')).toBe(false);
      expect(isValidPhone(undefined)).toBe(false);
    });
  });

  describe('validateContact', () => {
    it('should return isValid: true for a complete valid contact', () => {
      const contact: NormalizedContact = {
        name: 'Minh',
        lastName: 'Tran',
        email: 'minh.tran@example.com',
        phone: '0901234567',
      };

      const result = validateContact(contact);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should collect multiple errors when fields are missing or invalid', () => {
      const contact: NormalizedContact = {
        name: '',
        email: 'invalid-email',
        phone: '123',
      };

      const result = validateContact(contact);
      expect(result.isValid).toBe(false);
      expect(result.errors.length).toBe(3);
      expect(result.errors[0]).toContain('Name is required');
      expect(result.errors[1]).toContain('Invalid email format');
      expect(result.errors[2]).toContain('Invalid phone number format');
    });

    it('should reject contact with consecutive dots in email and return descriptive error', () => {
      const contact: NormalizedContact = {
        name: 'John Doe',
        email: 'user..name@example.com',
        phone: '0901234567',
      };

      const result = validateContact(contact);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain(
        'Invalid email format according to RFC 5322: "user..name@example.com"'
      );
    });

    it('should reject contact with leading dot in email', () => {
      const contact: NormalizedContact = {
        name: 'John Doe',
        email: '.user@example.com',
        phone: '0901234567',
      };

      const result = validateContact(contact);
      expect(result.isValid).toBe(false);
      expect(result.errors[0]).toContain('Invalid email format according to RFC 5322');
    });

    it('should reject contact with numeric or stringified malformed subfields', () => {
      const contact: NormalizedContact = {
        name: '123',
        email: '12345',
        phone: '123',
      };

      const result = validateContact(contact);
      expect(result.isValid).toBe(false);
      expect(result.errors).toEqual(
        expect.arrayContaining([
          'Invalid email format according to RFC 5322: "12345"',
          'Invalid phone number format (must contain 9-15 digits): "123"',
        ])
      );
    });

    it('should accept contact with valid sanitized phone and complex RFC 5322 email', () => {
      const contact: NormalizedContact = {
        name: 'Le Van C',
        email: 'c.le+crm@domain.vn',
        phone: '+84901234567',
      };

      const result = validateContact(contact);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });
  });

  describe('validateContactOrThrow', () => {
    it('should not throw for valid contact', () => {
      const valid: NormalizedContact = {
        name: 'Nguyen Van A',
        email: 'a@example.com',
        phone: '0901234567',
      };
      expect(() => validateContactOrThrow(valid)).not.toThrow();
    });

    it('should throw ValidationError with statusCode 400 for invalid contact', () => {
      const invalid: NormalizedContact = {
        name: '',
        email: '',
        phone: '',
      };

      try {
        validateContactOrThrow(invalid);
        fail('Should have thrown ValidationError');
      } catch (err: any) {
        expect(err).toBeInstanceOf(ValidationError);
        expect(err.statusCode).toBe(400);
        expect(err.errors.length).toBeGreaterThan(0);
      }
    });

    it('should throw ValidationError when contact email contains consecutive dots', () => {
      const contact: NormalizedContact = {
        name: 'Valid Name',
        email: 'user..name@example.com',
        phone: '0901234567',
      };
      expect(() => validateContactOrThrow(contact)).toThrow(ValidationError);
      expect(() => validateContactOrThrow(contact)).toThrow('Invalid email format according to RFC 5322');
    });

    it('should throw ValidationError when contact email contains leading dot', () => {
      const contact: NormalizedContact = {
        name: 'Valid Name',
        email: '.user@example.com',
        phone: '0901234567',
      };
      expect(() => validateContactOrThrow(contact)).toThrow(ValidationError);
    });

    it('should throw ValidationError when contact phone is invalid', () => {
      const contact: NormalizedContact = {
        name: 'Valid Name',
        email: 'user@example.com',
        phone: '123',
      };
      expect(() => validateContactOrThrow(contact)).toThrow(ValidationError);
      expect(() => validateContactOrThrow(contact)).toThrow('Invalid phone number format');
    });

    it('should throw ValidationError when contact has numeric/malformed subfield strings', () => {
      const contact: NormalizedContact = {
        name: '123',
        email: '12345',
        phone: '123',
      };
      expect(() => validateContactOrThrow(contact)).toThrow(ValidationError);
    });
  });
});
