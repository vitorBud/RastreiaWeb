export interface AuditEngineStatus {
  ready: boolean;
  reason: string;
}

export function getAuditEngineStatus(): AuditEngineStatus {
  return {
    ready: false,
    reason: 'A validação contra SSRF deve ser implementada antes da navegação.',
  };
}
