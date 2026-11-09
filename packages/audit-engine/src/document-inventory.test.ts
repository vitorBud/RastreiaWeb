import { describe, expect, it } from 'vitest';
import { createDocumentInventory } from './document-inventory.js';

describe('createDocumentInventory', () => {
  it('extrai e normaliza links, imagens e recursos sem carregar a rede', async () => {
    const inventory = await createDocumentInventory(`
      <!doctype html>
      <html lang="pt-BR">
        <head>
          <title>Página de teste</title>
          <link rel="stylesheet" href="/styles.css">
          <script src="/app.js"></script>
        </head>
        <body>
          <a href="/sobre#equipe">Conheça a equipe</a>
          <a href="mailto:contato@example.com">E-mail</a>
          <img src="/logo.png" alt="Marca da empresa">
          <img src="/decoracao.png">
        </body>
      </html>
    `, 'https://example.com/inicio');

    expect(inventory.title).toBe('Página de teste');
    expect(inventory.links).toEqual([
      expect.objectContaining({
        targetUrl: 'https://example.com/sobre',
        text: 'Conheça a equipe',
      }),
    ]);
    expect(inventory.images).toEqual([
      expect.objectContaining({
        alt: 'Marca da empresa',
        targetUrl: 'https://example.com/logo.png',
      }),
      expect.objectContaining({
        alt: null,
        targetUrl: 'https://example.com/decoracao.png',
      }),
    ]);
    expect(inventory.resources).toEqual([
      expect.objectContaining({
        kind: 'stylesheet',
        targetUrl: 'https://example.com/styles.css',
      }),
      expect.objectContaining({
        kind: 'script',
        targetUrl: 'https://example.com/app.js',
      }),
    ]);
  });
});
