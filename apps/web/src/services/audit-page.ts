import type { AuditReport, AuditSettings } from '../types/audit';

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

function isAuditReport(value: unknown): value is AuditReport {
  if (
    !isRecord(value) ||
    !isRecord(value.limits) ||
    !isRecord(value.summary) ||
    !Array.isArray(value.issues)
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
    )
  );
}

export async function runPageAudit(
  url: string,
  settings: AuditSettings,
): Promise<AuditReport> {
  let response: Response;

  try {
    response = await fetch('/api/audits', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
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
