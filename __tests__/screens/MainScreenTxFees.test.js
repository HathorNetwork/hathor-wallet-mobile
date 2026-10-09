/**
 * Copyright (c) Hathor Labs and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { jest, describe, test, expect, afterEach } from '@jest/globals';
import React from 'react';
import { act, create } from 'react-test-renderer';
import { Provider } from 'react-redux';
import { legacy_createStore as createStore } from 'redux';
import { reducer } from '../../src/reducers/reducer';
import {
  setFeatureToggles,
  setFullNodeNetworkName,
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
import TxDetailsModal from '../../src/components/TxDetailsModal';
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

async function pressTx({ flag = true, level = 'full' } = {}) {
  const wallet = { getTx: jest.fn(async () => null) };
  const store = createStore(reducer);
  store.dispatch(setFeatureToggles({
    ...FEATURE_TOGGLE_DEFAULTS,
    [SHIELDED_OUTPUTS_FEATURE_TOGGLE]: flag,
  }));
  store.dispatch(setFullNodeNetworkName(FULL_NETWORK_SHIELDED_TESTNET));
  store.dispatch(shieldedProviderUpdate({ status: SHIELDED_PROVIDER_STATUS.READY }));
  store.dispatch(shieldedCapabilityUpdate(capability(level)));
  store.dispatch(setWallet(wallet));
  store.dispatch(tokenFetchBalanceSuccess(DEFAULT_TOKEN.uid, {
    available: 1000n, locked: 0n, privateAvailable: 0n,
  }));

  let renderer;
  await act(async () => {
    renderer = create(
      <Provider store={store}><MainScreen navigation={{ navigate: jest.fn() }} /></Provider>,
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
  return { modal: renderer.root.findByType(TxDetailsModal), wallet };
}

describe('the tx details of the token screen', () => {
  test('asks for the fees where the wallet decodes its private outputs', async () => {
    const { modal } = await pressTx();

    expect(modal.props.showFees).toBe(true);
    expect(modal.props.nativeSymbol).toBe(DEFAULT_TOKEN.symbol);
    expect(typeof modal.props.wallet.getTx).toBe('function');
  });

  test.each([
    ['the shielded UI is off', { flag: false }],
    ['the private balance is locked', { level: 'watch' }],
  ])('asks for no fees while %s', async (_label, options) => {
    const { modal, wallet } = await pressTx(options);

    expect(modal.props.showFees).toBe(false);
    expect(wallet.getTx).not.toHaveBeenCalled();
  });
});
