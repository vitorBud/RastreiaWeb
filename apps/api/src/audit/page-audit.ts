import {
  analyzeResponsiveLayout,
  createDocumentInventory,
  type DocumentInventory,
  type DocumentLink,
  type ResponsiveStylesheet,
} from '@rastreiaweb/audit-engine';
import type {
  AuditIssue,
  AuditLinkResult,
  AuditLinkState,
  AuditProgress,
  AuditReport,
  AuditSeverity,
  ResponsiveAuditResult,
} from '@rastreiaweb/shared';
import {
  AuditNetworkError,
  requestPublicUrl,
  type PublicHttpResponse,
} from './public-http-client.js';

export type PageAuditErrorCode =
  | 'PAGE_CONTENT_MISSING'
  | 'PAGE_NOT_HTML'
  | 'PAGE_UNAVAILABLE';

export class PageAuditError extends Error {
  constructor(
    public readonly code: PageAuditErrorCode,
    message: string,
  ) {
    super(message);
    this.name = 'PageAuditError';
  }
}

export interface PageAuditOptions {
  maxLinks?: number;
  maxResources?: number;
  onProgress?: (progress: AuditProgress) => void;
}

interface PageAuditDependencies {
  analyzeResponsive?: typeof analyzeResponsiveLayout;
  createInventory?: typeof createDocumentInventory;
  requestUrl?: typeof requestPublicUrl;
}

type TargetState =
  | 'broken'
  | 'ok'
  | 'restricted'
  | 'unavailable'
  | 'unreachable';

interface TargetCheckResult {
  finalUrl?: string;
  issues: AuditIssue[];
  redirects: string[];
  state: TargetState;
  statusCode?: number;
}

type CheckableDocumentLink = DocumentLink & { checkUrl: string };

function readableFileName(targetUrl: string): string {
  try {
    const url = new URL(targetUrl);
    const segments = url.pathname.split('/').filter(Boolean);
    const fileName = segments[segments.length - 1];

    return decodeURIComponent(fileName || url.hostname).slice(0, 120);
  } catch {
    return targetUrl.slice(0, 120);
  }
}

function uniqueByTarget<T extends { targetUrl: string }>(items: T[]): T[] {
  const seen = new Set<string>();

  return items.filter((item) => {
    if (seen.has(item.targetUrl)) {
      return false;
    }

    seen.add(item.targetUrl);
    return true;
  });
}

function uniqueByCheckUrl(items: CheckableDocumentLink[]): CheckableDocumentLink[] {
  const seen = new Set<string>();

  return items.filter((item) => {
    if (seen.has(item.checkUrl)) {
      return false;
    }

    seen.add(item.checkUrl);
    return true;
  });
}

async function requestStatus(
  targetUrl: string,
  requestUrl: typeof requestPublicUrl,
): Promise<PublicHttpResponse> {
  try {
    const headResponse = await requestUrl(targetUrl, {
      maxRedirects: 3,
      method: 'HEAD',
      readBody: false,
      timeoutMs: 5_000,
    });

    if (headResponse.statusCode < 400) {
      return headResponse;
    }
  } catch {
    // Alguns servidores rejeitam HEAD. O GET abaixo confirma o estado real.
  }

  return requestUrl(targetUrl, {
    maxRedirects: 3,
    method: 'GET',
    readBody: false,
    timeoutMs: 5_000,
  });
}

function statusIssue(
  pageUrl: string,
  targetUrl: string,
  element: string,
  statusCode: number,
  kind: 'link' | 'resource',
): AuditIssue | null {
  if (statusCode < 400) {
    return null;
  }

  const accessRestricted = statusCode === 401 || statusCode === 403 || statusCode === 429;
  const notFound = statusCode === 404 || statusCode === 410;
  const serverError = statusCode >= 500;
  const severity: AuditSeverity = accessRestricted
    ? 'minor'
    : serverError || notFound
      ? 'serious'
      : 'moderate';
  const subject = kind === 'link' ? 'link' : 'recurso';

  return {
    category: kind,
    code: accessRestricted
      ? 'ACCESS_RESTRICTED'
      : notFound
        ? 'NOT_FOUND'
        : serverError
          ? 'SERVER_ERROR'
          : 'HTTP_ERROR',
    description: accessRestricted
      ? `Verificação inconclusiva: o destino restringiu a requisição automatizada com HTTP ${statusCode}.`
      : notFound
        ? `${subject === 'link' ? 'Link quebrado' : 'Recurso indisponível'} confirmado: o teste GET respondeu com HTTP ${statusCode}.`
        : serverError
          ? `O servidor do ${subject} falhou durante a confirmação GET com HTTP ${statusCode}.`
          : `O ${subject} respondeu com HTTP ${statusCode} durante a confirmação GET.`,
    element,
    pageUrl,
    severity,
    statusCode,
    suggestion: accessRestricted
      ? 'Abra o destino manualmente. Ele pode exigir autenticação ou bloquear ferramentas automatizadas.'
      : 'Confira o endereço e corrija ou substitua a referência.',
    targetUrl,
  };
}

async function checkTarget(
  pageUrl: string,
  targetUrl: string,
  element: string,
  kind: 'link' | 'resource',
  requestUrl: typeof requestPublicUrl,
): Promise<TargetCheckResult> {
  try {
    const response = await requestStatus(targetUrl, requestUrl);
    const issue = statusIssue(
      pageUrl,
      targetUrl,
      element,
      response.statusCode,
      kind,
    );
    const accessRestricted = [401, 403, 429].includes(response.statusCode);
    const issues = issue ? [issue] : [];

    if (response.redirects.length > 0) {
      issues.push({
        category: kind,
        code: 'REDIRECT',
        description: `O destino passou por ${response.redirects.length} redirecionamento(s).`,
        element,
        pageUrl,
        severity: 'minor',
        statusCode: response.statusCode,
        suggestion: 'Use diretamente a URL final quando isso não prejudicar a navegação.',
        targetUrl,
      });
    }

    let state: TargetState = 'ok';

    if (accessRestricted) {
      state = 'restricted';
    } else if (response.statusCode === 404 || response.statusCode === 410) {
      state = 'broken';
    } else if (response.statusCode >= 400) {
      state = 'unavailable';
    }

    return {
      finalUrl: response.finalUrl,
      issues,
      redirects: response.redirects,
      state,
      statusCode: response.statusCode,
    };
  } catch (error) {
    const description = error instanceof AuditNetworkError
      ? error.message
      : 'Não foi possível acessar o destino.';

    return {
      issues: [{
        category: kind,
        code: 'UNREACHABLE',
        description,
        element,
        pageUrl,
        severity: 'serious',
        suggestion: 'Confirme se a URL é pública, válida e está disponível.',
        targetUrl,
      }],
      redirects: [],
      state: 'unreachable',
    };
  }
}

async function mapWithConcurrency<T, R>(
  items: T[],
  concurrency: number,
  worker: (item: T) => Promise<R>,
  onItemComplete?: () => void,
): Promise<R[]> {
  const results: R[] = [];

  for (let index = 0; index < items.length; index += concurrency) {
    const batch = items.slice(index, index + concurrency);
    results.push(...await Promise.all(batch.map(async (item) => {
      const result = await worker(item);
      onItemComplete?.();
      return result;
    })));
  }

  return results;
}

interface ResponsiveStylesheetLoadResult {
  discovered: number;
  loaded: number;
  stylesheets: ResponsiveStylesheet[];
}

function cssImportUrls(content: string, sourceUrl: string): string[] {
  const imports = content.matchAll(
    /@import\s+(?:url\(\s*)?["']?([^"')\s;]+)["']?\s*\)?[^;]*;/gi,
  );

  return Array.from(imports).flatMap((match) => {
    try {
      const url = new URL(match[1]!, sourceUrl);
      return ['http:', 'https:'].includes(url.protocol) ? [url.toString()] : [];
    } catch {
      return [];
    }
  });
}

async function loadResponsiveStylesheets(
  inventory: DocumentInventory,
  maxResources: number,
  requestUrl: typeof requestPublicUrl,
): Promise<ResponsiveStylesheetLoadResult> {
  const initialUrls = uniqueByTarget(
    inventory.resources.filter((resource) => resource.kind === 'stylesheet'),
  ).map((resource) => resource.targetUrl);
  const discoveredUrls = new Set(initialUrls);
  const attemptedUrls = new Set<string>();
  const queue = [...initialUrls];
  const stylesheets: ResponsiveStylesheet[] = [];
  const stylesheetLimit = Math.min(Math.max(maxResources, 1), 12);

  while (queue.length > 0 && attemptedUrls.size < stylesheetLimit) {
    const batch: string[] = [];

    while (
      queue.length > 0 &&
      batch.length < 4 &&
      attemptedUrls.size + batch.length < stylesheetLimit
    ) {
      const targetUrl = queue.shift();

      if (targetUrl && !attemptedUrls.has(targetUrl) && !batch.includes(targetUrl)) {
        batch.push(targetUrl);
      }
    }

    batch.forEach((targetUrl) => attemptedUrls.add(targetUrl));
    const loadedBatch = await mapWithConcurrency(
      batch,
      4,
      async (targetUrl): Promise<ResponsiveStylesheet | null> => {
        try {
          const response = await requestUrl(targetUrl, {
            accept: 'text/css,*/*;q=0.1',
            maxBodyBytes: 1_500_000,
            maxRedirects: 2,
            method: 'GET',
            readBody: true,
            timeoutMs: 4_000,
          });

          if (response.statusCode >= 400 || !response.body) {
            return null;
          }

          return {
            content: response.body,
            sourceUrl: response.finalUrl,
          };
        } catch {
          return null;
        }
      },
    );

    for (const stylesheet of loadedBatch) {
      if (!stylesheet) {
        continue;
      }

      stylesheets.push(stylesheet);
      const imports = cssImportUrls(stylesheet.content, stylesheet.sourceUrl);

      for (const importedUrl of imports.reverse()) {
        if (!discoveredUrls.has(importedUrl)) {
          discoveredUrls.add(importedUrl);
          queue.unshift(importedUrl);
        }
      }
    }
  }

  return {
    discovered: discoveredUrls.size,
    loaded: stylesheets.length,
    stylesheets,
  };
}

export async function auditPage(
  inputUrl: string,
  options: PageAuditOptions = {},
  dependencies: PageAuditDependencies = {},
): Promise<AuditReport> {
  const startedAt = Date.now();
  const maxLinks = options.maxLinks ?? 20;
  const maxResources = options.maxResources ?? 20;
  const onProgress = options.onProgress;
  const requestUrl = dependencies.requestUrl ?? requestPublicUrl;
  const createInventory = dependencies.createInventory ?? createDocumentInventory;
  const analyzeResponsive = dependencies.analyzeResponsive ?? analyzeResponsiveLayout;
  onProgress?.({
    completed: 0,
    message: 'Baixando a página principal…',
    percent: 3,
    phase: 'downloading',
    total: 1,
  });
  const pageResponse = await requestUrl(inputUrl, {
    maxBodyBytes: 2_000_000,
    maxRedirects: 5,
    method: 'GET',
    readBody: true,
    timeoutMs: 10_000,
  });

  if (pageResponse.statusCode >= 400) {
    throw new PageAuditError(
      'PAGE_UNAVAILABLE',
      `A página principal respondeu com o status HTTP ${pageResponse.statusCode}.`,
    );
  }

  const contentType = pageResponse.headers['content-type']?.toLowerCase();

  if (contentType && !contentType.includes('text/html') && !contentType.includes('application/xhtml+xml')) {
    throw new PageAuditError(
      'PAGE_NOT_HTML',
      'O endereço informado não retornou um documento HTML.',
    );
  }

  if (!pageResponse.body) {
    throw new PageAuditError(
      'PAGE_CONTENT_MISSING',
      'A página não retornou conteúdo para análise.',
    );
  }

  onProgress?.({
    completed: 1,
    message: 'Página recebida. Lendo o HTML…',
    percent: 16,
    phase: 'inventory',
    total: 1,
  });

  const inventory: DocumentInventory = await createInventory(
    pageResponse.body,
    pageResponse.finalUrl,
  );
  const checkableLinks = inventory.links.filter(
    (link): link is CheckableDocumentLink =>
      link.checkable && typeof link.checkUrl === 'string',
  );
  const uniqueCheckableLinks = uniqueByCheckUrl(checkableLinks);
  const linksToCheck = uniqueCheckableLinks.slice(0, maxLinks);
  const resources = [
    ...uniqueByTarget(inventory.images)
      .map((image) => ({ ...image, kind: 'image' as const })),
    ...inventory.resources,
  ].slice(0, maxResources);
  const totalChecks = linksToCheck.length + resources.length;
  let completedChecks = 0;
  const reportCheckProgress = () => {
    completedChecks += 1;
    const percent = totalChecks === 0
      ? 88
      : 28 + Math.round((completedChecks / totalChecks) * 60);

    onProgress?.({
      completed: completedChecks,
      message: `Verificando destinos e recursos (${completedChecks} de ${totalChecks})…`,
      percent,
      phase: 'checking',
      total: totalChecks,
    });
  };

  onProgress?.({
    completed: 0,
    message: totalChecks === 0
      ? 'Nenhum destino HTTP precisa ser verificado.'
      : `Inventário concluído. ${totalChecks} item(ns) serão verificados.`,
    percent: totalChecks === 0 ? 88 : 28,
    phase: 'checking',
    total: totalChecks,
  });
  const issues: AuditIssue[] = [
    ...inventory.images
      .filter((image) => image.alt === null)
      .map((image) => ({
        category: 'accessibility' as const,
        code: 'IMAGE_ALT_MISSING',
        description: `A imagem "${readableFileName(image.targetUrl)}" foi encontrada sem o atributo alt.`,
        element: image.element,
        pageUrl: pageResponse.finalUrl,
        severity: 'serious' as const,
        suggestion: 'Se a imagem comunica conteúdo ou funciona como controle, adicione um alt que descreva objetivamente sua informação ou função. Se for apenas decorativa, mantenha o atributo presente e vazio (alt=""). Não use somente o nome do arquivo como texto alternativo.',
        targetUrl: image.targetUrl,
      })),
    ...inventory.links
      .filter((link) => link.uncheckableReason === 'invalid_url')
      .map((link) => ({
        category: 'link' as const,
        code: 'INVALID_LINK_TARGET',
        description: `O atributo href contém um destino inválido: "${link.declaredHref}".`,
        element: link.element,
        pageUrl: pageResponse.finalUrl,
        severity: 'moderate' as const,
        suggestion: 'Substitua o href por uma URL HTTP(S), um caminho relativo válido ou remova o elemento da navegação.',
        targetUrl: link.targetUrl,
      })),
  ];

  const linkResults = await mapWithConcurrency(linksToCheck, 4, (link) =>
    checkTarget(
      pageResponse.finalUrl,
      link.checkUrl,
      link.element,
      'link',
      requestUrl,
    ),
    reportCheckProgress,
  );
  const resourceResults = await mapWithConcurrency(resources, 4, (resource) =>
    checkTarget(
      pageResponse.finalUrl,
      resource.targetUrl,
      resource.element,
      'resource',
      requestUrl,
    ),
    reportCheckProgress,
  );

  onProgress?.({
    completed: 0,
    message: 'Preparando o layout para desktop, tablet e celular…',
    percent: 89,
    phase: 'responsive',
    total: 3,
  });

  let responsive: ResponsiveAuditResult;

  try {
    const stylesheetResult = await loadResponsiveStylesheets(
      inventory,
      maxResources,
      requestUrl,
    );
    responsive = await analyzeResponsive(
      pageResponse.body,
      pageResponse.finalUrl,
      stylesheetResult.stylesheets,
      (completed, total) => {
        onProgress?.({
          completed,
          message: `Medindo responsividade (${completed} de ${total} resoluções)…`,
          percent: 89 + Math.round((completed / total) * 5),
          phase: 'responsive',
          total,
        });
      },
    );
    responsive.styleCoverage = {
      discovered: stylesheetResult.discovered,
      loaded: stylesheetResult.loaded,
    };
  } catch {
    responsive = {
      message: 'Não foi possível iniciar o navegador isolado para medir a responsividade.',
      status: 'unavailable',
      viewports: [],
    };
  }

  issues.push(
    ...linkResults.flatMap((result) => result.issues),
    ...resourceResults.flatMap((result) => result.issues),
  );

  if (responsive.status === 'completed') {
    issues.push(...responsive.viewports.flatMap((viewport) => {
      if (!viewport.horizontalOverflow) {
        return [];
      }

      if (viewport.overflowingElements.length === 0) {
        return [{
          category: 'responsive' as const,
          code: 'HORIZONTAL_OVERFLOW',
          description: `A página possui ${viewport.documentWidth - viewport.width}px de rolagem horizontal na resolução ${viewport.width} × ${viewport.height}px.`,
          pageUrl: pageResponse.finalUrl,
          severity: 'moderate' as const,
          suggestion: 'Revise larguras fixas, min-width, margens e posicionamentos que ultrapassam a largura da viewport.',
        }];
      }

      return viewport.overflowingElements.map((element) => ({
        category: 'responsive' as const,
        code: 'ELEMENT_OUTSIDE_VIEWPORT',
        description: `O elemento "${element.selector}" ultrapassa em ${element.overflowPixels}px a viewport de ${viewport.width} × ${viewport.height}px.`,
        element: element.element,
        pageUrl: pageResponse.finalUrl,
        severity: 'moderate' as const,
        suggestion: 'Evite larguras rígidas maiores que a tela. Prefira max-width: 100%, unidades fluidas e media queries adequadas.',
      }));
    }));
  }

  const linkResultByCheckUrl = new Map<string, TargetCheckResult>();

  linksToCheck.forEach((link, index) => {
    const result = linkResults[index];

    if (result) {
      linkResultByCheckUrl.set(link.checkUrl, result);
    }
  });
  const auditedLinks = inventory.links.map((link, index) => {
    const result = link.checkUrl
      ? linkResultByCheckUrl.get(link.checkUrl)
      : undefined;
    const state: AuditLinkState = result
      ? result.state === 'ok' && result.redirects.length > 0
        ? 'redirected'
        : result.state
      : 'not_checked';

    return {
      checkReason: result
        ? undefined
        : link.checkable && link.checkUrl
          ? 'limit'
          : link.uncheckableReason ?? 'unsupported_protocol',
      declaredHref: link.declaredHref,
      element: link.element,
      finalUrl: result?.finalUrl,
      pageUrl: pageResponse.finalUrl,
      position: index + 1,
      redirects: result?.redirects ?? [],
      state,
      statusCode: result?.statusCode,
      targetUrl: link.targetUrl,
      text: link.text,
    } satisfies AuditLinkResult;
  });

  onProgress?.({
    completed: totalChecks,
    message: 'Organizando ocorrências e preparando o relatório…',
    percent: 97,
    phase: 'reporting',
    total: totalChecks,
  });

  const report: AuditReport = {
    analyzedAt: new Date().toISOString(),
    disclaimer: 'Esta análise automática verifica imagens sem alt, links, recursos e overflow horizontal. Ela não substitui testes manuais de acessibilidade e responsividade. A medição responsiva usa HTML e CSS públicos, com JavaScript e novas requisições do navegador bloqueados.',
    durationMs: Date.now() - startedAt,
    finalUrl: pageResponse.finalUrl,
    initialUrl: inputUrl,
    issues,
    links: auditedLinks,
    limits: { maxLinks, maxResources },
    pageTitle: inventory.title || new URL(pageResponse.finalUrl).hostname,
    responsive,
    summary: {
      brokenLinks: linkResults.filter((result) => result.state === 'broken').length,
      failedResources: resourceResults.filter((result) =>
        ['broken', 'unavailable', 'unreachable'].includes(result.state),
      ).length,
      imagesFound: inventory.images.length,
      imagesWithoutAlt: inventory.images.filter((image) => image.alt === null).length,
      linksChecked: linksToCheck.length,
      linksFound: uniqueCheckableLinks.length,
      redirects: [...linkResults, ...resourceResults]
        .filter((result) => result.redirects.length > 0).length,
      restrictedLinks: linkResults.filter((result) => result.state === 'restricted').length,
      resourcesChecked: resources.length,
      totalIssues: issues.length,
      unavailableLinks: linkResults.filter((result) => result.state === 'unavailable').length,
      unreachableLinks: linkResults.filter((result) => result.state === 'unreachable').length,
    },
  };

  onProgress?.({
    completed: totalChecks,
    message: 'Auditoria concluída.',
    percent: 100,
    phase: 'complete',
    total: totalChecks,
  });

  return report;
}
