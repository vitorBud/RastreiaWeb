import { describe, expect, it } from 'vitest';
import { getAuditEngineStatus } from './index.js';

describe('getAuditEngineStatus', () => {
  it('impede que a fundação seja confundida com uma auditoria pronta', () => {
    expect(getAuditEngineStatus()).toEqual({
      ready: false,
      reason: 'A validação contra SSRF deve ser implementada antes da navegação.',
    });
  });
});
