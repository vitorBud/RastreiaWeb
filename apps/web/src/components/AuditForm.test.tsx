import { render, screen } from '@testing-library/react';
import { vi } from 'vitest';
import { AuditForm } from './AuditForm';

describe('AuditForm', () => {
  it('mostra o progresso real recebido da auditoria', () => {
    render(
      <AuditForm
        error=""
        isLoading
        onResetError={vi.fn()}
        onSubmit={vi.fn(async () => {})}
        progress={{
          completed: 3,
          message: 'Verificando destinos e recursos (3 de 8)…',
          percent: 51,
          phase: 'checking',
          total: 8,
        }}
      />,
    );

    expect(screen.getByRole('progressbar', { name: 'Progresso da auditoria' }))
      .toHaveAttribute('aria-valuenow', '51');
    expect(screen.getByText('51%')).toBeInTheDocument();
    expect(screen.getByText('Verificando destinos e recursos (3 de 8)…'))
      .toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Analisando/ })).toBeDisabled();
  });
});
