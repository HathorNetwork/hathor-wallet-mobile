/**
 * Copyright (c) Hathor Labs and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { jest, describe, test, expect, beforeEach, afterEach } from '@jest/globals';
import React from 'react';
import { Linking, Text } from 'react-native';
import { act, create } from 'react-test-renderer';
import { Provider } from 'react-redux';
import { legacy_createStore as createStore } from 'redux';
import {
  MULTICHAIN_DEV_BACKEND_FEATURE_TOGGLE,
  MULTICHAIN_FEATURE_TOGGLE,
  PRE_SETTINGS_NEXT_TESTNET,
} from '../../../src/constants';
import { CHAIN } from '../../../src/multichain/chains';
import { TRANSFER_STATUS } from '../../../src/multichain/state';
import { PortalProvider } from '../../../src/components/Portal';
import NewHathorButton from '../../../src/components/NewHathorButton';
import { NextTxDetailsModal } from '../../../src/components/Multichain/NextTxDetailsModal';
import { TransferDetailsModal } from '../../../src/components/Multichain/TransferDetailsModal';

const BURN = '00a9b934d3e1d26927fd5e7f5cbaceb1bc186a0f8d97dfe9986e625cc94beee5';
const MINT = '2243044bc6be978eec0d8ab1ef80422f011bbee6f13dbde11a43612e1b0a3213';
const LEGACY_EXPLORER = 'https://legacy-explorer.testnet-alpha.samba.hathor.network/';
const NEXT_EXPLORER = 'https://samba.explorer.hathor.dev/';
const VIEW = 'View on explorer';

// A backend set up for local testing: its side chain has no explorer.
const DEV_BACKEND = {
  url: 'http://backend.test',
  pins: {
    next: {
      network_id: 1777,
      native_token: 'aa'.repeat(32),
      service_view_pub: 'bb'.repeat(32),
      wire_format: 'v3',
      genesis_ms: 1,
      epoch_ms: 500,
    },
    transfer: null,
  },
};

// The wallet on the Hathor Next Testnet preset, or on a backend set up for local testing.
function stateOn({ devBackend = null, explorerUrl = PRE_SETTINGS_NEXT_TESTNET.explorerUrl } = {}) {
  return {
    fullNodeNetworkName: 'testnet-juliet',
    networkSettings: { ...PRE_SETTINGS_NEXT_TESTNET, explorerUrl },
    featureToggles: devBackend
      ? { [MULTICHAIN_FEATURE_TOGGLE]: true, [MULTICHAIN_DEV_BACKEND_FEATURE_TOGGLE]: true }
      : {},
    serverInfo: { decimal_places: 2 },
    multichain: { devBackend },
  };
}

let mounted = null;

async function render(element, state = stateOn()) {
  const store = createStore(() => state);
  await act(async () => {
    mounted = create(
      <Provider store={store}>
        <PortalProvider>{element}</PortalProvider>
      </Provider>,
    );
  });
  // BackdropModal shows its content 100 ms after it opens.
  await act(async () => { await new Promise((resolve) => { setTimeout(resolve, 150); }); });
  return mounted.root;
}

// What the links of a screen open, in their order.
async function opened(root) {
  const links = root.findAll((node) => (node.type === Text || node.type === NewHathorButton)
    && (node.props.children === VIEW || node.props.title === VIEW)
    && typeof node.props.onPress === 'function');
  const urls = [];
  for (const link of links) {
    Linking.openURL.mockClear();
    // eslint-disable-next-line no-await-in-loop
    await act(async () => { link.props.onPress(); });
    urls.push(...Linking.openURL.mock.calls.map(([url]) => url));
  }
  return urls;
}

const transfer = (overrides = {}) => ({
  id: 'transfer-1',
  from: CHAIN.HATHOR,
  to: CHAIN.HATHOR_NEXT,
  hathorTokenId: '00',
  nextTokenId: '664cf15052b6f66f1f06ac32189381a27f1bfe1eda2f77cea4fde760b5884d33',
  amount: '500',
  receiveAmount: '500000000',
  bridgeFee: '0',
  networkFee: '1',
  toAddress: 'samba1zexample',
  toOwn: true,
  sentAt: 1795625000000,
  arriveAt: 1795625630000,
  status: TRANSFER_STATUS.ARRIVED,
  sourceTxId: BURN,
  debitedOnSource: true,
  reason: null,
  progress: { stage: 'arrived', confirmations: 21, needed: 21, mintTxId: MINT },
  ...overrides,
});

const nextRow = (overrides = {}) => ({
  id: 'row-1',
  txId: MINT,
  tokenId: 'd957d448377de9c9d313d545398677cd6df99ac051dcf2afcd1b38dcb22f92d8',
  direction: 'out',
  kind: 'payment',
  amount: '10000000',
  peer: null,
  status: 'recorded',
  at: 1795625000000,
  reason: null,
  ...overrides,
});

beforeEach(() => {
  jest.spyOn(Linking, 'openURL').mockImplementation(async () => true);
});

afterEach(async () => {
  if (mounted) {
    await act(async () => { mounted.unmount(); });
    mounted = null;
  }
  jest.restoreAllMocks();
});

describe('a transfer between chains', () => {
  test("opens each step on its own chain's explorer: the burn on Hathor Network's, the mint on Hathor Next's", async () => {
    const root = await render(
      <TransferDetailsModal transfer={transfer()} symbol='HTR' hathorDecimalPlaces={2} onDismiss={() => {}} />,
    );
    expect(await opened(root)).toEqual([
      `${LEGACY_EXPLORER}transaction/${BURN}`,
      `${NEXT_EXPLORER}tx/${MINT}`,
    ]);
  });

  test('links only the steps whose transaction it knows', async () => {
    const root = await render(
      <TransferDetailsModal
        transfer={transfer({
          status: TRANSFER_STATUS.PENDING,
          progress: { stage: 'confirming', confirmations: 3, needed: 21, mintTxId: null },
        })}
        symbol='HTR'
        hathorDecimalPlaces={2}
        onDismiss={() => {}}
      />,
    );
    expect(await opened(root)).toEqual([`${LEGACY_EXPLORER}transaction/${BURN}`]);
  });

  test('links no Hathor Next step on a side chain without an explorer', async () => {
    const root = await render(
      <TransferDetailsModal transfer={transfer()} symbol='HTR' hathorDecimalPlaces={2} onDismiss={() => {}} />,
      stateOn({ devBackend: DEV_BACKEND, explorerUrl: 'https://explorer.local/' }),
    );
    expect(await opened(root)).toEqual([`https://explorer.local/transaction/${BURN}`]);
  });
});

describe('a Hathor Next transaction', () => {
  test("opens on Hathor Next's explorer, never on Hathor Network's", async () => {
    const root = await render(
      <NextTxDetailsModal row={nextRow()} token={{ symbol: 'USDT', name: 'USDT' }} onDismiss={() => {}} />,
    );
    expect(await opened(root)).toEqual([`${NEXT_EXPLORER}tx/${MINT}`]);
  });

  test('has no explorer link on a side chain without an explorer', async () => {
    const root = await render(
      <NextTxDetailsModal row={nextRow()} token={{ symbol: 'USDT', name: 'USDT' }} onDismiss={() => {}} />,
      stateOn({ devBackend: DEV_BACKEND }),
    );
    expect(await opened(root)).toEqual([]);
  });
});
