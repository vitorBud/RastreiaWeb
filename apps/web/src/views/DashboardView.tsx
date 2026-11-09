import type { AppView, AuditCategory, AuditReport } from '../types/audit';
import { AuditForm } from '../components/AuditForm';
import { Icon } from '../components/Icon';

interface DashboardViewProps {
  auditError: string;
  historyCount: number;
  isAuditing: boolean;
  onAudit: (url: string) => Promise<void>;
  onNavigate: (view: AppView) => void;
  onResetError: () => void;
  report: AuditReport | null;
}

const categories: Array<{
  category: AuditCategory;
  className: string;
  description: string;
  label: string;
}> = [
  { category: 'link', className: 'violet', description: 'Status e redirecionamentos', label: 'Links' },
  { category: 'resource', className: 'pink', description: 'Imagens, CSS e JavaScript', label: 'Recursos' },
  { category: 'responsive', className: 'blue', description: 'Planejado para a v0.2', label: 'Responsividade' },
  { category: 'accessibility', className: 'green', description: 'Alternativas textuais iniciais', label: 'Acessibilidade' },
];

function getHostname(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return url;
  }
}

export function DashboardView(props: DashboardViewProps) {
  const { report } = props;
  const issueCount = (category: AuditCategory) =>
    report?.issues.filter((issue) => issue.category === category).length ?? 0;

  return (
    <>
      <AuditForm
        error={props.auditError}
        isLoading={props.isAuditing}
        onResetError={props.onResetError}
        onSubmit={props.onAudit}
      />

      <section className="overview-grid" aria-label="Visão geral do projeto">
        <article className="card status-card">
          <div className="card-heading">
            <span>{report ? 'Última auditoria' : 'Status do projeto'}</span>
            <span className="status-pill"><span />{report ? 'Concluída' : 'Fundação'}</span>
          </div>
          <div className="status-value">
            {report ? `${report.summary.totalIssues} ocorrência(s)` : 'Pronto para analisar'}
          </div>
          <p>
            {report
              ? report.pageTitle
              : 'Informe uma página pública autorizada para gerar o primeiro relatório.'}
          </p>
          <div className="progress-track" aria-label="Estado da última auditoria">
            <span />
          </div>
          <div className="progress-label">
            <span>{report ? getHostname(report.finalUrl) : 'Base técnica'}</span>
            <strong>{report ? `${report.durationMs} ms` : 'Concluída'}</strong>
          </div>
        </article>

        <article className="card security-card">
          <div className="security-glow" />
          <Icon name="shield" />
          <span className="card-eyebrow">Camada de segurança</span>
          <h2>Navegação controlada</h2>
          <p>Redirecionamentos, DNS, IPs privados, tamanho e tempo de resposta possuem limites.</p>
          <button className="inline-link" type="button" onClick={() => props.onNavigate('help')}>
            Entender as proteções <span aria-hidden="true">→</span>
          </button>
        </article>

        <article className="card categories-card">
          <div className="card-heading">
            <span>Categorias da auditoria</span>
            <button className="text-button" type="button" onClick={() => props.onNavigate('reports')}>
              Ver relatório
            </button>
          </div>
          <ul>
            {categories.map((item) => (
              <li key={item.category}>
                <span className={`category-icon ${item.className}`} aria-hidden="true" />
                <span><strong>{item.label}</strong><small>{item.description}</small></span>
                <span className="pending-badge">
                  {report && item.category !== 'responsive'
                    ? issueCount(item.category)
                    : item.category === 'responsive' ? 'Em breve' : '—'}
                </span>
              </li>
            ))}
          </ul>
        </article>

        <article className="card scope-card">
          <div className="card-heading">
            <span>Escopo atual</span>
            <span className="scope-count">v0.1</span>
          </div>
          <div className="scope-grid">
            <div><small>Links verificados</small><strong>{report?.summary.linksChecked ?? 0}</strong><span>de {report?.summary.linksFound ?? 0} encontrados</span></div>
            <div><small>Recursos verificados</small><strong>{report?.summary.resourcesChecked ?? 0}</strong><span>{report?.summary.failedResources ?? 0} com falha</span></div>
            <div><small>Imagens encontradas</small><strong>{report?.summary.imagesFound ?? 0}</strong><span>{report?.summary.imagesWithoutAlt ?? 0} sem alt</span></div>
            <div><small>Histórico local</small><strong>{props.historyCount}</strong><span>auditorias salvas</span></div>
          </div>
        </article>

        <article className="card chart-card">
          <div className="chart-header">
            <div>
              <span className="card-eyebrow">Diagnóstico</span>
              <h2>{report ? 'Resumo da última página' : 'Aguardando primeira análise'}</h2>
            </div>
            {report && (
              <button className="secondary-button" type="button" onClick={() => props.onNavigate('reports')}>
                Abrir detalhes
              </button>
            )}
          </div>
          {report ? (
            <div className="metric-bars">
              {categories.slice(0, 3).map((item) => {
                const count = issueCount(item.category);
                const width = Math.min(100, count * 12);
                return (
                  <div className="metric-row" key={item.category}>
                    <span>{item.label}</span>
                    <div><span style={{ width: `${width}%` }} /></div>
                    <strong>{count}</strong>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="empty-chart">
              <div className="chart-grid" />
              <div className="empty-chart-content">
                <span><Icon name="report" /></span>
                <strong>O relatório aparecerá aqui</strong>
                <small>A análise não será simulada: os dados virão da página informada.</small>
              </div>
            </div>
          )}
        </article>

        <article className="card next-card">
          <span className="step-number">{report ? '✓' : '01'}</span>
          <div>
            <span className="card-eyebrow">Ação recomendada</span>
            <h2>{report ? 'Revise as ocorrências encontradas' : 'Execute a primeira auditoria'}</h2>
            <p>{report ? report.disclaimer : 'A página será analisada com limites de segurança e sem crawler irrestrito.'}</p>
          </div>
          <button className="next-arrow" type="button" onClick={() => props.onNavigate(report ? 'reports' : 'new-audit')} aria-label={report ? 'Abrir relatório' : 'Criar auditoria'}>
            ↗
          </button>
        </article>
      </section>
    </>
  );
}
