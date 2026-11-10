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
