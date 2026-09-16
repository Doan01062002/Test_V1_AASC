import request from 'supertest';
import { app } from '../../src/app';
import { bitrix24Service, Bitrix24Error } from '../../src/services/bitrix24Service';

describe('Webhook Controller Integration Tests', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('POST /webhook/jotform with valid JSON should return 200 and contactId', async () => {
    jest.spyOn(bitrix24Service, 'createContact').mockResolvedValue(1042);

    const payload = {
      q3_name: { first: 'Minh', last: 'Tran' },
      q4_email: 'minh.tran@example.com',
      q5_phoneNumber: '0901234567',
      submission_id: 'sub_test_1',
      formID: '262582117734055',
    };

    const response = await request(app)
      .post('/webhook/jotform')
      .send(payload)
      .set('Content-Type', 'application/json');

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data.contactId).toBe(1042);
    expect(response.body.data.normalized.name).toBe('Minh');
    expect(response.body.data.normalized.lastName).toBe('Tran');
    expect(response.body.data.normalized.email).toBe('minh.tran@example.com');
    expect(response.body.data.normalized.phone).toBe('0901234567');
  });

  it('POST /webhook/jotform with multipart/form-data containing rawRequest should succeed', async () => {
    jest.spyOn(bitrix24Service, 'createContact').mockResolvedValue(2084);

    const rawRequestString = JSON.stringify({
      q3_name: { first: 'Linh', last: 'Nguyen' },
      q4_email: 'linh.nguyen@example.com',
      q5_phoneNumber: { full: '+84988776655' },
      slug: 'submit/262582117734055',
    });

    const response = await request(app)
      .post('/webhook/jotform')
      .field('rawRequest', rawRequestString);

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data.contactId).toBe(2084);
    expect(response.body.data.normalized.name).toBe('Linh');
    expect(response.body.data.normalized.lastName).toBe('Nguyen');
    expect(response.body.data.normalized.email).toBe('linh.nguyen@example.com');
    expect(response.body.data.normalized.phone).toBe('+84988776655');
  });

  it('POST /webhook/jotform should return 400 Bad Request when validation fails', async () => {
    const invalidPayload = {
      q3_name: '', // Empty name
      q4_email: 'not-an-email', // Malformed email
      q5_phoneNumber: '123', // Too short
    };

    const response = await request(app)
      .post('/webhook/jotform')
      .send(invalidPayload);

    expect(response.status).toBe(400);
    expect(response.body.success).toBe(false);
    expect(response.body.code).toBe('VALIDATION_ERROR');
    expect(response.body.details).toHaveLength(3);
  });

  it('POST /webhook/jotform should return 502 when Bitrix24 fails without crashing server', async () => {
    jest.spyOn(bitrix24Service, 'createContact').mockRejectedValue(
      new Bitrix24Error('Bitrix24 API rejected credentials', 502, 'INVALID_CREDENTIALS')
    );

    const validPayload = {
      q3_name: 'Test Name',
      q4_email: 'test@example.com',
      q5_phoneNumber: '0901234567',
    };

    const response = await request(app)
      .post('/webhook/jotform')
      .send(validPayload);

    expect(response.status).toBe(502);
    expect(response.body.success).toBe(false);
    expect(response.body.code).toBe('INVALID_CREDENTIALS');
  });

  it('POST /webhook/jotform with malformed JSON body should return 400 MALFORMED_JSON', async () => {
    const response = await request(app)
      .post('/webhook/jotform')
      .set('Content-Type', 'application/json')
      .send('{"invalid_json": true, missing_brace');

    expect(response.status).toBe(400);
    expect(response.body.success).toBe(false);
    expect(response.body.code).toBe('MALFORMED_JSON');
  });

  it('POST /webhook/jotform should return 500 when an unexpected non-Bitrix error occurs', async () => {
    jest.spyOn(bitrix24Service, 'createContact').mockRejectedValue(new Error('Unexpected disk failure'));

    const response = await request(app)
      .post('/webhook/jotform')
      .send({
        q3_name: 'Crash Test',
        q4_email: 'crash@test.com',
        q5_phoneNumber: '0901234567',
      });

    expect(response.status).toBe(500);
    expect(response.body.success).toBe(false);
    expect(response.body.code).toBe('INTERNAL_ERROR');
  });

  it('POST /sync/jotform should fetch submissions and trigger Bitrix24 creation', async () => {
    const { jotformService } = require('../../src/services/jotformService');
    jest.spyOn(jotformService, 'getNormalizedSubmissions').mockResolvedValue([
      {
        name: 'Sync User',
        email: 'sync@example.com',
        phone: '0901234567',
        submissionId: 'sync_1',
      },
      {
        name: '',
        email: 'bad',
        phone: '1',
        submissionId: 'sync_2',
      },
    ]);
    jest.spyOn(bitrix24Service, 'createContact').mockResolvedValue(9999);

    const response = await request(app).post('/sync/jotform');
    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data.total).toBe(2);
    expect(response.body.data.results[0].contactId).toBe(9999);
    expect(response.body.data.results[1].error).toContain('Validation failed');
  });

  it('POST /sync/jotform should return 502 when Jotform service fails', async () => {
    const { jotformService } = require('../../src/services/jotformService');
    jest.spyOn(jotformService, 'getNormalizedSubmissions').mockRejectedValue(new Error('Jotform API down'));

    const response = await request(app).post('/sync/jotform');
    expect(response.status).toBe(502);
    expect(response.body.success).toBe(false);
  });

  it('POST /webhook/jotform should return 400 Bad Request (not 500) when rawRequest has numeric name and invalid email', async () => {
    const payload = {
      rawRequest: JSON.stringify({
        q3_name: { first: 123, last: 456 },
        q4_email: 'not-an-email',
        q5_phoneNumber: '0901234567',
      }),
    };

    const response = await request(app)
      .post('/webhook/jotform')
      .send(payload)
      .set('Content-Type', 'application/json');

    expect(response.status).toBe(400);
    expect(response.body.success).toBe(false);
    expect(response.body.code).toBe('VALIDATION_ERROR');
    expect(response.body.details).toEqual(
      expect.arrayContaining([expect.stringContaining('Invalid email format')])
    );
  });

  it('POST /webhook/jotform should return 400 Bad Request (not 500) when rawRequest contains numeric email in compound object', async () => {
    const payload = {
      rawRequest: JSON.stringify({
        q3_name: { first: 'Nguyen', last: 'An' },
        q4_email: { email: 12345 },
        q5_phoneNumber: '0901234567',
      }),
    };

    const response = await request(app)
      .post('/webhook/jotform')
      .send(payload);

    expect(response.status).toBe(400);
    expect(response.body.success).toBe(false);
    expect(response.body.code).toBe('VALIDATION_ERROR');
    expect(response.body.details).toContain(
      'Invalid email format according to RFC 5322: "12345"'
    );
  });

  it('POST /webhook/jotform should return 400 Bad Request (not 500) when phone contains invalid numeric subfield', async () => {
    const payload = {
      rawRequest: JSON.stringify({
        q3_name: 'Tran B',
        q4_email: 'tran.b@example.com',
        q5_phoneNumber: { full: 999 }, // 3 digits only, invalid
      }),
    };

    const response = await request(app)
      .post('/webhook/jotform')
      .send(payload);

    expect(response.status).toBe(400);
    expect(response.body.success).toBe(false);
    expect(response.body.code).toBe('VALIDATION_ERROR');
    expect(response.body.details[0]).toContain('Invalid phone number format');
  });

  it('POST /webhook/jotform should return 400 Bad Request (not 500) when email contains consecutive dots', async () => {
    const payload = {
      q3_name: { first: 'Minh', last: 'Tran' },
      q4_email: 'user..name@example.com',
      q5_phoneNumber: '0901234567',
    };

    const response = await request(app)
      .post('/webhook/jotform')
      .send(payload);

    expect(response.status).toBe(400);
    expect(response.body.success).toBe(false);
    expect(response.body.code).toBe('VALIDATION_ERROR');
    expect(response.body.details).toContain(
      'Invalid email format according to RFC 5322: "user..name@example.com"'
    );
  });

  it('POST /webhook/jotform should return 400 Bad Request (not 500) when email contains leading dot', async () => {
    const payload = {
      rawRequest: JSON.stringify({
        q3_name: 'Alice',
        q4_email: '.alice@example.com',
        q5_phoneNumber: '0901234567',
      }),
    };

    const response = await request(app)
      .post('/webhook/jotform')
      .send(payload);

    expect(response.status).toBe(400);
    expect(response.body.success).toBe(false);
    expect(response.body.code).toBe('VALIDATION_ERROR');
    expect(response.body.details[0]).toContain('Invalid email format according to RFC 5322');
  });

  it('POST /webhook/jotform should return 400 Bad Request (not 500) when compound object has deeply nested objects', async () => {
    const payload = {
      rawRequest: JSON.stringify({
        q3_name: { first: { sub: 'nested' }, last: 'Doe' },
        q4_email: { email: { obj: true } },
        q5_phoneNumber: { full: { sub: 'invalid' } },
      }),
    };

    const response = await request(app)
      .post('/webhook/jotform')
      .send(payload);

    expect(response.status).toBe(400);
    expect(response.body.success).toBe(false);
    expect(response.body.code).toBe('VALIDATION_ERROR');
  });

  it('POST /webhook/jotform should succeed with 200 when rawRequest has valid numeric phone literal', async () => {
    jest.spyOn(bitrix24Service, 'createContact').mockResolvedValue(5555);

    const payload = {
      rawRequest: JSON.stringify({
        q3_name: { first: 'John', last: 'Doe' },
        q4_email: 'john.doe@example.com',
        q5_phoneNumber: { full: 901234567 }, // Numeric literal, normalized to '901234567' (9 valid digits)
      }),
    };

    const response = await request(app)
      .post('/webhook/jotform')
      .send(payload);

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data.contactId).toBe(5555);
    expect(response.body.data.normalized.phone).toBe('901234567');
  });
});

