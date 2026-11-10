import { useState } from 'react';
import { Icon } from './components/Icon';
import { Sidebar } from './components/Sidebar';
import { AuditApiError, runPageAudit } from './services/audit-page';
import {
  loadAuditHistory,
  loadAuditSettings,
  saveAuditHistory,
  saveAuditSettings,
} from './storage/audit-storage';
import type {
  AppView,
  AuditReport,
  AuditSettings,
  ReportFocus,
} from './types/audit';
import { DashboardView } from './views/DashboardView';
import { HelpView } from './views/HelpView';
import { HistoryView } from './views/HistoryView';
import { NewAuditView } from './views/NewAuditView';
import { ReportView } from './views/ReportView';
import { SettingsView } from './views/SettingsView';

const viewContent: Record<AppView, { eyebrow: string; title: string; description: string }> = {
  dashboard: {
    description: 'Acompanhe a saúde técnica dos seus projetos em um só lugar.',
    eyebrow: 'Painel de qualidade',
    title: 'Olá, Vitor.',
  },
  help: {
    description: 'Entenda o fluxo, as proteções e as limitações da análise automática.',
    eyebrow: 'Documentação rápida',
    title: 'Ajuda e suporte',
  },
  history: {
    description: 'Consulte as auditorias armazenadas neste navegador.',
    eyebrow: 'Auditorias anteriores',
    title: 'Histórico',
  },
  'new-audit': {
    description: 'Analise uma página pública com limites de segurança.',
    eyebrow: 'Novo diagnóstico',
    title: 'Nova auditoria',
  },
  reports: {
    description: 'Filtre ocorrências e consulte todos os links encontrados na página.',
    eyebrow: 'Diagnóstico técnico',
    title: 'Relatório',
  },
  settings: {
    description: 'Controle o escopo das análises e o comportamento da interface.',
    eyebrow: 'Preferências',
    title: 'Configurações',
  },
};

function normalizeSettings(settings: AuditSettings): AuditSettings {
  const clamp = (value: number, min: number, max: number, fallback: number) =>
    Number.isFinite(value) ? Math.min(max, Math.max(min, value)) : fallback;

  return {
    autoOpenReport: settings.autoOpenReport,
    historyLimit: clamp(settings.historyLimit, 1, 30, 10),
    maxLinks: clamp(settings.maxLinks, 1, 50, 20),
    maxResources: clamp(settings.maxResources, 1, 50, 20),
  };
}

export function App() {
  const [view, setView] = useState<AppView>('dashboard');
  const [history, setHistory] = useState<AuditReport[]>(loadAuditHistory);
  const [currentReport, setCurrentReport] = useState<AuditReport | null>(
    () => loadAuditHistory()[0] ?? null,
  );
  const [settings, setSettings] = useState<AuditSettings>(loadAuditSettings);
  const [isAuditing, setIsAuditing] = useState(false);
  const [auditError, setAuditError] = useState('');
  const [reportFocus, setReportFocus] = useState<ReportFocus>({});
  const [reportNavigationId, setReportNavigationId] = useState(0);
  const content = viewContent[view];

  function openReport(focus: ReportFocus = {}) {
    setReportFocus(focus);
    setReportNavigationId((value) => value + 1);
    setAuditError('');
    setView('reports');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function navigate(nextView: AppView) {
    if (nextView === 'reports') {
      openReport();
      return;
    }

    setAuditError('');
    setView(nextView);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  async function handleAudit(url: string) {
    setAuditError('');
    setIsAuditing(true);

    try {
      const report = await runPageAudit(url, settings);
      const nextHistory = [
        report,
        ...history.filter((item) => item.analyzedAt !== report.analyzedAt),
      ].slice(0, settings.historyLimit);

      setCurrentReport(report);
      setHistory(nextHistory);
      saveAuditHistory(nextHistory);

      if (settings.autoOpenReport) {
        openReport();
      } else {
        setView('dashboard');
      }
    } catch (error) {
      setAuditError(
        error instanceof AuditApiError
          ? error.message
          : 'Não foi possível concluir a auditoria.',
      );
    } finally {
      setIsAuditing(false);
    }
  }

  function selectReport(report: AuditReport) {
    setCurrentReport(report);
    openReport();
  }

  function deleteReport(analyzedAt: string) {
    const nextHistory = history.filter((report) => report.analyzedAt !== analyzedAt);
    setHistory(nextHistory);
    saveAuditHistory(nextHistory);

    if (currentReport?.analyzedAt === analyzedAt) {
      setCurrentReport(nextHistory[0] ?? null);
    }
  }

  function clearHistory() {
    if (!window.confirm('Deseja remover todo o histórico salvo neste navegador?')) {
      return;
    }

    setHistory([]);
    setCurrentReport(null);
    saveAuditHistory([]);
  }

  function handleSaveSettings(nextSettings: AuditSettings) {
    const normalized = normalizeSettings(nextSettings);
    const trimmedHistory = history.slice(0, normalized.historyLimit);

    setSettings(normalized);
    setHistory(trimmedHistory);
    saveAuditSettings(normalized);
    saveAuditHistory(trimmedHistory);
  }

  return (
    <div className="app-shell">
      <Sidebar activeView={view} onNavigate={navigate} />

      <main className="dashboard">
        <header className="topbar">
          <div>
            <span className="section-kicker">{content.eyebrow}</span>
            <h1>{content.title}</h1>
            <p>{content.description}</p>
          </div>

          <div className="profile-actions">
            <button
              className="icon-button notification-button"
              type="button"
              onClick={() => openReport()}
              aria-label="Abrir relatório mais recente"
            >
              <Icon name="bell" />
              {currentReport && <span>{currentReport.summary.totalIssues}</span>}
            </button>
            <button
              className="icon-button"
              type="button"
              onClick={() => navigate('settings')}
              aria-label="Abrir configurações"
            >
              <Icon name="settings" />
            </button>
            <button className="profile" type="button" onClick={() => navigate('settings')}>
              <span className="avatar" aria-hidden="true">VG</span>
              <span><strong>Vitor Gomes</strong><small>Desenvolvedor</small></span>
            </button>
          </div>
        </header>

        <div className={`view-content view-${view}`} key={view}>
          {view === 'dashboard' && (
            <DashboardView
              auditError={auditError}
              history={history}
              isAuditing={isAuditing}
              onAudit={handleAudit}
              onNavigate={navigate}
              onOpenReport={openReport}
              onResetError={() => setAuditError('')}
              onSelectReport={selectReport}
              report={currentReport}
            />
          )}
          {view === 'new-audit' && (
            <NewAuditView
              error={auditError}
              isAuditing={isAuditing}
              onAudit={handleAudit}
              onResetError={() => setAuditError('')}
            />
          )}
          {view === 'reports' && (
            <ReportView
              initialFocus={reportFocus}
              key={reportNavigationId}
              onNavigate={navigate}
              report={currentReport}
            />
          )}
          {view === 'history' && (
            <HistoryView
              history={history}
              onClear={clearHistory}
              onDelete={deleteReport}
              onNavigate={navigate}
              onSelect={selectReport}
            />
          )}
          {view === 'settings' && <SettingsView onSave={handleSaveSettings} settings={settings} />}
          {view === 'help' && <HelpView />}
        </div>

        <footer className="dashboard-footer">
          <span>RastreiaWeb v0.1</span>
          <span>Testes automáticos não garantem acessibilidade completa.</span>
        </footer>
      </main>
    </div>
  );
}
