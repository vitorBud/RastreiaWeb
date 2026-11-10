import { fireEvent, render, screen, within } from '@testing-library/react';
import type { AuditLinkResult, AuditLinkState } from '../types/audit';
import { ReportLinksPanel } from './ReportLinksPanel';

function createLink(
  position: number,
  state: AuditLinkState,
  overrides: Partial<AuditLinkResult> = {},
): AuditLinkResult {
  const slug = `pagina-${position}`;

  return {
    declaredHref: `/${slug}`,
    element: `<a href="/${slug}">Link ${position}</a>`,
    finalUrl: `https://example.com/${slug}`,
    pageUrl: 'https://example.com/',
    position,
    redirects: [],
    state,
    statusCode: state === 'broken' ? 404 : 200,
    targetUrl: `https://example.com/${slug}`,
    text: `Link ${position}`,
    ...overrides,
  };
}

const links: AuditLinkResult[] = [
  createLink(3, 'broken', { text: 'Página ausente' }),
  createLink(1, 'ok', { text: 'Início' }),
  createLink(2, 'redirected', {
    declaredHref: '/documentacao-antiga',
    element: '<a href="/documentacao-antiga">Documentação antiga</a>',
    finalUrl: 'https://example.com/documentacao',
    redirects: ['https://example.com/documentacao'],
    targetUrl: 'https://example.com/documentacao-antiga',
    text: 'Documentação antiga',
  }),
  createLink(4, 'restricted', { statusCode: 403, text: 'Área restrita' }),
  createLink(5, 'unavailable', { statusCode: 500, text: 'Servidor indisponível' }),
  createLink(6, 'unreachable', {
    finalUrl: undefined,
    statusCode: undefined,
    text: 'Destino inacessível',
  }),
  createLink(7, 'not_checked', {
    checkReason: 'limit',
    finalUrl: undefined,
    statusCode: undefined,
    text: 'Fora do limite',
  }),
  createLink(8, 'not_checked', {
    checkReason: 'unsupported_protocol',
    declaredHref: 'mailto:contato@example.com',
    element: '<a href="mailto:contato@example.com">E-mail</a>',
    finalUrl: undefined,
    statusCode: undefined,
    targetUrl: 'mailto:contato@example.com',
    text: 'E-mail',
  }),
  createLink(9, 'not_checked', {
    checkReason: 'invalid_url',
    declaredHref: 'http://[',
    element: '<a href="http://[">URL inválida</a>',
    finalUrl: undefined,
    statusCode: undefined,
    targetUrl: 'http://[',
    text: 'URL inválida',
  }),
  createLink(10, 'ok', {
    declaredHref: '/pagina-1#rodape',
    element: '<a href="/pagina-1#rodape">Início no rodapé</a>',
    finalUrl: 'https://example.com/pagina-1',
    targetUrl: 'https://example.com/pagina-1#rodape',
    text: 'Início no rodapé',
  }),
];

describe('ReportLinksPanel', () => {
  it('organiza todos os links pela posição original e identifica cada resultado', () => {
    render(<ReportLinksPanel discoveredDestinations={7} links={links} />);

    const inventory = screen.getByRole('region', {
      name: 'Todos os links encontrados',
    });
    const headings = within(inventory).getAllByRole('heading', { level: 3 });

    expect(headings.map((heading) => heading.textContent)).toEqual([
      'Início',
      'Documentação antiga',
      'Página ausente',
      'Área restrita',
      'Servidor indisponível',
      'Destino inacessível',
      'Fora do limite',
      'URL inválida',
      'Início no rodapé',
    ]);
    [
      'Funcionando',
      'Redirecionado',
      'Quebrado',
      'Verificação inconclusiva',
      'Indisponível',
      'Inacessível',
      'Não verificado',
    ].forEach((label) => expect(within(inventory).getAllByText(label).length).toBeGreaterThan(0));
  });

  it('pesquisa, filtra e reordena sem alterar a lista recebida', () => {
    const originalOrder = links.map((link) => link.position);
    render(<ReportLinksPanel discoveredDestinations={7} links={links} />);

    fireEvent.change(screen.getByRole('searchbox', { name: 'Buscar nos links' }), {
      target: { value: 'documentacao-antiga' },
    });
    expect(screen.getByRole('heading', { name: 'Documentação antiga' }))
      .toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Página ausente' }))
      .not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Limpar' }));
    fireEvent.change(screen.getByRole('combobox', {
      name: 'Filtrar links por resultado',
    }), { target: { value: 'broken' } });
    expect(screen.getByRole('heading', { name: 'Página ausente' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Início' })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Limpar' }));
    fireEvent.change(screen.getByRole('combobox', { name: 'Ordenar links' }), {
      target: { value: 'text' },
    });
    const inventory = screen.getByRole('region', {
      name: 'Todos os links encontrados',
    });
    const orderedNames = within(inventory)
      .getAllByRole('heading', { level: 3 })
      .map((heading) => heading.textContent);

    expect(orderedNames[0]).toBe('Área restrita');
    expect(links.map((link) => link.position)).toEqual(originalOrder);
  });

  it('explica redirecionamentos e os motivos de falta de verificação', () => {
    render(<ReportLinksPanel discoveredDestinations={7} links={links} />);

    expect(screen.getByRole('link', { name: 'https://example.com/documentacao' }))
      .toHaveAttribute('href', 'https://example.com/documentacao');
    expect(screen.getByText(/ficou fora da verificação HTTP por causa do limite/))
      .toBeInTheDocument();
    expect(screen.getByText(/não pôde ser interpretado como uma URL válida/))
      .toBeInTheDocument();
    expect(screen.getByText('Ver elemento HTML e rota de redirecionamento'))
      .toBeInTheDocument();
    expect(screen.getAllByText('Ver elemento HTML').length).toBeGreaterThan(0);
  });

  it('monta listas extensas em etapas para manter a troca de seção responsiva', () => {
    const manyLinks = Array.from({ length: 25 }, (_, index) =>
      createLink(index + 1, 'ok'),
    );

    render(<ReportLinksPanel discoveredDestinations={25} links={manyLinks} />);

    expect(screen.getAllByRole('heading', { level: 3 })).toHaveLength(20);
    fireEvent.click(screen.getByRole('button', { name: /Mostrar mais links/ }));
    expect(screen.getAllByRole('heading', { level: 3 })).toHaveLength(25);
  });

  it('permite separar links do mesmo domínio de destinos externos', () => {
    const externalLink = createLink(2, 'ok', {
      declaredHref: 'https://docs.example.net/guia',
      finalUrl: 'https://docs.example.net/guia',
      targetUrl: 'https://docs.example.net/guia',
      text: 'Documentação externa',
    });

    render(
      <ReportLinksPanel
        discoveredDestinations={2}
        links={[createLink(1, 'ok', { text: 'Página interna' }), externalLink]}
      />,
    );

    fireEvent.change(screen.getByRole('combobox', {
      name: 'Filtrar links por domínio',
    }), { target: { value: 'external' } });

    expect(screen.getByRole('heading', { name: 'Documentação externa' }))
      .toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Página interna' }))
      .not.toBeInTheDocument();
    expect(screen.getByText('Domínio externo')).toBeInTheDocument();
  });

  it('remove placeholders de relatórios antigos já armazenados', () => {
    const placeholder = createLink(2, 'ok', {
      declaredHref: '@wrapper',
      targetUrl: 'https://example.com/@wrapper',
      text: 'Wrapper interno',
    });

    render(
      <ReportLinksPanel
        discoveredDestinations={2}
        links={[createLink(1, 'ok', { text: 'Página válida' }), placeholder]}
      />,
    );

    expect(screen.getByRole('heading', { name: 'Página válida' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Wrapper interno' }))
      .not.toBeInTheDocument();
    expect(screen.getByText('1 de 1 link(s)')).toBeInTheDocument();
  });

  it('diferencia uma página sem links de um relatório antigo', () => {
    const { rerender } = render(
      <ReportLinksPanel discoveredDestinations={3} links={[]} />,
    );

    expect(screen.getByRole('heading', {
      name: 'Inventário de links indisponível neste relatório',
    })).toBeInTheDocument();
    expect(screen.getByText(/criado antes do inventário completo/)).toBeInTheDocument();

    rerender(<ReportLinksPanel discoveredDestinations={0} links={[]} />);

    expect(screen.getByRole('heading', { name: 'Nenhum link encontrado na página' }))
      .toBeInTheDocument();
  });
});
