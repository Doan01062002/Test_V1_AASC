import request from 'supertest';
import { app } from '../../src/app';

describe('Health & Root Integration Tests', () => {
  it('GET /health should return 200 OK with service metadata and uptime', async () => {
    const response = await request(app).get('/health');

    expect(response.status).toBe(200);
    expect(response.body.status).toBe('ok');
    expect(response.body.service).toBe('tich-hop-jotform-bitrix24');
    expect(response.body.uptime).toBeGreaterThanOrEqual(0);
    expect(response.body.timestamp).toBeDefined();
    expect(response.body.config).toBeDefined();
    expect(response.body.config.jotformFormId).toBe('262582117734055');
  });

  it('GET / should return 200 OK with API overview', async () => {
    const response = await request(app).get('/');

    expect(response.status).toBe(200);
    expect(response.body.message).toContain('Jotform & Bitrix24 CRM Integration');
    expect(response.body.docs.webhook).toBe('POST /webhook/jotform');
  });

  it('GET /undefined-route should return 404 NOT_FOUND', async () => {
    const response = await request(app).get('/undefined-route');

    expect(response.status).toBe(404);
    expect(response.body.success).toBe(false);
    expect(response.body.code).toBe('NOT_FOUND');
  });
});
