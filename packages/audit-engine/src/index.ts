export {
  createDocumentInventory,
  type DocumentImage,
  type DocumentInventory,
  type DocumentLink,
  type DocumentResource,
} from './document-inventory.js';

export interface AuditEngineStatus {
  ready: boolean;
  reason: string;
}

export function getAuditEngineStatus(): AuditEngineStatus {
  return {
    ready: true,
    reason: 'Pronto para analisar HTML obtido por uma camada de rede controlada.',
  };
}
