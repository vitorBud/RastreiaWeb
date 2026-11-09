import type { AppView } from '../types/audit';
import { Icon, type IconName } from './Icon';

interface SidebarProps {
  activeView: AppView;
  onNavigate: (view: AppView) => void;
}

const primaryItems: Array<{ icon: IconName; label: string; view: AppView }> = [
  { icon: 'dashboard', label: 'Visão geral', view: 'dashboard' },
  { icon: 'scan', label: 'Nova auditoria', view: 'new-audit' },
  { icon: 'report', label: 'Relatórios', view: 'reports' },
  { icon: 'history', label: 'Histórico', view: 'history' },
];

const secondaryItems: Array<{ icon: IconName; label: string; view: AppView }> = [
  { icon: 'settings', label: 'Configurações', view: 'settings' },
  { icon: 'help', label: 'Ajuda e suporte', view: 'help' },
];

function NavigationButton({
  activeView,
  icon,
  label,
  onNavigate,
  view,
}: SidebarProps & { icon: IconName; label: string; view: AppView }) {
  return (
    <button
      className={activeView === view ? 'active' : ''}
      type="button"
      onClick={() => onNavigate(view)}
      aria-current={activeView === view ? 'page' : undefined}
    >
      <Icon name={icon} />
      <span>{label}</span>
    </button>
  );
}

export function Sidebar(props: SidebarProps) {
  return (
    <aside className="sidebar">
      <button
        className="brand"
        type="button"
        onClick={() => props.onNavigate('dashboard')}
        aria-label="RastreiaWeb — início"
      >
        <span className="brand-mark" aria-hidden="true">R</span>
        <span>Rastreia<span>Web</span></span>
      </button>

      <nav aria-label="Navegação principal">
        <ul className="nav-list">
          {primaryItems.map((item) => (
            <li key={item.view}>
              <NavigationButton {...props} {...item} />
            </li>
          ))}
        </ul>
      </nav>

      <div className="sidebar-footer">
        {secondaryItems.map((item) => (
          <NavigationButton key={item.view} {...props} {...item} />
        ))}
      </div>
    </aside>
  );
}
