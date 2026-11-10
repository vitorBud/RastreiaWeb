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
  links: [
    {
      declaredHref: '/documentacao',
      element: '<a href="/documentacao">Documentação</a>',
      finalUrl: 'https://example.com/documentacao',
      pageUrl: 'https://example.com/',
      position: 1,
      redirects: [],
      state: 'ok',
      statusCode: 200,
      targetUrl: 'https://example.com/documentacao',
      text: 'Documentação',
    },
    {
      declaredHref: '/docs-antiga',
      element: '<a href="/docs-antiga">Documentação antiga</a>',
      finalUrl: 'https://example.com/documentacao',
      pageUrl: 'https://example.com/',
      position: 2,
      redirects: ['https://example.com/documentacao'],
      state: 'redirected',
      statusCode: 200,
      targetUrl: 'https://example.com/docs-antiga',
      text: 'Documentação antiga',
    },
    {
      declaredHref: '/quebrado',
      element: '<a href="/quebrado">Página ausente</a>',
      finalUrl: 'https://example.com/quebrado',
      pageUrl: 'https://example.com/',
      position: 3,
      redirects: [],
      state: 'broken',
      statusCode: 404,
      targetUrl: 'https://example.com/quebrado',
      text: 'Página ausente',
    },
    {
      declaredHref: '/restrito',
      element: '<a href="/restrito">Área restrita</a>',
      finalUrl: 'https://example.com/restrito',
      pageUrl: 'https://example.com/',
      position: 4,
      redirects: [],
      state: 'restricted',
      statusCode: 403,
      targetUrl: 'https://example.com/restrito',
      text: 'Área restrita',
    },
    {
      checkReason: 'unsupported_protocol',
      declaredHref: 'mailto:contato@example.com',
      element: '<a href="mailto:contato@example.com">E-mail</a>',
      pageUrl: 'https://example.com/',
      position: 5,
      redirects: [],
      state: 'not_checked',
      targetUrl: 'mailto:contato@example.com',
      text: 'E-mail',
    },
  ],
  limits: { maxLinks: 20, maxResources: 20 },
  pageTitle: 'Exemplo',
  responsive: {
    message: 'Layout medido em três resoluções.',
    status: 'completed',
    viewports: [
      {
        documentWidth: 1440,
        height: 900,
        horizontalOverflow: false,
        name: 'desktop',
        overflowingElements: [],
        width: 1440,
      },
      {
        documentWidth: 768,
        height: 1024,
        horizontalOverflow: false,
        name: 'tablet',
        overflowingElements: [],
        width: 768,
      },
      {
        documentWidth: 620,
        height: 844,
        horizontalOverflow: true,
        name: 'mobile',
        overflowingElements: [{
          element: '<main class="wide">Conteúdo</main>',
          overflowPixels: 230,
          selector: 'main.wide',
        }],
        width: 390,
      },
    ],
  },
  summary: {
    brokenLinks: 1,
    failedResources: 0,
    imagesFound: 1,
    imagesWithoutAlt: 1,
    linksChecked: 4,
    linksFound: 4,
    redirects: 1,
    restrictedLinks: 1,
    resourcesChecked: 0,
    totalIssues: 3,
    unavailableLinks: 0,
    unreachableLinks: 0,
  },
};

describe('ReportView', () => {
  it('resume a medição responsiva por viewport', () => {
    render(<ReportView onNavigate={vi.fn()} report={report} />);

    expect(screen.getByRole('heading', { name: 'Responsividade' })).toBeInTheDocument();
    expect(screen.getByText('Desktop')).toBeInTheDocument();
    expect(screen.getByText('Tablet')).toBeInTheDocument();
    expect(screen.getByText('Celular')).toBeInTheDocument();
    expect(screen.getByText('Overflow detectado')).toBeInTheDocument();
    expect(screen.getAllByText('Sem overflow horizontal')).toHaveLength(2);
  });

  it('distingue problemas confirmados de verificações inconclusivas', () => {
    render(<ReportView onNavigate={vi.fn()} report={report} />);

    expect(screen.getByText('Link quebrado confirmado.')).toBeInTheDocument();
    expect(screen.getByText('Verificação inconclusiva.')).toBeInTheDocument();
    expect(screen.getByText('Quebrados confirmados')).toBeInTheDocument();
    expect(screen.getByText('Inconclusivos')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Mostrar filtros' }));
    fireEvent.change(screen.getByRole('combobox', { name: 'Resultado' }), {
      target: { value: 'inconclusive' },
    });

    expect(screen.queryByText('Link quebrado confirmado.')).not.toBeInTheDocument();
    expect(screen.getByText('Verificação inconclusiva.')).toBeInTheDocument();
  });

  it('mostra exatamente qual imagem está sem alt e onde ela foi encontrada', () => {
    render(<ReportView onNavigate={vi.fn()} report={report} />);

    fireEvent.click(screen.getByText('banner-home.jpg'));
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

    fireEvent.click(screen.getByRole('button', { name: 'Mostrar filtros' }));
    fireEvent.change(screen.getByRole('searchbox', { name: 'Buscar' }), {
      target: { value: '/produtos' },
    });

    expect(screen.getByText(
      'A imagem "banner-home.jpg" foi encontrada sem o atributo alt.',
    )).toBeInTheDocument();
    expect(screen.queryByText('Link quebrado confirmado.')).not.toBeInTheDocument();
    expect(screen.queryByText('Verificação inconclusiva.')).not.toBeInTheDocument();
  });

  it('inicia com o foco solicitado pela visão geral', () => {
    render(
      <ReportView
        initialFocus={{
          category: 'accessibility',
          query: 'IMAGE_ALT_MISSING',
        }}
        onNavigate={vi.fn()}
        report={report}
      />,
    );

    expect(screen.getByRole('combobox', { name: 'Categoria' }))
      .toHaveValue('accessibility');
    expect(screen.getByRole('searchbox', { name: 'Buscar' }))
      .toHaveValue('IMAGE_ALT_MISSING');
    expect(screen.getByText(
      'A imagem "banner-home.jpg" foi encontrada sem o atributo alt.',
    )).toBeInTheDocument();
    expect(screen.queryByText('Link quebrado confirmado.')).not.toBeInTheDocument();
    expect(screen.queryByText('Verificação inconclusiva.')).not.toBeInTheDocument();
  });

  it('organiza todos os links em uma seção separada', () => {
    render(<ReportView onNavigate={vi.fn()} report={report} />);

    fireEvent.click(screen.getByRole('button', { name: /Todos os links/ }));

    expect(screen.getByRole('heading', { name: 'Todos os links encontrados' }))
      .toBeInTheDocument();
    expect(screen.getByText('Documentação')).toBeInTheDocument();
    expect(screen.getByText('Documentação antiga')).toBeInTheDocument();
    expect(screen.getByText('Página ausente')).toBeInTheDocument();
    expect(screen.getByText('Área restrita')).toBeInTheDocument();
    expect(screen.queryByText('E-mail')).not.toBeInTheDocument();
    expect(screen.queryByText('Link quebrado confirmado.')).not.toBeInTheDocument();
  });

  it('pode abrir diretamente no inventário de links', () => {
    render(
      <ReportView
        initialFocus={{ section: 'links' }}
        onNavigate={vi.fn()}
        report={report}
      />,
    );

    expect(screen.getByRole('button', { name: /Todos os links/ }))
      .toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('heading', { name: 'Todos os links encontrados' }))
      .toBeInTheDocument();
  });
});
