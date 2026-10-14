/**
 * Copyright (c) Hathor Labs and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { jest, describe, it, expect, afterEach } from '@jest/globals';
import { Address, Network } from '@hathor/wallet-lib';
import { validateAddress, isShieldedAddress, shieldedAddressNotSupportedText } from '../../src/utils';

afterEach(() => {
  jest.restoreAllMocks();
});

// Built with wallet-lib's address encoders from fixed keys. A shielded address is 71 bytes:
// version byte, scan pubkey, spend pubkey and checksum.
const ADDRESSES = {
  testnet: {
    p2pkh: 'Wa9Q77VagNbzfecxW6g56jBuetkgEYyxoh',
    p2sh: 'wYcywVdpeZCGzVW9DBQetyvXzWFnQXkhBf',
    shielded: 'K3KokZRo7DyNRRiyijpsVix2VADrd4HeA8vWLR5itAj81BVC4Vv7xoXbrYyKYwsLMWhefXqXKgJvC6HcVkDuJ7AJ7qUMS7fVc',
  },
  mainnet: {
    p2pkh: 'HHzVcXf5FRK5gM26hFgZ6bCwtFFYovJVjE',
    p2sh: 'hTnsUhCjoEycNKd7MVkVvbPzxrEmWa3hPx',
    shielded: 'Ce61z7k3hbx6xtx7ZN86iu5L16XSCpPoFp3V2pCJzWfXpCD9cEemGQQ3WuJysuaF8qbr6yPUZB2ui6t2eEbN2rFxp7mn7PtMW',
  },
};

describe('validateAddress', () => {
  it.each(['testnet', 'mainnet'])('accepts P2PKH and P2SH addresses on %s', (networkName) => {
    const network = new Network(networkName);
    expect(validateAddress(ADDRESSES[networkName].p2pkh, network)).toEqual({ isValid: true });
    expect(validateAddress(ADDRESSES[networkName].p2sh, network)).toEqual({ isValid: true });
  });

  it.each(['testnet', 'mainnet'])('rejects a shielded address on %s', (networkName) => {
    const network = new Network(networkName);
    expect(validateAddress(ADDRESSES[networkName].shielded, network)).toEqual({
      isValid: false,
      message: shieldedAddressNotSupportedText,
    });
  });

  it('rejects a shielded address of another network as an invalid address', () => {
    const result = validateAddress(ADDRESSES.mainnet.shielded, new Network('testnet'));
    expect(result.isValid).toBe(false);
    expect(result.message).not.toBe(shieldedAddressNotSupportedText);
  });
});

describe('isShieldedAddress', () => {
  const network = new Network('testnet');

  it('is true for a shielded address of the given network', () => {
    expect(isShieldedAddress(ADDRESSES.testnet.shielded, network)).toBe(true);
  });

  it('is false for P2PKH and P2SH addresses', () => {
    expect(isShieldedAddress(ADDRESSES.testnet.p2pkh, network)).toBe(false);
    expect(isShieldedAddress(ADDRESSES.testnet.p2sh, network)).toBe(false);
  });

  it('is false for a shielded address of another network', () => {
    expect(isShieldedAddress(ADDRESSES.mainnet.shielded, network)).toBe(false);
  });

  it('is false for values that are not addresses', () => {
    expect(isShieldedAddress('not an address', network)).toBe(false);
    expect(isShieldedAddress('', network)).toBe(false);
    expect(isShieldedAddress(undefined, network)).toBe(false);
    expect(isShieldedAddress(null, network)).toBe(false);
    expect(isShieldedAddress(42, network)).toBe(false);
  });

  it('throws when the check fails for a reason other than an invalid address', () => {
    jest.spyOn(Address.prototype, 'isShielded').mockImplementation(() => {
      throw new TypeError('unexpected failure');
    });
    expect(() => isShieldedAddress(ADDRESSES.testnet.shielded, network)).toThrow('unexpected failure');
  });
});
