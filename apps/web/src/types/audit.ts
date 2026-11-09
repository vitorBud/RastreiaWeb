export type AuditCategory = 'accessibility' | 'link' | 'resource' | 'responsive';
export type AuditSeverity = 'critical' | 'serious' | 'moderate' | 'minor';

export interface AuditIssue {
  category: AuditCategory;
  code: string;
  description: string;
  element?: string;
  pageUrl: string;
  severity: AuditSeverity;
  statusCode?: number;
  suggestion?: string;
  targetUrl?: string;
}

export interface AuditSummary {
  brokenLinks: number;
  failedResources: number;
  imagesFound: number;
  imagesWithoutAlt: number;
  linksChecked: number;
  linksFound: number;
  redirects: number;
  resourcesChecked: number;
  totalIssues: number;
}

export interface AuditReport {
  analyzedAt: string;
  disclaimer: string;
  durationMs: number;
  finalUrl: string;
  initialUrl: string;
  issues: AuditIssue[];
  limits: {
    maxLinks: number;
    maxResources: number;
  };
  pageTitle: string;
  summary: AuditSummary;
}

export interface AuditSettings {
  autoOpenReport: boolean;
  historyLimit: number;
  maxLinks: number;
  maxResources: number;
}

export type AppView =
  | 'dashboard'
  | 'help'
  | 'history'
  | 'new-audit'
  | 'reports'
  | 'settings';
