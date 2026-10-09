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
const MINE = 'WMINE';
const THEIRS = 'WTHEIRS';

// A send of 10.00 HTR to an amount-shielded output, with its shielded change: 2 private outputs.
const TX = TxHistory.from({
  txId: '00007c3e2bd5ff1ac6fa1347f5b2f15f9e5f2c1e43aa1d7a4c1c0e6b8f2d3a91',
  timestamp: 1700000000,
  balance: -1003n,
  voided: false,
  version: 1,
  shielded_outputs: [{ mode: 1 }, { mode: 1 }],
}, HTR);

/**
 * A wallet whose local copy of the tx has these inputs, and whose fullnode reports these fees.
 */
function fakeWallet({ inputAddress = MINE, fees = [{ token_uid: HTR, amount: 3 }] } = {}) {
  const inputs = [{ tx_id: 'parent', index: 0, decoded: { address: inputAddress } }];
  return {
    getTx: jest.fn(async () => ({ tx_id: TX.txId, inputs })),
    checkAddressesMine: jest.fn(async (addresses) => Object.fromEntries(
      addresses.map((address) => [address, address === MINE]),
    )),
    getFullTxById: jest.fn(async () => ({ success: true, tx: { inputs, fees }, meta: {} })),
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

async function render({ wallet = fakeWallet(), showFees = true, token = TOKEN } = {}) {
  const store = createStore(reducer);
  let renderer;
  await act(async () => {
    renderer = create(
      <Provider store={store}>
        <PortalProvider>
          <TxDetailsModal
            tx={TX}
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
  test('keeps the rows of the tx details', async () => {
    const { texts } = await render({ showFees: false });

    expect(texts()).toEqual(expect.arrayContaining([
      '-10.03 HTR',
      'Token',
      'Description',
      'Date & Time',
      'Fee Model',
      'Native Token',
      'Transaction ID',
      'Public Explorer',
    ]));
  });

  test('shows the fees of a tx the wallet paid, between the fee model and the tx id', async () => {
    const { texts, expandFees } = await render();

    const order = texts();
    expect(order).toContain('Fees');
    expect(order).toContain('0.03 HTR');
    expect(order.indexOf('Fee Model')).toBeLessThan(order.indexOf('Fees'));
    expect(order.indexOf('Fees')).toBeLessThan(order.indexOf('Transaction ID'));
    expect(order).not.toContain('Privacy fee');

    await expandFees();

    expect(texts()).toEqual(expect.arrayContaining([
      'Network fee', '0.01 HTR', 'Privacy fee', '0.02 HTR',
    ]));
  });

  test('shows no fees for a tx the wallet did not pay', async () => {
    const wallet = fakeWallet({ inputAddress: THEIRS });
    const { texts } = await render({ wallet });

    expect(texts()).not.toContain('Fees');
    expect(wallet.getFullTxById).not.toHaveBeenCalled();
  });

  test('loads no fees while the shielded UI is off', async () => {
    const wallet = fakeWallet();
    const { texts } = await render({ wallet, showFees: false });

    expect(texts()).not.toContain('Fees');
    expect(wallet.getTx).not.toHaveBeenCalled();
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
