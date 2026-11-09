import { useEffect, useState, type FormEvent } from 'react';
import type { AuditSettings } from '../types/audit';

interface SettingsViewProps {
  onSave: (settings: AuditSettings) => void;
  settings: AuditSettings;
}

export function SettingsView({ onSave, settings }: SettingsViewProps) {
  const [draft, setDraft] = useState(settings);
  const [saved, setSaved] = useState(false);

  useEffect(() => setDraft(settings), [settings]);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    onSave(draft);
    setSaved(true);
  }

  return (
    <section className="page-panel settings-view">
      <div className="page-intro">
        <span className="card-eyebrow">Preferências locais</span>
        <h2>Configurações da auditoria</h2>
        <p>Defina limites conservadores. Valores maiores aumentam o tempo e o número de requisições.</p>
      </div>

      <form onSubmit={handleSubmit}>
        <fieldset>
          <legend>Limites de rede</legend>
          <label>
            Links por auditoria
            <input
              type="number"
              min="1"
              max="50"
              value={draft.maxLinks}
              onChange={(event) => setDraft({ ...draft, maxLinks: Number(event.target.value) })}
            />
            <small>Máximo de links que receberão uma verificação HTTP.</small>
          </label>
          <label>
            Recursos por auditoria
            <input
              type="number"
              min="1"
              max="50"
              value={draft.maxResources}
              onChange={(event) => setDraft({ ...draft, maxResources: Number(event.target.value) })}
            />
            <small>Inclui imagens, scripts e folhas de estilo.</small>
          </label>
        </fieldset>

        <fieldset>
          <legend>Experiência</legend>
          <label>
            Auditorias salvas
            <input
              type="number"
              min="1"
              max="30"
              value={draft.historyLimit}
              onChange={(event) => setDraft({ ...draft, historyLimit: Number(event.target.value) })}
            />
            <small>O histórico é salvo apenas neste navegador.</small>
          </label>
          <label className="checkbox-label">
            <input
              type="checkbox"
              checked={draft.autoOpenReport}
              onChange={(event) => setDraft({ ...draft, autoOpenReport: event.target.checked })}
            />
            <span><strong>Abrir relatório automaticamente</strong><small>Exibe os detalhes assim que a auditoria terminar.</small></span>
          </label>
        </fieldset>

        <div className="settings-actions">
          <button className="primary-button" type="submit">Salvar configurações</button>
          {saved && <span role="status">Configurações salvas neste navegador.</span>}
        </div>
      </form>
    </section>
  );
}
