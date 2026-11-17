/**
 * Copyright (c) Hathor Labs and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { jest, describe, it, expect, afterEach } from '@jest/globals';
import { Address, Network, helpersUtils } from '@hathor/wallet-lib';
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

const BASE58_ALPHABET = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';

function base58Encode(bytes) {
  let value = BigInt(`0x${Buffer.from(bytes).toString('hex')}`);
  let encoded = '';
  while (value > 0n) {
    encoded = BASE58_ALPHABET[Number(value % 58n)] + encoded;
    value /= 58n;
  }
  for (const byte of bytes) {
    if (byte !== 0) {
      break;
    }
    encoded = `1${encoded}`;
  }
  return encoded;
}

// The compressed form of x = 5, which has no point on secp256k1: 5^3 + 7 is not a square
// modulo the field prime.
const OFF_CURVE_KEY = Buffer.concat([Buffer.from([0x02]), Buffer.alloc(31), Buffer.from([5])]);

/**
 * A shielded address with the checksum of its bytes, but one of its two public keys (version
 * 1 byte, scan key 33 bytes, spend key 33 bytes) replaced by a point off the curve.
 */
function withOffCurveKey(address, network, key) {
  const bytes = new Address(address, { network }).decode();
  const offset = key === 'scan' ? 1 : 34;
  const body = Buffer.concat([
    bytes.subarray(0, offset),
    OFF_CURVE_KEY,
    bytes.subarray(offset + 33, 67),
  ]);
  return base58Encode(Buffer.concat([body, helpersUtils.getChecksum(body)]));
}

describe('validateAddress where the wallet sends privately', () => {
  const network = new Network('testnet');
  const allowShielded = { allowShielded: true };

  it('accepts a shielded address of the network', () => {
    expect(validateAddress(ADDRESSES.testnet.shielded, network, allowShielded))
      .toEqual({ isValid: true });
  });

  it('still accepts P2PKH and P2SH addresses', () => {
    expect(validateAddress(ADDRESSES.testnet.p2pkh, network, allowShielded))
      .toEqual({ isValid: true });
    expect(validateAddress(ADDRESSES.testnet.p2sh, network, allowShielded))
      .toEqual({ isValid: true });
  });

  it.each(['scan', 'spend'])('rejects a shielded address whose %s key is off the curve', (key) => {
    const address = withOffCurveKey(ADDRESSES.testnet.shielded, network, key);
    // The checksum is right, so only the curve check finds it.
    expect(() => new Address(address, { network }).validateAddress()).not.toThrow();

    expect(validateAddress(address, network, allowShielded))
      .toEqual({ isValid: false, message: 'Invalid address' });
  });

  it('rejects a shielded address of another network', () => {
    expect(validateAddress(ADDRESSES.mainnet.shielded, network, allowShielded))
      .toEqual({ isValid: false, message: 'Invalid address' });
  });

  it('keeps the shielded address message without the option', () => {
    const address = withOffCurveKey(ADDRESSES.testnet.shielded, network, 'scan');
    expect(validateAddress(address, network)).toEqual({
      isValid: false,
      message: shieldedAddressNotSupportedText,
    });
    expect(validateAddress(ADDRESSES.testnet.shielded, network, { allowShielded: false }))
      .toEqual({ isValid: false, message: shieldedAddressNotSupportedText });
  });
});
