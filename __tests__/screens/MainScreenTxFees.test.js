/**
 * Copyright (c) Hathor Labs and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { jest, describe, test, expect, afterEach } from '@jest/globals';
import React from 'react';
import { TouchableOpacity } from 'react-native';
import { act, create } from 'react-test-renderer';
import { Provider } from 'react-redux';
import { legacy_createStore as createStore } from 'redux';
import { reducer } from '../../src/reducers/reducer';
import {
  setFeatureToggles,
  setFullNodeNetworkName,
  setUseWalletService,
  setWallet,
  shieldedCapabilityUpdate,
  shieldedProviderUpdate,
  tokenFetchBalanceSuccess,
  tokenFetchHistorySuccess,
} from '../../src/actions';
import {
  DEFAULT_TOKEN,
  FEATURE_TOGGLE_DEFAULTS,
  FULL_NETWORK_SHIELDED_TESTNET,
  SHIELDED_OUTPUTS_FEATURE_TOGGLE,
  SHIELDED_PROVIDER_STATUS,
} from '../../src/constants';
import { TxHistory } from '../../src/models';
import { PortalProvider } from '../../src/components/Portal';
import MainScreen from '../../src/screens/MainScreen';

const capability = (level) => ({
  level,
  reason: level === 'full' ? null : 'locked',
  cause: level === 'full' ? null : 'wrong-pin',
  canReceive: level === 'full',
  canSpend: level === 'full',
  historyComplete: true,
  undecoded: { txIds: [], locked: 0, unreadable: 0, error: 0 },
});

// A send with 2 amount-shielded outputs, whose privacy fee is 0.02 HTR of its 0.03 HTR fee.
const TX = TxHistory.from({
  txId: '00007c3e2bd5ff1ac6fa1347f5b2f15f9e5f2c1e43aa1d7a4c1c0e6b8f2d3a91',
  timestamp: 1700000000,
  balance: -1003n,
  voided: false,
  version: 1,
  shielded_outputs: [{ mode: 1 }, { mode: 1 }],
}, DEFAULT_TOKEN.uid);

let mounted = null;

afterEach(async () => {
  if (mounted) {
    await act(async () => { mounted.unmount(); });
    mounted = null;
  }
});

/**
 * A row's label and the text after it, its value.
 */
const rowOf = (texts, label) => texts.slice(texts.indexOf(label), texts.indexOf(label) + 2);

async function pressTx({
  flag = true,
  level = 'full',
  network = FULL_NETWORK_SHIELDED_TESTNET,
  providerStatus = SHIELDED_PROVIDER_STATUS.READY,
  useWalletService = false,
} = {}) {
  // The fullnode lists the tx's fee of 0.03 HTR.
  const wallet = {
    getFullTxById: jest.fn(async () => ({
      success: true,
      tx: { fees: [{ token_uid: DEFAULT_TOKEN.uid, amount: 3 }] },
      meta: {},
    })),
  };
  const store = createStore(reducer);
  store.dispatch(setFeatureToggles({
    ...FEATURE_TOGGLE_DEFAULTS,
    [SHIELDED_OUTPUTS_FEATURE_TOGGLE]: flag,
  }));
  store.dispatch(setUseWalletService(useWalletService));
  store.dispatch(setFullNodeNetworkName(network));
  store.dispatch(shieldedProviderUpdate({ status: providerStatus }));
  store.dispatch(shieldedCapabilityUpdate(capability(level)));
  store.dispatch(setWallet(wallet));
  store.dispatch(tokenFetchBalanceSuccess(DEFAULT_TOKEN.uid, {
    available: 1000n, locked: 0n, privateAvailable: 0n,
  }));

  let renderer;
  await act(async () => {
    renderer = create(
      <Provider store={store}>
        <PortalProvider><MainScreen navigation={{ navigate: jest.fn() }} /></PortalProvider>
      </Provider>,
    );
  });
  mounted = renderer;
  // The history the screen asks for when it opens.
  await act(async () => {
    store.dispatch(tokenFetchHistorySuccess(DEFAULT_TOKEN.uid, [TX]));
  });
  await act(async () => {
    renderer.root.find((node) => node.props.item === TX && typeof node.props.onTxPress === 'function')
      .props.onTxPress(TX);
  });
  // BackdropModal shows its content 100 ms after it opens.
  await act(async () => {
    await new Promise((resolve) => { setTimeout(resolve, 150); });
  });

  const texts = () => renderer.root
    .findAll((node) => node.type === 'Text')
    .map((node) => [].concat(node.props.children).join(''));
  const expandFees = () => act(async () => {
    renderer.root.findAllByType(TouchableOpacity)
      .find((node) => node.findAll(
        (child) => child.type === 'Text' && child.props.children === 'Fees',
      ).length > 0)
      .props.onPress();
  });
  return { texts, expandFees, wallet };
}

describe('the tx details of the token screen', () => {
  test.each([
    ['decodes its private outputs', {}],
    ['holds its private balance locked', { level: 'watch' }],
    ['could not load the crypto provider', { providerStatus: SHIELDED_PROVIDER_STATUS.FAILED }],
  ])('split the fees into the network and privacy fees in the shielded environment, for a wallet that %s', async (_label, options) => {
    const { texts, expandFees, wallet } = await pressTx(options);

    expect(wallet.getFullTxById).toHaveBeenCalledWith(TX.txId);
    expect(rowOf(texts(), 'Fees')).toEqual(['Fees', '0.03 HTR']);

    await expandFees();

    expect(rowOf(texts(), 'Network fee')).toEqual(['Network fee', '0.01 HTR']);
    expect(rowOf(texts(), 'Privacy fee')).toEqual(['Privacy fee', '0.02 HTR']);
  });

  test.each([
    ['the shielded UI is off', { flag: false }],
    ['the wallet runs on the wallet-service facade', { useWalletService: true }],
    ['the node reports Mainnet', {
      network: 'mainnet',
      providerStatus: SHIELDED_PROVIDER_STATUS.UNREGISTERED,
    }],
    ['the node reports another testnet', {
      network: 'testnet',
      providerStatus: SHIELDED_PROVIDER_STATUS.UNREGISTERED,
    }],
  ])('show the whole fee as the network fee while %s', async (_label, options) => {
    const { texts, expandFees, wallet } = await pressTx(options);

    expect(wallet.getFullTxById).toHaveBeenCalledWith(TX.txId);
    expect(rowOf(texts(), 'Fees')).toEqual(['Fees', '0.03 HTR']);

    await expandFees();

    expect(rowOf(texts(), 'Network fee')).toEqual(['Network fee', '0.03 HTR']);
    expect(texts()).not.toContain('Privacy fee');
  });
});
