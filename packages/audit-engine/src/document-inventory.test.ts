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
        checkable: true,
        checkUrl: 'https://example.com/sobre',
        declaredHref: '/sobre#equipe',
        targetUrl: 'https://example.com/sobre#equipe',
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

  it('preserva cada imagem e diferencia alt ausente de alt vazio', async () => {
    const inventory = await createDocumentInventory(`
      <!doctype html>
      <html lang="pt-BR">
        <body>
          <img src="/marca.png" alt="Marca da empresa">
          <img src="/marca.png">
          <img src="https://cdn.example.net/divisor.svg" alt="">
        </body>
      </html>
    `, 'https://example.com/inicio');

    expect(inventory.images).toHaveLength(3);
    expect(inventory.images).toEqual([
      expect.objectContaining({
        alt: 'Marca da empresa',
        targetUrl: 'https://example.com/marca.png',
      }),
      expect.objectContaining({
        alt: null,
        element: expect.stringContaining('src="/marca.png"'),
        targetUrl: 'https://example.com/marca.png',
      }),
      expect.objectContaining({
        alt: '',
        targetUrl: 'https://cdn.example.net/divisor.svg',
      }),
    ]);
  });

  it('preserva destinos HTTP repetidos e URLs HTTP inválidas na ordem do HTML', async () => {
    const inventory = await createDocumentInventory(`
      <!doctype html>
      <html lang="pt-BR">
        <body>
          <a class="menu" href="/documentacao#inicio">Documentação</a>
          <a class="rodape" href="/documentacao#contato">Documentação no rodapé</a>
          <a href="tel:+5511999999999">Telefone</a>
          <a href="http://[">URL inválida</a>
        </body>
      </html>
    `, 'https://example.com/inicio');

    expect(inventory.links).toHaveLength(3);
    expect(inventory.links).toEqual([
      expect.objectContaining({
        checkUrl: 'https://example.com/documentacao',
        declaredHref: '/documentacao#inicio',
        targetUrl: 'https://example.com/documentacao#inicio',
        text: 'Documentação',
      }),
      expect.objectContaining({
        checkUrl: 'https://example.com/documentacao',
        declaredHref: '/documentacao#contato',
        targetUrl: 'https://example.com/documentacao#contato',
        text: 'Documentação no rodapé',
      }),
      expect.objectContaining({
        checkable: false,
        declaredHref: 'http://[',
        targetUrl: 'http://[',
        text: 'URL inválida',
        uncheckableReason: 'invalid_url',
      }),
    ]);
  });

  it('ignora placeholders e ações que não representam navegação web real', async () => {
    const inventory = await createDocumentInventory(`
      <!doctype html>
      <html lang="pt-BR">
        <body>
          <a href="@wrapper">Placeholder do framework</a>
          <a href="{{ destination }}">Template</a>
          <a href="#conteudo">Atalho na própria página</a>
          <a href="https://example.com/inicio#rodape">Mesmo documento</a>
          <a href="javascript:void(0)">Controle JavaScript</a>
          <a href="mailto:contato@example.com">E-mail</a>
          <a href="/desativado" aria-disabled="true">Desativado</a>
          <button data-href="/acao">Botão sem navegação declarada</button>
          <a class="button" href="/cadastro">Criar conta</a>
          <map><area href="https://docs.example.net/guia" alt="Guia externo"></map>
        </body>
      </html>
    `, 'https://example.com/inicio');

    expect(inventory.links).toHaveLength(2);
    expect(inventory.links).toEqual([
      expect.objectContaining({
        declaredHref: '/cadastro',
        targetUrl: 'https://example.com/cadastro',
        text: 'Criar conta',
      }),
      expect.objectContaining({
        declaredHref: 'https://docs.example.net/guia',
        targetUrl: 'https://docs.example.net/guia',
        text: 'Guia externo',
      }),
    ]);
  });
});
