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
import { TokenVersion } from '@hathor/wallet-lib';
import { reducer } from '../../src/reducers/reducer';
import {
  setFeatureToggles,
  setFullNodeNetworkName,
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

const P2PKH = 'Wa9Q77VagNbzfecxW6g56jBuetkgEYyxoh';
const WARNING = 'Creating a token can spend private HTR and make its amount public.';

/**
 * A wallet whose storage holds the given UTXOs, filtered as wallet-lib's storage filters them.
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
  getCurrentAddress: jest.fn(async () => ({ address: P2PKH, index: 3 })),
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

async function render(wallet, { flag = true } = {}) {
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

describe('CreateTokenConfirm with private HTR', () => {
  test.each([
    ['the shielded UI is on', true],
    ['the shielded UI is off', false],
  ])('neither reads the private HTR nor warns about it when %s', async (_label, flag) => {
    const wallet = createWallet([PUBLIC_HTR, PRIVATE_HTR]);
    const { texts } = await render(wallet, { flag });

    expect(texts()).not.toContain(WARNING);
    expect(wallet.storage.selectUtxos).not.toHaveBeenCalled();
  });

  test('mints to a legacy address of the wallet, as before', async () => {
    const wallet = createWallet([PRIVATE_HTR]);
    const { renderer } = await render(wallet);

    await act(async () => {
      renderer.root.find((node) => node.props.title === 'Create token' && node.props.onPress)
        .props.onPress();
    });
    const [, pinParams] = mockNavigation.navigate.mock.calls[0];
    await act(async () => { pinParams.cb('123456'); });

    expect(wallet.getCurrentAddress).toHaveBeenCalledWith({ markAsUsed: true });
    expect(wallet.prepareCreateNewToken).toHaveBeenCalledWith(
      'Token',
      'TKN',
      10000n,
      expect.objectContaining({ address: P2PKH }),
    );
  });
});
