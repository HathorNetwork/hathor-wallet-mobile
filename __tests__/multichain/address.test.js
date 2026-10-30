/**
 * Copyright (c) Hathor Labs and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { describe, test, expect } from '@jest/globals';
import { Network } from '@hathor/wallet-lib';
import {
  addressChain,
  isNextAddress,
  parseNextQrCode,
  validateTransferAddress,
} from '../../src/multichain/address';
import { CHAIN } from '../../src/multichain/chains';

const network = new Network('testnet');
const HATHOR_ADDRESS = 'Wa9Q77VagNbzfecxW6g56jBuetkgEYyxoh';
const NEXT_ADDRESS = `samba:${'ab12'.repeat(32)}`;

describe('isNextAddress', () => {
  test('takes the live form and the placeholder form', () => {
    expect(isNextAddress(NEXT_ADDRESS)).toBe(true);
    expect(isNextAddress(`  ${NEXT_ADDRESS}  `)).toBe(true);
    expect(isNextAddress(`smb1${'q'.repeat(40)}`)).toBe(true);
  });

  test('refuses an uppercase prefix, a short body and a Hathor Network address', () => {
    expect(isNextAddress(NEXT_ADDRESS.replace('samba:', 'SAMBA:'))).toBe(false);
    expect(isNextAddress(`samba:${'ab'.repeat(10)}`)).toBe(false);
    expect(isNextAddress(HATHOR_ADDRESS)).toBe(false);
    expect(isNextAddress('')).toBe(false);
  });
});

describe('parseNextQrCode', () => {
  test('reads the address alone or a payment request on it', () => {
    expect(parseNextQrCode(NEXT_ADDRESS)).toBe(NEXT_ADDRESS);
    expect(parseNextQrCode(`${NEXT_ADDRESS}?amount=100`)).toBe(NEXT_ADDRESS);
  });

  test('reads nothing from a Hathor Network QR code', () => {
    expect(parseNextQrCode(`hathor:${HATHOR_ADDRESS}`)).toBeNull();
  });
});

describe('addressChain', () => {
  test('tells the two chains apart by the address alone', () => {
    expect(addressChain(HATHOR_ADDRESS, network)).toBe(CHAIN.HATHOR);
    expect(addressChain(NEXT_ADDRESS, network)).toBe(CHAIN.HATHOR_NEXT);
    expect(addressChain(` ${NEXT_ADDRESS} `, network)).toBe(CHAIN.HATHOR_NEXT);
  });

  test('gives no chain for anything else', () => {
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
