import cors from 'cors';
import express from 'express';
import { z } from 'zod';
import type { AuditReport } from '@rastreiaweb/shared';
import { AuditNetworkError } from './audit/public-http-client.js';
import { auditPage, PageAuditError } from './audit/page-audit.js';
import {
  resolveHostnameWithDns,
  UrlValidationError,
  validatePublicUrl,
  type ResolveHostname,
} from './security/public-url.js';

interface AppDependencies {
  auditPage: (url: string) => Promise<AuditReport>;
  resolveHostname: ResolveHostname;
}

const urlRequestSchema = z.strictObject({
  url: z.string(),
});

export function createApp(
  dependencies: Partial<AppDependencies> = {},
) {
  const app = express();
  const runAudit = dependencies.auditPage ?? auditPage;
  const resolveHostname = dependencies.resolveHostname ?? resolveHostnameWithDns;

  app.disable('x-powered-by');
  app.use(cors({ origin: 'http://localhost:5173' }));
  app.use(express.json({ limit: '16kb' }));

  app.get('/api/health', (_request, response) => {
    response.status(200).json({
      service: 'rastreiaweb-api',
      status: 'ok',
    });
  });

  app.post('/api/urls/validate', async (request, response) => {
    const parsedBody = urlRequestSchema.safeParse(request.body);

    if (!parsedBody.success) {
      response.status(400).json({
        code: 'INVALID_REQUEST',
        error: 'Envie um objeto contendo o campo url em formato de texto.',
      });
      return;
    }

    try {
      const result = await validatePublicUrl(
        parsedBody.data.url,
        resolveHostname,
      );

      response.status(200).json({
        valid: true,
        url: {
          hostname: result.hostname,
          normalizedUrl: result.normalizedUrl,
          protocol: result.protocol,
        },
      });
    } catch (error) {
      if (error instanceof UrlValidationError) {
        const invalidDestinationCodes = new Set([
          'DNS_LOOKUP_FAILED',
          'HOST_NOT_FOUND',
          'PRIVATE_ADDRESS',
        ]);

        response.status(invalidDestinationCodes.has(error.code) ? 422 : 400).json({
          code: error.code,
          error: error.message,
          valid: false,
        });
        return;
      }

      response.status(500).json({
        code: 'INTERNAL_ERROR',
        error: 'Não foi possível validar a URL.',
        valid: false,
      });
    }
  });

  app.post('/api/audits', async (request, response) => {
    const parsedBody = urlRequestSchema.safeParse(request.body);

    if (!parsedBody.success) {
      response.status(400).json({
        code: 'INVALID_REQUEST',
        error: 'Envie um objeto contendo o campo url em formato de texto.',
      });
      return;
    }

    try {
      const report = await runAudit(parsedBody.data.url);
      response.status(200).json(report);
    } catch (error) {
      if (error instanceof UrlValidationError) {
        response.status(422).json({
          code: error.code,
          error: error.message,
        });
        return;
      }

      if (error instanceof PageAuditError) {
        response.status(422).json({
          code: error.code,
          error: error.message,
        });
        return;
      }

      if (error instanceof AuditNetworkError) {
        response.status(error.code === 'TIMEOUT' ? 504 : 502).json({
          code: error.code,
          error: error.message,
        });
        return;
      }

      response.status(500).json({
        code: 'INTERNAL_ERROR',
        error: 'Não foi possível concluir a auditoria.',
      });
    }
  });

  app.use((_request, response) => {
    response.status(404).json({
      error: 'Rota não encontrada.',
    });
  });

  return app;
}

export const app = createApp();
