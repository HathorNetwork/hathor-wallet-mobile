/**
 * Copyright (c) Hathor Labs and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { jest, describe, test, expect } from '@jest/globals';
import {
  getWalletShieldedCapability,
  walletServiceShieldedCapability,
} from '../../src/shielded/capability';
import { receiveStateFromCapability } from '../../src/shielded/receiveState';

// A wallet-service facade wallet: it has isShieldedEnabled, and no getShieldedCapability.
const walletServiceWallet = ({ ready = true, shieldedEnabled = true, provider = {} } = {}) => ({
  isReady: () => ready,
  isShieldedEnabled: () => shieldedEnabled,
  storage: { shieldedCryptoProvider: provider },
});

const NOTHING_UNDECODED = { txIds: [], locked: 0, unreadable: 0, error: 0 };

describe('walletServiceShieldedCapability', () => {
  test('is full for a ready wallet whose shielded keys the service registered', () => {
    expect(walletServiceShieldedCapability(walletServiceWallet())).toEqual({
      level: 'full',
      reason: null,
      cause: null,
      canReceive: true,
      canSpend: true,
      historyComplete: true,
      undecoded: NOTHING_UNDECODED,
    });
  });

  test.each([
    ['the wallet is not ready', { ready: false }, 'not-started'],
    ['the service did not register its shielded keys', { shieldedEnabled: false }, 'no-shielded-keys'],
    ['no crypto provider is registered', { provider: null }, 'no-provider'],
  ])('is none when %s', (_label, options, reason) => {
    expect(walletServiceShieldedCapability(walletServiceWallet(options))).toEqual({
      level: 'none',
      reason,
      cause: null,
      canReceive: false,
      canSpend: false,
      historyComplete: false,
      undecoded: NOTHING_UNDECODED,
    });
  });

  test('gives the receive state the fullnode facade capability would', () => {
    expect(receiveStateFromCapability(walletServiceShieldedCapability(walletServiceWallet())))
      .toBeNull();
    expect(receiveStateFromCapability(
      walletServiceShieldedCapability(walletServiceWallet({ ready: false })),
    )).toEqual({ status: 'loading', reason: null });
  });
});

describe('getWalletShieldedCapability', () => {
  test('reads the capability of a wallet that has getShieldedCapability', async () => {
    const capability = { level: 'watch' };
    const wallet = {
      getShieldedCapability: jest.fn(async () => capability),
      isShieldedEnabled: jest.fn(() => true),
    };

    await expect(getWalletShieldedCapability(wallet)).resolves.toBe(capability);
    expect(wallet.isShieldedEnabled).not.toHaveBeenCalled();
  });

  test('builds the capability of a wallet-service facade wallet', async () => {
    await expect(getWalletShieldedCapability(walletServiceWallet()))
      .resolves.toEqual(expect.objectContaining({ level: 'full' }));
    await expect(getWalletShieldedCapability(walletServiceWallet({ shieldedEnabled: false })))
      .resolves.toEqual(expect.objectContaining({ level: 'none', reason: 'no-shielded-keys' }));
  });
});
