import { useMemo, useState } from 'react';
import { Icon } from '../components/Icon';
import type {
  AppView,
  AuditCategory,
  AuditReport,
  AuditSeverity,
} from '../types/audit';

interface ReportViewProps {
  onNavigate: (view: AppView) => void;
  report: AuditReport | null;
}

const categoryLabels: Record<AuditCategory, string> = {
  accessibility: 'Acessibilidade',
  link: 'Links',
  resource: 'Recursos',
  responsive: 'Responsividade',
};

const severityLabels: Record<AuditSeverity, string> = {
  critical: 'Crítica',
  serious: 'Séria',
  moderate: 'Moderada',
  minor: 'Menor',
};

function exportReport(report: AuditReport) {
  const content = JSON.stringify(report, null, 2);
  const blob = new Blob([content], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  let hostname = 'pagina';

  try {
    hostname = new URL(report.finalUrl).hostname.replace(/[^a-z0-9.-]/gi, '-');
  } catch {
    hostname = 'pagina';
  }

  anchor.href = url;
  anchor.download = `rastreiaweb-${hostname}-${report.analyzedAt.slice(0, 10)}.json`;
  anchor.click();
  URL.revokeObjectURL(url);
}

export function ReportView({ onNavigate, report }: ReportViewProps) {
  const [category, setCategory] = useState<'all' | AuditCategory>('all');
  const [severity, setSeverity] = useState<'all' | AuditSeverity>('all');
  const filteredIssues = useMemo(() => report?.issues.filter((issue) =>
    (category === 'all' || issue.category === category) &&
    (severity === 'all' || issue.severity === severity),
  ) ?? [], [category, report, severity]);

  if (!report) {
    return (
      <section className="empty-page page-panel">
        <span><Icon name="report" /></span>
        <h2>Nenhum relatório disponível</h2>
        <p>Execute uma auditoria para preencher esta área com dados reais.</p>
        <button className="primary-button" type="button" onClick={() => onNavigate('new-audit')}>
          Criar auditoria
        </button>
      </section>
    );
  }

  return (
    <section className="report-view">
      <div className="report-header page-panel">
        <div>
          <span className="card-eyebrow">Relatório mais recente</span>
          <h2>{report.pageTitle}</h2>
          <a href={report.finalUrl} target="_blank" rel="noreferrer">{report.finalUrl}</a>
          <p>Analisado em {new Date(report.analyzedAt).toLocaleString('pt-BR')} · {report.durationMs} ms</p>
        </div>
        <div className="report-actions">
          <button className="secondary-button" type="button" onClick={() => window.print()}>
            Imprimir
          </button>
          <button className="primary-button" type="button" onClick={() => exportReport(report)}>
            <Icon name="download" />Exportar JSON
          </button>
        </div>
      </div>

      <div className="summary-cards">
        <article><small>Ocorrências</small><strong>{report.summary.totalIssues}</strong><span>Total identificado</span></article>
        <article><small>Links quebrados</small><strong>{report.summary.brokenLinks}</strong><span>{report.summary.linksChecked} verificados</span></article>
        <article><small>Recursos com falha</small><strong>{report.summary.failedResources}</strong><span>{report.summary.resourcesChecked} verificados</span></article>
        <article><small>Imagens sem alt</small><strong>{report.summary.imagesWithoutAlt}</strong><span>{report.summary.imagesFound} encontradas</span></article>
      </div>

      <div className="issues-panel page-panel">
        <div className="issues-toolbar">
          <div>
            <span className="card-eyebrow">Ocorrências técnicas</span>
            <h2>{filteredIssues.length} resultado(s)</h2>
          </div>
          <div className="filter-groups">
            <label>
              Categoria
              <select value={category} onChange={(event) => setCategory(event.target.value as 'all' | AuditCategory)}>
                <option value="all">Todas</option>
                {Object.entries(categoryLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
              </select>
            </label>
            <label>
              Gravidade
              <select value={severity} onChange={(event) => setSeverity(event.target.value as 'all' | AuditSeverity)}>
                <option value="all">Todas</option>
                {Object.entries(severityLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
              </select>
            </label>
          </div>
        </div>

        {filteredIssues.length === 0 ? (
          <div className="no-issues">
            <Icon name="shield" />
            <strong>Nenhuma ocorrência para estes filtros</strong>
            <span>Isso não garante ausência total de problemas; mantenha também revisões manuais.</span>
          </div>
        ) : (
          <ol className="issue-list">
            {filteredIssues.map((issue, index) => (
              <li key={`${issue.code}-${issue.targetUrl ?? index}-${index}`}>
                <div className="issue-topline">
                  <span className={`severity-badge ${issue.severity}`}>{severityLabels[issue.severity]}</span>
                  <span>{categoryLabels[issue.category]}</span>
                  <code>{issue.code}</code>
                  {issue.statusCode && <span>HTTP {issue.statusCode}</span>}
                </div>
                <h3>{issue.description}</h3>
                {issue.targetUrl && <a href={issue.targetUrl} target="_blank" rel="noreferrer">{issue.targetUrl}</a>}
                {issue.element && <pre><code>{issue.element}</code></pre>}
                {issue.suggestion && <p><strong>Como corrigir:</strong> {issue.suggestion}</p>}
              </li>
            ))}
          </ol>
        )}
      </div>

      <p className="report-disclaimer">{report.disclaimer}</p>
    </section>
  );
}
