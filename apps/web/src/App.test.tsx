import { fireEvent, render, screen } from '@testing-library/react';
import { afterAll, beforeEach, vi } from 'vitest';
import { App } from './App';

const fetchMock = vi.fn();

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal('fetch', fetchMock);
});

afterAll(() => {
  vi.unstubAllGlobals();
});

describe('App', () => {
  it('envia a URL e apresenta o endereço normalizado', async () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify({
      valid: true,
      url: {
        hostname: 'example.com',
        normalizedUrl: 'https://example.com/',
        protocol: 'https:',
      },
    }), { status: 200 }));

    render(<App />);

    fireEvent.change(screen.getByLabelText('URL pública autorizada'), {
      target: { value: 'https://example.com' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Validar página' }));

    await screen.findByText('URL validada com segurança: https://example.com/');
    expect(screen.getByRole('status')).toHaveTextContent('https://example.com/');
  });

  it('apresenta como alerta um destino bloqueado pela API', async () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify({
      code: 'PRIVATE_ADDRESS',
      error: 'A URL aponta para um endereço privado ou reservado.',
      valid: false,
    }), { status: 422 }));

    render(<App />);

    fireEvent.change(screen.getByLabelText('URL pública autorizada'), {
      target: { value: 'http://127.0.0.1' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Validar página' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'A URL aponta para um endereço privado ou reservado.',
    );
  });
});
