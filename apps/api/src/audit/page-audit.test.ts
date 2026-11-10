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
      expect.objectContaining({
        category: 'accessibility',
        code: 'IMAGE_ALT_MISSING',
        description: 'A imagem "logo.png" foi encontrada sem o atributo alt.',
        element: '<img src="/logo.png">',
        pageUrl: 'https://example.com/',
        severity: 'serious',
        suggestion: expect.stringContaining('alt=""'),
        targetUrl: 'https://example.com/logo.png',
      }),
      expect.objectContaining({ code: 'NOT_FOUND', statusCode: 404 }),
    ]));
  });

  it('audita cada uso da imagem sem repetir sua verificação HTTP', async () => {
    const requestUrl = vi.fn(async (
      url: string,
      options?: { readBody?: boolean },
    ): Promise<PublicHttpResponse> => options?.readBody
      ? pageResponse
      : {
          ...pageResponse,
          body: undefined,
          finalUrl: url,
        });
    const createInventory = vi.fn(async () => ({
      images: [
        {
          alt: 'Marca da empresa',
          element: '<img src="/marca.png" alt="Marca da empresa">',
          targetUrl: 'https://example.com/marca.png',
        },
        {
          alt: null,
          element: '<img class="rodape" src="/marca.png">',
          targetUrl: 'https://example.com/marca.png',
        },
        {
          alt: '',
          element: '<img src="/divisor.svg" alt="">',
          targetUrl: 'https://example.com/divisor.svg',
        },
      ],
      links: [],
      resources: [],
      title: 'Exemplo',
    }));

    const report = await auditPage('https://example.com', {}, {
      createInventory,
      requestUrl,
    });

    expect(report.summary).toMatchObject({
      imagesFound: 3,
      imagesWithoutAlt: 1,
      resourcesChecked: 2,
      totalIssues: 1,
    });
    expect(report.issues).toEqual([
      expect.objectContaining({
        code: 'IMAGE_ALT_MISSING',
        element: '<img class="rodape" src="/marca.png">',
        pageUrl: 'https://example.com/',
        targetUrl: 'https://example.com/marca.png',
      }),
    ]);
    expect(requestUrl).toHaveBeenCalledTimes(3);
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

  it('não marca como quebrado quando HEAD falha mas GET confirma o link', async () => {
    const requestUrl = vi.fn(async (
      url: string,
      options?: { method?: 'GET' | 'HEAD'; readBody?: boolean },
    ): Promise<PublicHttpResponse> => {
      if (options?.readBody) {
        return pageResponse;
      }

      return {
        ...pageResponse,
        body: undefined,
        finalUrl: url,
        statusCode: options?.method === 'HEAD' ? 404 : 200,
      };
    });
    const createInventory = vi.fn(async () => ({
      images: [],
      links: [{
        element: '<a href="/pagina">Página</a>',
        targetUrl: 'https://example.com/pagina',
        text: 'Página',
      }],
      resources: [],
      title: 'Exemplo',
    }));

    const report = await auditPage('https://example.com', {}, {
      createInventory,
      requestUrl,
    });

    expect(report.summary.brokenLinks).toBe(0);
    expect(report.issues).toHaveLength(0);
    expect(requestUrl).toHaveBeenCalledTimes(3);
  });

  it('trata bloqueio automatizado como inconclusivo, não como link quebrado', async () => {
    const requestUrl = vi.fn(async (
      url: string,
      options?: { readBody?: boolean },
    ): Promise<PublicHttpResponse> => options?.readBody
      ? pageResponse
      : {
          ...pageResponse,
          body: undefined,
          finalUrl: url,
          statusCode: 403,
        });
    const createInventory = vi.fn(async () => ({
      images: [],
      links: [{
        element: '<a href="/restrito">Área restrita</a>',
        targetUrl: 'https://example.com/restrito',
        text: 'Área restrita',
      }],
      resources: [],
      title: 'Exemplo',
    }));

    const report = await auditPage('https://example.com', {}, {
      createInventory,
      requestUrl,
    });

    expect(report.summary.brokenLinks).toBe(0);
    expect(report.issues).toEqual([
      expect.objectContaining({
        code: 'ACCESS_RESTRICTED',
        severity: 'minor',
        statusCode: 403,
      }),
    ]);
  });
});
