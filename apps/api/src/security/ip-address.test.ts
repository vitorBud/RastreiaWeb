import { describe, expect, it } from 'vitest';
import { isPublicIp } from './ip-address.js';

describe('isPublicIp', () => {
  it.each([
    '1.1.1.1',
    '8.8.8.8',
    '93.184.216.34',
    '2606:4700:4700::1111',
  ])('aceita o endereço público %s', (address) => {
    expect(isPublicIp(address)).toBe(true);
  });

  it.each([
    '0.0.0.0',
    '10.0.0.1',
    '100.64.0.1',
    '127.0.0.1',
    '169.254.169.254',
    '172.16.0.1',
    '192.168.1.1',
    '198.51.100.8',
    '224.0.0.1',
    '::',
    '::1',
    '::ffff:127.0.0.1',
    'fc00::1',
    'fe80::1',
    '2001:db8::1',
    'valor-inválido',
  ])('bloqueia o endereço privado, reservado ou inválido %s', (address) => {
    expect(isPublicIp(address)).toBe(false);
  });
});
