/**
 * Copyright (c) Hathor Labs and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { jest, describe, test, expect, afterEach } from '@jest/globals';

const mockNavigation = {
  navigate: jest.fn(),
  goBack: jest.fn(),
  addListener: jest.fn(() => jest.fn()),
  getParent: jest.fn(() => ({ goBack: jest.fn() })),
};
let mockParams = {};
jest.mock('../../src/hooks/navigation', () => ({
  useNavigation: () => mockNavigation,
  useParams: () => mockParams,
}));

/* eslint-disable import/first */
import React from 'react';
import { act, create } from 'react-test-renderer';
import { Provider } from 'react-redux';
import { legacy_createStore as createStore } from 'redux';
import { TokenVersion, errors } from '@hathor/wallet-lib';
import { reducer } from '../../src/reducers/reducer';
import {
  setFeatureToggles,
  setFullNodeNetworkName,
  setUseWalletService,
  setWallet,
  shieldedProviderUpdate,
} from '../../src/actions';
import {
  FEATURE_TOGGLE_DEFAULTS,
  FULL_NETWORK_SHIELDED_TESTNET,
  SHIELDED_OUTPUTS_FEATURE_TOGGLE,
  SHIELDED_PROVIDER_STATUS,
} from '../../src/constants';
import { STORE } from '../../src/store';
import { PortalProvider } from '../../src/components/Portal';
import CreateTokenConfirm from '../../src/screens/CreateTokenConfirm';
/* eslint-enable import/first */

// Testnet addresses built with wallet-lib's address encoders from fixed keys.
const P2PKH = 'Wa9Q77VagNbzfecxW6g56jBuetkgEYyxoh';
const SHIELDED = 'K3KokZRo7DyNRRiyijpsVix2VADrd4HeA8vWLR5itAj81BVC4Vv7xoXbrYyKYwsLMWhefXqXKgJvC6HcVkDuJ7AJ7qUMS7fVc';
const WARNING = 'Creating a token can spend private HTR and make its amount public.';

/**
 * A wallet whose storage holds the given UTXOs, filtered as wallet-lib's storage filters them,
 * and whose current address is the new address on the shielded chain and a legacy one otherwise.
 */
const createWallet = (utxos) => ({
  storage: {
    getNativeTokenData: () => ({ symbol: 'HTR' }),
    selectUtxos: jest.fn(async function* selectUtxos(options) {
      for (const utxo of utxos) {
        const shieldedMatch = options.shielded === undefined
          || Boolean(utxo.shielded) === options.shielded;
        if (utxo.token === options.token && shieldedMatch
          && (!options.filter_method || options.filter_method(utxo))) {
          yield utxo;
        }
      }
    }),
  },
  getCurrentAddress: jest.fn(async (_options, opts) => ({
    address: opts?.legacy === false ? SHIELDED : P2PKH,
    index: 3,
  })),
  prepareCreateNewToken: jest.fn(async () => { throw new Error('stopped by the test'); }),
});

let mounted = null;

afterEach(async () => {
  if (mounted) {
    await act(async () => { mounted.unmount(); });
    mounted = null;
  }
  jest.restoreAllMocks();
  jest.clearAllMocks();
});

async function render(wallet, { flag = true, useWalletService = false } = {}) {
  jest.spyOn(STORE, 'isPasskeyWallet').mockReturnValue(false);
  mockParams = {
    amount: 10000n,
    name: 'Token',
    symbol: 'TKN',
    tokenVersion: TokenVersion.DEPOSIT,
  };
  const store = createStore(reducer);
  store.dispatch(setFeatureToggles({
    ...FEATURE_TOGGLE_DEFAULTS,
    [SHIELDED_OUTPUTS_FEATURE_TOGGLE]: flag,
  }));
  store.dispatch(setUseWalletService(useWalletService));
  store.dispatch(setFullNodeNetworkName(FULL_NETWORK_SHIELDED_TESTNET));
  store.dispatch(shieldedProviderUpdate({ status: SHIELDED_PROVIDER_STATUS.READY }));
  store.dispatch(setWallet(wallet));

  let renderer;
  await act(async () => {
    renderer = create(
      <Provider store={store}><PortalProvider><CreateTokenConfirm /></PortalProvider></Provider>,
    );
  });
  mounted = renderer;
  const texts = () => renderer.root
    .findAll((node) => node.type === 'Text')
    .map((node) => [].concat(node.props.children).join(''));
  return { renderer, texts };
}

const PRIVATE_HTR = { token: '00', value: 500n, shielded: true, timelock: null };
const PUBLIC_HTR = { token: '00', value: 500n, shielded: false, timelock: null };

describe('CreateTokenConfirm on the shielded testnet', () => {
  test.each([
    ['the shielded UI is on', true],
    ['the shielded UI is off', false],
  ])('neither reads the private HTR nor warns about it when %s', async (_label, flag) => {
    const wallet = createWallet([PUBLIC_HTR, PRIVATE_HTR]);
    const { texts } = await render(wallet, { flag });

    expect(texts()).not.toContain(WARNING);
    expect(wallet.storage.selectUtxos).not.toHaveBeenCalled();
  });

  // Creates the token with the PIN, up to prepareCreateNewToken, which the wallet fails.
  const createToken = async (renderer) => {
    await act(async () => {
      renderer.root.find((node) => node.props.title === 'Create token' && node.props.onPress)
        .props.onPress();
    });
    const [, pinParams] = mockNavigation.navigate.mock.calls[0];
    await act(async () => { pinParams.cb('123456'); });
  };

  test('mints to the new address of the wallet in the shielded environment', async () => {
    const wallet = createWallet([PRIVATE_HTR]);
    const { renderer } = await render(wallet);

    await createToken(renderer);

    expect(wallet.getCurrentAddress).toHaveBeenCalledWith({ markAsUsed: true }, { legacy: false });
    expect(wallet.prepareCreateNewToken).toHaveBeenCalledWith(
      'Token',
      'TKN',
      10000n,
      expect.objectContaining({ address: SHIELDED }),
    );
  });

  test('says the private balance is locked when the wallet gives no new address', async () => {
    const wallet = createWallet([PRIVATE_HTR]);
    wallet.getCurrentAddress.mockRejectedValue(new errors.ShieldedKeyError(
      'shielded-locked',
      "The wallet's scan key is not unlocked, so it cannot see what a shielded address receives.",
    ));
    const { renderer, texts } = await render(wallet);

    await createToken(renderer);
    await act(async () => { await new Promise((resolve) => { setTimeout(resolve, 150); }); });

    // No legacy address stands in for it.
    expect(wallet.prepareCreateNewToken).not.toHaveBeenCalled();
    expect(texts()).toContain('Your private balance is locked. Unlock it and try again.');
  });

  test('mints to a legacy address of the wallet while the shielded UI is off', async () => {
    const wallet = createWallet([PRIVATE_HTR]);
    const { renderer } = await render(wallet, { flag: false });

    await createToken(renderer);

    expect(wallet.getCurrentAddress).toHaveBeenCalledWith({ markAsUsed: true }, { legacy: true });
    expect(wallet.prepareCreateNewToken).toHaveBeenCalledWith(
      'Token',
      'TKN',
      10000n,
      expect.objectContaining({ address: P2PKH }),
    );
  });

  test('mints to the new address of the wallet on the wallet-service facade, in the shielded environment', async () => {
    // The facade pays a shielded address on its spend key, like the fullnode facade.
    const wallet = createWallet([PRIVATE_HTR]);
    wallet.validateAndRenewAuthToken = jest.fn(async () => {});
    const { renderer } = await render(wallet, { useWalletService: true });

    await createToken(renderer);

    expect(wallet.getCurrentAddress).toHaveBeenCalledWith({ markAsUsed: true }, { legacy: false });
    expect(wallet.prepareCreateNewToken).toHaveBeenCalledWith(
      'Token',
      'TKN',
      10000n,
      expect.objectContaining({ address: SHIELDED }),
    );
  });
});
