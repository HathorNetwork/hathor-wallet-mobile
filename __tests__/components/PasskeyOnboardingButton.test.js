/**
 * Copyright (c) Hathor Labs and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { jest, describe, test, expect, beforeEach, afterEach } from '@jest/globals';

// One shared logger object, so the tests can assert on what the onboarding logs.
jest.mock('../../src/logger', () => {
  const log = {
    error: jest.fn(), warn: jest.fn(), info: jest.fn(), debug: jest.fn(), log: jest.fn(),
  };
  return { logger: () => log };
});

// The sign-in ceremony: it hands the test's words to the onboarding.
jest.mock('../../src/passkey/passkeyService', () => ({
  createWalletWordsFromPasskey: jest.fn(),
  signInWalletWordsFromPasskey: jest.fn(),
  isPasskeyCancel: jest.fn(() => false),
  isPasskeySupported: jest.fn(async () => true),
}));
jest.mock('../../src/passkey/passkeySigner', () => ({
  derivePasskeyXpub: jest.fn(() => 'xpub-passkey-wallet'),
}));
jest.mock('../../src/passkey/shieldedKeys', () => ({
  derivePasskeyShieldedKeys: jest.fn(),
  holdPasskeyScanKey: jest.fn(),
}));
jest.mock('../../src/passkey/walletServiceRegistration', () => ({
  registerOnWalletService: jest.fn(),
  shouldRegisterOnWalletService: jest.fn(() => false),
}));
jest.mock('../../src/NavigationService', () => ({
  __esModule: true,
  default: { resetToMain: jest.fn() },
}));
// The sheet, without its animation.
jest.mock('../../src/components/HathorModal', () => {
  const { View } = jest.requireActual('react-native');
  return {
    __esModule: true,
    default: ({ children }) => <View>{children}</View>,
  };
});

/* eslint-disable import/first */
import React from 'react';
import { Alert } from 'react-native';
import { act, create } from 'react-test-renderer';
import { Provider } from 'react-redux';
import { legacy_createStore as createStore, applyMiddleware } from 'redux';
import { reducer } from '../../src/reducers/reducer';
import { setFeatureToggles, types } from '../../src/actions';
import { PASSKEY_ONBOARDING_FEATURE_TOGGLE } from '../../src/constants';
import { STORE } from '../../src/store';
import { logger } from '../../src/logger';
import PasskeyOnboardingButton from '../../src/components/PasskeyOnboardingButton';
import { signInWalletWordsFromPasskey } from '../../src/passkey/passkeyService';
import { derivePasskeyShieldedKeys, holdPasskeyScanKey } from '../../src/passkey/shieldedKeys';
/* eslint-enable import/first */

const log = logger();
const WORDS = 'passkey words';
const SHIELDED = {
  shieldedXpubs: { scanXpubkey: 'xpub-scan', spendXpubkey: 'xpub-spend' },
  scanXPrivKey: 'xprv-scan-key',
};

let mounted = null;

/** Renders the button with the passkey flag on, and signs in with a passkey. */
async function signIn() {
  const actions = [];
  const recordActions = () => (next) => (action) => {
    actions.push(action);
    return next(action);
  };
  const store = createStore(reducer, applyMiddleware(recordActions));
  store.dispatch(setFeatureToggles({ [PASSKEY_ONBOARDING_FEATURE_TOGGLE]: true }));
  await act(async () => {
    mounted = create(<Provider store={store}><PasskeyOnboardingButton /></Provider>);
  });
  const press = (title) => act(async () => {
    mounted.root.find((node) => node.props.title === title && node.props.onPress).props.onPress();
  });
  await press('Passkey');
  await press('Sign in with passkey');
  return { typesOf: () => actions.map((action) => action.type) };
}

describe('PasskeyOnboardingButton', () => {
  beforeEach(() => {
    signInWalletWordsFromPasskey.mockResolvedValue({
      words: WORDS, label: 'My passkey', credentialId: 'credential-id',
    });
    jest.spyOn(STORE, 'initPasskeyStorage').mockResolvedValue(undefined);
    jest.spyOn(Alert, 'alert').mockImplementation(() => {});
  });

  afterEach(async () => {
    if (mounted) {
      await act(async () => { mounted.unmount(); });
      mounted = null;
    }
    jest.restoreAllMocks();
    jest.clearAllMocks();
  });

  test('stores the shielded xpubs with the wallet, and holds the scan key once it is stored', async () => {
    derivePasskeyShieldedKeys.mockReturnValue(SHIELDED);

    const { typesOf } = await signIn();

    expect(derivePasskeyShieldedKeys).toHaveBeenCalledWith(WORDS);
    expect(STORE.initPasskeyStorage).toHaveBeenCalledWith('xpub-passkey-wallet', {
      passkeyLabel: 'My passkey',
      credentialId: 'credential-id',
      shieldedXpubs: SHIELDED.shieldedXpubs,
    });
    // The held key is tied to the stored wallet's xpub.
    expect(holdPasskeyScanKey).toHaveBeenCalledWith(SHIELDED.scanXPrivKey);
    expect(holdPasskeyScanKey.mock.invocationCallOrder[0])
      .toBeGreaterThan(STORE.initPasskeyStorage.mock.invocationCallOrder[0]);
    expect(typesOf()).toContain(types.START_WALLET_REQUESTED);
    expect(Alert.alert).not.toHaveBeenCalled();
  });

  test('creates the wallet without shielded keys where wallet-lib cannot derive them', async () => {
    derivePasskeyShieldedKeys.mockReturnValue(null);

    const { typesOf } = await signIn();

    expect(STORE.initPasskeyStorage).toHaveBeenCalledWith(
      'xpub-passkey-wallet',
      expect.objectContaining({ shieldedXpubs: null }),
    );
    expect(holdPasskeyScanKey).not.toHaveBeenCalled();
    expect(typesOf()).toContain(types.START_WALLET_REQUESTED);
  });

  // The next unlock derives them.
  test('still creates the wallet when the shielded keys fail to derive', async () => {
    derivePasskeyShieldedKeys.mockImplementation(() => { throw new Error('derivation failed'); });

    const { typesOf } = await signIn();

    expect(STORE.initPasskeyStorage).toHaveBeenCalledWith(
      'xpub-passkey-wallet',
      expect.objectContaining({ shieldedXpubs: null }),
    );
    expect(holdPasskeyScanKey).not.toHaveBeenCalled();
    expect(Alert.alert).not.toHaveBeenCalled();
    expect(log.error).toHaveBeenCalledTimes(1);
    expect(typesOf()).toContain(types.START_WALLET_REQUESTED);
  });
});
