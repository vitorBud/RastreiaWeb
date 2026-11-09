import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { defaultSettings } from '../storage/audit-storage';
import { runPageAudit } from './audit-page';

const fetchMock = vi.fn();

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal('fetch', fetchMock);
});

afterAll(() => {
  vi.unstubAllGlobals();
});

describe('runPageAudit', () => {
  it('envia a URL e os limites configurados', async () => {
    const report = {
      analyzedAt: '2026-11-09T12:00:00.000Z',
      disclaimer: 'Análise automática.',
      durationMs: 100,
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
        linksChecked: 0,
        linksFound: 0,
        redirects: 0,
        resourcesChecked: 0,
        totalIssues: 0,
      },
    };
    fetchMock.mockResolvedValue(new Response(JSON.stringify(report), { status: 200 }));

    await expect(runPageAudit('https://example.com', defaultSettings)).resolves
      .toMatchObject({ pageTitle: 'Example Domain' });
    expect(fetchMock).toHaveBeenCalledWith('/api/audits', expect.objectContaining({
      body: JSON.stringify({
        options: { maxLinks: 20, maxResources: 20 },
        url: 'https://example.com',
      }),
    }));
  });

  it('apresenta a mensagem de erro enviada pela API', async () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify({
      code: 'PRIVATE_ADDRESS',
      error: 'A URL aponta para um endereço privado ou reservado.',
    }), { status: 422 }));

    await expect(runPageAudit('http://127.0.0.1', defaultSettings)).rejects
      .toMatchObject({
        code: 'PRIVATE_ADDRESS',
        message: 'A URL aponta para um endereço privado ou reservado.',
      });
  });
});
