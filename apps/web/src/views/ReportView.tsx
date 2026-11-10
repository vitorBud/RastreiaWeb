import { useEffect, useMemo, useState } from 'react';
import { Icon } from '../components/Icon';
import { ReportLinksPanel } from '../components/ReportLinksPanel';
import type {
  AppView,
  AuditCategory,
  AuditIssue,
  AuditReport,
  AuditSeverity,
  ReportFocus,
} from '../types/audit';

interface ReportViewProps {
  initialFocus?: ReportFocus;
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

const viewportLabels = {
  desktop: 'Desktop',
  mobile: 'Celular',
  tablet: 'Tablet',
} as const;

function ResponsiveOverview({ report }: { report: AuditReport }) {
  const result = report.responsive;

  if (!result) {
    return null;
  }

  return (
    <section className="responsive-overview page-panel" aria-labelledby="responsive-title">
      <div className="responsive-overview-heading">
        <div>
          <span className="card-eyebrow">Teste por resolução</span>
          <h2 id="responsive-title">Responsividade</h2>
          <p>{result.message}</p>
        </div>
        <span className={`responsive-analysis-state ${result.status}`}>
          {result.status === 'completed' ? 'Análise concluída' : 'Análise indisponível'}
        </span>
      </div>

      {result.status === 'completed' && (
        <div className="responsive-viewport-grid">
          {result.viewports.map((viewport) => {
            const issueCount = viewport.overflowingElements.length;

            return (
              <article
                className={viewport.horizontalOverflow ? 'attention' : 'clean'}
                key={viewport.name}
              >
                <div>
                  <span>{viewportLabels[viewport.name]}</span>
                  <strong>{viewport.width} × {viewport.height}</strong>
                </div>
                <span className="responsive-viewport-state">
                  {viewport.horizontalOverflow ? 'Overflow detectado' : 'Sem overflow horizontal'}
                </span>
                <dl>
                  <div><dt>Largura do documento</dt><dd>{viewport.documentWidth}px</dd></div>
                  <div><dt>Elementos sinalizados</dt><dd>{issueCount}</dd></div>
                </dl>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}

function hostname(url: string | undefined): string {
  if (!url) {
    return 'Não informado';
  }

  try {
    return new URL(url).hostname;
  } catch {
    return url;
  }
}

function fileName(url: string | undefined): string {
  if (!url) {
    return 'Imagem sem URL identificável';
  }

  try {
    const parsedUrl = new URL(url);
    const segments = parsedUrl.pathname.split('/').filter(Boolean);
    return decodeURIComponent(segments[segments.length - 1] || parsedUrl.hostname);
  } catch {
    return url;
  }
}

function issueOutcome(issue: AuditIssue): IssueOutcome {
  switch (issue.code) {
    case 'NOT_FOUND':
    case 'IMAGE_ALT_MISSING':
    case 'INVALID_LINK_TARGET':
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

interface ImageAltDetailsProps {
  copiedUrl: string;
  issue: AuditIssue;
  onCopyUrl: (url: string) => void;
}

function ImageAltDetails({ copiedUrl, issue, onCopyUrl }: ImageAltDetailsProps) {
  const imageHost = hostname(issue.targetUrl);
  const pageHost = hostname(issue.pageUrl);
  const imageName = fileName(issue.targetUrl);
  const externalResource = imageHost !== 'Não informado' && imageHost !== pageHost;

  return (
    <details className="image-alt-details">
      <summary>
        <span>
          <small>Imagem afetada</small>
          <strong>{imageName}</strong>
        </span>
        <span>Ver detalhes</span>
      </summary>

      <section
        className="image-alt-details-body"
        aria-label={`Detalhes da imagem sem alt: ${imageName}`}
      >
        <dl className="image-alt-grid">
        <div className="image-alt-field wide">
          <dt>URL exata da imagem</dt>
          <dd className="image-alt-address">
            {issue.targetUrl ? (
              <>
                <a href={issue.targetUrl} target="_blank" rel="noreferrer">
                  {issue.targetUrl}
                </a>
                <button
                  type="button"
                  onClick={() => onCopyUrl(issue.targetUrl!)}
                  aria-label={`Copiar URL da imagem ${imageName}`}
                >
                  {copiedUrl === issue.targetUrl ? 'URL copiada' : 'Copiar URL'}
                </button>
              </>
            ) : (
              <span>O elemento não possui uma URL pública identificável.</span>
            )}
          </dd>
        </div>

        <div className="image-alt-field">
          <dt>Hospedada em</dt>
          <dd>
            <strong>{imageHost}</strong>
            <span className={`origin-label ${externalResource ? 'external' : ''}`}>
              {externalResource ? 'domínio externo' : 'mesmo domínio'}
            </span>
          </dd>
        </div>

        <div className="image-alt-field">
          <dt>Site analisado</dt>
          <dd><strong>{pageHost}</strong></dd>
        </div>

        <div className="image-alt-field wide">
          <dt>Encontrada na página</dt>
          <dd className="image-alt-page">
            <a href={issue.pageUrl} target="_blank" rel="noreferrer">
              {issue.pageUrl}
            </a>
          </dd>
        </div>

        <div className="image-alt-field">
          <dt>Regra da auditoria</dt>
          <dd><code>{issue.code}</code></dd>
        </div>

        <div className="image-alt-field">
          <dt>Estado encontrado</dt>
          <dd><code>alt</code> não está presente no elemento.</dd>
        </div>
        </dl>

        {issue.element && (
          <div className="image-alt-element">
            <span>Elemento HTML encontrado</span>
            <pre><code>{issue.element}</code></pre>
          </div>
        )}
      </section>
    </details>
  );
}

function exportReport(report: AuditReport) {
  const content = JSON.stringify(report, null, 2);
  const blob = new Blob([content], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  let exportHostname = 'pagina';

  try {
    exportHostname = new URL(report.finalUrl).hostname.replace(/[^a-z0-9.-]/gi, '-');
  } catch {
    exportHostname = 'pagina';
  }

  anchor.href = url;
  anchor.download = `rastreiaweb-${exportHostname}-${report.analyzedAt.slice(0, 10)}.json`;
  anchor.click();
  URL.revokeObjectURL(url);
}

export function ReportView({ initialFocus = {}, onNavigate, report }: ReportViewProps) {
  const [category, setCategory] = useState<'all' | AuditCategory>(
    initialFocus.category ?? 'all',
  );
  const [severity, setSeverity] = useState<'all' | AuditSeverity>('all');
  const [outcome, setOutcome] = useState<'all' | IssueOutcome>('all');
  const [query, setQuery] = useState(initialFocus.query ?? '');
  const [copiedUrl, setCopiedUrl] = useState('');
  const [section, setSection] = useState<'issues' | 'links'>(
    initialFocus.section ?? 'issues',
  );
  const [visibleIssueCount, setVisibleIssueCount] = useState(15);
  const [showFilters, setShowFilters] = useState(
    Boolean(initialFocus.category || initialFocus.query),
  );
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
          issue.pageUrl,
          issue.targetUrl,
        ].some((value) => value?.toLowerCase().includes(normalizedQuery))),
      )
      .sort((first, second) => severityOrder[first.severity] - severityOrder[second.severity]) ?? [];
  }, [category, outcome, query, report, severity]);
  const visibleIssues = filteredIssues.slice(0, visibleIssueCount);

  useEffect(() => {
    setVisibleIssueCount(15);
  }, [category, outcome, query, severity]);

  function changeSection(nextSection: 'issues' | 'links') {
    setSection(nextSection);
  }

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
  const activeFilterCount = [
    category !== 'all',
    severity !== 'all',
    outcome !== 'all',
    Boolean(query.trim()),
  ].filter(Boolean).length;

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
      </div>

      <details className="report-overview-disclosure page-panel">
        <summary>
          <span>
            <strong>Resumo da auditoria</strong>
            <small>
              {report.summary.totalIssues} ocorrências · {report.summary.brokenLinks} quebrados · {report.summary.imagesWithoutAlt} sem alt
            </small>
          </span>
          <span>Ver resumo</span>
        </summary>
        <div className="report-overview-content">
          <div className="summary-cards report-summary-cards">
            <article><small>Ocorrências</small><strong>{report.summary.totalIssues}</strong><span>Total automático</span></article>
            <article><small>Quebrados confirmados</small><strong>{report.summary.brokenLinks}</strong><span>HTTP 404 ou 410 via GET</span></article>
            <article><small>Inconclusivos</small><strong>{inconclusiveCount}</strong><span>Bloqueio ou autenticação</span></article>
            <article><small>Imagens sem alt</small><strong>{report.summary.imagesWithoutAlt}</strong><span>{report.summary.imagesFound} encontradas</span></article>
          </div>
          <dl className="report-coverage">
            <div><dt>Links navegáveis</dt><dd>{report.links.length} elementos</dd></div>
            <div><dt>Destinos verificados</dt><dd>{report.summary.linksChecked} de {report.summary.linksFound}</dd></div>
            <div><dt>Recursos verificados</dt><dd>{report.summary.resourcesChecked}</dd></div>
            <div><dt>Limite aplicado</dt><dd>{report.limits.maxLinks} destinos · {report.limits.maxResources} recursos</dd></div>
          </dl>
        </div>
      </details>

      <ResponsiveOverview report={report} />

      <nav className="report-sections page-panel" aria-label="Conteúdo do relatório">
        <button
          type="button"
          className={section === 'issues' ? 'active' : ''}
          aria-pressed={section === 'issues'}
          onClick={() => changeSection('issues')}
        >
          <span>Ocorrências</span>
          <strong>{report.issues.length}</strong>
        </button>
        <button
          type="button"
          className={section === 'links' ? 'active' : ''}
          aria-pressed={section === 'links'}
          onClick={() => changeSection('links')}
        >
          <span>Todos os links</span>
          <strong>{report.links.length}</strong>
        </button>
      </nav>

      <div
        className={`report-section-content report-section-${section}`}
        key={section}
      >
      {section === 'issues' ? (
          <div className="issues-panel page-panel">
            <div className="issues-toolbar">
              <div>
                <span className="card-eyebrow">Ocorrências técnicas</span>
                <h2>{filteredIssues.length} de {report.issues.length} resultado(s)</h2>
              </div>
              <button
                className="secondary-button filter-toggle"
                type="button"
                aria-expanded={showFilters}
                onClick={() => setShowFilters((visible) => !visible)}
              >
                {showFilters ? 'Ocultar filtros' : 'Mostrar filtros'}
                {activeFilterCount > 0 && <span>{activeFilterCount}</span>}
              </button>
            </div>

            {showFilters && (
              <div className="report-filter-drawer">
                <div className="severity-overview" aria-label="Ocorrências por gravidade">
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
                <div className="report-filters" aria-label="Filtros do relatório">
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
                    <select
                      aria-label="Categoria"
                      value={category}
                      onChange={(event) => setCategory(
                        event.target.value as 'all' | AuditCategory,
                      )}
                    >
                      <option value="all">Todas</option>
                      {Object.entries(categoryLabels).map(([value, label]) => (
                        <option key={value} value={value}>{label}</option>
                      ))}
                    </select>
                  </fieldset>
                  <fieldset>
                    <legend>Resultado</legend>
                    <select
                      aria-label="Resultado"
                      value={outcome}
                      onChange={(event) => setOutcome(
                        event.target.value as 'all' | IssueOutcome,
                      )}
                    >
                      <option value="all">Todos</option>
                      {Object.entries(outcomeLabels).map(([value, label]) => (
                        <option key={value} value={value}>{label}</option>
                      ))}
                    </select>
                  </fieldset>
                  <fieldset>
                    <legend>Gravidade</legend>
                    <select
                      aria-label="Gravidade"
                      value={severity}
                      onChange={(event) => setSeverity(
                        event.target.value as 'all' | AuditSeverity,
                      )}
                    >
                      <option value="all">Todas</option>
                      {Object.entries(severityLabels).map(([value, label]) => (
                        <option key={value} value={value}>{label}</option>
                      ))}
                    </select>
                  </fieldset>
                  <button className="secondary-button" type="button" onClick={clearFilters}>
                    Limpar filtros
                  </button>
                </div>
              </div>
            )}

            <div className="issues-results" aria-live="polite">
              {filteredIssues.length === 0 ? (
                  <div className="no-issues">
                    <Icon name="shield" />
                    <strong>Nenhuma ocorrência para estes filtros</strong>
                    <span>Isso não garante ausência total de problemas; mantenha revisões manuais.</span>
                  </div>
                ) : (
                  <ol className="issue-list refined">
                    {visibleIssues.map((issue, index) => {
                      const result = issueOutcome(issue);
                      const imageWithoutAlt = issue.code === 'IMAGE_ALT_MISSING';
                      return (
                        <li
                          className={`issue-card ${result} ${issue.severity}`}
                          key={`${issue.code}-${issue.targetUrl ?? index}-${index}`}
                        >
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

                          {imageWithoutAlt ? (
                            <ImageAltDetails
                              copiedUrl={copiedUrl}
                              issue={issue}
                              onCopyUrl={copyUrl}
                            />
                          ) : issue.targetUrl && (
                            <div className="issue-target">
                              <a href={issue.targetUrl} target="_blank" rel="noreferrer">{issue.targetUrl}</a>
                              <button type="button" onClick={() => copyUrl(issue.targetUrl!)}>
                                {copiedUrl === issue.targetUrl ? 'Copiado' : 'Copiar URL'}
                              </button>
                            </div>
                          )}

                          {!imageWithoutAlt && (issue.element || issue.pageUrl) && (
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
              {visibleIssueCount < filteredIssues.length && (
                <button
                  className="secondary-button load-more-button"
                  type="button"
                  onClick={() => setVisibleIssueCount((count) => count + 15)}
                >
                  Mostrar mais ocorrências
                  <span>{filteredIssues.length - visibleIssueCount} restantes</span>
                </button>
              )}
            </div>
          </div>
      ) : (
        <ReportLinksPanel
          discoveredDestinations={report.summary.linksFound}
          links={report.links}
        />
      )}
      </div>

      <p className="report-disclaimer">{report.disclaimer}</p>
    </section>
  );
}
