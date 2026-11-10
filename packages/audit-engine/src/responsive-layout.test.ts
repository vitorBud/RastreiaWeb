import { describe, expect, it } from 'vitest';
import { analyzeResponsiveLayout } from './responsive-layout.js';

describe('analyzeResponsiveLayout', () => {
  it('detecta um elemento que força rolagem horizontal em telas menores', async () => {
    const result = await analyzeResponsiveLayout(`
      <!doctype html>
      <html>
        <head></head>
        <body><main class="wide-panel">Conteúdo</main></body>
      </html>
    `, 'https://example.com/', [{
      content: `
        @import url('https://fonts.example.net/theme.css');
        * { box-sizing: border-box; }
        body { margin: 0; }
        .wide-panel { width: 900px; height: 80px; }
        @media (min-width: 1000px) { .wide-panel { width: 100%; } }
      `,
      sourceUrl: 'https://example.com/styles.css',
    }]);

    expect(result.status).toBe('completed');
    expect(result.viewports).toHaveLength(3);
    expect(result.viewports.find((item) => item.name === 'desktop'))
      .toMatchObject({ horizontalOverflow: false, width: 1440 });
    expect(result.viewports.find((item) => item.name === 'mobile'))
      .toMatchObject({ horizontalOverflow: true, width: 390 });
    expect(
      result.viewports.find((item) => item.name === 'mobile')?.overflowingElements[0],
    ).toMatchObject({ selector: 'main.wide-panel' });
  });

  it('não sinaliza conteúdo dentro de uma área de rolagem intencional', async () => {
    const result = await analyzeResponsiveLayout(`
      <!doctype html>
      <html>
        <head><style>
          body { margin: 0; }
          .scroller { max-width: 100%; overflow-x: auto; }
          table { width: 900px; }
        </style></head>
        <body><div class="scroller"><table><tr><td>Dados</td></tr></table></div></body>
      </html>
    `, 'https://example.com/');

    const mobile = result.viewports.find((item) => item.name === 'mobile');
    expect(mobile?.horizontalOverflow).toBe(false);
    expect(mobile?.overflowingElements).toEqual([]);
  });

  it('remove a apresentação alternativa de noscript antes de medir', async () => {
    const result = await analyzeResponsiveLayout(`
      <!doctype html>
      <html class="no-js">
        <body>
          <noscript><div style="width: 900px">Ative o JavaScript</div></noscript>
          <main style="max-width: 100%">Conteúdo principal</main>
        </body>
      </html>
    `, 'https://example.com/');

    expect(result.viewports.every((item) => !item.horizontalOverflow)).toBe(true);
    expect(result.viewports.every((item) =>
      item.overflowingElements.every((element) => !element.element.includes('noscript')),
    )).toBe(true);
  });
});
