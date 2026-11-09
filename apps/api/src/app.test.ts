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

describe('POST /api/audits', () => {
  it('devolve o relatório produzido pelo motor de auditoria', async () => {
    const report = {
      analyzedAt: '2026-11-09T12:00:00.000Z',
      disclaimer: 'Análise automática.',
      durationMs: 420,
      finalUrl: 'https://example.com/',
      initialUrl: 'https://example.com',
      issues: [],
      limits: { maxLinks: 20, maxResources: 20 },
      pageTitle: 'Example Domain',
      summary: {
        brokenLinks: 0,
        failedResources: 0,
        imagesFound: 0,
        imagesWithoutAlt: 0,
        linksChecked: 1,
        linksFound: 1,
        redirects: 0,
        resourcesChecked: 0,
        totalIssues: 0,
      },
    };
    const auditPage = vi.fn(async () => report);
    const auditApp = createApp({ auditPage });

    const response = await request(auditApp)
      .post('/api/audits')
      .send({ url: 'https://example.com' });

    expect(response.status).toBe(200);
    expect(response.body).toEqual(report);
    expect(auditPage).toHaveBeenCalledWith('https://example.com', undefined);
  });

  it('encaminha limites personalizados para o motor', async () => {
    const auditPage = vi.fn(async () => ({
      analyzedAt: '2026-11-09T12:00:00.000Z',
      disclaimer: 'Análise automática.',
      durationMs: 100,
      finalUrl: 'https://example.com/',
      initialUrl: 'https://example.com',
      issues: [],
      limits: { maxLinks: 10, maxResources: 8 },
      pageTitle: 'Example Domain',
      summary: {
        brokenLinks: 0,
        failedResources: 0,
        imagesFound: 0,
        imagesWithoutAlt: 0,
        linksChecked: 0,
        linksFound: 0,
        redirects: 0,
        resourcesChecked: 0,
        totalIssues: 0,
      },
    }));
    const auditApp = createApp({ auditPage });

    const response = await request(auditApp)
      .post('/api/audits')
      .send({
        options: { maxLinks: 10, maxResources: 8 },
        url: 'https://example.com',
      });

    expect(response.status).toBe(200);
    expect(auditPage).toHaveBeenCalledWith('https://example.com', {
      maxLinks: 10,
      maxResources: 8,
    });
  });
});
