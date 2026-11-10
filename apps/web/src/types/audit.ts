export type AuditCategory = 'accessibility' | 'link' | 'resource' | 'responsive';
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

export type ResponsiveViewportName = 'desktop' | 'mobile' | 'tablet';

export interface ResponsiveOverflowElement {
  element: string;
  overflowPixels: number;
  selector: string;
}

export interface ResponsiveViewportResult {
  documentWidth: number;
  height: number;
  horizontalOverflow: boolean;
  name: ResponsiveViewportName;
  overflowingElements: ResponsiveOverflowElement[];
  width: number;
}

export interface ResponsiveAuditResult {
  message: string;
  status: 'completed' | 'unavailable';
  styleCoverage?: {
    discovered: number;
    loaded: number;
  };
  viewports: ResponsiveViewportResult[];
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
  responsive?: ResponsiveAuditResult;
  summary: AuditSummary;
}

export type AuditProgressPhase =
  | 'downloading'
  | 'inventory'
  | 'checking'
  | 'responsive'
  | 'reporting'
  | 'complete';

export interface AuditProgress {
  completed: number;
  message: string;
  percent: number;
  phase: AuditProgressPhase;
  total: number;
}

export interface AuditSettings {
  autoOpenReport: boolean;
  historyLimit: number;
  maxLinks: number;
  maxResources: number;
}

export interface ReportFocus {
  category?: AuditCategory;
  query?: string;
  section?: 'issues' | 'links';
}

export type AppView =
  | 'dashboard'
  | 'help'
  | 'history'
  | 'new-audit'
  | 'reports'
  | 'settings';
