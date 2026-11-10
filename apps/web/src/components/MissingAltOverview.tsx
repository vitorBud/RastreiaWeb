import type { AuditIssue } from '../types/audit';

interface MissingAltOverviewProps {
  issues: AuditIssue[];
  onOpenAll: () => void;
  onOpenIssue: (issue: AuditIssue) => void;
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

export function MissingAltOverview({
  issues,
  onOpenAll,
  onOpenIssue,
}: MissingAltOverviewProps) {
  if (issues.length === 0) {
    return null;
  }

  return (
    <section className="card alt-errors-card" aria-labelledby="alt-errors-title">
      <div className="alt-errors-header">
        <div>
          <span className="card-eyebrow">Acessibilidade detalhada</span>
          <h2 id="alt-errors-title">Imagens sem atributo alt</h2>
          <p>Todas as ocorrências da última auditoria estão identificadas abaixo.</p>
        </div>
        <div className="alt-errors-actions">
          <span>
            <strong>{issues.length}</strong>
            {issues.length === 1 ? 'ocorrência' : 'ocorrências'}
          </span>
          <button className="secondary-button" type="button" onClick={onOpenAll}>
            Ver todas no relatório
          </button>
        </div>
      </div>

      <div
        className="dashboard-alt-scroll"
        role="region"
        aria-label="Todas as imagens sem atributo alt"
        tabIndex={0}
      >
        <ol className="dashboard-alt-list">
          {issues.map((issue, index) => {
            const imageHost = hostname(issue.targetUrl);
            const pageHost = hostname(issue.pageUrl);
            const imageName = fileName(issue.targetUrl);
            const externalResource = imageHost !== 'Não informado' && imageHost !== pageHost;

            return (
              <li key={`${issue.targetUrl ?? 'imagem'}-${issue.element ?? index}-${index}`}>
                <button
                  type="button"
                  onClick={() => onOpenIssue(issue)}
                  aria-label={`Abrir detalhes de ${imageName}, imagem ${index + 1} de ${issues.length}, hospedada em ${imageHost}, encontrada em ${issue.pageUrl}`}
                >
                  <span className="dashboard-alt-index" aria-hidden="true">
                    {String(index + 1).padStart(2, '0')}
                  </span>
                  <span className="dashboard-alt-file">
                    <strong>{imageName}</strong>
                    <span>{issue.targetUrl ?? 'URL da imagem não identificada'}</span>
                    <small>{imageHost}</small>
                  </span>
                  <span className="dashboard-alt-origin">
                    <small>Encontrada em</small>
                    <span>{issue.pageUrl}</span>
                    <strong>{pageHost}</strong>
                  </span>
                  <span className="dashboard-alt-element">
                    <small>Elemento HTML</small>
                    <code>{issue.element ?? 'Trecho HTML não disponível neste relatório.'}</code>
                  </span>
                  <span className={`dashboard-alt-host ${externalResource ? 'external' : ''}`}>
                    {externalResource ? 'Domínio externo' : 'Mesmo domínio'}
                  </span>
                  <span className="dashboard-alt-arrow" aria-hidden="true">→</span>
                </button>
              </li>
            );
          })}
        </ol>
      </div>
    </section>
  );
}
