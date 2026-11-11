import type { AuditReport, AuditSettings } from '../types/audit';

const historyKey = 'rastreiaweb:audit-history';
const settingsKey = 'rastreiaweb:settings';

type NewSummaryField = 'restrictedLinks' | 'unavailableLinks' | 'unreachableLinks';

type StoredAuditReport = Omit<AuditReport, 'links' | 'summary'> & {
  links?: unknown[];
  summary: Omit<AuditReport['summary'], NewSummaryField> &
    Partial<Pick<AuditReport['summary'], NewSummaryField>>;
};

export const defaultSettings: AuditSettings = {
  autoOpenReport: true,
  historyLimit: 10,
  maxLinks: 20,
  maxResources: 20,
};

function getStorage(): Storage | null {
  return typeof window === 'undefined' ? null : window.localStorage;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isStoredLink(value: unknown): value is AuditReport['links'][number] {
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

function isStoredResponsiveResult(value: unknown): boolean {
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

function isStoredReport(item: unknown): item is StoredAuditReport {
  if (!isRecord(item) || !isRecord(item.limits) || !isRecord(item.summary)) {
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
    'resourcesChecked',
    'totalIssues',
  ];
  const summary = item.summary;

  return (
    typeof item.analyzedAt === 'string' &&
    typeof item.disclaimer === 'string' &&
    typeof item.durationMs === 'number' &&
    typeof item.finalUrl === 'string' &&
    typeof item.initialUrl === 'string' &&
    Array.isArray(item.issues) &&
    item.issues.every((issue) =>
      isRecord(issue) &&
      ['accessibility', 'link', 'resource', 'responsive']
        .includes(String(issue.category)) &&
      typeof issue.code === 'string' &&
      typeof issue.description === 'string' &&
      typeof issue.pageUrl === 'string' &&
      ['critical', 'serious', 'moderate', 'minor']
        .includes(String(issue.severity)) &&
      (issue.element === undefined || typeof issue.element === 'string') &&
      (issue.statusCode === undefined || typeof issue.statusCode === 'number') &&
      (issue.suggestion === undefined || typeof issue.suggestion === 'string') &&
      (issue.targetUrl === undefined || typeof issue.targetUrl === 'string')
    ) &&
    (item.links === undefined || Array.isArray(item.links)) &&
    typeof item.limits.maxLinks === 'number' &&
    typeof item.limits.maxResources === 'number' &&
    typeof item.pageTitle === 'string' &&
    (item.responsive === undefined || isStoredResponsiveResult(item.responsive)) &&
    summaryFields.every((field) => typeof summary[field] === 'number') &&
    (summary.restrictedLinks === undefined ||
      typeof summary.restrictedLinks === 'number') &&
    (summary.unavailableLinks === undefined ||
      typeof summary.unavailableLinks === 'number') &&
    (summary.unreachableLinks === undefined ||
      typeof summary.unreachableLinks === 'number')
  );
}

function lightweightResponsiveResult(
  responsive: AuditReport['responsive'],
): AuditReport['responsive'] {
  return responsive
    ? {
        ...responsive,
        viewports: responsive.viewports.map((viewport) => ({
          documentWidth: viewport.documentWidth,
          height: viewport.height,
          horizontalOverflow: viewport.horizontalOverflow,
          name: viewport.name,
          overflowingElements: viewport.overflowingElements,
          width: viewport.width,
        })),
      }
    : undefined;
}

function normalizeStoredReport(report: StoredAuditReport): AuditReport {
  return {
    ...report,
    links: report.links?.filter(isStoredLink) ?? [],
    responsive: lightweightResponsiveResult(report.responsive),
    summary: {
      ...report.summary,
      restrictedLinks: report.summary.restrictedLinks ?? 0,
      unavailableLinks: report.summary.unavailableLinks ?? 0,
      unreachableLinks: report.summary.unreachableLinks ?? 0,
    },
  };
}

export function loadAuditHistory(): AuditReport[] {
  try {
    const value = getStorage()?.getItem(historyKey);
    const parsed: unknown = value ? JSON.parse(value) : [];

    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed.filter(isStoredReport).map(normalizeStoredReport);
  } catch {
    return [];
  }
}

export function saveAuditHistory(history: AuditReport[]): void {
  try {
    const lightweightHistory = history.map((report) => ({
      ...report,
      responsive: lightweightResponsiveResult(report.responsive),
    }));

    getStorage()?.setItem(historyKey, JSON.stringify(lightweightHistory));
  } catch {
    // A interface continua funcional mesmo se o armazenamento estiver indisponível.
  }
}

export function loadAuditSettings(): AuditSettings {
  try {
    const value = getStorage()?.getItem(settingsKey);
    const parsed: unknown = value ? JSON.parse(value) : null;

    if (!parsed || typeof parsed !== 'object') {
      return defaultSettings;
    }

    return {
      autoOpenReport: 'autoOpenReport' in parsed && typeof parsed.autoOpenReport === 'boolean'
        ? parsed.autoOpenReport
        : defaultSettings.autoOpenReport,
      historyLimit: 'historyLimit' in parsed && typeof parsed.historyLimit === 'number'
        ? Math.min(30, Math.max(1, parsed.historyLimit))
        : defaultSettings.historyLimit,
      maxLinks: 'maxLinks' in parsed && typeof parsed.maxLinks === 'number'
        ? Math.min(50, Math.max(1, parsed.maxLinks))
        : defaultSettings.maxLinks,
      maxResources: 'maxResources' in parsed && typeof parsed.maxResources === 'number'
        ? Math.min(50, Math.max(1, parsed.maxResources))
        : defaultSettings.maxResources,
    };
  } catch {
    return defaultSettings;
  }
}

export function saveAuditSettings(settings: AuditSettings): void {
  try {
    getStorage()?.setItem(settingsKey, JSON.stringify(settings));
  } catch {
    // A configuração continua válida na sessão atual.
  }
}
