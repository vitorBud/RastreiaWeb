import { describe, expect, it } from 'vitest';
import { getAuditEngineStatus } from './index.js';

describe('getAuditEngineStatus', () => {
  it('informa que o motor pode analisar HTML de forma isolada', () => {
    expect(getAuditEngineStatus()).toEqual({
      ready: true,
      reason: 'Pronto para analisar HTML obtido por uma camada de rede controlada.',
    });
  });
});
