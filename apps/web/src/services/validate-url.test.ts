import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiRequestError, validateUrl } from './validate-url';

const fetchMock = vi.fn();

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal('fetch', fetchMock);
});

afterAll(() => {
  vi.unstubAllGlobals();
});

describe('validateUrl', () => {
  it('retorna os dados normalizados de uma URL pública', async () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify({
      valid: true,
      url: {
        hostname: 'example.com',
        normalizedUrl: 'https://example.com/',
        protocol: 'https:',
      },
    }), { status: 200 }));

    await expect(validateUrl('https://example.com')).resolves.toEqual({
      valid: true,
      url: {
        hostname: 'example.com',
        normalizedUrl: 'https://example.com/',
        protocol: 'https:',
      },
    });

    expect(fetchMock).toHaveBeenCalledWith('/api/urls/validate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: 'https://example.com' }),
    });
  });

  it('preserva o código e a mensagem de validação enviados pela API', async () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify({
      code: 'PRIVATE_ADDRESS',
      error: 'A URL aponta para um endereço privado ou reservado.',
      valid: false,
    }), { status: 422 }));

    await expect(validateUrl('http://127.0.0.1')).rejects.toMatchObject({
      code: 'PRIVATE_ADDRESS',
      message: 'A URL aponta para um endereço privado ou reservado.',
      status: 422,
    } satisfies Partial<ApiRequestError>);
  });

  it('transforma falhas de rede em um erro compreensível', async () => {
    fetchMock.mockRejectedValue(new TypeError('Failed to fetch'));

    await expect(validateUrl('https://example.com')).rejects.toMatchObject({
      code: 'NETWORK_ERROR',
      status: 0,
    });
  });
});
