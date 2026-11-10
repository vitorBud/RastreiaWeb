import { AuditForm } from '../components/AuditForm';
import type { AuditProgress } from '../types/audit';

interface NewAuditViewProps {
  auditProgress: AuditProgress | null;
  error: string;
  isAuditing: boolean;
  onAudit: (url: string) => Promise<void>;
  onResetError: () => void;
}

export function NewAuditView(props: NewAuditViewProps) {
  return (
    <section className="page-panel audit-page">
      <div className="page-intro">
        <span className="card-eyebrow">Auditoria v0.1</span>
        <h2>Analise uma página pública</h2>
        <p>O RastreiaWeb verifica uma única página, respeitando limites de rede e quantidade de recursos.</p>
      </div>

      <AuditForm
        error={props.error}
        isLoading={props.isAuditing}
        progress={props.auditProgress}
        onResetError={props.onResetError}
        onSubmit={props.onAudit}
        variant="full"
      />

      <div className="safety-grid">
        <article><strong>Destino público</strong><span>Redes locais, privadas e reservadas são bloqueadas.</span></article>
        <article><strong>Escopo limitado</strong><span>Apenas uma página e uma quantidade controlada de recursos.</span></article>
        <article><strong>Sem execução livre</strong><span>O HTML é interpretado com scripts e rede bloqueados.</span></article>
      </div>
    </section>
  );
}
