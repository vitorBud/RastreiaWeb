import { useMemo, useState } from 'react';
import { Icon } from '../components/Icon';
import type {
  AppView,
  AuditCategory,
  AuditIssue,
  AuditReport,
  AuditSeverity,
} from '../types/audit';

interface ReportViewProps {
  onNavigate: (view: AppView) => void;
  report: AuditReport | null;
}

type IssueOutcome =
  | 'attention'
  | 'confirmed'
  | 'inconclusive'
  | 'redirected'
  | 'unavailable';

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

const outcomeLabels: Record<IssueOutcome, string> = {
  attention: 'Requer atenção',
  confirmed: 'Problema confirmado',
  inconclusive: 'Verificação inconclusiva',
  redirected: 'Redirecionamento',
  unavailable: 'Destino indisponível',
};

const severityOrder: Record<AuditSeverity, number> = {
  critical: 0,
  serious: 1,
  moderate: 2,
  minor: 3,
};

function issueOutcome(issue: AuditIssue): IssueOutcome {
  switch (issue.code) {
    case 'NOT_FOUND':
    case 'IMAGE_ALT_MISSING':
      return 'confirmed';
    case 'ACCESS_RESTRICTED':
      return 'inconclusive';
    case 'REDIRECT':
      return 'redirected';
    case 'SERVER_ERROR':
    case 'HTTP_ERROR':
    case 'UNREACHABLE':
      return 'unavailable';
    default:
      return 'attention';
  }
}

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
  const [outcome, setOutcome] = useState<'all' | IssueOutcome>('all');
  const [query, setQuery] = useState('');
  const [copiedUrl, setCopiedUrl] = useState('');
  const filteredIssues = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    return report?.issues
      .filter((issue) =>
        (category === 'all' || issue.category === category) &&
        (severity === 'all' || issue.severity === severity) &&
        (outcome === 'all' || issueOutcome(issue) === outcome) &&
        (!normalizedQuery || [
          issue.code,
          issue.description,
          issue.element,
          issue.targetUrl,
        ].some((value) => value?.toLowerCase().includes(normalizedQuery))),
      )
      .sort((first, second) => severityOrder[first.severity] - severityOrder[second.severity]) ?? [];
  }, [category, outcome, query, report, severity]);

  function clearFilters() {
    setCategory('all');
    setSeverity('all');
    setOutcome('all');
    setQuery('');
  }

  async function copyUrl(url: string) {
    try {
      await navigator.clipboard.writeText(url);
      setCopiedUrl(url);
      window.setTimeout(() => setCopiedUrl(''), 1_800);
    } catch {
      setCopiedUrl('');
    }
  }

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

  const severityCounts = Object.keys(severityLabels).reduce((counts, item) => ({
    ...counts,
    [item]: report.issues.filter((issue) => issue.severity === item).length,
  }), {} as Record<AuditSeverity, number>);
  const inconclusiveCount = report.issues.filter(
    (issue) => issue.code === 'ACCESS_RESTRICTED',
  ).length;

  return (
    <section className="report-view">
      <div className="report-hero page-panel">
        <div className="report-identity">
          <span className={`report-state ${report.summary.totalIssues === 0 ? 'clean' : 'attention'}`}>
            {report.summary.totalIssues === 0 ? 'Nenhuma ocorrência automática' : 'Revisão recomendada'}
          </span>
          <h2>{report.pageTitle}</h2>
          <a href={report.finalUrl} target="_blank" rel="noreferrer">{report.finalUrl}</a>
          <p>
            {new Date(report.analyzedAt).toLocaleString('pt-BR')} · {report.durationMs} ms
          </p>
        </div>
        <div className="report-actions">
          <button className="secondary-button" type="button" onClick={() => window.print()}>
            Imprimir
          </button>
          <button className="primary-button" type="button" onClick={() => exportReport(report)}>
            <Icon name="download" />Exportar JSON
          </button>
        </div>
        <dl className="report-coverage">
          <div><dt>Links verificados</dt><dd>{report.summary.linksChecked} de {report.summary.linksFound}</dd></div>
          <div><dt>Recursos verificados</dt><dd>{report.summary.resourcesChecked}</dd></div>
          <div><dt>Limite aplicado</dt><dd>{report.limits.maxLinks} links · {report.limits.maxResources} recursos</dd></div>
        </dl>
      </div>

      <div className="summary-cards report-summary-cards">
        <article><small>Ocorrências</small><strong>{report.summary.totalIssues}</strong><span>Total automático</span></article>
        <article><small>Quebrados confirmados</small><strong>{report.summary.brokenLinks}</strong><span>HTTP 404 ou 410 via GET</span></article>
        <article><small>Inconclusivos</small><strong>{inconclusiveCount}</strong><span>Bloqueio ou autenticação</span></article>
        <article><small>Imagens sem alt</small><strong>{report.summary.imagesWithoutAlt}</strong><span>{report.summary.imagesFound} encontradas</span></article>
      </div>

      <div className="severity-overview page-panel" aria-label="Ocorrências por gravidade">
        {Object.entries(severityLabels).map(([value, label]) => (
          <button
            type="button"
            key={value}
            className={severity === value ? 'active' : ''}
            aria-pressed={severity === value}
            onClick={() => setSeverity(
              severity === value ? 'all' : value as AuditSeverity,
            )}
          >
            <span className={`severity-dot ${value}`} />
            <span>{label}</span>
            <strong>{severityCounts[value as AuditSeverity]}</strong>
          </button>
        ))}
      </div>

      <div className="report-workspace">
        <aside className="report-filters page-panel" aria-label="Filtros do relatório">
          <div>
            <span className="card-eyebrow">Refinar resultados</span>
            <h2>Filtros</h2>
          </div>
          <label className="report-search">
            Buscar
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="URL, código ou descrição"
            />
          </label>
          <fieldset>
            <legend>Categoria</legend>
            <select aria-label="Categoria" value={category} onChange={(event) => setCategory(event.target.value as 'all' | AuditCategory)}>
              <option value="all">Todas</option>
              {Object.entries(categoryLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
          </fieldset>
          <fieldset>
            <legend>Resultado</legend>
            <select aria-label="Resultado" value={outcome} onChange={(event) => setOutcome(event.target.value as 'all' | IssueOutcome)}>
              <option value="all">Todos</option>
              {Object.entries(outcomeLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
          </fieldset>
          <fieldset>
            <legend>Gravidade</legend>
            <select aria-label="Gravidade" value={severity} onChange={(event) => setSeverity(event.target.value as 'all' | AuditSeverity)}>
              <option value="all">Todas</option>
              {Object.entries(severityLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
          </fieldset>
          <button className="secondary-button" type="button" onClick={clearFilters}>
            Limpar filtros
          </button>
        </aside>

        <div className="issues-panel page-panel">
          <div className="issues-toolbar">
            <div>
              <span className="card-eyebrow">Ocorrências técnicas</span>
              <h2>{filteredIssues.length} de {report.issues.length} resultado(s)</h2>
            </div>
          </div>

          <div aria-live="polite">
            {filteredIssues.length === 0 ? (
              <div className="no-issues">
                <Icon name="shield" />
                <strong>Nenhuma ocorrência para estes filtros</strong>
                <span>Isso não garante ausência total de problemas; mantenha revisões manuais.</span>
              </div>
            ) : (
              <ol className="issue-list refined">
                {filteredIssues.map((issue, index) => {
                  const result = issueOutcome(issue);
                  return (
                    <li className={`issue-card ${result} ${issue.severity}`} key={`${issue.code}-${issue.targetUrl ?? index}-${index}`}>
                      <div className="issue-topline">
                        <span className={`outcome-badge ${result}`}>{outcomeLabels[result]}</span>
                        <span className={`severity-badge ${issue.severity}`}>{severityLabels[issue.severity]}</span>
                        <span>{categoryLabels[issue.category]}</span>
                        {issue.statusCode !== undefined && <span>HTTP {issue.statusCode}</span>}
                      </div>

                      <div className="issue-problem">
                        <small>Problema identificado</small>
                        <h3>{issue.description}</h3>
                      </div>

                      {issue.targetUrl && (
                        <div className="issue-target">
                          <a href={issue.targetUrl} target="_blank" rel="noreferrer">{issue.targetUrl}</a>
                          <button type="button" onClick={() => copyUrl(issue.targetUrl!)}>
                            {copiedUrl === issue.targetUrl ? 'Copiado' : 'Copiar URL'}
                          </button>
                        </div>
                      )}

                      {(issue.element || issue.pageUrl) && (
                        <details className="issue-evidence">
                          <summary>Ver evidências técnicas</summary>
                          <dl>
                            <div><dt>Código</dt><dd><code>{issue.code}</code></dd></div>
                            <div><dt>Página de origem</dt><dd>{issue.pageUrl}</dd></div>
                          </dl>
                          {issue.element && <pre><code>{issue.element}</code></pre>}
                        </details>
                      )}

                      {issue.suggestion && (
                        <div className="issue-suggestion">
                          <strong>Como corrigir ou confirmar</strong>
                          <p>{issue.suggestion}</p>
                        </div>
                      )}
                    </li>
                  );
                })}
              </ol>
            )}
          </div>
        </div>
      </div>

      <p className="report-disclaimer">{report.disclaimer}</p>
    </section>
  );
}
