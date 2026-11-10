import type { AuditReport, AuditSettings } from '../types/audit';

const historyKey = 'rastreiaweb:audit-history';
const settingsKey = 'rastreiaweb:settings';

export const defaultSettings: AuditSettings = {
  autoOpenReport: true,
  historyLimit: 10,
  maxLinks: 20,
  maxResources: 20,
};

function getStorage(): Storage | null {
  return typeof window === 'undefined' ? null : window.localStorage;
}

function isStoredReport(item: unknown): item is AuditReport {
  return (
    typeof item === 'object' &&
    item !== null &&
    'analyzedAt' in item && typeof item.analyzedAt === 'string' &&
    'finalUrl' in item && typeof item.finalUrl === 'string' &&
    'initialUrl' in item && typeof item.initialUrl === 'string' &&
    'issues' in item && Array.isArray(item.issues) &&
    'pageTitle' in item && typeof item.pageTitle === 'string' &&
    'summary' in item && typeof item.summary === 'object' && item.summary !== null
  );
}

function normalizeStoredReport(report: AuditReport): AuditReport {
  return {
    ...report,
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
    getStorage()?.setItem(historyKey, JSON.stringify(history));
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
