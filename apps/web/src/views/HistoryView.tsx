import { Icon } from '../components/Icon';
import type { AppView, AuditReport } from '../types/audit';

interface HistoryViewProps {
  history: AuditReport[];
  onClear: () => void;
  onDelete: (analyzedAt: string) => void;
  onNavigate: (view: AppView) => void;
  onSelect: (report: AuditReport) => void;
}

export function HistoryView(props: HistoryViewProps) {
  if (props.history.length === 0) {
    return (
      <section className="empty-page page-panel">
        <span><Icon name="history" /></span>
        <h2>Seu histórico está vazio</h2>
        <p>As auditorias concluídas serão salvas localmente neste navegador.</p>
        <button className="primary-button" type="button" onClick={() => props.onNavigate('new-audit')}>
          Criar primeira auditoria
        </button>
      </section>
    );
  }

  return (
    <section className="page-panel history-view">
      <div className="section-header">
        <div>
          <span className="card-eyebrow">Armazenamento local</span>
          <h2>{props.history.length} auditoria(s)</h2>
          <p>Estes dados permanecem apenas neste navegador.</p>
        </div>
        <button className="danger-button" type="button" onClick={props.onClear}>
          <Icon name="trash" />Limpar histórico
        </button>
      </div>

      <div className="history-list">
        {props.history.map((report) => (
          <article key={report.analyzedAt}>
            <button className="history-main" type="button" onClick={() => props.onSelect(report)}>
              <span className="history-icon"><Icon name="report" /></span>
              <span>
                <strong>{report.pageTitle}</strong>
                <small>{report.finalUrl}</small>
              </span>
              <span className="history-meta">
                <strong>{report.summary.totalIssues}</strong>
                <small>ocorrências</small>
              </span>
              <span className="history-date">
                {new Date(report.analyzedAt).toLocaleString('pt-BR')}
              </span>
              <Icon name="arrow" />
            </button>
            <button className="delete-row" type="button" onClick={() => props.onDelete(report.analyzedAt)} aria-label={`Excluir auditoria de ${report.pageTitle}`}>
              <Icon name="trash" />
            </button>
          </article>
        ))}
      </div>
    </section>
  );
}
