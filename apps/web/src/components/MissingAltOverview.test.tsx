import { fireEvent, render, screen, within } from '@testing-library/react';
import { vi } from 'vitest';
import type { AuditIssue } from '../types/audit';
import { MissingAltOverview } from './MissingAltOverview';

const issues: AuditIssue[] = [
  {
    category: 'accessibility',
    code: 'IMAGE_ALT_MISSING',
    description: 'Imagem sem alt.',
    element: '<img class="cabecalho" src="/marca.png">',
    pageUrl: 'https://example.com/inicio',
    severity: 'serious',
    targetUrl: 'https://example.com/marca.png',
  },
  {
    category: 'accessibility',
    code: 'IMAGE_ALT_MISSING',
    description: 'Imagem sem alt.',
    element: '<img class="rodape" src="/marca.png">',
    pageUrl: 'https://example.com/contato',
    severity: 'serious',
    targetUrl: 'https://cdn.example.net/marca.png',
  },
];

describe('MissingAltOverview', () => {
  it('lista todas as imagens com URL, origem e hospedagem', () => {
    render(
      <MissingAltOverview
        issues={issues}
        onOpenAll={vi.fn()}
        onOpenIssue={vi.fn()}
      />,
    );

    const list = screen.getByRole('region', {
      name: 'Todas as imagens sem atributo alt',
    });

    expect(within(list).getAllByText('marca.png')).toHaveLength(2);
    expect(within(list).getByText('https://example.com/marca.png')).toBeInTheDocument();
    expect(within(list).getByText('https://cdn.example.net/marca.png')).toBeInTheDocument();
    expect(within(list).getByText('https://example.com/inicio')).toBeInTheDocument();
    expect(within(list).getByText('https://example.com/contato')).toBeInTheDocument();
    expect(within(list).getByText('<img class="cabecalho" src="/marca.png">'))
      .toBeInTheDocument();
    expect(within(list).getByText('<img class="rodape" src="/marca.png">'))
      .toBeInTheDocument();
    expect(within(list).getByText('Domínio externo')).toBeInTheDocument();
  });

  it('abre todas as ocorrências ou uma imagem específica', () => {
    const onOpenAll = vi.fn();
    const onOpenIssue = vi.fn();
    render(
      <MissingAltOverview
        issues={issues}
        onOpenAll={onOpenAll}
        onOpenIssue={onOpenIssue}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Ver todas no relatório' }));
    fireEvent.click(screen.getByRole('button', {
      name: /Abrir detalhes de marca.png, imagem 2 de 2/,
    }));

    expect(onOpenAll).toHaveBeenCalledOnce();
    expect(onOpenIssue).toHaveBeenCalledWith(issues[1]);
  });

  it('não ocupa espaço quando não existem imagens sem alt', () => {
    const { container } = render(
      <MissingAltOverview
        issues={[]}
        onOpenAll={vi.fn()}
        onOpenIssue={vi.fn()}
      />,
    );

    expect(container).toBeEmptyDOMElement();
  });
});
