import { useState, type FormEvent } from 'react';
import type { AuditProgress } from '../types/audit';
import { Icon } from './Icon';

interface AuditFormProps {
  error: string;
  isLoading: boolean;
  onResetError: () => void;
  onSubmit: (url: string) => Promise<void>;
  progress: AuditProgress | null;
  variant?: 'compact' | 'full';
}

export function AuditForm({
  error,
  isLoading,
  onResetError,
  onSubmit,
  progress,
  variant = 'compact',
}: AuditFormProps) {
  const [url, setUrl] = useState('');

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await onSubmit(url);
  }

  return (
    <form className={`audit-bar ${variant}`} onSubmit={handleSubmit}>
      <Icon name="link" />
      <label className="sr-only" htmlFor={`website-url-${variant}`}>
        URL pública autorizada
      </label>
      <input
        id={`website-url-${variant}`}
        name="website-url"
        type="url"
        value={url}
        onChange={(event) => {
          setUrl(event.target.value);
          onResetError();
        }}
        placeholder="Cole uma URL pública autorizada"
        aria-describedby={error ? `audit-error-${variant}` : undefined}
        aria-invalid={Boolean(error)}
        disabled={isLoading}
        required
      />
      <button type="submit" disabled={isLoading}>
        <Icon name="scan" />
        {isLoading ? 'Analisando…' : 'Analisar página'}
      </button>
      {isLoading && progress && (
        <div
          className="audit-live-progress"
          role="progressbar"
          aria-label="Progresso da auditoria"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={progress.percent}
        >
          <div className="audit-live-progress-heading" aria-live="polite">
            <span>{progress.message}</span>
            <strong>{progress.percent}%</strong>
          </div>
          <div className="audit-live-progress-track" aria-hidden="true">
            <span style={{ width: `${progress.percent}%` }} />
          </div>
        </div>
      )}
      {error && (
        <p className="status-message error" id={`audit-error-${variant}`} role="alert">
          {error}
        </p>
      )}
    </form>
  );
}
