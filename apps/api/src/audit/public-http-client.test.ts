import { describe, expect, it, vi } from 'vitest';
import { requestPublicUrl, type RawRequest } from './public-http-client.js';

const publicResolver = vi.fn(async () => [
  { address: '93.184.216.34', family: 4 },
]);

describe('requestPublicUrl', () => {
  it('permite solicitar o tipo de conteúdo adequado ao recurso', async () => {
    const rawRequest: RawRequest = vi.fn().mockResolvedValue({
      body: 'body { margin: 0; }',
      headers: { 'content-type': 'text/css' },
      statusCode: 200,
    });

    await requestPublicUrl('https://example.com/styles.css', {
      accept: 'text/css,*/*;q=0.1',
    }, {
      rawRequest,
      resolveHostname: publicResolver,
    });

    expect(rawRequest).toHaveBeenCalledWith(
      expect.any(Object),
      expect.objectContaining({ accept: 'text/css,*/*;q=0.1' }),
    );
  });

  it('revalida e acompanha redirecionamentos públicos', async () => {
    const rawRequest: RawRequest = vi
      .fn()
      .mockResolvedValueOnce({
        headers: { location: '/pagina-final' },
        statusCode: 302,
      })
      .mockResolvedValueOnce({
        body: '<html></html>',
        headers: { 'content-type': 'text/html' },
        statusCode: 200,
      });

    const result = await requestPublicUrl('https://example.com/inicio', {}, {
      rawRequest,
      resolveHostname: publicResolver,
    });

    expect(result).toMatchObject({
      body: '<html></html>',
      finalUrl: 'https://example.com/pagina-final',
      redirects: ['https://example.com/pagina-final'],
      statusCode: 200,
    });
    expect(rawRequest).toHaveBeenCalledTimes(2);
  });

  it('bloqueia um redirecionamento para endereço privado antes da conexão', async () => {
    const rawRequest: RawRequest = vi.fn().mockResolvedValue({
      headers: { location: 'http://127.0.0.1/admin' },
      statusCode: 302,
    });

    await expect(requestPublicUrl('https://example.com', {}, {
      rawRequest,
      resolveHostname: publicResolver,
    })).rejects.toMatchObject({ code: 'PRIVATE_ADDRESS' });

    expect(rawRequest).toHaveBeenCalledTimes(1);
  });

  it('limita a quantidade de redirecionamentos', async () => {
    const rawRequest: RawRequest = vi.fn().mockResolvedValue({
      headers: { location: '/novamente' },
      statusCode: 301,
    });

    await expect(requestPublicUrl('https://example.com', { maxRedirects: 1 }, {
      rawRequest,
      resolveHostname: publicResolver,
    })).rejects.toMatchObject({ code: 'TOO_MANY_REDIRECTS' });
  });
});
