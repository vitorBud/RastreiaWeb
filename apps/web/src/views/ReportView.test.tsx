import { fireEvent, render, screen, within } from '@testing-library/react';
import { vi } from 'vitest';
import type { AuditReport } from '../types/audit';
import { ReportView } from './ReportView';

const report: AuditReport = {
  analyzedAt: '2026-11-09T12:00:00.000Z',
  disclaimer: 'Análise automática.',
  durationMs: 100,
  finalUrl: 'https://example.com/',
  initialUrl: 'https://example.com',
  issues: [
    {
      category: 'link',
      code: 'NOT_FOUND',
      description: 'Link quebrado confirmado.',
      pageUrl: 'https://example.com/',
      severity: 'serious',
      statusCode: 404,
      targetUrl: 'https://example.com/quebrado',
    },
    {
      category: 'link',
      code: 'ACCESS_RESTRICTED',
      description: 'Verificação inconclusiva.',
      pageUrl: 'https://example.com/',
      severity: 'minor',
      statusCode: 403,
      targetUrl: 'https://example.com/restrito',
    },
    {
      category: 'accessibility',
      code: 'IMAGE_ALT_MISSING',
      description: 'A imagem "banner-home.jpg" foi encontrada sem o atributo alt.',
      element: '<img class="hero" src="https://cdn.example.net/banner-home.jpg">',
      pageUrl: 'https://example.com/produtos',
      severity: 'serious',
      suggestion: 'Se a imagem comunica conteúdo, adicione um alt descritivo. Se for decorativa, use alt="".',
      targetUrl: 'https://cdn.example.net/banner-home.jpg',
    },
  ],
  limits: { maxLinks: 20, maxResources: 20 },
  pageTitle: 'Exemplo',
  summary: {
    brokenLinks: 1,
    failedResources: 0,
    imagesFound: 1,
    imagesWithoutAlt: 1,
    linksChecked: 2,
    linksFound: 2,
    redirects: 0,
    restrictedLinks: 1,
    resourcesChecked: 0,
    totalIssues: 3,
    unavailableLinks: 0,
    unreachableLinks: 0,
  },
};

describe('ReportView', () => {
  it('distingue problemas confirmados de verificações inconclusivas', () => {
    render(<ReportView onNavigate={vi.fn()} report={report} />);

    expect(screen.getByText('Link quebrado confirmado.')).toBeInTheDocument();
    expect(screen.getByText('Verificação inconclusiva.')).toBeInTheDocument();
    expect(screen.getByText('Quebrados confirmados')).toBeInTheDocument();
    expect(screen.getByText('Inconclusivos')).toBeInTheDocument();

    fireEvent.change(screen.getByRole('combobox', { name: 'Resultado' }), {
      target: { value: 'inconclusive' },
    });

    expect(screen.queryByText('Link quebrado confirmado.')).not.toBeInTheDocument();
    expect(screen.getByText('Verificação inconclusiva.')).toBeInTheDocument();
  });

  it('mostra exatamente qual imagem está sem alt e onde ela foi encontrada', () => {
    render(<ReportView onNavigate={vi.fn()} report={report} />);

    const details = screen.getByRole('region', {
      name: 'Detalhes da imagem sem alt: banner-home.jpg',
    });

    expect(within(details).getByText('banner-home.jpg')).toBeInTheDocument();
    expect(within(details).getByRole('link', {
      name: 'https://cdn.example.net/banner-home.jpg',
    })).toHaveAttribute('href', 'https://cdn.example.net/banner-home.jpg');
    expect(within(details).getByRole('link', {
      name: 'https://example.com/produtos',
    })).toHaveAttribute('href', 'https://example.com/produtos');
    expect(within(details).getByText('cdn.example.net')).toBeInTheDocument();
    expect(within(details).getByText('example.com')).toBeInTheDocument();
    expect(within(details).getByText('domínio externo')).toBeInTheDocument();
    expect(within(details).getByText('IMAGE_ALT_MISSING')).toBeInTheDocument();
    expect(within(details).getByText(
      '<img class="hero" src="https://cdn.example.net/banner-home.jpg">',
    )).toBeInTheDocument();
    expect(screen.getByText(/Se a imagem comunica conteúdo/)).toBeInTheDocument();
  });

  it('permite localizar a ocorrência pela página de origem', () => {
    render(<ReportView onNavigate={vi.fn()} report={report} />);

    fireEvent.change(screen.getByRole('searchbox', { name: 'Buscar' }), {
      target: { value: '/produtos' },
    });

    expect(screen.getByText(
      'A imagem "banner-home.jpg" foi encontrada sem o atributo alt.',
    )).toBeInTheDocument();
    expect(screen.queryByText('Link quebrado confirmado.')).not.toBeInTheDocument();
    expect(screen.queryByText('Verificação inconclusiva.')).not.toBeInTheDocument();
  });
});
