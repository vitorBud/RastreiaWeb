export type AuditCategory =
  | 'accessibility'
  | 'link'
  | 'resource'
  | 'responsive';

export type AuditSeverity = 'critical' | 'serious' | 'moderate' | 'minor';

export interface AuditIssue {
  category: AuditCategory;
  description: string;
  element?: string;
  pageUrl: string;
  severity: AuditSeverity;
  suggestion?: string;
  targetUrl?: string;
}

export interface AuditReport {
  analyzedAt: string;
  issues: AuditIssue[];
  pageUrl: string;
}
