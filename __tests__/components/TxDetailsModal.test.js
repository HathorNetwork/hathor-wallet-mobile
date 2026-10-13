/**
 * Copyright (c) Hathor Labs and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { jest, describe, test, expect, afterEach } from '@jest/globals';
import React from 'react';
import { StyleSheet, TouchableOpacity } from 'react-native';
import { act, create } from 'react-test-renderer';
import { Provider } from 'react-redux';
import { legacy_createStore as createStore } from 'redux';
import { TokenVersion, constants as hathorLibConstants } from '@hathor/wallet-lib';
import { reducer } from '../../src/reducers/reducer';
import { AMOUNT_FORMAT } from '../../src/constants';
import { TxHistory } from '../../src/models';
import { PortalProvider } from '../../src/components/Portal';
import TxDetailsModal from '../../src/components/TxDetailsModal';

const HTR = hathorLibConstants.NATIVE_TOKEN_UID;
const TOKEN = {
  uid: HTR, name: 'Hathor', symbol: 'HTR', version: TokenVersion.NATIVE,
};

// A send of 10.00 HTR to an amount-shielded output, with its shielded change: 2 private outputs.
const SENT_TX = TxHistory.from({
  txId: '00007c3e2bd5ff1ac6fa1347f5b2f15f9e5f2c1e43aa1d7a4c1c0e6b8f2d3a91',
  timestamp: 1700000000,
  balance: -1003n,
  voided: false,
  version: 1,
  shielded_outputs: [{ mode: 1 }, { mode: 1 }],
}, HTR);

// A receive of 5.00 HTR on an amount-shielded output, whose sender paid the fees.
const RECEIVED_TX = TxHistory.from({
  txId: '0000a1b2c3d4e5f60718293a4b5c6d7e8f90a1b2c3d4e5f60718293a4b5c6d7e',
  timestamp: 1700000100,
  balance: 500n,
  voided: false,
  version: 1,
  shielded_outputs: [{ mode: 1 }, { mode: 1 }],
}, HTR);

// A nano contract call that sent 1.00 HTR.
const NANO_TX = TxHistory.from({
  txId: '00009f8e7d6c5b4a39281706f5e4d3c2b1a09f8e7d6c5b4a39281706f5e4d3c2',
  timestamp: 1700000200,
  balance: -100n,
  voided: false,
  version: hathorLibConstants.NANO_CONTRACTS_VERSION,
  ncId: '000063f99b133c7630bc9d0117919f5b8726155412ad063dbbd618bdc7f85d7a',
  ncMethod: 'bet',
  ncCaller: { base58: 'WCALLERCALLERCALLERCALLERCALLER' },
  firstBlock: '000000002ab1b5a6f6bc6e3f6b3c9e2b8ed2d29b6c6f6d3e1c9c2f8b5a4e3d2c',
}, HTR);

/**
 * A wallet whose fullnode reports these fees for every tx.
 */
function fakeWallet({ fees = [{ token_uid: HTR, amount: 3 }] } = {}) {
  return {
    getFullTxById: jest.fn(async () => ({ success: true, tx: { fees }, meta: {} })),
  };
}

let mounted = null;

afterEach(async () => {
  if (mounted) {
    await act(async () => { mounted.unmount(); });
    mounted = null;
  }
});

// BackdropModal shows its content 100 ms after it opens.
const waitForModalContent = () => act(async () => {
  await new Promise((resolve) => { setTimeout(resolve, 150); });
});

async function render({
  tx = SENT_TX,
  wallet = fakeWallet(),
  showFees = true,
  token = TOKEN,
} = {}) {
  const store = createStore(reducer);
  let renderer;
  await act(async () => {
    renderer = create(
      <Provider store={store}>
        <PortalProvider>
          <TxDetailsModal
            tx={tx}
            token={token}
            onRequestClose={jest.fn()}
            isNFT={false}
            amountFormat={AMOUNT_FORMAT.EXPANDED}
            decimalPlaces={2}
            wallet={wallet}
            showFees={showFees}
            nativeSymbol='HTR'
          />
        </PortalProvider>
      </Provider>,
    );
  });
  mounted = renderer;
  await waitForModalContent();

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
  return { renderer, texts, expandFees };
}

describe('TxDetailsModal', () => {
  test('shows the amount, with Sent under it for a send', async () => {
    const { texts } = await render({ showFees: false });

    const order = texts();
    expect(order.slice(0, 2)).toEqual(['-10.03 HTR', 'Sent HTR']);
    expect(order).not.toContain('Amount');
  });

  test('shows Received under the amount of a receive', async () => {
    const { texts } = await render({ tx: RECEIVED_TX, showFees: false });

    expect(texts().slice(0, 2)).toEqual(['5.00 HTR', 'Received HTR']);
  });

  test('has no Token, Description or Fee Model row', async () => {
    const { texts } = await render({ showFees: false });

    const shown = texts();
    for (const row of ['Token', 'Hathor (HTR)', 'Description', 'Fee Model', 'Native Token']) {
      expect(shown).not.toContain(row);
    }
  });

  test('has no nano contract rows', async () => {
    const { texts } = await render({ tx: NANO_TX, showFees: false });

    const shown = texts();
    for (const row of [
      'Nano Contract Status',
      'Blueprint Method',
      'bet',
      'Nano Contract ID',
      'Nano Contract Caller',
      'Nano Contract',
    ]) {
      expect(shown).not.toContain(row);
    }
    expect(shown).toEqual(expect.arrayContaining(['Date & Time', 'Transaction ID', 'Public Explorer']));
  });

  test('lists the date, the fees, the tx id and the explorer link, in this order', async () => {
    const { texts, expandFees } = await render();

    const order = texts();
    expect(order).toContain('0.03 HTR');
    expect(order.indexOf('Date & Time')).toBeLessThan(order.indexOf('Fees'));
    expect(order.indexOf('Fees')).toBeLessThan(order.indexOf('Transaction ID'));
    expect(order.indexOf('Transaction ID')).toBeLessThan(order.indexOf('Public Explorer'));
    expect(order).not.toContain('Privacy fee');

    await expandFees();

    expect(texts()).toEqual(expect.arrayContaining([
      'Network fee', '0.01 HTR', 'Privacy fee', '0.02 HTR',
    ]));
  });

  test('spaces the expanded fees 8 above and 8 below', async () => {
    const { renderer, expandFees } = await render();

    await expandFees();

    // The innermost view that holds the expanded network and privacy fees.
    const holds = (node, text) => node.findAll(
      (child) => child.type === 'Text' && child.props.children === text,
    ).length > 0;
    const views = renderer.root.findAll(
      (node) => node.type === 'View' && holds(node, 'Network fee') && holds(node, 'Privacy fee'),
    );
    expect(StyleSheet.flatten(views[views.length - 1].props.style)).toEqual(
      expect.objectContaining({ paddingTop: 8, paddingBottom: 8 }),
    );
  });

  test('shows the fees of a tx the wallet received', async () => {
    const wallet = fakeWallet();
    const { texts } = await render({ tx: RECEIVED_TX, wallet });

    expect(wallet.getFullTxById).toHaveBeenCalledWith(RECEIVED_TX.txId);
    expect(texts()).toEqual(expect.arrayContaining(['Fees', '0.03 HTR']));
  });

  test('shows no fees for a tx with no HTR fee', async () => {
    const { texts } = await render({ wallet: fakeWallet({ fees: [] }) });

    expect(texts()).not.toContain('Fees');
  });

  test('loads no fees while the shielded UI is off', async () => {
    const wallet = fakeWallet();
    const { texts } = await render({ wallet, showFees: false });

    expect(texts()).not.toContain('Fees');
    expect(wallet.getFullTxById).not.toHaveBeenCalled();
  });

  test('drops fees that arrive once the modal is closed', async () => {
    const wallet = fakeWallet();
    let respond;
    wallet.getFullTxById.mockImplementation(() => new Promise((resolve) => { respond = resolve; }));
    const { renderer } = await render({ wallet });
    // React no longer warns about a state update after an unmount: watch the update itself.
    const setState = jest.spyOn(renderer.root.findByType(TxDetailsModal).instance, 'setState');

    await act(async () => { renderer.unmount(); });
    mounted = null;
    await act(async () => {
      respond({ success: true, tx: { fees: [{ token_uid: HTR, amount: 3 }] }, meta: {} });
    });

    expect(wallet.getFullTxById).toHaveBeenCalledTimes(1);
    expect(setState).not.toHaveBeenCalled();
  });
});
