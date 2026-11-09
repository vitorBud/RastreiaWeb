import cors from 'cors';
import express from 'express';
import { z } from 'zod';
import {
  resolveHostnameWithDns,
  UrlValidationError,
  validatePublicUrl,
  type ResolveHostname,
} from './security/public-url.js';

interface AppDependencies {
  resolveHostname: ResolveHostname;
}

const urlRequestSchema = z.strictObject({
  url: z.string(),
});

export function createApp(
  dependencies: AppDependencies = { resolveHostname: resolveHostnameWithDns },
) {
  const app = express();

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
        dependencies.resolveHostname,
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

  app.use((_request, response) => {
    response.status(404).json({
      error: 'Rota não encontrada.',
    });
  });

  return app;
}

export const app = createApp();
