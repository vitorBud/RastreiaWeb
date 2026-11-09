import { fireEvent, render, screen } from '@testing-library/react';
import { App } from './App';

describe('App', () => {
  it('apresenta o formulário inicial e explica a etapa atual', () => {
    render(<App />);

    fireEvent.change(screen.getByLabelText('URL pública autorizada'), {
      target: { value: 'https://example.com' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Analisar página' }));

    expect(screen.getByRole('status')).toHaveTextContent(
      'A conexão segura com a auditoria será implementada na próxima etapa.',
    );
  });
});
