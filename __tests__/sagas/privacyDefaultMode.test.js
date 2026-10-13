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
  PRIVACY_MODE,
  networkSettingsKeyMap,
} from '../../src/constants';
import { PRIVACY_DEFAULT_MODE_KEY, STORE } from '../../src/store';

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
 * Runs loadPrivacyDefaultMode and returns the actions it dispatched.
 */
async function load() {
  const dispatched = [];
  await runSaga(
    { dispatch: (action) => dispatched.push(action) },
    loadPrivacyDefaultMode,
  ).toPromise();
  return dispatched;
}

describe('loadPrivacyDefaultMode', () => {
  test.each([
    PRIVACY_MODE.PRIVATE,
    PRIVACY_MODE.HIDE_AMOUNT,
    PRIVACY_MODE.PUBLIC,
  ])('puts the default the device keeps: %s', async (mode) => {
    stubStoredItems({ [PRIVACY_DEFAULT_MODE_KEY]: mode });

    expect(await load()).toEqual([privacyDefaultModeSet(mode)]);
  });

  test.each([
    ['nothing saved', null],
    ['an unknown value', 'garbage'],
  ])('puts the default privacy mode for %s', async (_label, value) => {
    stubStoredItems({ [PRIVACY_DEFAULT_MODE_KEY]: value });

    expect(await load()).toEqual([privacyDefaultModeSet(DEFAULT_PRIVACY_MODE)]);
  });
});

/**
 * Steps startWallet, as a seed wallet's start, until it loads the default privacy mode, and
 * returns the effects it yielded up to that one. A select reads the network settings of the
 * state; every other effect gets nothing back.
 */
function effectsUntilPrivacyDefault() {
  jest.spyOn(STORE, 'getWalletMeta').mockReturnValue(null);
  jest.spyOn(STORE, 'getStorage').mockReturnValue({
    store: { cleanMetadata: jest.fn() },
    cleanStorage: jest.fn(),
  });
  stubStoredItems({ [networkSettingsKeyMap.networkSettings]: null });

  const gen = startWallet(startWalletRequested({ words: 'seed words', pin: '111111' }));
  const effects = [];
  let step = gen.next();
  for (let i = 0; i < 20 && !step.done; i += 1) {
    effects.push(step.value);
    if (step.value.type === 'CALL' && step.value.payload.fn === loadPrivacyDefaultMode) {
      break;
    }
    step = gen.next(step.value.type === 'SELECT' ? PRE_SETTINGS_SHIELDED_TESTNET : undefined);
  }
  gen.return();
  return effects;
}

const isCallTo = (fn) => (effect) => effect.type === 'CALL' && effect.payload.fn === fn;

describe('startWallet', () => {
  test('loads the default privacy mode the device keeps, before the flags', () => {
    const effects = effectsUntilPrivacyDefault();

    expect(effects[effects.length - 1]).toEqual(call(loadPrivacyDefaultMode));
    expect(effects.filter(isCallTo(loadPrivacyDefaultMode))).toHaveLength(1);
    expect(effects.some(isCallTo(monitorFeatureFlags))).toBe(false);
  });
});
