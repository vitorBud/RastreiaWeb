import cors from 'cors';
import express from 'express';
import { z } from 'zod';
import type { AuditProgress, AuditReport } from '@rastreiaweb/shared';
import { AuditNetworkError } from './audit/public-http-client.js';
import {
  auditPage,
  PageAuditError,
  type PageAuditOptions,
} from './audit/page-audit.js';
import {
  resolveHostnameWithDns,
  UrlValidationError,
  validatePublicUrl,
  type ResolveHostname,
} from './security/public-url.js';

interface AppDependencies {
  auditPage: (url: string, options?: PageAuditOptions) => Promise<AuditReport>;
  resolveHostname: ResolveHostname;
}

const urlRequestSchema = z.strictObject({
  url: z.string(),
});

const auditRequestSchema = z.strictObject({
  options: z.strictObject({
    maxLinks: z.number().int().min(1).max(50),
    maxResources: z.number().int().min(1).max(50),
  }).optional(),
  url: z.string(),
});

function auditErrorResponse(error: unknown) {
  if (error instanceof UrlValidationError) {
    return { body: { code: error.code, error: error.message }, status: 422 };
  }

  if (error instanceof PageAuditError) {
    return { body: { code: error.code, error: error.message }, status: 422 };
  }

  if (error instanceof AuditNetworkError) {
    return {
      body: { code: error.code, error: error.message },
      status: error.code === 'TIMEOUT' ? 504 : 502,
    };
  }

  return {
    body: {
      code: 'INTERNAL_ERROR',
      error: 'Não foi possível concluir a auditoria.',
    },
    status: 500,
  };
}

export function createApp(
  dependencies: Partial<AppDependencies> = {},
) {
  const app = express();
  const runAudit = dependencies.auditPage ?? auditPage;
  const resolveHostname = dependencies.resolveHostname ?? resolveHostnameWithDns;
  let auditInProgress = false;

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
    const parsedBody = auditRequestSchema.safeParse(request.body);

    if (!parsedBody.success) {
      response.status(400).json({
        code: 'INVALID_REQUEST',
        error: 'Envie um objeto contendo o campo url em formato de texto.',
      });
      return;
    }

    if (auditInProgress) {
      response.status(429).json({
        code: 'AUDIT_IN_PROGRESS',
        error: 'Já existe uma auditoria em andamento. Aguarde a conclusão.',
      });
      return;
    }

    auditInProgress = true;

    if (request.headers.accept?.includes('application/x-ndjson')) {
      response.status(200);
      response.setHeader('Content-Type', 'application/x-ndjson; charset=utf-8');
      response.setHeader('Cache-Control', 'no-cache, no-transform');
      response.setHeader('X-Content-Type-Options', 'nosniff');
      response.flushHeaders();

      const writeEvent = (event: object) => {
        response.write(`${JSON.stringify(event)}\n`);
      };

      try {
        const report = await runAudit(parsedBody.data.url, {
          ...(parsedBody.data.options ?? {}),
          onProgress: (progress: AuditProgress) => {
            writeEvent({ progress, type: 'progress' });
          },
        });
        writeEvent({ report, type: 'report' });
      } catch (error) {
        const result = auditErrorResponse(error);
        writeEvent({
          error: { ...result.body, status: result.status },
          type: 'error',
        });
      } finally {
        auditInProgress = false;
        response.end();
      }

      return;
    }

    try {
      const report = await runAudit(parsedBody.data.url, parsedBody.data.options);
      response.status(200).json(report);
    } catch (error) {
      const result = auditErrorResponse(error);
      response.status(result.status).json(result.body);
    } finally {
      auditInProgress = false;
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
