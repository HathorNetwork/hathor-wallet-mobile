/**
 * Copyright (c) Hathor Labs and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { describe, test, expect, afterEach } from '@jest/globals';
import React from 'react';
import { Text } from 'react-native';
import { act, create } from 'react-test-renderer';
import { Provider } from 'react-redux';
import { legacy_createStore as createStore } from 'redux';
import { PRE_SETTINGS_NEXT_TESTNET } from '../../../src/constants';
import { CHAIN } from '../../../src/multichain/chains';
import { TRANSFER_STATUS } from '../../../src/multichain/state';
import { PortalProvider } from '../../../src/components/Portal';
import { TransferDetailsModal } from '../../../src/components/Multichain/TransferDetailsModal';

const MINUTE = 60000;
// The usual time of a transfer on testnet-alpha: 21 confirmations of 30 s blocks.
const USUAL_MS = 21 * 30000;
const HELD = 'held by samba-node: paused';

const STATE = {
  fullNodeNetworkName: 'testnet-juliet',
  networkSettings: PRE_SETTINGS_NEXT_TESTNET,
  featureToggles: {},
  serverInfo: { decimal_places: 2 },
  multichain: { devBackend: null },
};

let mounted = null;

afterEach(async () => {
  if (mounted) {
    await act(async () => { mounted.unmount(); });
    mounted = null;
  }
});

// The texts of the sheet of a transfer, each as it reads.
async function sheetOf(transfer) {
  const store = createStore(() => STATE);
  await act(async () => {
    mounted = create(
      <Provider store={store}>
        <PortalProvider>
          <TransferDetailsModal
            transfer={transfer}
            symbol='HTR'
            hathorDecimalPlaces={2}
            onDismiss={() => {}}
          />
        </PortalProvider>
      </Provider>,
    );
  });
  // BackdropModal shows its content 100 ms after it opens.
  await act(async () => { await new Promise((resolve) => { setTimeout(resolve, 150); }); });
  return mounted.root.findAllByType(Text)
    .map((node) => [].concat(node.props.children).join(''));
}

// The status line of the sheet's second step: the HTR's arrival on Hathor Next.
const arrivalLine = (texts) => texts[texts.indexOf('Received on Hathor Next') + 2];

// A transfer on its way, as the backend bridge records it.
const onItsWay = (overrides = {}) => ({
  id: 'transfer-1',
  from: CHAIN.HATHOR,
  to: CHAIN.HATHOR_NEXT,
  hathorTokenId: '00',
  nextTokenId: '664cf15052b6f66f1f06ac32189381a27f1bfe1eda2f77cea4fde760b5884d33',
  amount: '100',
  receiveAmount: '100000000',
  bridgeFee: '0',
  networkFee: '1',
  toAddress: 'samba1zexample',
  toOwn: true,
  sentAt: Date.now() - 3 * MINUTE,
  arriveAt: Date.now() + 8 * MINUTE,
  usualMs: USUAL_MS,
  status: TRANSFER_STATUS.PENDING,
  sourceTxId: '00'.repeat(32),
  debitedOnSource: true,
  reason: null,
  progress: { stage: 'confirming', confirmations: 5, needed: 21, mintTxId: null },
  ...overrides,
});

describe('the sheet of a transfer on its way', () => {
  test('counts its confirmations, with its time to arrive and the usual time', async () => {
    const texts = await sheetOf(onItsWay());
    expect(arrivalLine(texts)).toMatch(
      /^Confirming 5 of 21 on Hathor Network · Arriving in about [89] min · Usually about 11 min$/,
    );
  });

  test('held past its confirmations: waits for Hathor Next, with no time to arrive, and says why', async () => {
    // What QA saw: sent 113 minutes ago, every confirmation long done, Hathor Next not minting.
    const texts = await sheetOf(onItsWay({
      sentAt: Date.now() - 113 * MINUTE,
      arriveAt: Date.now(),
      reason: HELD,
      progress: { stage: 'confirming', confirmations: 213, needed: 21, mintTxId: null },
    }));
    expect(arrivalLine(texts))
      .toBe('Confirmed on Hathor Network, waiting for Hathor Next · Usually about 11 min');
    expect(texts).toContain(HELD);
    expect(texts.join(' ')).not.toMatch(/Arriving in about|213/);
  });

  test("keeps the backend's note to itself while the burn is still confirming", async () => {
    const texts = await sheetOf(onItsWay({
      reason: "samba-node's burn status is unavailable; depth read from hathor-core",
    }));
    expect(texts.join(' ')).not.toContain('samba-node');
  });

  test('minting: its time to arrive stays, however deep the burn is', async () => {
    const texts = await sheetOf(onItsWay({
      arriveAt: Date.now(),
      progress: { stage: 'eligible', confirmations: 213, needed: 21, mintTxId: null },
    }));
    expect(arrivalLine(texts))
      .toBe('Minting on Hathor Next · Arriving in about 1 min · Usually about 11 min');
  });

  test('says no usual time when its bridge gives none', async () => {
    const texts = await sheetOf(onItsWay({ usualMs: undefined }));
    expect(arrivalLine(texts)).toMatch(/^Confirming 5 of 21 on Hathor Network · Arriving in about [89] min$/);
  });

  test("still says why one didn't go through", async () => {
    const texts = await sheetOf(onItsWay({
      status: TRANSFER_STATUS.FAILED,
      reason: 'refused by hathor-core',
      progress: { stage: 'failed', confirmations: 0, needed: 21, mintTxId: null },
    }));
    expect(texts).toContain('refused by hathor-core');
  });
});
