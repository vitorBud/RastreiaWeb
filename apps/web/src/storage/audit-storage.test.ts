import { beforeEach, describe, expect, it } from 'vitest';
import { loadAuditHistory } from './audit-storage';

const historyKey = 'rastreiaweb:audit-history';

const legacyReport = {
  analyzedAt: '2026-11-08T12:00:00.000Z',
  disclaimer: 'Análise automática.',
  durationMs: 100,
  finalUrl: 'https://example.com/',
  initialUrl: 'https://example.com',
  issues: [],
  limits: { maxLinks: 20, maxResources: 20 },
  pageTitle: 'Relatório antigo',
  summary: {
    brokenLinks: 0,
    failedResources: 0,
    imagesFound: 0,
    imagesWithoutAlt: 0,
    linksChecked: 2,
    linksFound: 3,
    redirects: 0,
    resourcesChecked: 0,
    totalIssues: 0,
  },
};

describe('loadAuditHistory', () => {
  beforeEach(() => window.localStorage.clear());

  it('mantém relatórios antigos compatíveis com o inventário de links', () => {
    window.localStorage.setItem(historyKey, JSON.stringify([legacyReport]));

    const [report] = loadAuditHistory();

    expect(report?.links).toEqual([]);
    expect(report?.summary).toMatchObject({
      restrictedLinks: 0,
      unavailableLinks: 0,
      unreachableLinks: 0,
    });
  });

  it('preserva o inventário completo dos relatórios novos', () => {
    const link = {
      declaredHref: '/documentacao',
      element: '<a href="/documentacao">Documentação</a>',
      finalUrl: 'https://example.com/documentacao',
      pageUrl: 'https://example.com/',
      position: 1,
      redirects: [],
      state: 'ok',
      statusCode: 200,
      targetUrl: 'https://example.com/documentacao',
      text: 'Documentação',
    };
    window.localStorage.setItem(historyKey, JSON.stringify([{
      ...legacyReport,
      links: [link],
      summary: {
        ...legacyReport.summary,
        linksChecked: 1,
        linksFound: 1,
      },
    }]));

    expect(loadAuditHistory()[0]?.links).toEqual([link]);
  });

  it('descarta itens de link corrompidos sem perder o restante do relatório', () => {
    window.localStorage.setItem(historyKey, JSON.stringify([{
      ...legacyReport,
      links: [{ position: 'primeiro', state: 'desconhecido' }],
    }]));

    expect(loadAuditHistory()[0]?.links).toEqual([]);
  });
});
