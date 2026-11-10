import type {
  AppView,
  AuditCategory,
  AuditReport,
  ReportFocus,
} from '../types/audit';
import { AuditForm } from '../components/AuditForm';
import { AuditHistoryChart } from '../components/AuditHistoryChart';
import { Icon } from '../components/Icon';
import { MissingAltOverview } from '../components/MissingAltOverview';

interface DashboardViewProps {
  auditError: string;
  history: AuditReport[];
  isAuditing: boolean;
  onAudit: (url: string) => Promise<void>;
  onNavigate: (view: AppView) => void;
  onOpenReport: (focus?: ReportFocus) => void;
  onResetError: () => void;
  onSelectReport: (report: AuditReport) => void;
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
  const missingAltIssues = report?.issues.filter(
    (issue) => issue.code === 'IMAGE_ALT_MISSING',
  ) ?? [];
  const linkCoverage = report
    ? report.summary.linksFound === 0
      ? 100
      : Math.round((report.summary.linksChecked / report.summary.linksFound) * 100)
    : 0;

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
            <span className="status-pill"><span />{report ? `${report.summary.totalIssues} ocorr.` : 'Fundação'}</span>
          </div>
          <div className="status-value">
            {report
              ? report.summary.totalIssues === 0
                ? 'Nenhuma ocorrência automática'
                : 'Revisão recomendada'
              : 'Pronto para analisar'}
          </div>
          <p>
            {report
              ? report.pageTitle
              : 'Informe uma página pública autorizada para gerar o primeiro relatório.'}
          </p>
          <div
            className="progress-track"
            role="progressbar"
            aria-label="Cobertura dos destinos HTTP encontrados"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={linkCoverage}
          >
            <span style={{ width: `${linkCoverage}%` }} />
          </div>
          <div className="progress-label">
            <span>{report ? `Cobertura de destinos HTTP · ${getHostname(report.finalUrl)}` : 'Base técnica'}</span>
            <strong>{report ? `${linkCoverage}%` : 'Concluída'}</strong>
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
            <button className="text-button" type="button" onClick={() => props.onOpenReport()}>
              Ver relatório
            </button>
          </div>
          <ul>
            {categories.map((item) => (
              <li key={item.category}>
                <button
                  type="button"
                  onClick={() => props.onOpenReport({ category: item.category })}
                >
                  <span className={`category-icon ${item.className}`} aria-hidden="true" />
                  <span><strong>{item.label}</strong><small>{item.description}</small></span>
                  <span className="pending-badge">
                    {report && item.category !== 'responsive'
                      ? issueCount(item.category)
                      : item.category === 'responsive' ? 'Em breve' : '—'}
                  </span>
                </button>
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
            <div><small>Destinos verificados</small><strong>{report?.summary.linksChecked ?? 0}</strong><span>de {report?.summary.linksFound ?? 0} destinos HTTP únicos</span></div>
            <div><small>Recursos verificados</small><strong>{report?.summary.resourcesChecked ?? 0}</strong><span>{report?.summary.failedResources ?? 0} com falha</span></div>
            <div><small>Imagens encontradas</small><strong>{report?.summary.imagesFound ?? 0}</strong><span>{missingAltIssues.length} ocorrências sem alt</span></div>
            <div><small>Páginas distintas</small><strong>{new Set(props.history.map((item) => item.finalUrl)).size}</strong><span>{props.history.length} auditorias salvas</span></div>
          </div>
          {report && (
            <button
              className="scope-links-action"
              type="button"
              onClick={() => props.onOpenReport({ section: 'links' })}
            >
              <span>Ver todos os links encontrados</span>
              <strong>{report.links.length} elemento(s) <span aria-hidden="true">→</span></strong>
            </button>
          )}
        </article>

        <article className="card chart-card">
          <div className="chart-header">
            <div>
              <span className="card-eyebrow">Histórico visual</span>
              <h2>Auditorias recentes</h2>
            </div>
            {report && (
              <button className="secondary-button" type="button" onClick={() => props.onOpenReport()}>
                Abrir detalhes
              </button>
            )}
          </div>
          <AuditHistoryChart
            history={props.history}
            onCreateAudit={() => props.onNavigate('new-audit')}
            onSelectReport={props.onSelectReport}
          />
        </article>

        <MissingAltOverview
          issues={missingAltIssues}
          onOpenAll={() => props.onOpenReport({
            category: 'accessibility',
            query: 'IMAGE_ALT_MISSING',
          })}
          onOpenIssue={(issue) => props.onOpenReport({
            category: 'accessibility',
            query: issue.element ?? issue.targetUrl ?? issue.description,
          })}
        />

        <article className="card next-card">
          <span className="step-number">{report ? '✓' : '01'}</span>
          <div>
            <span className="card-eyebrow">Ação recomendada</span>
            <h2>{report ? 'Revise as ocorrências encontradas' : 'Execute a primeira auditoria'}</h2>
            <p>{report ? report.disclaimer : 'A página será analisada com limites de segurança e sem crawler irrestrito.'}</p>
          </div>
          <button
            className="next-arrow"
            type="button"
            onClick={() => report ? props.onOpenReport() : props.onNavigate('new-audit')}
            aria-label={report ? 'Abrir relatório' : 'Criar auditoria'}
          >
            ↗
          </button>
        </article>
      </section>
    </>
  );
}
