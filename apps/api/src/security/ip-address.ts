import { isIP } from 'node:net';

interface Ipv4Range {
  base: string;
  prefix: number;
}

const blockedIpv4Ranges: Ipv4Range[] = [
  { base: '0.0.0.0', prefix: 8 },
  { base: '10.0.0.0', prefix: 8 },
  { base: '100.64.0.0', prefix: 10 },
  { base: '127.0.0.0', prefix: 8 },
  { base: '169.254.0.0', prefix: 16 },
  { base: '172.16.0.0', prefix: 12 },
  { base: '192.0.0.0', prefix: 24 },
  { base: '192.0.2.0', prefix: 24 },
  { base: '192.88.99.0', prefix: 24 },
  { base: '192.168.0.0', prefix: 16 },
  { base: '198.18.0.0', prefix: 15 },
  { base: '198.51.100.0', prefix: 24 },
  { base: '203.0.113.0', prefix: 24 },
  { base: '224.0.0.0', prefix: 4 },
  { base: '240.0.0.0', prefix: 4 },
];

function ipv4ToNumber(address: string): number | null {
  const parts = address.split('.').map(Number);

  if (
    parts.length !== 4 ||
    parts.some((part) => !Number.isInteger(part) || part < 0 || part > 255)
  ) {
    return null;
  }

  return parts.reduce((value, part) => ((value << 8) | part) >>> 0, 0);
}

function isIpv4InRange(address: string, range: Ipv4Range): boolean {
  const value = ipv4ToNumber(address);
  const base = ipv4ToNumber(range.base);

  if (value === null || base === null) {
    return false;
  }

  const mask = range.prefix === 0 ? 0 : (0xffffffff << (32 - range.prefix)) >>> 0;
  return ((value & mask) >>> 0) === ((base & mask) >>> 0);
}

function parseIpv6(address: string): bigint | null {
  let normalized = address.toLowerCase().split('%')[0];

  if (!normalized) {
    return null;
  }

  if (normalized.includes('.')) {
    const separatorIndex = normalized.lastIndexOf(':');
    const ipv4 = normalized.slice(separatorIndex + 1);
    const ipv4Value = ipv4ToNumber(ipv4);

    if (ipv4Value === null) {
      return null;
    }

    const highGroup = ((ipv4Value >>> 16) & 0xffff).toString(16);
    const lowGroup = (ipv4Value & 0xffff).toString(16);
    normalized = `${normalized.slice(0, separatorIndex)}:${highGroup}:${lowGroup}`;
  }

  const halves = normalized.split('::');

  if (halves.length > 2) {
    return null;
  }

  const left = halves[0] ? halves[0].split(':') : [];
  const right = halves[1] ? halves[1].split(':') : [];
  const missingGroups = 8 - left.length - right.length;

  if ((halves.length === 1 && missingGroups !== 0) || missingGroups < 0) {
    return null;
  }

  const groups = halves.length === 2
    ? [...left, ...Array<string>(missingGroups).fill('0'), ...right]
    : left;

  if (
    groups.length !== 8 ||
    groups.some((group) => !/^[0-9a-f]{1,4}$/.test(group))
  ) {
    return null;
  }

  return groups.reduce((value, group) => (value << 16n) | BigInt(`0x${group}`), 0n);
}

function isIpv6InRange(value: bigint, baseAddress: string, prefix: number): boolean {
  const base = parseIpv6(baseAddress);

  if (base === null) {
    return false;
  }

  const shift = BigInt(128 - prefix);
  return (value >> shift) === (base >> shift);
}

function isPublicIpv4(address: string): boolean {
  return !blockedIpv4Ranges.some((range) => isIpv4InRange(address, range));
}

function isPublicIpv6(address: string): boolean {
  const value = parseIpv6(address);

  if (value === null) {
    return false;
  }

  if (isIpv6InRange(value, '::ffff:0:0', 96)) {
    const mappedIpv4 = Number(value & 0xffffffffn);
    const addressParts = [24, 16, 8, 0].map((shift) => (mappedIpv4 >>> shift) & 0xff);
    return isPublicIpv4(addressParts.join('.'));
  }

  const blockedRanges = [
    ['2001::', 32],
    ['2001:2::', 48],
    ['2001:10::', 28],
    ['2001:db8::', 32],
    ['2002::', 16],
  ] as const;

  const isGlobalUnicast = isIpv6InRange(value, '2000::', 3);
  const isBlocked = blockedRanges.some(([base, prefix]) =>
    isIpv6InRange(value, base, prefix),
  );

  return isGlobalUnicast && !isBlocked;
}

export function isPublicIp(address: string): boolean {
  const normalized = address.replace(/^\[|\]$/g, '');
  const version = isIP(normalized);

  if (version === 4) {
    return isPublicIpv4(normalized);
  }

  if (version === 6) {
    return isPublicIpv6(normalized);
  }

  return false;
}
