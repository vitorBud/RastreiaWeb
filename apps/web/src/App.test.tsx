import { fireEvent, render, screen } from '@testing-library/react';
import { afterAll, beforeEach, vi } from 'vitest';
import { App } from './App';

const fetchMock = vi.fn();

const report = {
  analyzedAt: '2026-11-09T12:00:00.000Z',
  disclaimer: 'Análise automática não substitui revisão manual.',
  durationMs: 320,
  finalUrl: 'https://example.com/',
  initialUrl: 'https://example.com',
  issues: [{
    category: 'link',
    code: 'NOT_FOUND',
    description: 'Link quebrado confirmado: o teste GET respondeu com HTTP 404.',
    pageUrl: 'https://example.com/',
    severity: 'serious',
    statusCode: 404,
    targetUrl: 'https://example.com/inexistente',
  }],
  links: [{
    declaredHref: '/inexistente',
    element: '<a href="/inexistente">Link quebrado</a>',
    finalUrl: 'https://example.com/inexistente',
    pageUrl: 'https://example.com/',
    position: 1,
    redirects: [],
    state: 'broken',
    statusCode: 404,
    targetUrl: 'https://example.com/inexistente',
    text: 'Link quebrado',
  }],
  limits: { maxLinks: 20, maxResources: 20 },
  pageTitle: 'Example Domain',
  summary: {
    brokenLinks: 1,
    failedResources: 0,
    imagesFound: 0,
    imagesWithoutAlt: 0,
    linksChecked: 1,
    linksFound: 1,
    redirects: 0,
    restrictedLinks: 0,
    resourcesChecked: 0,
    unavailableLinks: 0,
    unreachableLinks: 0,
    totalIssues: 1,
  },
};

const reportWithMissingAlt = {
  ...report,
  analyzedAt: '2026-11-09T13:00:00.000Z',
  issues: [
    ...report.issues,
    {
      category: 'accessibility',
      code: 'IMAGE_ALT_MISSING',
      description: 'A imagem "banner.jpg" foi encontrada sem o atributo alt.',
      element: '<img class="hero" src="https://cdn.example.net/banner.jpg">',
      pageUrl: 'https://example.com/inicio',
      severity: 'serious',
      suggestion: 'Adicione um texto alternativo adequado.',
      targetUrl: 'https://cdn.example.net/banner.jpg',
    },
    {
      category: 'accessibility',
      code: 'IMAGE_ALT_MISSING',
      description: 'A imagem "equipe.jpg" foi encontrada sem o atributo alt.',
      element: '<img src="https://example.com/equipe.jpg">',
      pageUrl: 'https://example.com/sobre',
      severity: 'serious',
      suggestion: 'Adicione um texto alternativo adequado.',
      targetUrl: 'https://example.com/equipe.jpg',
    },
  ],
  summary: {
    ...report.summary,
    imagesFound: 2,
    imagesWithoutAlt: 2,
    totalIssues: 3,
  },
};

beforeEach(() => {
  window.localStorage.clear();
  fetchMock.mockReset();
  vi.stubGlobal('fetch', fetchMock);
  vi.stubGlobal('scrollTo', vi.fn());
});

afterAll(() => {
  vi.unstubAllGlobals();
});

describe('App', () => {
  it('executa uma auditoria e abre o relatório real', async () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify(report), { status: 200 }));
    render(<App />);

    fireEvent.change(screen.getByLabelText('URL pública autorizada'), {
      target: { value: 'https://example.com' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Analisar página' }));

    expect(await screen.findByText('Example Domain')).toBeInTheDocument();
    expect(screen.getByText('Link quebrado confirmado: o teste GET respondeu com HTTP 404.')).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledWith('/api/audits', expect.objectContaining({
      method: 'POST',
    }));
  });

  it('navega para configurações pelo menu lateral', () => {
    render(<App />);

    fireEvent.click(screen.getByRole('button', { name: 'Configurações' }));

    expect(screen.getByRole('heading', { name: 'Configurações' })).toBeInTheDocument();
    expect(screen.getByText('Configurações da auditoria')).toBeInTheDocument();
  });

  it('abre o inventário completo de links pela visão geral', () => {
    window.localStorage.setItem(
      'rastreiaweb:audit-history',
      JSON.stringify([report]),
    );
    render(<App />);

    fireEvent.click(screen.getByRole('button', {
      name: /Ver todos os links encontrados/,
    }));

    expect(screen.getByRole('button', { name: /Todos os links/ }))
      .toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('heading', { name: 'Todos os links encontrados' }))
      .toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Link quebrado' }))
      .toBeInTheDocument();
  });

  it('detalha imagens sem alt no dashboard e abre o relatório filtrado', () => {
    window.localStorage.setItem(
      'rastreiaweb:audit-history',
      JSON.stringify([reportWithMissingAlt]),
    );
    render(<App />);

    const list = screen.getByRole('region', {
      name: 'Todas as imagens sem atributo alt',
    });

    expect(list).toHaveTextContent('https://cdn.example.net/banner.jpg');
    expect(list).toHaveTextContent('https://example.com/inicio');
    expect(list).toHaveTextContent('https://example.com/equipe.jpg');
    expect(list).toHaveTextContent('https://example.com/sobre');

    fireEvent.click(screen.getByRole('button', { name: 'Ver todas no relatório' }));

    expect(screen.getByRole('heading', { name: 'Relatório' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Acessibilidade/ }))
      .toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('searchbox', { name: 'Buscar' }))
      .toHaveValue('IMAGE_ALT_MISSING');
    expect(screen.getByText(
      'A imagem "banner.jpg" foi encontrada sem o atributo alt.',
    )).toBeInTheDocument();
    expect(screen.getByText(
      'A imagem "equipe.jpg" foi encontrada sem o atributo alt.',
    )).toBeInTheDocument();
    expect(screen.queryByText(
      'Link quebrado confirmado: o teste GET respondeu com HTTP 404.',
    )).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Visão geral' }));
    fireEvent.click(screen.getByRole('button', {
      name: /Abrir detalhes de banner.jpg, imagem 1 de 2/,
    }));

    expect(screen.getByRole('searchbox', { name: 'Buscar' }))
      .toHaveValue('<img class="hero" src="https://cdn.example.net/banner.jpg">');
    expect(screen.getByText(
      'A imagem "banner.jpg" foi encontrada sem o atributo alt.',
    )).toBeInTheDocument();
    expect(screen.queryByText(
      'A imagem "equipe.jpg" foi encontrada sem o atributo alt.',
    )).not.toBeInTheDocument();
  });

  it('apresenta erros da auditoria no formulário', async () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify({
      code: 'PRIVATE_ADDRESS',
      error: 'A URL aponta para um endereço privado ou reservado.',
    }), { status: 422 }));
    render(<App />);

    fireEvent.change(screen.getByLabelText('URL pública autorizada'), {
      target: { value: 'http://127.0.0.1' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Analisar página' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'A URL aponta para um endereço privado ou reservado.',
    );
  });
});
