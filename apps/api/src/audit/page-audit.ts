import {
  createDocumentInventory,
  type DocumentInventory,
} from '@rastreiaweb/audit-engine';
import type {
  AuditIssue,
  AuditReport,
  AuditSeverity,
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
}

interface PageAuditDependencies {
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
  issues: AuditIssue[];
  redirected: boolean;
  state: TargetState;
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

    return { issues, redirected: response.redirects.length > 0, state };
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
      redirected: false,
      state: 'unreachable',
    };
  }
}

async function mapWithConcurrency<T, R>(
  items: T[],
  concurrency: number,
  worker: (item: T) => Promise<R>,
): Promise<R[]> {
  const results: R[] = [];

  for (let index = 0; index < items.length; index += concurrency) {
    const batch = items.slice(index, index + concurrency);
    results.push(...await Promise.all(batch.map(worker)));
  }

  return results;
}

export async function auditPage(
  inputUrl: string,
  options: PageAuditOptions = {},
  dependencies: PageAuditDependencies = {},
): Promise<AuditReport> {
  const startedAt = Date.now();
  const maxLinks = options.maxLinks ?? 20;
  const maxResources = options.maxResources ?? 20;
  const requestUrl = dependencies.requestUrl ?? requestPublicUrl;
  const createInventory = dependencies.createInventory ?? createDocumentInventory;
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

  const inventory: DocumentInventory = await createInventory(
    pageResponse.body,
    pageResponse.finalUrl,
  );
  const links = inventory.links.slice(0, maxLinks);
  const resources = [
    ...inventory.images.map((image) => ({ ...image, kind: 'image' as const })),
    ...inventory.resources,
  ].slice(0, maxResources);
  const issues: AuditIssue[] = inventory.images
    .filter((image) => image.alt === null)
    .map((image) => ({
      category: 'accessibility',
      code: 'IMAGE_ALT_MISSING',
      description: 'A imagem não possui o atributo alt.',
      element: image.element,
      pageUrl: pageResponse.finalUrl,
      severity: 'serious',
      suggestion: 'Adicione uma alternativa textual ou alt vazio quando a imagem for apenas decorativa.',
      targetUrl: image.targetUrl,
    }));

  const linkResults = await mapWithConcurrency(links, 4, (link) =>
    checkTarget(
      pageResponse.finalUrl,
      link.targetUrl,
      link.element,
      'link',
      requestUrl,
    ),
  );
  const resourceResults = await mapWithConcurrency(resources, 4, (resource) =>
    checkTarget(
      pageResponse.finalUrl,
      resource.targetUrl,
      resource.element,
      'resource',
      requestUrl,
    ),
  );

  issues.push(
    ...linkResults.flatMap((result) => result.issues),
    ...resourceResults.flatMap((result) => result.issues),
  );

  return {
    analyzedAt: new Date().toISOString(),
    disclaimer: 'Esta análise automática não substitui testes manuais completos de acessibilidade e experiência.',
    durationMs: Date.now() - startedAt,
    finalUrl: pageResponse.finalUrl,
    initialUrl: inputUrl,
    issues,
    limits: { maxLinks, maxResources },
    pageTitle: inventory.title || new URL(pageResponse.finalUrl).hostname,
    summary: {
      brokenLinks: linkResults.filter((result) => result.state === 'broken').length,
      failedResources: resourceResults.filter((result) =>
        ['broken', 'unavailable', 'unreachable'].includes(result.state),
      ).length,
      imagesFound: inventory.images.length,
      imagesWithoutAlt: inventory.images.filter((image) => image.alt === null).length,
      linksChecked: links.length,
      linksFound: inventory.links.length,
      redirects: [...linkResults, ...resourceResults]
        .filter((result) => result.redirected).length,
      restrictedLinks: linkResults.filter((result) => result.state === 'restricted').length,
      resourcesChecked: resources.length,
      totalIssues: issues.length,
      unavailableLinks: linkResults.filter((result) => result.state === 'unavailable').length,
      unreachableLinks: linkResults.filter((result) => result.state === 'unreachable').length,
    },
  };
}
