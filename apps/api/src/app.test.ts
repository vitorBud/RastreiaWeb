import request from 'supertest';
import { describe, expect, it, vi } from 'vitest';
import { createApp } from './app.js';

const publicResolver = vi.fn(async () => [
  { address: '93.184.216.34', family: 4 },
]);

const app = createApp({ resolveHostname: publicResolver });

describe('GET /api/health', () => {
  it('informa que a API está disponível', async () => {
    const response = await request(app).get('/api/health');

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      service: 'rastreiaweb-api',
      status: 'ok',
    });
  });
});

describe('POST /api/urls/validate', () => {
  it('valida e normaliza uma URL pública', async () => {
    const response = await request(app)
      .post('/api/urls/validate')
      .send({ url: 'https://Example.com/documentacao#inicio' });

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      valid: true,
      url: {
        hostname: 'example.com',
        normalizedUrl: 'https://example.com/documentacao',
        protocol: 'https:',
      },
    });
  });

  it('rejeita um corpo sem o campo url', async () => {
    const response = await request(app)
      .post('/api/urls/validate')
      .send({});

    expect(response.status).toBe(400);
    expect(response.body).toMatchObject({
      code: 'INVALID_REQUEST',
    });
  });

  it('rejeita destinos privados identificados pelo DNS', async () => {
    const privateResolver = vi.fn(async () => [
      { address: '192.168.1.20', family: 4 },
    ]);
    const privateApp = createApp({ resolveHostname: privateResolver });

    const response = await request(privateApp)
      .post('/api/urls/validate')
      .send({ url: 'https://painel.exemplo.com.br' });

    expect(response.status).toBe(422);
    expect(response.body).toMatchObject({
      code: 'PRIVATE_ADDRESS',
      valid: false,
    });
  });
});
