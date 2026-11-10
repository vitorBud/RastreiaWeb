import { fireEvent, render, screen } from '@testing-library/react';
import { vi } from 'vitest';
import type { AuditReport } from '../types/audit';
import { AuditHistoryChart } from './AuditHistoryChart';

function createReport(index: number, totalIssues: number): AuditReport {
  return {
    analyzedAt: `2026-11-${String(index + 1).padStart(2, '0')}T12:00:00.000Z`,
    disclaimer: 'Análise automática.',
    durationMs: 100,
    finalUrl: `https://site-${index}.example.com/`,
    initialUrl: `https://site-${index}.example.com`,
    issues: Array.from({ length: totalIssues }, (_, issueIndex) => ({
      category: issueIndex % 2 === 0 ? 'link' : 'resource',
      code: 'NOT_FOUND',
      description: 'Problema',
      pageUrl: `https://site-${index}.example.com/`,
      severity: 'serious',
    })),
    links: [],
    limits: { maxLinks: 20, maxResources: 20 },
    pageTitle: `Site ${index}`,
    summary: {
      brokenLinks: totalIssues,
      failedResources: 0,
      imagesFound: 0,
      imagesWithoutAlt: 0,
      linksChecked: 0,
      linksFound: 0,
      redirects: 0,
      restrictedLinks: 0,
      resourcesChecked: 0,
      totalIssues,
      unavailableLinks: 0,
      unreachableLinks: 0,
    },
  };
}

describe('AuditHistoryChart', () => {
  it('mostra no máximo oito auditorias e abre a selecionada', () => {
    const history = Array.from({ length: 10 }, (_, index) => createReport(index, index));
    const onSelectReport = vi.fn();

    render(
      <AuditHistoryChart
        history={history}
        onCreateAudit={vi.fn()}
        onSelectReport={onSelectReport}
      />,
    );

    const bars = screen.getAllByRole('button');
    expect(bars).toHaveLength(8);
    fireEvent.click(screen.getByRole('button', { name: /Site 0/ }));
    expect(onSelectReport).toHaveBeenCalledWith(history[0]);
  });

  it('oferece iniciar uma auditoria quando não há histórico', () => {
    const onCreateAudit = vi.fn();
    render(
      <AuditHistoryChart
        history={[]}
        onCreateAudit={onCreateAudit}
        onSelectReport={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Criar auditoria' }));
    expect(onCreateAudit).toHaveBeenCalledOnce();
  });
});
