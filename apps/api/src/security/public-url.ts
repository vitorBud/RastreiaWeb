import { lookup } from 'node:dns/promises';
import { isIP } from 'node:net';
import { isPublicIp } from './ip-address.js';

export interface ResolvedAddress {
  address: string;
  family: number;
}

export type ResolveHostname = (hostname: string) => Promise<readonly ResolvedAddress[]>;

export type UrlValidationErrorCode =
  | 'CREDENTIALS_NOT_ALLOWED'
  | 'DNS_LOOKUP_FAILED'
  | 'EMPTY_URL'
  | 'HOSTNAME_NOT_ALLOWED'
  | 'HOST_NOT_FOUND'
  | 'INVALID_URL'
  | 'PORT_NOT_ALLOWED'
  | 'PRIVATE_ADDRESS'
  | 'UNSUPPORTED_PROTOCOL';

export class UrlValidationError extends Error {
  constructor(
    public readonly code: UrlValidationErrorCode,
    message: string,
  ) {
    super(message);
    this.name = 'UrlValidationError';
  }
}

export interface ValidatedPublicUrl {
  addresses: readonly ResolvedAddress[];
  hostname: string;
  normalizedUrl: string;
  protocol: 'http:' | 'https:';
}

const blockedHostnameSuffixes = [
  '.example',
  '.home',
  '.internal',
  '.invalid',
  '.lan',
  '.local',
  '.localdomain',
  '.localhost',
  '.onion',
  '.test',
];

export async function resolveHostnameWithDns(
  hostname: string,
): Promise<readonly ResolvedAddress[]> {
  return lookup(hostname, { all: true, verbatim: true });
}

function normalizeHostname(hostname: string): string {
  return hostname.replace(/^\[|\]$/g, '').replace(/\.$/, '').toLowerCase();
}

function isBlockedHostname(hostname: string): boolean {
  return (
    hostname === 'localhost' ||
    blockedHostnameSuffixes.some((suffix) => hostname.endsWith(suffix))
  );
}

export async function validatePublicUrl(
  input: string,
  resolveHostname: ResolveHostname = resolveHostnameWithDns,
): Promise<ValidatedPublicUrl> {
  const value = input.trim();

  if (!value) {
    throw new UrlValidationError('EMPTY_URL', 'Informe uma URL para análise.');
  }

  if (value.length > 2_048) {
    throw new UrlValidationError('INVALID_URL', 'A URL excede o limite de 2.048 caracteres.');
  }

  let url: URL;

  try {
    url = new URL(value);
  } catch {
    throw new UrlValidationError('INVALID_URL', 'A URL informada não é válida.');
  }

  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new UrlValidationError(
      'UNSUPPORTED_PROTOCOL',
      'Somente os protocolos HTTP e HTTPS são permitidos.',
    );
  }

  const protocol = url.protocol as 'http:' | 'https:';

  if (url.username || url.password) {
    throw new UrlValidationError(
      'CREDENTIALS_NOT_ALLOWED',
      'URLs com usuário ou senha não são permitidas.',
    );
  }

  const allowedPort = protocol === 'http:' ? '80' : '443';

  if (url.port && url.port !== allowedPort) {
    throw new UrlValidationError(
      'PORT_NOT_ALLOWED',
      'Somente as portas HTTP e HTTPS padrão são permitidas.',
    );
  }

  const hostname = normalizeHostname(url.hostname);

  if (!hostname || isBlockedHostname(hostname)) {
    throw new UrlValidationError(
      'HOSTNAME_NOT_ALLOWED',
      'O hostname informado não pode ser analisado.',
    );
  }

  let addresses: readonly ResolvedAddress[];

  if (isIP(hostname)) {
    addresses = [{ address: hostname, family: isIP(hostname) }];
  } else {
    try {
      addresses = await resolveHostname(hostname);
    } catch {
      throw new UrlValidationError(
        'DNS_LOOKUP_FAILED',
        'Não foi possível confirmar o destino da URL.',
      );
    }
  }

  if (addresses.length === 0) {
    throw new UrlValidationError(
      'HOST_NOT_FOUND',
      'O hostname não possui um endereço acessível.',
    );
  }

  if (addresses.some(({ address }) => !isPublicIp(address))) {
    throw new UrlValidationError(
      'PRIVATE_ADDRESS',
      'A URL aponta para um endereço privado ou reservado.',
    );
  }

  url.hostname = isIP(hostname) === 6 ? `[${hostname}]` : hostname;
  url.hash = '';

  return {
    addresses,
    hostname,
    normalizedUrl: url.toString(),
    protocol,
  };
}
