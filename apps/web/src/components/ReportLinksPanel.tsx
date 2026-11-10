import { useEffect, useMemo, useState } from 'react';
import type { AuditLinkResult, AuditLinkState } from '../types/audit';
import { Icon } from './Icon';

interface ReportLinksPanelProps {
  discoveredDestinations: number;
  links: AuditLinkResult[];
}

type LinkOrder = 'document' | 'result' | 'status' | 'text';
type LinkScope = 'external' | 'internal' | 'invalid';

const stateLabels: Record<AuditLinkState, string> = {
  broken: 'Quebrado',
  not_checked: 'Não verificado',
  ok: 'Funcionando',
  redirected: 'Redirecionado',
  restricted: 'Verificação inconclusiva',
  unavailable: 'Indisponível',
  unreachable: 'Inacessível',
};

const stateOrder: Record<AuditLinkState, number> = {
  broken: 0,
  unreachable: 1,
  unavailable: 2,
  restricted: 3,
  redirected: 4,
  not_checked: 5,
  ok: 6,
};

function isHttpUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

function isReportableLink(link: AuditLinkResult): boolean {
  const declaredHref = link.declaredHref.trim();

  if (
    !declaredHref ||
    declaredHref.startsWith('#') ||
    /^(?:\.{0,2}\/|\/)?@[a-z][\w.-]*$/i.test(declaredHref) ||
    /^(?:undefined|null|false|\[object Object\])$/i.test(declaredHref) ||
    /\{\{.*\}\}|\$\{.*\}|\[\[.*\]\]|<%.*%>/.test(declaredHref) ||
    /^(?:javascript|data|mailto|tel|sms|blob|about):/i.test(declaredHref)
  ) {
    return false;
  }

  try {
    const target = new URL(link.targetUrl);
    const page = new URL(link.pageUrl);
    target.hash = '';
    page.hash = '';
    return target.toString() !== page.toString();
  } catch {
    return true;
  }
}

function destinationKey(link: AuditLinkResult): string {
  try {
    const url = new URL(link.targetUrl);
    url.hash = '';
    return url.toString();
  } catch {
    return link.targetUrl;
  }
}

function linkScope(link: AuditLinkResult): LinkScope {
  try {
    const target = new URL(link.targetUrl);
    const page = new URL(link.pageUrl);

    return target.hostname === page.hostname ? 'internal' : 'external';
  } catch {
    return 'invalid';
  }
}

const scopeLabels: Record<LinkScope, string> = {
  external: 'Domínio externo',
  internal: 'Mesmo domínio',
  invalid: 'Destino inválido',
};

function notCheckedExplanation(link: AuditLinkResult): string {
  if (link.checkReason === 'invalid_url') {
    return 'O valor do href não pôde ser interpretado como uma URL válida e não recebeu uma requisição de rede.';
  }

  if (link.checkReason === 'unsupported_protocol') {
    return 'Este link foi encontrado no HTML, mas não usa HTTP ou HTTPS e não recebe uma requisição de rede.';
  }

  return 'Este link foi encontrado no HTML, mas ficou fora da verificação HTTP por causa do limite configurado.';
}

export function ReportLinksPanel({
  discoveredDestinations,
  links,
}: ReportLinksPanelProps) {
  const [query, setQuery] = useState('');
  const [state, setState] = useState<'all' | AuditLinkState>('all');
  const [scope, setScope] = useState<'all' | Exclude<LinkScope, 'invalid'>>('all');
  const [order, setOrder] = useState<LinkOrder>('document');
  const [visibleCount, setVisibleCount] = useState(20);
  const reportableLinks = useMemo(() => links.filter(isReportableLink), [links]);
  const filteredLinks = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    const result = reportableLinks.filter((link) =>
      (state === 'all' || link.state === state) &&
      (scope === 'all' || linkScope(link) === scope) &&
      (!normalizedQuery || [
        link.declaredHref,
        link.element,
        link.finalUrl,
        link.pageUrl,
        link.targetUrl,
        link.text,
      ].some((value) => value?.toLowerCase().includes(normalizedQuery))),
    );

    return [...result].sort((first, second) => {
      switch (order) {
        case 'result':
          return stateOrder[first.state] - stateOrder[second.state] ||
            first.position - second.position;
        case 'status':
          return (first.statusCode ?? Number.POSITIVE_INFINITY) -
            (second.statusCode ?? Number.POSITIVE_INFINITY) ||
            first.position - second.position;
        case 'text':
          return (first.text || first.targetUrl).localeCompare(
            second.text || second.targetUrl,
            'pt-BR',
          ) || first.position - second.position;
        default:
          return first.position - second.position;
      }
    });
  }, [order, query, reportableLinks, scope, state]);
  const visibleLinks = filteredLinks.slice(0, visibleCount);
  const checkableLinks = reportableLinks.filter((link) => isHttpUrl(link.targetUrl));
  const uniqueDestinations = new Set(checkableLinks.map(destinationKey)).size;
  const checkedDestinations = new Set(
    checkableLinks
      .filter((link) => link.state !== 'not_checked')
      .map(destinationKey),
  ).size;
  const notCheckedCount = reportableLinks.filter((link) => link.state === 'not_checked').length;

  useEffect(() => {
    setVisibleCount(20);
  }, [order, query, scope, state]);

  function clearFilters() {
    setQuery('');
    setState('all');
    setScope('all');
    setOrder('document');
  }

  if (reportableLinks.length === 0) {
    return (
      <section className="links-empty page-panel">
        <Icon name="link" />
        <h2>
          {discoveredDestinations > 0
            ? 'Inventário de links indisponível neste relatório'
            : 'Nenhum link encontrado na página'}
        </h2>
        <p>
          {discoveredDestinations > 0
            ? 'Este relatório foi criado antes do inventário completo. Execute uma nova auditoria para visualizar todos os links.'
            : 'O HTML analisado não apresentou elementos de link que pudessem ser inventariados.'}
        </p>
      </section>
    );
  }

  return (
    <section className="links-inventory" aria-labelledby="links-inventory-title">
      <div className="link-inventory-summary">
        <article><small>Links navegáveis no HTML</small><strong>{reportableLinks.length}</strong><span>Inclui repetições</span></article>
        <article><small>Destinos HTTP únicos</small><strong>{uniqueDestinations}</strong><span>Sem contar fragmentos</span></article>
        <article><small>Destinos verificados</small><strong>{checkedDestinations}</strong><span>Com resultado de rede</span></article>
        <article className="not-checked-summary"><small>Elementos não verificados</small><strong>{notCheckedCount}</strong><span>Limite, protocolo ou URL inválida</span></article>
      </div>

      <div className="links-toolbar page-panel">
        <div>
          <span className="card-eyebrow">Inventário da página</span>
          <h2 id="links-inventory-title">Todos os links encontrados</h2>
          <p>Somente destinos navegáveis. Placeholders, fragmentos locais e ações JavaScript são ignorados.</p>
        </div>
        <div className="links-controls">
          <label>
            Buscar
            <input
              aria-label="Buscar nos links"
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Texto, URL, página ou HTML"
            />
          </label>
          <label>
            Resultado
            <select
              aria-label="Filtrar links por resultado"
              value={state}
              onChange={(event) => setState(event.target.value as 'all' | AuditLinkState)}
            >
              <option value="all">Todos</option>
              {Object.entries(stateLabels).map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
          </label>
          <label>
            Domínio
            <select
              aria-label="Filtrar links por domínio"
              value={scope}
              onChange={(event) => setScope(
                event.target.value as 'all' | Exclude<LinkScope, 'invalid'>,
              )}
            >
              <option value="all">Todos os domínios</option>
              <option value="internal">Mesmo domínio</option>
              <option value="external">Somente externos</option>
            </select>
          </label>
          <label>
            Ordenar
            <select
              aria-label="Ordenar links"
              value={order}
              onChange={(event) => setOrder(event.target.value as LinkOrder)}
            >
              <option value="document">Ordem na página</option>
              <option value="text">Texto do link</option>
              <option value="status">Status HTTP</option>
              <option value="result">Resultado</option>
            </select>
          </label>
          <button className="secondary-button" type="button" onClick={clearFilters}>
            Limpar
          </button>
        </div>
      </div>

      <div className="links-results page-panel">
        <div className="links-results-heading" aria-atomic="true" aria-live="polite">
          <strong>{filteredLinks.length} de {reportableLinks.length} link(s)</strong>
          <span>Cada número corresponde à posição do elemento no HTML.</span>
        </div>

        {filteredLinks.length === 0 ? (
          <div className="no-issues">
            <Icon name="link" />
            <strong>Nenhum link corresponde aos filtros</strong>
            <span>Limpe os filtros ou tente outra busca.</span>
          </div>
        ) : (
          <ol className="audited-link-list">
            {visibleLinks.map((link) => (
              <li className={`audited-link-card ${link.state}`} key={`${link.position}-${link.declaredHref}`}>
                <span className="link-position" aria-hidden="true">
                  {String(link.position).padStart(2, '0')}
                </span>
                <div className="link-main">
                  <div className="link-card-heading">
                    <div>
                      <small>Link {link.position} na ordem da página</small>
                      <h3>{link.text || 'Link sem texto visível'}</h3>
                    </div>
                    <div className="link-result-badges">
                      <span className={`link-scope-badge ${linkScope(link)}`}>
                        {scopeLabels[linkScope(link)]}
                      </span>
                      <span className={`link-state-badge ${link.state}`}>
                        {stateLabels[link.state]}
                      </span>
                      {link.statusCode !== undefined && <span>HTTP {link.statusCode}</span>}
                    </div>
                  </div>

                  <div className="link-destination">
                    <small>Destino</small>
                    {isHttpUrl(link.targetUrl) ? (
                      <a href={link.targetUrl} target="_blank" rel="noreferrer">
                        {link.targetUrl}
                      </a>
                    ) : (
                      <code>{link.targetUrl}</code>
                    )}
                  </div>

                  {link.finalUrl && link.redirects.length > 0 && (
                    <div className="link-final-url">
                      <small>Destino final</small>
                      <a href={link.finalUrl} target="_blank" rel="noreferrer">
                        {link.finalUrl}
                      </a>
                    </div>
                  )}

                  {link.state === 'not_checked' && (
                    <p className="link-not-checked">{notCheckedExplanation(link)}</p>
                  )}

                  <dl className="link-metadata">
                    <div>
                      <dt>Página de origem</dt>
                      <dd>
                        {isHttpUrl(link.pageUrl) ? (
                          <a href={link.pageUrl} target="_blank" rel="noreferrer">
                            {link.pageUrl}
                          </a>
                        ) : link.pageUrl}
                      </dd>
                    </div>
                    <div><dt>href declarado</dt><dd><code>{link.declaredHref || '(vazio)'}</code></dd></div>
                    <div><dt>Redirecionamentos</dt><dd>{link.redirects.length}</dd></div>
                  </dl>

                  <details className="link-evidence">
                    <summary>
                      {link.redirects.length > 0
                        ? 'Ver elemento HTML e rota de redirecionamento'
                        : 'Ver elemento HTML'}
                    </summary>
                    <pre><code>{link.element}</code></pre>
                    {link.redirects.length > 0 && (
                      <ol>
                        {link.redirects.map((redirect, index) => (
                          <li key={`${redirect}-${index}`}>{redirect}</li>
                        ))}
                      </ol>
                    )}
                  </details>
                </div>
              </li>
            ))}
          </ol>
        )}
        {visibleCount < filteredLinks.length && (
          <button
            className="secondary-button load-more-button"
            type="button"
            onClick={() => setVisibleCount((count) => count + 20)}
          >
            Mostrar mais links
            <span>{filteredLinks.length - visibleCount} restantes</span>
          </button>
        )}
      </div>
    </section>
  );
}
