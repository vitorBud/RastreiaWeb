export interface ValidatedUrl {
  hostname: string;
  normalizedUrl: string;
  protocol: 'http:' | 'https:';
}

export interface ValidateUrlResponse {
  url: ValidatedUrl;
  valid: true;
}

export class ApiRequestError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly status: number,
  ) {
    super(message);
    this.name = 'ApiRequestError';
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isValidateUrlResponse(value: unknown): value is ValidateUrlResponse {
  if (!isRecord(value) || value.valid !== true || !isRecord(value.url)) {
    return false;
  }

  return (
    typeof value.url.hostname === 'string' &&
    typeof value.url.normalizedUrl === 'string' &&
    (value.url.protocol === 'http:' || value.url.protocol === 'https:')
  );
}

export async function validateUrl(url: string): Promise<ValidateUrlResponse> {
  let response: Response;

  try {
    response = await fetch('/api/urls/validate', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ url }),
    });
  } catch {
    throw new ApiRequestError(
      'Não foi possível conectar à API. Verifique se o servidor está ativo.',
      'NETWORK_ERROR',
      0,
    );
  }

  let body: unknown;

  try {
    body = await response.json();
  } catch {
    throw new ApiRequestError(
      'A API retornou uma resposta que não pôde ser interpretada.',
      'INVALID_RESPONSE',
      response.status,
    );
  }

  if (!response.ok) {
    const message = isRecord(body) && typeof body.error === 'string'
      ? body.error
      : 'A URL não pôde ser validada.';
    const code = isRecord(body) && typeof body.code === 'string'
      ? body.code
      : 'VALIDATION_ERROR';

    throw new ApiRequestError(message, code, response.status);
  }

  if (!isValidateUrlResponse(body)) {
    throw new ApiRequestError(
      'A API retornou dados em um formato inesperado.',
      'INVALID_RESPONSE',
      response.status,
    );
  }

  return body;
}
