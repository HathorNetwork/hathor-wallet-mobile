/**
 * Copyright (c) Hathor Labs and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { describe, test, expect } from '@jest/globals';
import { SHIELDED_OUTPUTS_FEATURE_TOGGLE, SHIELDED_PROVIDER_STATUS } from '../../src/constants';
import { canSendPrivately } from '../../src/shielded/gating';

const capability = (level, { reason = null, cause = null } = {}) => ({
  level,
  reason,
  cause,
  canReceive: level === 'view' || level === 'full',
  canSpend: level === 'full',
  historyComplete: true,
  undecoded: { txIds: [], locked: 0, unreadable: 0, error: 0 },
});

// A seed wallet on the shielded testnet, with the flag on and a provider that passed.
const state = (overrides = {}) => {
  const { shielded, ...rest } = overrides;
  return {
    featureToggles: { [SHIELDED_OUTPUTS_FEATURE_TOGGLE]: true },
    useWalletService: false,
    fullNodeNetworkName: 'testnet-shielded-outputs',
    ...rest,
    shielded: {
      providerStatus: SHIELDED_PROVIDER_STATUS.READY,
      providerError: null,
      capability: capability('full'),
      ...shielded,
    },
  };
};

describe('canSendPrivately', () => {
  test('holds for a wallet that decodes and spends its private outputs', () => {
    expect(canSendPrivately(state())).toBe(true);
  });

  test.each(['not-supplied', 'wrong-pin', 'error'])(
    'holds for a locked wallet a PIN can unlock (cause %s)',
    (cause) => {
      const locked = capability('watch', { reason: 'locked', cause });
      expect(canSendPrivately(state({ shielded: { capability: locked } }))).toBe(true);
    },
  );

  test('fails for a locked wallet whose scan key is corrupt', () => {
    const corrupt = capability('watch', { reason: 'locked', cause: 'corrupt-key' });
    expect(canSendPrivately(state({ shielded: { capability: corrupt } }))).toBe(false);
  });

  // A passkey wallet started with a scan key that isn't the key of its stored scan xpub: the same
  // passkey gives the same key again.
  test('fails for a locked wallet whose scan key given at start does not match', () => {
    const mismatch = capability('watch', { reason: 'locked', cause: 'key-mismatch' });
    expect(canSendPrivately(state({ shielded: { capability: mismatch } }))).toBe(false);
  });

  test.each([
    ['view', capability('view', { reason: 'no-spend-authority' })],
    ['none, with keys that do not match', capability('none', { reason: 'integrity', cause: 'key-mismatch' })],
    ['none, without shielded keys', capability('none', { reason: 'needs-password' })],
  ])('fails at level %s', (_label, at) => {
    expect(canSendPrivately(state({ shielded: { capability: at } }))).toBe(false);
  });

  test('fails before the wallet reports a capability', () => {
    expect(canSendPrivately(state({ shielded: { capability: null } }))).toBe(false);
  });

  test.each([
    ['the flag is off', { featureToggles: { [SHIELDED_OUTPUTS_FEATURE_TOGGLE]: false } }],
    ['the wallet runs on the wallet-service facade', { useWalletService: true }],
    ['the node reports another network', { fullNodeNetworkName: 'testnet-india' }],
    ['the provider failed its self-test', {
      shielded: { providerStatus: SHIELDED_PROVIDER_STATUS.FAILED },
    }],
    ['no provider was registered', {
      shielded: { providerStatus: SHIELDED_PROVIDER_STATUS.UNREGISTERED },
    }],
  ])('fails at level full when %s', (_label, overrides) => {
    expect(canSendPrivately(state(overrides))).toBe(false);
  });
});
