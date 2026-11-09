import { describe, expect, it, vi } from 'vitest';
import { validatePublicUrl } from './public-url.js';

const publicResolver = vi.fn(async () => [
  { address: '93.184.216.34', family: 4 },
]);

describe('validatePublicUrl', () => {
  it('normaliza uma URL pública e remove o fragmento', async () => {
    const result = await validatePublicUrl(
      '  https://Example.COM/docs?lang=pt#conteudo  ',
      publicResolver,
    );

    expect(result).toEqual({
      addresses: [{ address: '93.184.216.34', family: 4 }],
      hostname: 'example.com',
      normalizedUrl: 'https://example.com/docs?lang=pt',
      protocol: 'https:',
    });
  });

  it.each([
    ['ftp://example.com', 'UNSUPPORTED_PROTOCOL'],
    ['https://usuario:senha@example.com', 'CREDENTIALS_NOT_ALLOWED'],
    ['https://example.com:8080', 'PORT_NOT_ALLOWED'],
    ['http://example.com:443', 'PORT_NOT_ALLOWED'],
    ['http://localhost', 'HOSTNAME_NOT_ALLOWED'],
    ['http://servico.internal', 'HOSTNAME_NOT_ALLOWED'],
    ['http://127.0.0.1', 'PRIVATE_ADDRESS'],
    ['http://2130706433', 'PRIVATE_ADDRESS'],
    ['http://[::1]', 'PRIVATE_ADDRESS'],
  ])('bloqueia %s com o código %s', async (url, code) => {
    await expect(validatePublicUrl(url, publicResolver)).rejects.toMatchObject({ code });
  });

  it('bloqueia um hostname quando qualquer resposta DNS não é pública', async () => {
    const mixedResolver = vi.fn(async () => [
      { address: '93.184.216.34', family: 4 },
      { address: '10.0.0.5', family: 4 },
    ]);

    await expect(
      validatePublicUrl('https://example.com', mixedResolver),
    ).rejects.toMatchObject({ code: 'PRIVATE_ADDRESS' });
  });

  it('trata falhas de DNS sem expor detalhes internos', async () => {
    const failingResolver = vi.fn(async () => {
      throw new Error('getaddrinfo ENOTFOUND');
    });

    await expect(
      validatePublicUrl('https://nao-existe.example.com.br', failingResolver),
    ).rejects.toMatchObject({ code: 'DNS_LOOKUP_FAILED' });
  });
});
