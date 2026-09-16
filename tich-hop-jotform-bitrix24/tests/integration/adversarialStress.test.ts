import dns from 'dns';
import request from 'supertest';
import { app } from '../../src/app';
import { bitrix24Service, Bitrix24Error } from '../../src/services/bitrix24Service';
import { createResilientLookup } from '../../src/utils/dnsResolver';

describe('Adversarial & Stress Testing Suite', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('1. Webhook Endpoint Stress: Malformed JSON & Payloads', () => {
    it('should return 400 MALFORMED_JSON when JSON syntax is truncated', async () => {
      const response = await request(app)
        .post('/webhook/jotform')
        .set('Content-Type', 'application/json')
        .send('{"name": "Minh", "email": "minh@example.com"');

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.code).toBe('MALFORMED_JSON');
      expect(response.body.error).toContain('Invalid JSON payload format');
      expect(response.body.timestamp).toBeDefined();
    });

    it('should return 400 MALFORMED_JSON on invalid tokens and syntax in JSON', async () => {
      const response = await request(app)
        .post('/webhook/jotform')
        .set('Content-Type', 'application/json')
        .send('{ "q3_name": undefined, "q4_email": NaN }');

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.code).toBe('MALFORMED_JSON');
    });

    it('should return 400 MALFORMED_JSON on raw unescaped control characters in JSON', async () => {
      const response = await request(app)
        .post('/webhook/jotform')
        .set('Content-Type', 'application/json')
        .send('{\n"q3_name": "Test\x00Name"\n}');

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.code).toBe('MALFORMED_JSON');
    });
  });

  describe('2. Webhook Endpoint Stress: Empty & Boundary Payloads', () => {
    it('should return 400 VALIDATION_ERROR on empty JSON object {} without crashing', async () => {
      const response = await request(app)
        .post('/webhook/jotform')
        .set('Content-Type', 'application/json')
        .send({});

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.code).toBe('VALIDATION_ERROR');
      expect(response.body.details).toContain('Name is required and must not be empty');
      expect(response.body.details).toContain('Email is required');
      expect(response.body.details).toContain('Phone number is required');
    });

    it('should return 400 VALIDATION_ERROR on empty request body ""', async () => {
      const response = await request(app)
        .post('/webhook/jotform')
        .set('Content-Type', 'application/json')
        .send('');

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.code).toBe('VALIDATION_ERROR');
    });

    it('should return 400 VALIDATION_ERROR on whitespace-only fields', async () => {
      const response = await request(app)
        .post('/webhook/jotform')
        .send({
          q3_name: '   ',
          q4_email: '   ',
          q5_phoneNumber: '   ',
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.code).toBe('VALIDATION_ERROR');
      expect(response.body.details).toEqual(
        expect.arrayContaining([
          'Name is required and must not be empty',
          'Email is required',
          'Phone number is required',
        ])
      );
    });
  });

  describe('3. Webhook Endpoint Stress: Invalid Fields (Strict RFC Validation)', () => {
    it('should reject malformed email formats with 400 VALIDATION_ERROR', async () => {
      const malformedEmails = [
        'plainaddress',
        '#@%^%#$@#$@#.com',
        '@example.com',
        'Joe Smith <email@example.com>',
        'email.example.com',
        'email@example@example.com',
        'email@example..com',
      ];

      for (const badEmail of malformedEmails) {
        const response = await request(app)
          .post('/webhook/jotform')
          .send({
            q3_name: 'Valid Name',
            q4_email: badEmail,
            q5_phoneNumber: '0901234567',
          });

        expect(response.status).toBe(400);
        expect(response.body.success).toBe(false);
        expect(response.body.code).toBe('VALIDATION_ERROR');
        expect(response.body.details.some((msg: string) => msg.includes('RFC 5322'))).toBe(true);
      }
    });

    it('should reject invalid phone numbers (letters, too short, too long) with 400 VALIDATION_ERROR', async () => {
      const badPhones = [
        '123', // too short (<9 digits)
        'abcdefghij', // alpha
        '12345678', // 8 digits
        '+1234567890123456789', // >15 digits
        'phone-number',
      ];

      for (const badPhone of badPhones) {
        const response = await request(app)
          .post('/webhook/jotform')
          .send({
            q3_name: 'Valid Name',
            q4_email: 'valid@example.com',
            q5_phoneNumber: badPhone,
          });

        expect(response.status).toBe(400);
        expect(response.body.success).toBe(false);
        expect(response.body.code).toBe('VALIDATION_ERROR');
        expect(
          response.body.details.some((msg: string) =>
            msg.toLowerCase().includes('phone')
          )
        ).toBe(true);
      }
    });
  });

  describe('4. Webhook Endpoint Stress: Multipart/Form-Data & URL-Encoded Payloads', () => {
    it('should successfully handle valid multipart/form-data via multer', async () => {
      jest.spyOn(bitrix24Service, 'createContact').mockResolvedValue(5555);

      const response = await request(app)
        .post('/webhook/jotform')
        .field('q3_name[first]', 'Nguyen')
        .field('q3_name[last]', 'An')
        .field('q4_email', 'nguyen.an@example.com')
        .field('q5_phoneNumber', '+84987654321')
        .field('submission_id', 'sub_multipart_1');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.contactId).toBe(5555);
      expect(response.body.data.normalized.name).toBe('Nguyen');
      expect(response.body.data.normalized.lastName).toBe('An');
      expect(response.body.data.normalized.phone).toBe('+84987654321');
    });

    it('should reject multipart/form-data with missing required fields with 400', async () => {
      const response = await request(app)
        .post('/webhook/jotform')
        .field('q3_name', '')
        .field('q4_email', 'invalid-email');

      expect(response.status).toBe(400);
      expect(response.body.code).toBe('VALIDATION_ERROR');
    });

    it('should gracefully handle multipart rawRequest containing malformed JSON without crashing', async () => {
      const response = await request(app)
        .post('/webhook/jotform')
        .field('rawRequest', '{ broken-json-syntax');

      expect(response.status).toBe(400);
      expect(response.body.code).toBe('VALIDATION_ERROR');
    });

    it('should successfully handle urlencoded payloads with Vietnamese Unicode characters', async () => {
      jest.spyOn(bitrix24Service, 'createContact').mockResolvedValue(7777);

      const response = await request(app)
        .post('/webhook/jotform')
        .set('Content-Type', 'application/x-www-form-urlencoded')
        .send('q3_name=Nguy%E1%BB%85n%20V%C4%83n%20%C4%90%E1%BA%A1t&q4_email=dat.nguyen%40example.vn&q5_phoneNumber=0909123456');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.contactId).toBe(7777);
      expect(response.body.data.normalized.name).toBe('Nguyễn Văn Đạt');
      expect(response.body.data.normalized.email).toBe('dat.nguyen@example.vn');
      expect(response.body.data.normalized.phone).toBe('0909123456');
    });
  });

  describe('5. External Bitrix24 Service Error Simulation (Zero Server Crash)', () => {
    it('should return 502 when Bitrix24 responds with 401 Unauthorized', async () => {
      jest.spyOn(bitrix24Service, 'createContact').mockRejectedValue(
        new Bitrix24Error('Bitrix24 API error (401): INVALID_CREDENTIALS', 502, 'INVALID_CREDENTIALS')
      );

      const response = await request(app)
        .post('/webhook/jotform')
        .send({
          q3_name: 'Test Bitrix 401',
          q4_email: 'b24_401@example.com',
          q5_phoneNumber: '0901234567',
        });

      expect(response.status).toBe(502);
      expect(response.body.success).toBe(false);
      expect(response.body.code).toBe('INVALID_CREDENTIALS');
    });

    it('should return 500 when Bitrix24 responds with 500 Internal Server Error', async () => {
      jest.spyOn(bitrix24Service, 'createContact').mockRejectedValue(
        new Bitrix24Error('Bitrix24 API error (500): Internal server error', 500, 'BITRIX24_SERVER_ERROR')
      );

      const response = await request(app)
        .post('/webhook/jotform')
        .send({
          q3_name: 'Test Bitrix 500',
          q4_email: 'b24_500@example.com',
          q5_phoneNumber: '0901234567',
        });

      expect(response.status).toBe(500);
      expect(response.body.success).toBe(false);
      expect(response.body.code).toBe('BITRIX24_SERVER_ERROR');
    });

    it('should return 504 when Bitrix24 request times out', async () => {
      jest.spyOn(bitrix24Service, 'createContact').mockRejectedValue(
        new Bitrix24Error('Bitrix24 connection timed out after 10000ms', 504, 'TIMEOUT')
      );

      const response = await request(app)
        .post('/webhook/jotform')
        .send({
          q3_name: 'Test Bitrix Timeout',
          q4_email: 'timeout@example.com',
          q5_phoneNumber: '0901234567',
        });

      expect(response.status).toBe(504);
      expect(response.body.success).toBe(false);
      expect(response.body.code).toBe('TIMEOUT');
    });

    it('should return 502 when Bitrix24 connection is refused (ECONNREFUSED)', async () => {
      jest.spyOn(bitrix24Service, 'createContact').mockRejectedValue(
        new Bitrix24Error('Failed to reach Bitrix24 API (ECONNREFUSED)', 502, 'ECONNREFUSED')
      );

      const response = await request(app)
        .post('/webhook/jotform')
        .send({
          q3_name: 'Test Bitrix Refused',
          q4_email: 'refused@example.com',
          q5_phoneNumber: '0901234567',
        });

      expect(response.status).toBe(502);
      expect(response.body.success).toBe(false);
      expect(response.body.code).toBe('ECONNREFUSED');
    });

    it('should return 502 when Bitrix24 returns 200 OK but result is null or missing', async () => {
      jest.spyOn(bitrix24Service, 'createContact').mockRejectedValue(
        new Bitrix24Error('Bitrix24 API responded with 200 OK but missing contact ID in "result"', 502, 'MISSING_RESULT')
      );

      const response = await request(app)
        .post('/webhook/jotform')
        .send({
          q3_name: 'Test Missing Result',
          q4_email: 'missing@example.com',
          q5_phoneNumber: '0901234567',
        });

      expect(response.status).toBe(502);
      expect(response.body.success).toBe(false);
      expect(response.body.code).toBe('MISSING_RESULT');
    });
  });

  describe('6. DNS Resolver Adversarial Scenarios', () => {
    it('should bypass DNS lookup entirely for IPv6 addresses', (done) => {
      const lookup = createResilientLookup();
      lookup('::1', {}, (err, address, family) => {
        expect(err).toBeNull();
        expect(address).toBe('::1');
        expect(family).toBe(6);
        done();
      });
    });

    it('should handle system DNS timeout/SERVFAIL by falling back to custom DNS', (done) => {
      jest.spyOn(dns, 'lookup').mockImplementation(((
        hostname: string,
        options: any,
        callback: (err: any) => void
      ) => {
        const servFail = new Error('getaddrinfo ESERVFAIL') as any;
        servFail.code = 'ESERVFAIL';
        callback(servFail);
      }) as any);

      jest.spyOn(dns.Resolver.prototype, 'resolve4').mockImplementation((hostname: string, callback: any) => {
        callback(null, ['1.2.3.4']);
      });

      const lookup = createResilientLookup(['8.8.8.8', '1.1.1.1']);
      lookup('api.jotform.com', {}, (err, address, family) => {
        expect(err).toBeNull();
        expect(address).toBe('1.2.3.4');
        expect(family).toBe(4);
        done();
      });
    });

    it('should safely return error callback when both system DNS and custom DNS fail', (done) => {
      jest.spyOn(dns, 'lookup').mockImplementation(((
        hostname: string,
        options: any,
        callback: (err: any) => void
      ) => {
        const sysErr = new Error('getaddrinfo ENOTFOUND') as any;
        sysErr.code = 'ENOTFOUND';
        callback(sysErr);
      }) as any);

      jest.spyOn(dns.Resolver.prototype, 'resolve4').mockImplementation((hostname: string, callback: any) => {
        const customErr = new Error('queryA ENODATA') as any;
        customErr.code = 'ENODATA';
        callback(customErr, []);
      });

      const lookup = createResilientLookup(['8.8.8.8']);
      lookup('unresolvable.domain.internal', {}, (err, address) => {
        expect(err).toBeDefined();
        expect(address).toBe('');
        done();
      });
    });
  });

  describe('7. Robustness: Unexpected Error Boundary Handling', () => {
    it('should catch unhandled thrown errors in webhook route and respond with 500 without process termination', async () => {
      jest.spyOn(bitrix24Service, 'createContact').mockImplementation(() => {
        throw new Error('Fatal simulated out-of-memory or null reference');
      });

      const response = await request(app)
        .post('/webhook/jotform')
        .send({
          q3_name: 'Crash Proof',
          q4_email: 'crashproof@example.com',
          q5_phoneNumber: '0901234567',
        });

      expect(response.status).toBe(500);
      expect(response.body.success).toBe(false);
      expect(response.body.code).toBe('INTERNAL_ERROR');
      expect(response.body.timestamp).toBeDefined();
    });

    it('should handle type anomaly payloads (e.g. numeric subfields) without server crash', async () => {
      const response = await request(app)
        .post('/webhook/jotform')
        .send({
          q3_name: { first: 12345, last: 67890 },
          q4_email: 99999,
          q5_phoneNumber: true,
        });

      // Server catches error and returns either 400 or 500, but NEVER crashes or terminates
      expect([400, 500]).toContain(response.status);
      expect(response.body.success).toBe(false);
      expect(response.body.timestamp).toBeDefined();
    });

    it('should resist prototype pollution attempts', async () => {
      jest.spyOn(bitrix24Service, 'createContact').mockResolvedValue(8888);

      const response = await request(app)
        .post('/webhook/jotform')
        .send(JSON.parse('{"__proto__": {"isAdmin": true}, "q3_name": "Anti Hacker", "q4_email": "safe@test.com", "q5_phoneNumber": "0901234567"}'));

      expect(response.status).toBe(200);
      expect(({} as any).isAdmin).toBeUndefined();
    });

    it('should survive 30 concurrent mixed requests without dropping or crashing', async () => {
      jest.spyOn(bitrix24Service, 'createContact').mockResolvedValue(9999);

      const requests = Array.from({ length: 30 }).map((_, idx) => {
        if (idx % 3 === 0) {
          // Valid request
          return request(app)
            .post('/webhook/jotform')
            .send({
              q3_name: `User ${idx}`,
              q4_email: `user${idx}@example.com`,
              q5_phoneNumber: '0901234567',
            });
        } else if (idx % 3 === 1) {
          // Malformed JSON string
          return request(app)
            .post('/webhook/jotform')
            .set('Content-Type', 'application/json')
            .send('{"truncated": true');
        } else {
          // Empty payload
          return request(app)
            .post('/webhook/jotform')
            .send({});
        }
      });

      const responses = await Promise.all(requests);
      expect(responses).toHaveLength(30);
      for (let i = 0; i < responses.length; i++) {
        if (i % 3 === 0) {
          expect(responses[i].status).toBe(200);
        } else if (i % 3 === 1) {
          expect(responses[i].status).toBe(400);
          expect(responses[i].body.code).toBe('MALFORMED_JSON');
        } else {
          expect(responses[i].status).toBe(400);
          expect(responses[i].body.code).toBe('VALIDATION_ERROR');
        }
      }
    });
  });
});
