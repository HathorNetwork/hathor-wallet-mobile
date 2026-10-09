/**
 * Copyright (c) Hathor Labs and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { jest, describe, test, expect, afterEach } from '@jest/globals';
import { runSaga } from 'redux-saga';
import { call } from 'redux-saga/effects';
import { loadPrivacyDefaultMode, startWallet } from '../../src/sagas/wallet';
import { monitorFeatureFlags } from '../../src/sagas/featureToggle';
import { privacyDefaultModeSet, startWalletRequested } from '../../src/actions';
import {
  DEFAULT_PRIVACY_MODE,
  PRE_SETTINGS_SHIELDED_TESTNET,
  PRE_SETTINGS_TESTNET,
  PRIVACY_MODE,
  networkSettingsKeyMap,
  privacyDefaultModeKey,
} from '../../src/constants';
import { STORE } from '../../src/store';

afterEach(() => {
  jest.restoreAllMocks();
});

/**
 * Stubs the stored items: `saved` maps a key to its value, and every other key reads null.
 */
function stubStoredItems(saved) {
  jest.spyOn(STORE, 'getItem').mockImplementation((key) => saved[key] ?? null);
}

/**
 * Runs loadPrivacyDefaultMode for the network and returns the actions it dispatched.
 */
async function load(networkSettings) {
  const dispatched = [];
  await runSaga(
    { dispatch: (action) => dispatched.push(action) },
    loadPrivacyDefaultMode,
    networkSettings,
  ).toPromise();
  return dispatched;
}

describe('loadPrivacyDefaultMode', () => {
  test('puts the default saved for the network', async () => {
    stubStoredItems({
      [privacyDefaultModeKey(PRE_SETTINGS_SHIELDED_TESTNET)]: PRIVACY_MODE.PRIVATE,
    });

    expect(await load(PRE_SETTINGS_SHIELDED_TESTNET))
      .toEqual([privacyDefaultModeSet(PRIVACY_MODE.PRIVATE)]);
  });

  test("ignores another network's default", async () => {
    // The public testnet shares the shielded testnet's network, 'testnet'.
    stubStoredItems({
      [privacyDefaultModeKey(PRE_SETTINGS_TESTNET)]: PRIVACY_MODE.PRIVATE,
    });

    expect(await load(PRE_SETTINGS_SHIELDED_TESTNET))
      .toEqual([privacyDefaultModeSet(DEFAULT_PRIVACY_MODE)]);
  });

  test.each([
    ['an unknown value', 'garbage'],
    ['Public', PRIVACY_MODE.PUBLIC],
  ])('puts the default privacy mode for %s', async (_label, value) => {
    stubStoredItems({
      [privacyDefaultModeKey(PRE_SETTINGS_SHIELDED_TESTNET)]: value,
    });

    expect(await load(PRE_SETTINGS_SHIELDED_TESTNET))
      .toEqual([privacyDefaultModeSet(DEFAULT_PRIVACY_MODE)]);
  });
});

/**
 * Steps startWallet, as a seed wallet's start, until it loads the default privacy mode, and
 * returns the effects it yielded up to that one. A select reads the network settings of the
 * state; every other effect gets nothing back.
 */
function effectsUntilPrivacyDefault({ storedNetwork = null, stateNetwork }) {
  jest.spyOn(STORE, 'getWalletMeta').mockReturnValue(null);
  jest.spyOn(STORE, 'getStorage').mockReturnValue({
    store: { cleanMetadata: jest.fn() },
    cleanStorage: jest.fn(),
  });
  stubStoredItems({ [networkSettingsKeyMap.networkSettings]: storedNetwork });

  const gen = startWallet(startWalletRequested({ words: 'seed words', pin: '111111' }));
  const effects = [];
  let step = gen.next();
  for (let i = 0; i < 20 && !step.done; i += 1) {
    effects.push(step.value);
    if (step.value.type === 'CALL' && step.value.payload.fn === loadPrivacyDefaultMode) {
      break;
    }
    step = gen.next(step.value.type === 'SELECT' ? stateNetwork : undefined);
  }
  gen.return();
  return effects;
}

const isCallTo = (fn) => (effect) => effect.type === 'CALL' && effect.payload.fn === fn;

describe('startWallet', () => {
  test('loads the default privacy mode of the network in the state, before the flags', () => {
    const effects = effectsUntilPrivacyDefault({ stateNetwork: PRE_SETTINGS_SHIELDED_TESTNET });

    expect(effects[effects.length - 1])
      .toEqual(call(loadPrivacyDefaultMode, PRE_SETTINGS_SHIELDED_TESTNET));
    expect(effects.filter(isCallTo(loadPrivacyDefaultMode))).toHaveLength(1);
    expect(effects.some(isCallTo(monitorFeatureFlags))).toBe(false);
  });

  test('loads the default privacy mode of a custom network the storage holds', () => {
    const custom = { ...PRE_SETTINGS_TESTNET, nodeUrl: 'https://node.example/v1a/' };
    const effects = effectsUntilPrivacyDefault({
      storedNetwork: custom,
      stateNetwork: PRE_SETTINGS_SHIELDED_TESTNET,
    });

    expect(effects[effects.length - 1]).toEqual(call(loadPrivacyDefaultMode, custom));
  });
});
