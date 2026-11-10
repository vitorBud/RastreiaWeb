import type { AuditCategory, AuditReport } from '../types/audit';
import { Icon } from './Icon';

interface AuditHistoryChartProps {
  history: AuditReport[];
  onCreateAudit: () => void;
  onSelectReport: (report: AuditReport) => void;
}

const categoryLabels: Record<AuditCategory, string> = {
  accessibility: 'Acessibilidade',
  link: 'Links',
  resource: 'Recursos',
  responsive: 'Responsividade',
};

function hostname(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
}

export function AuditHistoryChart({
  history,
  onCreateAudit,
  onSelectReport,
}: AuditHistoryChartProps) {
  const reports = history.slice(0, 8).reverse();
  const maxIssues = Math.max(1, ...reports.map((report) => report.summary.totalIssues));

  if (reports.length === 0) {
    return (
      <div className="empty-chart">
        <div className="chart-grid" />
        <div className="empty-chart-content">
          <span><Icon name="report" /></span>
          <strong>O histórico aparecerá aqui</strong>
          <small>Compare páginas e auditorias usando dados reais.</small>
          <button className="text-button" type="button" onClick={onCreateAudit}>
            Criar auditoria
          </button>
        </div>
      </div>
    );
  }

  return (
    <figure className="audit-history-chart" aria-labelledby="audit-history-title">
      <div
        className="history-chart-plot"
        style={{ gridTemplateColumns: `repeat(${reports.length}, minmax(3rem, 1fr))` }}
      >
        {reports.map((report) => {
          const categoryCounts = Object.keys(categoryLabels).map((category) => ({
            category: category as AuditCategory,
            count: report.issues.filter((issue) => issue.category === category).length,
          }));
          const total = report.summary.totalIssues;
          const height = total === 0 ? 0 : Math.max(12, (total / maxIssues) * 100);
          const accessibleBreakdown = categoryCounts
            .filter((item) => item.count > 0)
            .map((item) => `${item.count} em ${categoryLabels[item.category]}`)
            .join(', ');
          const date = new Date(report.analyzedAt).toLocaleDateString('pt-BR', {
            day: '2-digit',
            month: '2-digit',
          });

          return (
            <button
              className="history-chart-column"
              type="button"
              key={report.analyzedAt}
              onClick={() => onSelectReport(report)}
              aria-label={`${report.pageTitle}, ${date}, ${total} ocorrência(s)${accessibleBreakdown ? `: ${accessibleBreakdown}` : ''}`}
            >
              <span className="chart-total">{total}</span>
              <span className="chart-bar-track">
                {total === 0 ? (
                  <span className="chart-zero-marker" />
                ) : (
                  <span className="chart-bar-stack" style={{ height: `${height}%` }}>
                    {categoryCounts.filter((item) => item.count > 0).map((item) => (
                      <span
                        className={`chart-segment ${item.category}`}
                        key={item.category}
                        style={{ flexGrow: item.count }}
                        title={`${categoryLabels[item.category]}: ${item.count}`}
                      />
                    ))}
                  </span>
                )}
              </span>
              <span className="chart-hostname" title={hostname(report.finalUrl)}>
                {hostname(report.finalUrl)}
              </span>
              <span className="chart-date">{date}</span>
            </button>
          );
        })}
      </div>
      <div className="chart-legend" aria-hidden="true">
        {Object.entries(categoryLabels).map(([category, label]) => (
          <span key={category}><i className={category} />{label}</span>
        ))}
      </div>
      <figcaption id="audit-history-title">
        Auditorias recentes: ocorrências por categoria. Clique em uma barra para abrir o relatório.
      </figcaption>
    </figure>
  );
}
