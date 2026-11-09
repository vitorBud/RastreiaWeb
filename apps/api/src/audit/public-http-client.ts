import { request as httpRequest, type IncomingHttpHeaders } from 'node:http';
import { request as httpsRequest } from 'node:https';
import { isIP } from 'node:net';
import type { Readable } from 'node:stream';
import { createBrotliDecompress, createGunzip, createInflate } from 'node:zlib';
import {
  resolveHostnameWithDns,
  validatePublicUrl,
  type ResolveHostname,
  type ValidatedPublicUrl,
} from '../security/public-url.js';

export type AuditNetworkErrorCode =
  | 'BODY_TOO_LARGE'
  | 'INVALID_REDIRECT'
  | 'REQUEST_FAILED'
  | 'TIMEOUT'
  | 'TOO_MANY_REDIRECTS'
  | 'UNSUPPORTED_ENCODING';

export class AuditNetworkError extends Error {
  constructor(
    public readonly code: AuditNetworkErrorCode,
    message: string,
  ) {
    super(message);
    this.name = 'AuditNetworkError';
  }
}

export interface RawHttpResponse {
  body?: string;
  headers: IncomingHttpHeaders;
  statusCode: number;
}

export interface PublicHttpResponse extends RawHttpResponse {
  finalUrl: string;
  redirects: string[];
}

export interface PublicHttpRequestOptions {
  maxBodyBytes?: number;
  maxRedirects?: number;
  method?: 'GET' | 'HEAD';
  readBody?: boolean;
  timeoutMs?: number;
}

export type RawRequest = (
  target: ValidatedPublicUrl,
  options: Required<Pick<PublicHttpRequestOptions, 'maxBodyBytes' | 'method' | 'readBody' | 'timeoutMs'>>,
) => Promise<RawHttpResponse>;

interface PublicHttpDependencies {
  rawRequest?: RawRequest;
  resolveHostname?: ResolveHostname;
}

const redirectStatusCodes = new Set([301, 302, 303, 307, 308]);

function createDecodedStream(
  response: Readable,
  contentEncoding: string | undefined,
): Readable {
  switch (contentEncoding?.toLowerCase()) {
    case undefined:
    case '':
    case 'identity':
      return response;
    case 'br':
      return response.pipe(createBrotliDecompress());
    case 'deflate':
      return response.pipe(createInflate());
    case 'gzip':
      return response.pipe(createGunzip());
    default:
      throw new AuditNetworkError(
        'UNSUPPORTED_ENCODING',
        `Codificação de resposta não suportada: ${contentEncoding}.`,
      );
  }
}

export const requestPinnedAddress: RawRequest = (target, options) =>
  new Promise((resolve, reject) => {
    const address = target.addresses[0];

    if (!address) {
      reject(new AuditNetworkError('REQUEST_FAILED', 'Nenhum endereço público disponível.'));
      return;
    }

    const url = new URL(target.normalizedUrl);
    const requester = target.protocol === 'https:' ? httpsRequest : httpRequest;
    const request = requester({
      headers: {
        Accept: options.readBody
          ? 'text/html,application/xhtml+xml;q=0.9,*/*;q=0.5'
          : '*/*',
        'Accept-Encoding': 'gzip, deflate, br',
        Host: url.host,
        'User-Agent': 'RastreiaWeb/0.1 (+https://github.com/vitorBud/RastreiaWeb)',
      },
      hostname: address.address,
      method: options.method,
      path: `${url.pathname}${url.search}`,
      port: target.protocol === 'https:' ? 443 : 80,
      rejectUnauthorized: true,
      ...(target.protocol === 'https:' && isIP(target.hostname) === 0
        ? { servername: target.hostname }
        : {}),
    }, (response) => {
      const statusCode = response.statusCode ?? 0;

      if (
        !options.readBody ||
        options.method === 'HEAD' ||
        redirectStatusCodes.has(statusCode)
      ) {
        response.resume();
        resolve({ headers: response.headers, statusCode });
        return;
      }

      let stream: Readable;

      try {
        stream = createDecodedStream(response, response.headers['content-encoding']);
      } catch (error) {
        response.destroy();
        reject(error);
        return;
      }

      const chunks: Buffer[] = [];
      let totalBytes = 0;

      stream.on('data', (chunk: Buffer | string) => {
        const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
        totalBytes += buffer.length;

        if (totalBytes > options.maxBodyBytes) {
          stream.destroy(new AuditNetworkError(
            'BODY_TOO_LARGE',
            `A resposta excedeu o limite de ${options.maxBodyBytes} bytes.`,
          ));
          return;
        }

        chunks.push(buffer);
      });
      stream.once('end', () => {
        resolve({
          body: Buffer.concat(chunks).toString('utf8'),
          headers: response.headers,
          statusCode,
        });
      });
      stream.once('error', reject);
    });

    request.setTimeout(options.timeoutMs, () => {
      request.destroy(new AuditNetworkError(
        'TIMEOUT',
        `A requisição excedeu o limite de ${options.timeoutMs} ms.`,
      ));
    });
    request.once('error', (error) => {
      reject(
        error instanceof AuditNetworkError
          ? error
          : new AuditNetworkError('REQUEST_FAILED', 'Não foi possível acessar o destino.'),
      );
    });
    request.end();
  });

export async function requestPublicUrl(
  input: string,
  options: PublicHttpRequestOptions = {},
  dependencies: PublicHttpDependencies = {},
): Promise<PublicHttpResponse> {
  const maxRedirects = options.maxRedirects ?? 5;
  const requestOptions = {
    maxBodyBytes: options.maxBodyBytes ?? 2_000_000,
    method: options.method ?? 'GET',
    readBody: options.readBody ?? true,
    timeoutMs: options.timeoutMs ?? 8_000,
  } as const;
  const rawRequest = dependencies.rawRequest ?? requestPinnedAddress;
  const resolveHostname = dependencies.resolveHostname ?? resolveHostnameWithDns;
  const redirects: string[] = [];
  let currentUrl = input;

  for (;;) {
    const target = await validatePublicUrl(currentUrl, resolveHostname);
    const response = await rawRequest(target, requestOptions);
    const location = response.headers.location;

    if (!redirectStatusCodes.has(response.statusCode)) {
      return {
        ...response,
        finalUrl: target.normalizedUrl,
        redirects,
      };
    }

    if (!location) {
      throw new AuditNetworkError(
        'INVALID_REDIRECT',
        'O servidor respondeu com redirecionamento sem informar o destino.',
      );
    }

    if (redirects.length >= maxRedirects) {
      throw new AuditNetworkError(
        'TOO_MANY_REDIRECTS',
        `A URL excedeu o limite de ${maxRedirects} redirecionamentos.`,
      );
    }

    let nextUrl: string;

    try {
      nextUrl = new URL(location, target.normalizedUrl).toString();
    } catch {
      throw new AuditNetworkError(
        'INVALID_REDIRECT',
        'O servidor informou um destino de redirecionamento inválido.',
      );
    }

    redirects.push(nextUrl);
    currentUrl = nextUrl;
  }
}
