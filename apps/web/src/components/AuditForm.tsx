import { useState, type FormEvent } from 'react';
import { Icon } from './Icon';

interface AuditFormProps {
  error: string;
  isLoading: boolean;
  onResetError: () => void;
  onSubmit: (url: string) => Promise<void>;
  variant?: 'compact' | 'full';
}

export function AuditForm({
  error,
  isLoading,
  onResetError,
  onSubmit,
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
      {error && (
        <p className="status-message error" id={`audit-error-${variant}`} role="alert">
          {error}
        </p>
      )}
    </form>
  );
}
