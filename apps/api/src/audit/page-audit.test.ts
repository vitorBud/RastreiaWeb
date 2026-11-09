import { describe, expect, it, vi } from 'vitest';
import { auditPage } from './page-audit.js';
import type { PublicHttpResponse } from './public-http-client.js';

const pageResponse: PublicHttpResponse = {
  body: '<html></html>',
  finalUrl: 'https://example.com/',
  headers: { 'content-type': 'text/html; charset=utf-8' },
  redirects: [],
  statusCode: 200,
};

describe('auditPage', () => {
  it('gera um relatório a partir de links, imagens e recursos reais', async () => {
    const requestUrl = vi.fn(async (url: string): Promise<PublicHttpResponse> => {
      if (url === 'https://example.com') {
        return pageResponse;
      }

      if (url.endsWith('/inexistente')) {
        return {
          ...pageResponse,
          body: undefined,
          finalUrl: url,
          statusCode: 404,
        };
      }

      return {
        ...pageResponse,
        body: undefined,
        finalUrl: url,
      };
    });
    const createInventory = vi.fn(async () => ({
      images: [{
        alt: null,
        element: '<img src="/logo.png">',
        targetUrl: 'https://example.com/logo.png',
      }],
      links: [{
        element: '<a href="/inexistente">Link</a>',
        targetUrl: 'https://example.com/inexistente',
        text: 'Link',
      }],
      resources: [],
      title: 'Exemplo',
    }));

    const report = await auditPage('https://example.com', {}, {
      createInventory,
      requestUrl,
    });

    expect(report.pageTitle).toBe('Exemplo');
    expect(report.summary).toMatchObject({
      brokenLinks: 1,
      imagesFound: 1,
      imagesWithoutAlt: 1,
      linksChecked: 1,
      totalIssues: 2,
    });
    expect(report.issues).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: 'IMAGE_ALT_MISSING' }),
      expect.objectContaining({ code: 'NOT_FOUND', statusCode: 404 }),
    ]));
  });

  it('recusa uma resposta que não seja HTML', async () => {
    const requestUrl = vi.fn(async () => ({
      ...pageResponse,
      headers: { 'content-type': 'application/pdf' },
    }));

    await expect(auditPage('https://example.com', {}, {
      requestUrl,
    })).rejects.toMatchObject({ code: 'PAGE_NOT_HTML' });
  });
});
