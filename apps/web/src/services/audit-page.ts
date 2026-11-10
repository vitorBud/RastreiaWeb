import type { AuditProgress, AuditReport, AuditSettings } from '../types/audit';

export class AuditApiError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly status: number,
  ) {
    super(message);
    this.name = 'AuditApiError';
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isAuditLinkResult(value: unknown): boolean {
  if (!isRecord(value)) {
    return false;
  }

  const state = typeof value.state === 'string' ? value.state : '';
  const validCheckReason = state === 'not_checked'
    ? value.checkReason === 'invalid_url' ||
      value.checkReason === 'limit' ||
      value.checkReason === 'unsupported_protocol'
    : value.checkReason === undefined;

  return (
    typeof value.declaredHref === 'string' &&
    typeof value.element === 'string' &&
    typeof value.pageUrl === 'string' &&
    typeof value.position === 'number' &&
    Number.isInteger(value.position) &&
    value.position > 0 &&
    Array.isArray(value.redirects) &&
    value.redirects.every((redirect) => typeof redirect === 'string') &&
    validCheckReason &&
    (value.finalUrl === undefined || typeof value.finalUrl === 'string') &&
    (value.statusCode === undefined || (
      typeof value.statusCode === 'number' &&
      Number.isInteger(value.statusCode) &&
      value.statusCode >= 100 &&
      value.statusCode <= 599
    )) &&
    [
      'broken',
      'not_checked',
      'ok',
      'redirected',
      'restricted',
      'unavailable',
      'unreachable',
    ].includes(state) &&
    typeof value.targetUrl === 'string' &&
    typeof value.text === 'string'
  );
}

function isResponsiveAuditResult(value: unknown): boolean {
  return (
    isRecord(value) &&
    typeof value.message === 'string' &&
    ['completed', 'unavailable'].includes(String(value.status)) &&
    (value.styleCoverage === undefined || (
      isRecord(value.styleCoverage) &&
      typeof value.styleCoverage.discovered === 'number' &&
      typeof value.styleCoverage.loaded === 'number'
    )) &&
    Array.isArray(value.viewports) &&
    value.viewports.every((viewport) =>
      isRecord(viewport) &&
      typeof viewport.documentWidth === 'number' &&
      typeof viewport.height === 'number' &&
      typeof viewport.horizontalOverflow === 'boolean' &&
      ['desktop', 'mobile', 'tablet'].includes(String(viewport.name)) &&
      Array.isArray(viewport.overflowingElements) &&
      viewport.overflowingElements.every((element) =>
        isRecord(element) &&
        typeof element.element === 'string' &&
        typeof element.overflowPixels === 'number' &&
        typeof element.selector === 'string'
      ) &&
      typeof viewport.width === 'number'
    )
  );
}

function isAuditReport(value: unknown): value is AuditReport {
  if (
    !isRecord(value) ||
    !isRecord(value.limits) ||
    !isRecord(value.summary) ||
    !Array.isArray(value.issues) ||
    !Array.isArray(value.links)
  ) {
    return false;
  }

  const summaryFields = [
    'brokenLinks',
    'failedResources',
    'imagesFound',
    'imagesWithoutAlt',
    'linksChecked',
    'linksFound',
    'redirects',
    'restrictedLinks',
    'resourcesChecked',
    'totalIssues',
    'unavailableLinks',
    'unreachableLinks',
  ];

  return (
    typeof value.analyzedAt === 'string' &&
    typeof value.disclaimer === 'string' &&
    typeof value.durationMs === 'number' &&
    typeof value.finalUrl === 'string' &&
    typeof value.initialUrl === 'string' &&
    typeof value.pageTitle === 'string' &&
    (value.responsive === undefined || isResponsiveAuditResult(value.responsive)) &&
    typeof value.limits.maxLinks === 'number' &&
    typeof value.limits.maxResources === 'number' &&
    summaryFields.every((field) => typeof value.summary[field] === 'number') &&
    value.issues.every((issue) =>
      isRecord(issue) &&
      typeof issue.category === 'string' &&
      typeof issue.code === 'string' &&
      typeof issue.description === 'string' &&
      typeof issue.pageUrl === 'string' &&
      typeof issue.severity === 'string'
    ) &&
    value.links.every(isAuditLinkResult)
  );
}

function isAuditProgress(value: unknown): value is AuditProgress {
  return (
    isRecord(value) &&
    typeof value.completed === 'number' &&
    typeof value.message === 'string' &&
    typeof value.percent === 'number' &&
    value.percent >= 0 &&
    value.percent <= 100 &&
    ['downloading', 'inventory', 'checking', 'responsive', 'reporting', 'complete']
      .includes(typeof value.phase === 'string' ? value.phase : '') &&
    typeof value.total === 'number'
  );
}

async function readAuditStream(
  response: Response,
  onProgress?: (progress: AuditProgress) => void,
): Promise<AuditReport> {
  if (!response.body) {
    throw new AuditApiError(
      'A API não disponibilizou o fluxo de progresso.',
      'INVALID_RESPONSE',
      response.status,
    );
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let report: AuditReport | null = null;

  const processLine = (line: string) => {
    if (!line.trim()) {
      return;
    }

    let event: unknown;

    try {
      event = JSON.parse(line);
    } catch {
      throw new AuditApiError(
        'A API enviou um evento de progresso inválido.',
        'INVALID_RESPONSE',
        response.status,
      );
    }

    if (!isRecord(event) || typeof event.type !== 'string') {
      return;
    }

    if (event.type === 'progress' && isAuditProgress(event.progress)) {
      onProgress?.(event.progress);
      return;
    }

    if (event.type === 'report' && isAuditReport(event.report)) {
      report = event.report;
      return;
    }

    if (event.type === 'error' && isRecord(event.error)) {
      throw new AuditApiError(
        typeof event.error.error === 'string'
          ? event.error.error
          : 'A auditoria não pôde ser concluída.',
        typeof event.error.code === 'string' ? event.error.code : 'AUDIT_ERROR',
        typeof event.error.status === 'number' ? event.error.status : response.status,
      );
    }
  };

  while (true) {
    const { done, value } = await reader.read();
    buffer += decoder.decode(value, { stream: !done });
    const lines = buffer.split('\n');
    buffer = lines.pop() ?? '';
    lines.forEach(processLine);

    if (done) {
      break;
    }
  }

  processLine(buffer);

  if (!report) {
    throw new AuditApiError(
      'A API encerrou o progresso sem enviar o relatório.',
      'INVALID_RESPONSE',
      response.status,
    );
  }

  return report;
}

export async function runPageAudit(
  url: string,
  settings: AuditSettings,
  onProgress?: (progress: AuditProgress) => void,
): Promise<AuditReport> {
  let response: Response;

  try {
    response = await fetch('/api/audits', {
      method: 'POST',
      headers: {
        Accept: 'application/x-ndjson',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        options: {
          maxLinks: settings.maxLinks,
          maxResources: settings.maxResources,
        },
        url,
      }),
    });
  } catch {
    throw new AuditApiError(
      'Não foi possível conectar à API. Confirme se o ambiente está em execução.',
      'NETWORK_ERROR',
      0,
    );
  }

  if (
    response.ok &&
    response.headers.get('content-type')?.includes('application/x-ndjson')
  ) {
    return readAuditStream(response, onProgress);
  }

  let body: unknown;

  try {
    body = await response.json();
  } catch {
    throw new AuditApiError(
      'A API retornou uma resposta que não pôde ser interpretada.',
      'INVALID_RESPONSE',
      response.status,
    );
  }

  if (!response.ok) {
    const message = isRecord(body) && typeof body.error === 'string'
      ? body.error
      : 'A auditoria não pôde ser concluída.';
    const code = isRecord(body) && typeof body.code === 'string'
      ? body.code
      : 'AUDIT_ERROR';

    throw new AuditApiError(message, code, response.status);
  }

  if (!isAuditReport(body)) {
    throw new AuditApiError(
      'A API retornou um relatório em formato inesperado.',
      'INVALID_RESPONSE',
      response.status,
    );
  }

  return body;
}
