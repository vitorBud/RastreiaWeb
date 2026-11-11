import { describe, expect, it, vi } from 'vitest';
import type { ResponsiveAuditResult } from '@rastreiaweb/shared';
import { auditPage } from './page-audit.js';
import type { PublicHttpResponse } from './public-http-client.js';

const pageResponse: PublicHttpResponse = {
  body: '<html></html>',
  finalUrl: 'https://example.com/',
  headers: { 'content-type': 'text/html; charset=utf-8' },
  redirects: [],
  statusCode: 200,
};

const analyzeResponsive = vi.fn(async (): Promise<ResponsiveAuditResult> => ({
  message: 'Três resoluções analisadas.',
  status: 'completed',
  viewports: [{
    documentWidth: 390,
    height: 844,
    horizontalOverflow: false,
    name: 'mobile',
    overflowingElements: [],
    width: 390,
  }],
}));

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
        checkable: true,
        checkUrl: 'https://example.com/inexistente',
        declaredHref: '/inexistente',
        element: '<a href="/inexistente">Link</a>',
        targetUrl: 'https://example.com/inexistente',
        text: 'Link',
      }],
      resources: [],
      title: 'Exemplo',
    }));
    const onProgress = vi.fn();

    const report = await auditPage('https://example.com', { onProgress }, {
      analyzeResponsive,
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
    expect(report.links).toEqual([
      expect.objectContaining({
        declaredHref: '/inexistente',
        pageUrl: 'https://example.com/',
        position: 1,
        state: 'broken',
        statusCode: 404,
        targetUrl: 'https://example.com/inexistente',
        text: 'Link',
      }),
    ]);
    expect(onProgress.mock.calls.map(([progress]) => progress.percent)).toEqual([
      3,
      16,
      28,
      58,
      88,
      89,
      97,
      100,
    ]);
  });

  it('lista todos os links e verifica cada destino HTTP apenas uma vez', async () => {
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
      images: [],
      links: [
        {
          checkable: true,
          checkUrl: 'https://example.com/documentacao',
          declaredHref: '/documentacao#inicio',
          element: '<a href="/documentacao#inicio">Documentação</a>',
          targetUrl: 'https://example.com/documentacao#inicio',
          text: 'Documentação',
        },
        {
          checkable: true,
          checkUrl: 'https://example.com/documentacao',
          declaredHref: '/documentacao#rodape',
          element: '<a href="/documentacao#rodape">Documentação no rodapé</a>',
          targetUrl: 'https://example.com/documentacao#rodape',
          text: 'Documentação no rodapé',
        },
        {
          checkable: true,
          checkUrl: 'https://example.com/contato',
          declaredHref: '/contato',
          element: '<a href="/contato">Contato</a>',
          targetUrl: 'https://example.com/contato',
          text: 'Contato',
        },
        {
          checkable: false,
          declaredHref: 'mailto:contato@example.com',
          element: '<a href="mailto:contato@example.com">E-mail</a>',
          targetUrl: 'mailto:contato@example.com',
          text: 'E-mail',
        },
        {
          checkable: false,
          declaredHref: 'http://[',
          element: '<a href="http://[">URL inválida</a>',
          targetUrl: 'http://[',
          text: 'URL inválida',
          uncheckableReason: 'invalid_url' as const,
        },
      ],
      resources: [],
      title: 'Exemplo',
    }));

    const report = await auditPage('https://example.com', { maxLinks: 1 }, {
      analyzeResponsive,
      createInventory,
      requestUrl,
    });

    expect(report.summary).toMatchObject({
      linksChecked: 1,
      linksFound: 2,
    });
    expect(report.issues).toEqual(expect.arrayContaining([
      expect.objectContaining({
        category: 'link',
        code: 'INVALID_LINK_TARGET',
        targetUrl: 'http://[',
      }),
    ]));
    expect(report.links).toEqual([
      expect.objectContaining({
        declaredHref: '/documentacao#inicio',
        position: 1,
        state: 'ok',
        statusCode: 200,
        targetUrl: 'https://example.com/documentacao#inicio',
      }),
      expect.objectContaining({
        declaredHref: '/documentacao#rodape',
        position: 2,
        state: 'ok',
        statusCode: 200,
        targetUrl: 'https://example.com/documentacao#rodape',
      }),
      expect.objectContaining({
        checkReason: 'limit',
        position: 3,
        state: 'not_checked',
      }),
      expect.objectContaining({
        checkReason: 'unsupported_protocol',
        position: 4,
        state: 'not_checked',
      }),
      expect.objectContaining({
        checkReason: 'invalid_url',
        position: 5,
        state: 'not_checked',
      }),
    ]);
    expect(requestUrl).toHaveBeenCalledTimes(2);
    expect(requestUrl).toHaveBeenNthCalledWith(
      2,
      'https://example.com/documentacao',
      expect.objectContaining({ method: 'HEAD' }),
    );
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
      analyzeResponsive,
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
        checkable: true,
        checkUrl: 'https://example.com/pagina',
        declaredHref: '/pagina',
        element: '<a href="/pagina">Página</a>',
        targetUrl: 'https://example.com/pagina',
        text: 'Página',
      }],
      resources: [],
      title: 'Exemplo',
    }));

    const report = await auditPage('https://example.com', {}, {
      analyzeResponsive,
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
        checkable: true,
        checkUrl: 'https://example.com/restrito',
        declaredHref: '/restrito',
        element: '<a href="/restrito">Área restrita</a>',
        targetUrl: 'https://example.com/restrito',
        text: 'Área restrita',
      }],
      resources: [],
      title: 'Exemplo',
    }));

    const report = await auditPage('https://example.com', {}, {
      analyzeResponsive,
      createInventory,
      requestUrl,
    });

    expect(report.summary.brokenLinks).toBe(0);
    expect(report.links[0]).toMatchObject({
      state: 'restricted',
      statusCode: 403,
    });
    expect(report.issues).toEqual([
      expect.objectContaining({
        code: 'ACCESS_RESTRICTED',
        severity: 'minor',
        statusCode: 403,
      }),
    ]);
  });

  it('registra redirecionamentos e destinos inacessíveis no inventário', async () => {
    const requestUrl = vi.fn(async (
      url: string,
      options?: { readBody?: boolean },
    ): Promise<PublicHttpResponse> => {
      if (options?.readBody) {
        return pageResponse;
      }

      if (url.endsWith('/antiga')) {
        return {
          ...pageResponse,
          body: undefined,
          finalUrl: 'https://example.com/nova',
          redirects: ['https://example.com/nova'],
        };
      }

      throw new Error('Destino inacessível');
    });
    const createInventory = vi.fn(async () => ({
      images: [],
      links: [
        {
          checkable: true,
          checkUrl: 'https://example.com/antiga',
          declaredHref: '/antiga',
          element: '<a href="/antiga">Página antiga</a>',
          targetUrl: 'https://example.com/antiga',
          text: 'Página antiga',
        },
        {
          checkable: true,
          checkUrl: 'https://example.com/fora-do-ar',
          declaredHref: '/fora-do-ar',
          element: '<a href="/fora-do-ar">Fora do ar</a>',
          targetUrl: 'https://example.com/fora-do-ar',
          text: 'Fora do ar',
        },
      ],
      resources: [],
      title: 'Exemplo',
    }));

    const report = await auditPage('https://example.com', {}, {
      analyzeResponsive,
      createInventory,
      requestUrl,
    });

    expect(report.links[0]).toMatchObject({
      finalUrl: 'https://example.com/nova',
      redirects: ['https://example.com/nova'],
      state: 'redirected',
      statusCode: 200,
    });
    expect(report.links[1]).toMatchObject({
      redirects: [],
      state: 'unreachable',
    });
    expect(report.links[1]?.finalUrl).toBeUndefined();
    expect(report.links[1]?.statusCode).toBeUndefined();
    expect(report.summary).toMatchObject({
      redirects: 1,
      unreachableLinks: 1,
    });
  });

  it('transforma elementos fora da viewport em ocorrências detalhadas', async () => {
    const requestUrl = vi.fn(async (): Promise<PublicHttpResponse> => pageResponse);
    const createInventory = vi.fn(async () => ({
      images: [],
      links: [],
      resources: [],
      title: 'Exemplo responsivo',
    }));
    const responsiveAnalyzer = vi.fn(async (): Promise<ResponsiveAuditResult> => ({
      message: 'Três resoluções analisadas.',
      status: 'completed',
      viewports: [{
        documentWidth: 620,
        height: 844,
        horizontalOverflow: true,
        name: 'mobile',
        overflowingElements: [{
          element: '<main class="wide">Conteúdo</main>',
          overflowPixels: 230,
          selector: 'main.wide',
        }],
        width: 390,
      }],
    }));

    const report = await auditPage('https://example.com', {}, {
      analyzeResponsive: responsiveAnalyzer,
      createInventory,
      requestUrl,
    });

    expect(report.responsive?.status).toBe('completed');
    expect(report.issues).toEqual([
      expect.objectContaining({
        category: 'responsive',
        code: 'ELEMENT_OUTSIDE_VIEWPORT',
        description: expect.stringContaining('main.wide'),
        element: '<main class="wide">Conteúdo</main>',
      }),
    ]);
    expect(report.summary.totalIssues).toBe(1);
  });

  it('informa quantas folhas CSS entraram na análise responsiva', async () => {
    const requestUrl = vi.fn(async (
      url: string,
      options?: { method?: string; readBody?: boolean },
    ): Promise<PublicHttpResponse> => {
      if (url.endsWith('/styles.css') && options?.readBody) {
        return {
          ...pageResponse,
          body: 'body { margin: 0; }',
          finalUrl: url,
          headers: { 'content-type': 'text/css' },
        };
      }

      return options?.readBody
        ? pageResponse
        : { ...pageResponse, body: undefined, finalUrl: url };
    });
    const createInventory = vi.fn(async () => ({
      images: [],
      links: [],
      resources: [{
        element: '<link rel="stylesheet" href="/styles.css">',
        kind: 'stylesheet' as const,
        targetUrl: 'https://example.com/styles.css',
      }],
      title: 'Exemplo com CSS',
    }));

    const report = await auditPage('https://example.com', {}, {
      analyzeResponsive,
      createInventory,
      requestUrl,
    });

    expect(analyzeResponsive).toHaveBeenLastCalledWith(
      pageResponse.body,
      pageResponse.finalUrl,
      [expect.objectContaining({
        content: 'body { margin: 0; }',
        sourceUrl: 'https://example.com/styles.css',
      })],
      expect.any(Function),
    );
    expect(report.responsive?.styleCoverage).toEqual({ discovered: 1, loaded: 1 });
  });

});
