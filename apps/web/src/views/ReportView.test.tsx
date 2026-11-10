import { fireEvent, render, screen } from '@testing-library/react';
import { vi } from 'vitest';
import type { AuditReport } from '../types/audit';
import { ReportView } from './ReportView';

const report: AuditReport = {
  analyzedAt: '2026-11-09T12:00:00.000Z',
  disclaimer: 'Análise automática.',
  durationMs: 100,
  finalUrl: 'https://example.com/',
  initialUrl: 'https://example.com',
  issues: [
    {
      category: 'link',
      code: 'NOT_FOUND',
      description: 'Link quebrado confirmado.',
      pageUrl: 'https://example.com/',
      severity: 'serious',
      statusCode: 404,
      targetUrl: 'https://example.com/quebrado',
    },
    {
      category: 'link',
      code: 'ACCESS_RESTRICTED',
      description: 'Verificação inconclusiva.',
      pageUrl: 'https://example.com/',
      severity: 'minor',
      statusCode: 403,
      targetUrl: 'https://example.com/restrito',
    },
  ],
  limits: { maxLinks: 20, maxResources: 20 },
  pageTitle: 'Exemplo',
  summary: {
    brokenLinks: 1,
    failedResources: 0,
    imagesFound: 0,
    imagesWithoutAlt: 0,
    linksChecked: 2,
    linksFound: 2,
    redirects: 0,
    restrictedLinks: 1,
    resourcesChecked: 0,
    totalIssues: 2,
    unavailableLinks: 0,
    unreachableLinks: 0,
  },
};

describe('ReportView', () => {
  it('distingue problemas confirmados de verificações inconclusivas', () => {
    render(<ReportView onNavigate={vi.fn()} report={report} />);

    expect(screen.getByText('Link quebrado confirmado.')).toBeInTheDocument();
    expect(screen.getByText('Verificação inconclusiva.')).toBeInTheDocument();
    expect(screen.getByText('Quebrados confirmados')).toBeInTheDocument();
    expect(screen.getByText('Inconclusivos')).toBeInTheDocument();

    fireEvent.change(screen.getByRole('combobox', { name: 'Resultado' }), {
      target: { value: 'inconclusive' },
    });

    expect(screen.queryByText('Link quebrado confirmado.')).not.toBeInTheDocument();
    expect(screen.getByText('Verificação inconclusiva.')).toBeInTheDocument();
  });
});
