/**
 * Copyright (c) Hathor Labs and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { describe, test, expect } from '@jest/globals';
import { Network } from '@hathor/wallet-lib';
import addressVectors from './next/fixtures/address-v2.json';
import {
  addressChain,
  isNextAddress,
  normalizeNextAddress,
  parseNextQrCode,
  sameNextAddress,
  validateTransferAddress,
} from '../../src/multichain/address';
import { CHAIN } from '../../src/multichain/chains';
import { fakePeerAddress } from './fakes/fakeAddress';

// Hathor Next's own address vectors (clients/wallet-sdk/fixtures/address/v2.json): what the real
// client emits is the first, `samba1z…`.
const [V2] = addressVectors.valid;
const LEGACY = addressVectors.valid.find((v) => v.form === 'legacy');
const UPPERCASE = addressVectors.valid.find((v) => v.address === v.address.toUpperCase()
  && v.form === 'v2');

const network = new Network('testnet');
const HATHOR_ADDRESS = 'Wa9Q77VagNbzfecxW6g56jBuetkgEYyxoh';
const NEXT_ADDRESS = V2.address;

describe('isNextAddress', () => {
  test.each(addressVectors.valid)('takes the $name address', (vector) => {
    expect(isNextAddress(vector.address)).toBe(true);
    expect(isNextAddress(`  ${vector.address}  `)).toBe(true);
  });

  test.each(addressVectors.invalid)('refuses an address with $name', (vector) => {
    expect(isNextAddress(vector.address)).toBe(false);
  });

  test.each(addressVectors.not_points)('refuses keys that are not curve points: $name', (vector) => {
    expect(isNextAddress(vector.address)).toBe(false);
  });

  test('refuses what is not a Hathor Next address', () => {
    expect(isNextAddress(HATHOR_ADDRESS)).toBe(false);
    expect(isNextAddress(`smb1${'q'.repeat(40)}`)).toBe(false);
    expect(isNextAddress('')).toBe(false);
    expect(isNextAddress(null)).toBe(false);
  });

  test("takes the test fake's addresses, which are real ones", () => {
    expect(isNextAddress(fakePeerAddress('someone'))).toBe(true);
    expect(fakePeerAddress('someone')).toMatch(/^samba1z[02-9ac-hj-np-z]{109}$/);
  });
});

describe('normalizeNextAddress and sameNextAddress', () => {
  test('give the lowercase samba1z form of either form', () => {
    expect(normalizeNextAddress(V2.address)).toBe(V2.address);
    expect(normalizeNextAddress(UPPERCASE.address)).toBe(UPPERCASE.address.toLowerCase());
    expect(normalizeNextAddress(LEGACY.address)).toMatch(/^samba1z/);
    expect(normalizeNextAddress('nonsense')).toBeNull();
  });

  test('compare the keys, not the text', () => {
    expect(sameNextAddress(UPPERCASE.address, UPPERCASE.address.toLowerCase())).toBe(true);
    expect(sameNextAddress(LEGACY.address, normalizeNextAddress(LEGACY.address))).toBe(true);
    expect(sameNextAddress(V2.address, fakePeerAddress('someone'))).toBe(false);
    expect(sameNextAddress(null, null)).toBe(false);
  });
});

describe('parseNextQrCode', () => {
  test('reads an address, alone or in a payment request', () => {
    expect(parseNextQrCode(NEXT_ADDRESS)).toBe(NEXT_ADDRESS);
    expect(parseNextQrCode(`${NEXT_ADDRESS}?amount=100`)).toBe(NEXT_ADDRESS);
    expect(parseNextQrCode(`samba:${NEXT_ADDRESS}?amount=1.5&token=00`)).toBe(NEXT_ADDRESS);
    expect(parseNextQrCode(UPPERCASE.address)).toBe(UPPERCASE.address.toLowerCase());
    expect(parseNextQrCode(LEGACY.address)).toBe(normalizeNextAddress(LEGACY.address));
  });

  test('reads nothing from other QR codes', () => {
    expect(parseNextQrCode(HATHOR_ADDRESS)).toBeNull();
    expect(parseNextQrCode(`hathor:${HATHOR_ADDRESS}`)).toBeNull();
    expect(parseNextQrCode(`samba:${HATHOR_ADDRESS}`)).toBeNull();
    expect(parseNextQrCode(addressVectors.invalid[0].address)).toBeNull();
  });
});

describe('addressChain', () => {
  test('tells the chain from the address', () => {
    expect(addressChain(HATHOR_ADDRESS, network)).toBe(CHAIN.HATHOR);
    expect(addressChain(NEXT_ADDRESS, network)).toBe(CHAIN.HATHOR_NEXT);
    expect(addressChain(` ${NEXT_ADDRESS} `, network)).toBe(CHAIN.HATHOR_NEXT);
    expect(addressChain(LEGACY.address, network)).toBe(CHAIN.HATHOR_NEXT);
  });

  test('is null for anything else', () => {
    expect(addressChain('nonsense', network)).toBeNull();
    expect(addressChain('', network)).toBeNull();
    expect(addressChain(null, network)).toBeNull();
  });
});

describe('validateTransferAddress', () => {
  test('has its own words for an address of the other chain', () => {
    expect(validateTransferAddress(NEXT_ADDRESS, network)).toEqual({ isValid: true });
    expect(validateTransferAddress(HATHOR_ADDRESS, network)).toEqual({
      isValid: false,
      message: 'This is a Hathor Network address. Enter a Hathor Next address.',
    });
    expect(validateTransferAddress('nonsense', network)).toEqual({
      isValid: false,
      message: 'Invalid address',
    });
  });

  test('takes the address of the destination, either way', () => {
    expect(validateTransferAddress(HATHOR_ADDRESS, network, CHAIN.HATHOR)).toEqual({
      isValid: true,
    });
    expect(validateTransferAddress(NEXT_ADDRESS, network, CHAIN.HATHOR)).toEqual({
      isValid: false,
      message: 'This is a Hathor Next address. Enter a Hathor Network address.',
    });
  });
});
