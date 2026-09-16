import {
  extractEmail,
  extractName,
  extractPhone,
  normalizeJotformSubmission,
  normalizeWebhookPayload,
} from '../../src/services/normalizer';
import { JotformSubmissionItem } from '../../src/types/jotform.types';

describe('Normalizer Service Unit Tests', () => {
  describe('extractName', () => {
    it('should extract first and last name from compound object', () => {
      const result = extractName({ first: 'John', last: 'Doe' });
      expect(result).toEqual({ name: 'John', lastName: 'Doe' });
    });

    it('should extract first name only when last name is missing', () => {
      const result = extractName({ first: 'Jane' });
      expect(result).toEqual({ name: 'Jane' });
    });

    it('should extract last name only when first name is missing', () => {
      const result = extractName({ last: 'Smith' });
      expect(result).toEqual({ name: 'Smith' });
    });

    it('should extract full string directly and preserve Vietnamese diacritics', () => {
      const result = extractName('Nguyễn Văn An');
      expect(result).toEqual({ name: 'Nguyễn Văn An' });
    });

    it('should handle single word name', () => {
      const result = extractName('Plato');
      expect(result).toEqual({ name: 'Plato' });
    });

    it('should return empty string for undefined or null', () => {
      expect(extractName(undefined)).toEqual({ name: '' });
      expect(extractName(null as any)).toEqual({ name: '' });
    });

    it('should safely coerce numeric first and last name properties to strings', () => {
      const result = extractName({ first: 123 as any, last: 456 as any });
      expect(result).toEqual({ name: '123', lastName: '456' });
    });

    it('should safely handle numeric first name only and numeric last name only', () => {
      expect(extractName({ first: 789 as any })).toEqual({ name: '789' });
      expect(extractName({ last: 999 as any })).toEqual({ name: '999' });
    });

    it('should safely handle nested object in first or last name without throwing TypeError', () => {
      expect(() => extractName({ first: { inner: 'value' } as any, last: 'Doe' })).not.toThrow();
      const result = extractName({ first: { inner: 'value' } as any, last: 'Doe' });
      expect(typeof result.name).toBe('string');
      expect(result.name).toBe('Doe');
    });

    it('should safely handle direct numeric and boolean input without throwing', () => {
      expect(extractName(12345 as any)).toEqual({ name: '12345' });
      expect(extractName(true as any)).toEqual({ name: 'true' });
      expect(extractName(false as any)).toEqual({ name: 'false' });
    });
  });

  describe('extractEmail', () => {
    it('should trim and lowercase standard email string', () => {
      expect(extractEmail('  John.Doe@Example.COM  ')).toBe('john.doe@example.com');
    });

    it('should extract email from compound object', () => {
      expect(extractEmail({ email: 'USER@DOMAIN.ORG' })).toBe('user@domain.org');
    });

    it('should return empty string for null or undefined', () => {
      expect(extractEmail(undefined)).toBe('');
      expect(extractEmail(null as any)).toBe('');
    });

    it('should safely coerce numeric email in compound object without throwing TypeError', () => {
      const result = extractEmail({ email: 12345 as any });
      expect(result).toBe('12345');
    });

    it('should safely handle nested object in compound email without throwing TypeError', () => {
      expect(() => extractEmail({ email: { address: 'nested@example.com' } as any })).not.toThrow();
      expect(typeof extractEmail({ email: { address: 'nested@example.com' } as any })).toBe('string');
    });

    it('should safely coerce direct numeric or boolean email values to string', () => {
      expect(extractEmail(99999 as any)).toBe('99999');
      expect(extractEmail(true as any)).toBe('true');
    });
  });

  describe('extractPhone', () => {
    it('should sanitize formatted phone string preserving leading +', () => {
      expect(extractPhone('+84 (090) 123-4567')).toBe('+840901234567');
      expect(extractPhone('090-123-4567')).toBe('0901234567');
    });

    it('should extract phone from compound object with "full" property', () => {
      expect(extractPhone({ full: '+84 901 234 567' })).toBe('+84901234567');
    });

    it('should assemble phone from code, area, and phone subfields', () => {
      const result = extractPhone({ code: '+84', area: '90', phone: '1234567' });
      expect(result).toBe('+84901234567');
    });

    it('should return empty string when no digits are present', () => {
      expect(extractPhone('no-digits-here')).toBe('');
      expect(extractPhone(undefined)).toBe('');
    });

    it('should safely coerce numeric "full" property in compound phone object without throwing TypeError', () => {
      const result = extractPhone({ full: 901234567 as any });
      expect(result).toBe('901234567');
    });

    it('should safely assemble phone from numeric code, area, and phone subfields', () => {
      const result = extractPhone({ code: 84 as any, area: 90 as any, phone: 1234567 as any });
      expect(result).toBe('84901234567');
    });

    it('should safely handle direct numeric phone without throwing', () => {
      expect(extractPhone(901234567 as any)).toBe('901234567');
    });

    it('should safely handle nested object or array in phone field without throwing', () => {
      expect(() => extractPhone({ full: { number: '0901234567' } as any })).not.toThrow();
      expect(() => extractPhone({ full: ['0901234567'] as any })).not.toThrow();
    });
  });

  describe('normalizeWebhookPayload', () => {
    it('should extract fields from standard Jotform JSON keys (q3, q4, q5)', () => {
      const payload = {
        q3_name: { first: 'Minh', last: 'Tran' },
        q4_email: 'minh.tran@example.com',
        q5_phoneNumber: '0901234567',
        submission_id: 'sub_12345',
        formID: '262582117734055',
      };

      const normalized = normalizeWebhookPayload(payload);
      expect(normalized.name).toBe('Minh');
      expect(normalized.lastName).toBe('Tran');
      expect(normalized.email).toBe('minh.tran@example.com');
      expect(normalized.phone).toBe('0901234567');
      expect(normalized.submissionId).toBe('sub_12345');
      expect(normalized.formId).toBe('262582117734055');
    });

    it('should extract fields from rawRequest JSON string', () => {
      const payload = {
        rawRequest: JSON.stringify({
          q3_name: { first: 'Alice', last: 'Wonder' },
          q4_email: 'alice@example.com',
          q5_phoneNumber: { full: '+84987654321' },
          slug: 'submit/262582117734055',
        }),
      };

      const normalized = normalizeWebhookPayload(payload);
      expect(normalized.name).toBe('Alice');
      expect(normalized.lastName).toBe('Wonder');
      expect(normalized.email).toBe('alice@example.com');
      expect(normalized.phone).toBe('+84987654321');
    });

    it('should support fallback generic fields (name, email, phone)', () => {
      const payload = {
        name: 'Bob Martin',
        email: 'bob@unclebob.org',
        phone: '0912345678',
      };

      const normalized = normalizeWebhookPayload(payload);
      expect(normalized.name).toBe('Bob Martin');
      expect(normalized.email).toBe('bob@unclebob.org');
      expect(normalized.phone).toBe('0912345678');
    });

    it('should gracefully handle malformed rawRequest JSON and fallback to top-level fields', () => {
      const payload = {
        rawRequest: '{malformed_json: true, missing_quotes}',
        q3_name: 'Fallback Name',
        q4_email: 'fallback@example.com',
        q5_phoneNumber: '0909999999',
      };

      const normalized = normalizeWebhookPayload(payload);
      expect(normalized.name).toBe('Fallback Name');
      expect(normalized.email).toBe('fallback@example.com');
      expect(normalized.phone).toBe('0909999999');
    });

    it('should normalize rawRequest with numeric compound values without throwing TypeError', () => {
      const payload = {
        rawRequest: JSON.stringify({
          q3_name: { first: 123, last: 456 },
          q4_email: { email: 99999 },
          q5_phoneNumber: { full: 901234567 },
        }),
      };
      const normalized = normalizeWebhookPayload(payload);
      expect(normalized.name).toBe('123');
      expect(normalized.lastName).toBe('456');
      expect(normalized.email).toBe('99999');
      expect(normalized.phone).toBe('901234567');
    });

    it('should normalize top-level numeric compound values safely', () => {
      const payload = {
        q3_name: { first: 100, last: 200 } as any,
        q4_email: { email: 12345 } as any,
        q5_phoneNumber: { full: 987654321 } as any,
      };
      const normalized = normalizeWebhookPayload(payload);
      expect(normalized.name).toBe('100');
      expect(normalized.lastName).toBe('200');
      expect(normalized.email).toBe('12345');
      expect(normalized.phone).toBe('987654321');
    });

    it('should safely process nested object values in compound fields without crashing', () => {
      const payload = {
        rawRequest: JSON.stringify({
          q3_name: { first: { sub: 'nested' }, last: 'Doe' },
          q4_email: { email: { sub: 'bad' } },
          q5_phoneNumber: { full: { sub: 'invalid' } },
        }),
      };
      expect(() => normalizeWebhookPayload(payload)).not.toThrow();
      const normalized = normalizeWebhookPayload(payload);
      expect(typeof normalized.name).toBe('string');
      expect(typeof normalized.email).toBe('string');
      expect(typeof normalized.phone).toBe('string');
    });
  });

  describe('normalizeJotformSubmission', () => {
    it('should correctly normalize submissions fetched from Jotform API', () => {
      const mockSubmission: JotformSubmissionItem = {
        id: 'api_sub_999',
        form_id: '262582117734055',
        created_at: '2026-09-16 10:00:00',
        status: 'ACTIVE',
        answers: {
          '3': {
            name: 'name',
            order: '1',
            text: 'Họ và tên',
            type: 'control_fullname',
            answer: { first: 'Nam', last: 'Le' },
          },
          '4': {
            name: 'email',
            order: '2',
            text: 'Email',
            type: 'control_email',
            answer: 'nam.le@company.vn',
          },
          '5': {
            name: 'phone',
            order: '3',
            text: 'Số điện thoại',
            type: 'control_phone',
            answer: { full: '+84933221100' },
          },
        },
      };

      const normalized = normalizeJotformSubmission(mockSubmission);
      expect(normalized.name).toBe('Nam');
      expect(normalized.lastName).toBe('Le');
      expect(normalized.email).toBe('nam.le@company.vn');
      expect(normalized.phone).toBe('+84933221100');
      expect(normalized.submissionId).toBe('api_sub_999');
      expect(normalized.formId).toBe('262582117734055');
    });
  });
});
