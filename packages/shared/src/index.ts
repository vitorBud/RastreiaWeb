export type AuditCategory =
  | 'accessibility'
  | 'link'
  | 'resource'
  | 'responsive';

export type AuditSeverity = 'critical' | 'serious' | 'moderate' | 'minor';

export type AuditLinkState =
  | 'broken'
  | 'not_checked'
  | 'ok'
  | 'redirected'
  | 'restricted'
  | 'unavailable'
  | 'unreachable';

export type AuditLinkCheckReason = 'invalid_url' | 'limit' | 'unsupported_protocol';

export interface AuditLinkResult {
  checkReason?: AuditLinkCheckReason;
  declaredHref: string;
  element: string;
  finalUrl?: string;
  pageUrl: string;
  position: number;
  redirects: string[];
  state: AuditLinkState;
  statusCode?: number;
  targetUrl: string;
  text: string;
}

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
  restrictedLinks: number;
  resourcesChecked: number;
  totalIssues: number;
  unavailableLinks: number;
  unreachableLinks: number;
}

export interface AuditReport {
  analyzedAt: string;
  disclaimer: string;
  durationMs: number;
  finalUrl: string;
  initialUrl: string;
  issues: AuditIssue[];
  links: AuditLinkResult[];
  limits: {
    maxLinks: number;
    maxResources: number;
  };
  pageTitle: string;
  summary: AuditSummary;
}

export type AuditProgressPhase =
  | 'downloading'
  | 'inventory'
  | 'checking'
  | 'reporting'
  | 'complete';

export interface AuditProgress {
  completed: number;
  message: string;
  percent: number;
  phase: AuditProgressPhase;
  total: number;
}
