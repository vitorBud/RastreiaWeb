import { FormEvent, useState, type ReactNode } from 'react';
import { ApiRequestError, validateUrl } from './services/validate-url';

type ValidationStatus = 'error' | 'idle' | 'loading' | 'success';

type IconName =
  | 'bell'
  | 'dashboard'
  | 'help'
  | 'history'
  | 'link'
  | 'report'
  | 'scan'
  | 'settings'
  | 'shield';

interface IconProps {
  name: IconName;
}

function Icon({ name }: IconProps) {
  const paths: Record<IconName, ReactNode> = {
    bell: <><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9"/><path d="M13.7 21a2 2 0 0 1-3.4 0"/></>,
    dashboard: <><rect x="3" y="3" width="7" height="7" rx="2"/><rect x="14" y="3" width="7" height="7" rx="2"/><rect x="3" y="14" width="7" height="7" rx="2"/><rect x="14" y="14" width="7" height="7" rx="2"/></>,
    help: <><circle cx="12" cy="12" r="9"/><path d="M9.7 9a2.5 2.5 0 1 1 3.7 2.2c-.9.5-1.4 1-1.4 2"/><path d="M12 17h.01"/></>,
    history: <><path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5"/><path d="M12 7v5l3 2"/></>,
    link: <><path d="M10 13a5 5 0 0 0 7.5.5l2-2a5 5 0 0 0-7-7l-1.1 1"/><path d="M14 11a5 5 0 0 0-7.5-.5l-2 2a5 5 0 0 0 7 7l1.1-1"/></>,
    report: <><path d="M6 2h9l4 4v16H6z"/><path d="M14 2v5h5"/><path d="M9 13h6M9 17h6"/></>,
    scan: <><path d="M4 8V5a1 1 0 0 1 1-1h3M16 4h3a1 1 0 0 1 1 1v3M20 16v3a1 1 0 0 1-1 1h-3M8 20H5a1 1 0 0 1-1-1v-3"/><circle cx="12" cy="12" r="3"/></>,
    settings: <><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1-2.8 2.8-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.6v.2h-4V21a1.7 1.7 0 0 0-1-1.6 1.7 1.7 0 0 0-1.9.3l-.1.1L4.2 17l.1-.1a1.7 1.7 0 0 0 .3-1.9A1.7 1.7 0 0 0 3 14H2.8v-4H3a1.7 1.7 0 0 0 1.6-1 1.7 1.7 0 0 0-.3-1.9L4.2 7 7 4.2l.1.1a1.7 1.7 0 0 0 1.9.3A1.7 1.7 0 0 0 10 3V2.8h4V3a1.7 1.7 0 0 0 1 1.6 1.7 1.7 0 0 0 1.9-.3l.1-.1L19.8 7l-.1.1a1.7 1.7 0 0 0-.3 1.9 1.7 1.7 0 0 0 1.6 1h.2v4H21a1.7 1.7 0 0 0-1.6 1Z"/></>,
    shield: <><path d="M12 3 4.5 6v5.5c0 4.7 3.2 8 7.5 9.5 4.3-1.5 7.5-4.8 7.5-9.5V6Z"/><path d="m9 12 2 2 4-4"/></>,
  };

  return (
    <svg className="icon" viewBox="0 0 24 24" aria-hidden="true">
      {paths[name]}
    </svg>
  );
}

const navigation = [
  { icon: 'dashboard' as const, label: 'Visão geral', href: '#overview' },
  { icon: 'scan' as const, label: 'Nova auditoria', href: '#new-audit' },
  { icon: 'report' as const, label: 'Relatórios', href: '#reports' },
  { icon: 'history' as const, label: 'Histórico', href: '#history' },
];

const categories = [
  { label: 'Links', description: 'Status e redirecionamentos', className: 'violet' },
  { label: 'Recursos', description: 'Imagens, CSS e JavaScript', className: 'pink' },
  { label: 'Responsividade', description: 'Limites e sobreposições', className: 'blue' },
  { label: 'Acessibilidade', description: 'Regras automáticas WCAG', className: 'green' },
];

export function App() {
  const [url, setUrl] = useState('');
  const [message, setMessage] = useState('');
  const [validationStatus, setValidationStatus] = useState<ValidationStatus>('idle');

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setValidationStatus('loading');
    setMessage('Validando protocolo, domínio e endereços de rede…');

    try {
      const result = await validateUrl(url);
      setValidationStatus('success');
      setMessage(`URL validada com segurança: ${result.url.normalizedUrl}`);
    } catch (error) {
      setValidationStatus('error');
      setMessage(
        error instanceof ApiRequestError
          ? error.message
          : 'Não foi possível validar a URL.',
      );
    }
  }

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <a className="brand" href="#overview" aria-label="RastreiaWeb — início">
          <span className="brand-mark" aria-hidden="true">R</span>
          <span>Rastreia<span>Web</span></span>
        </a>

        <nav aria-label="Navegação principal">
          <ul className="nav-list">
            {navigation.map((item, index) => (
              <li key={item.label}>
                <a className={index === 0 ? 'active' : ''} href={item.href}>
                  <Icon name={item.icon} />
                  <span>{item.label}</span>
                </a>
              </li>
            ))}
          </ul>
        </nav>

        <div className="sidebar-footer">
          <a href="#settings"><Icon name="settings" />Configurações</a>
          <a href="#support"><Icon name="help" />Ajuda e suporte</a>
        </div>
      </aside>

      <main className="dashboard">
        <header className="topbar">
          <div>
            <span className="section-kicker">Painel de qualidade</span>
            <h1>Olá, Vitor.</h1>
            <p>Acompanhe a saúde técnica dos seus projetos em um só lugar.</p>
          </div>

          <div className="profile-actions">
            <button className="icon-button" type="button" aria-label="Notificações">
              <Icon name="bell" />
            </button>
            <button className="icon-button" type="button" aria-label="Configurações">
              <Icon name="settings" />
            </button>
            <div className="profile" aria-label="Perfil de Vitor">
              <span className="avatar" aria-hidden="true">VG</span>
              <span><strong>Vitor Gomes</strong><small>Desenvolvedor</small></span>
            </div>
          </div>
        </header>

        <form className="audit-bar" id="new-audit" onSubmit={handleSubmit}>
          <Icon name="link" />
          <label className="sr-only" htmlFor="website-url">URL pública autorizada</label>
          <input
            id="website-url"
            name="website-url"
            type="url"
            value={url}
            onChange={(event) => {
              setUrl(event.target.value);
              setMessage('');
              setValidationStatus('idle');
            }}
            placeholder="Cole uma URL pública autorizada"
            aria-describedby={message ? 'url-validation-message' : undefined}
            aria-invalid={validationStatus === 'error'}
            disabled={validationStatus === 'loading'}
            required
          />
          <button type="submit" disabled={validationStatus === 'loading'}>
            <Icon name="scan" />
            {validationStatus === 'loading' ? 'Validando…' : 'Validar página'}
          </button>
          {message && (
            <p
              className={`status-message ${validationStatus}`}
              id="url-validation-message"
              role={validationStatus === 'error' ? 'alert' : 'status'}
            >
              {message}
            </p>
          )}
        </form>

        <section className="overview-grid" id="overview" aria-label="Visão geral do projeto">
          <article className="card status-card">
            <div className="card-heading">
              <span>Status do projeto</span>
              <span className="status-pill"><span />Fundação</span>
            </div>
            <div className="status-value">Pronto para evoluir</div>
            <p>Interface, API, testes e arquitetura inicial configurados.</p>
            <div className="progress-track" aria-label="Fundação concluída">
              <span />
            </div>
            <div className="progress-label"><span>Base técnica</span><strong>Concluída</strong></div>
          </article>

          <article className="card security-card">
            <div className="security-glow" />
            <Icon name="shield" />
            <span className="card-eyebrow">Camada de segurança</span>
            <h2>Validação inicial ativa</h2>
            <p>Protocolos, hostnames, DNS e endereços privados já são verificados pela API.</p>
            <a href="#next-steps">Ver próximos passos <span aria-hidden="true">→</span></a>
          </article>

          <article className="card categories-card" id="reports">
            <div className="card-heading">
              <span>Categorias da auditoria</span>
              <button className="text-button" type="button">Ver detalhes</button>
            </div>
            <ul>
              {categories.map((category) => (
                <li key={category.label}>
                  <span className={`category-icon ${category.className}`} aria-hidden="true" />
                  <span><strong>{category.label}</strong><small>{category.description}</small></span>
                  <span className="pending-badge">Pendente</span>
                </li>
              ))}
            </ul>
          </article>

          <article className="card scope-card">
            <div className="card-heading">
              <span>Escopo do MVP</span>
              <span className="scope-count">v0.1</span>
            </div>
            <div className="scope-grid">
              <div><small>Páginas por análise</small><strong>01</strong><span>Escopo controlado</span></div>
              <div><small>Protocolos aceitos</small><strong>02</strong><span>HTTP e HTTPS</span></div>
              <div><small>Histórico</small><strong>—</strong><span>Versão futura</span></div>
              <div><small>Auditorias feitas</small><strong>00</strong><span>Nenhuma ainda</span></div>
            </div>
          </article>

          <article className="card chart-card" id="history">
            <div className="chart-header">
              <div>
                <span className="card-eyebrow">Evolução</span>
                <h2>Qualidade ao longo do tempo</h2>
              </div>
              <div className="chart-filters" aria-label="Período do gráfico">
                <button className="active" type="button">7D</button>
                <button type="button">1M</button>
                <button type="button">6M</button>
                <button type="button">1A</button>
              </div>
            </div>
            <div className="empty-chart" role="img" aria-label="Gráfico vazio, aguardando a primeira auditoria">
              <div className="chart-grid" />
              <div className="empty-chart-content">
                <span><Icon name="report" /></span>
                <strong>Seu histórico começa na primeira análise</strong>
                <small>Os dados de qualidade aparecerão aqui conforme o projeto evoluir.</small>
              </div>
            </div>
          </article>

          <article className="card next-card" id="next-steps">
            <span className="step-number">02</span>
            <div>
              <span className="card-eyebrow">Próximo passo</span>
              <h2>Criar uma navegação controlada</h2>
              <p>O próximo passo será revalidar redirecionamentos e impedir DNS rebinding antes de conectar o Playwright.</p>
            </div>
            <span className="next-arrow" aria-hidden="true">↗</span>
          </article>
        </section>

        <footer className="dashboard-footer">
          <span>RastreiaWeb v0.1</span>
          <span>Testes automáticos não garantem acessibilidade completa.</span>
        </footer>
      </main>
    </div>
  );
}
