/**
 * Copyright (c) Hathor Labs and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { jest, describe, test, expect, beforeEach, afterEach } from '@jest/globals';
import { multichainKeyMap } from '../../src/constants';
import { STORE } from '../../src/store';
import { createMockNextClient, deriveMockNextAddress } from '../../src/multichain/mock/mockNextClient';
import { createMockBridge } from '../../src/multichain/mock/mockBridge';
import {
  computeBalances,
  ledgerTransfers,
  loadLedger,
  resetLedger,
  seedLedger,
} from '../../src/multichain/mock/mockLedger';
import { getSideChainConfig } from '../../src/multichain/chains';
import { TRANSFER_STATUS } from '../../src/multichain/state';
import { MOCK_SCENARIO } from '../../src/multichain/mock/scenarios';
import { NEXT_CLIENT_EVENT, NEXT_CLIENT_ERROR } from '../../src/multichain/nextClientErrors';
import { hathorToNextAmount } from '../../src/multichain/amount';

const NETWORK = 'testnet-juliet';
const WORDS = 'one two three';
const HTR = '00';

const connected = async (scenario = MOCK_SCENARIO.FUNDED) => {
  resetLedger(NETWORK, scenario);
  const client = createMockNextClient();
  client.prepareKeys({ words: WORDS });
  const connecting = client.connect({ network: NETWORK, birthday: 'genesis' });
  await jest.advanceTimersByTimeAsync(2000);
  await connecting;
  return client;
};

beforeEach(() => {
  jest.useFakeTimers();
  STORE.removeItem(multichainKeyMap.mock(NETWORK));
});

afterEach(() => {
  jest.useRealTimers();
});

describe('the simulated ledger', () => {
  test('holds 25 HTR and two tokens that share a symbol when funded', () => {
    const ledger = seedLedger(MOCK_SCENARIO.FUNDED);
    const balances = computeBalances(ledger);
    expect(balances[HTR]).toBe(2500000000n);
    const symbols = Object.values(ledger.tokens).filter((token) => token.symbol === 'TST');
    expect(symbols).toHaveLength(2);
    expect(symbols[0].id).not.toBe(symbols[1].id);
  });

  test('holds nothing but HTR at zero when empty', () => {
    expect(computeBalances(seedLedger(MOCK_SCENARIO.EMPTY))).toEqual({ [HTR]: 0n });
  });

  test('counts a transfer to its own address once its arrival time passes', () => {
    const transfer = {
      id: 'tx',
      from: 'hathor',
      to: 'hathor-next',
      nextTokenId: HTR,
      amount: '100',
      receiveAmount: '100000000',
      toOwn: true,
      sentAt: 0,
      arriveAt: 1000,
    };
    const ledger = { ...seedLedger(MOCK_SCENARIO.EMPTY), transfers: [transfer] };
    expect(computeBalances(ledger, 999)[HTR]).toBe(0n);
    expect(ledgerTransfers(ledger, 999)[0].status).toBe(TRANSFER_STATUS.PENDING);
    expect(computeBalances(ledger, 1000)[HTR]).toBe(100000000n);
    expect(ledgerTransfers(ledger, 1000)[0].status).toBe(TRANSFER_STATUS.ARRIVED);
  });

  test('never counts a transfer to another address', () => {
    const transfer = {
      id: 'tx',
      from: 'hathor',
      to: 'hathor-next',
      nextTokenId: HTR,
      amount: '100',
      receiveAmount: '100000000',
      toOwn: false,
      sentAt: 0,
      arriveAt: 1000,
    };
    const ledger = { ...seedLedger(MOCK_SCENARIO.EMPTY), transfers: [transfer] };
    expect(computeBalances(ledger, 2000)[HTR]).toBe(0n);
  });
});

describe('the simulated client', () => {
  test('derives a live-form address from the words, the same every time', () => {
    const address = deriveMockNextAddress(WORDS);
    expect(address).toMatch(/^samba:[0-9a-f]{128}$/);
    expect(deriveMockNextAddress(WORDS)).toBe(address);
    expect(deriveMockNextAddress('other words')).not.toBe(address);
  });

  test('refuses to connect before its keys are derived', async () => {
    await expect(createMockNextClient().connect({ network: NETWORK }))
      .rejects.toMatchObject({ code: NEXT_CLIENT_ERROR.NO_KEYS });
  });

  test('fails a connect still waiting when it disconnects', async () => {
    resetLedger(NETWORK, MOCK_SCENARIO.FUNDED);
    const client = createMockNextClient();
    client.prepareKeys({ words: WORDS });
    const connecting = client.connect({ network: NETWORK });
    const assertion = expect(connecting)
      .rejects.toMatchObject({ code: NEXT_CLIENT_ERROR.NOT_CONNECTED });
    client.disconnect();
    await jest.advanceTimersByTimeAsync(2000);
    await assertion;
    expect(client.getNetwork()).toBeNull();
  });

  test('fails to connect in the Connect fails scenario', async () => {
    resetLedger(NETWORK, MOCK_SCENARIO.CONNECT_FAILS);
    const client = createMockNextClient();
    client.prepareKeys({ words: WORDS });
    const connecting = client.connect({ network: NETWORK });
    const assertion = expect(connecting)
      .rejects.toMatchObject({ code: NEXT_CLIENT_ERROR.CONNECT_FAILED });
    await jest.advanceTimersByTimeAsync(2000);
    await assertion;
  });

  test('settles a payment: the amount and the fee leave, as two rows', async () => {
    const client = await connected();
    const outcomes = [];
    client.on(NEXT_CLIENT_EVENT.SEND, (outcome) => outcomes.push(outcome));
    const { sendId } = await client.send({ tokenId: HTR, to: deriveMockNextAddress('x'), amount: 100000000n });
    expect(client.getHistory(HTR).rows.slice(0, 2).map((row) => row.status)).toEqual(['pending', 'pending']);
    await jest.advanceTimersByTimeAsync(1000);
    expect(outcomes).toEqual([expect.objectContaining({ sendId, status: 'recorded' })]);
    // 25.00 - 1.00 - 0.05
    expect(client.getBalances().balances[HTR].available).toBe(2395000000n);
    const rows = client.getHistory(HTR).rows.filter((row) => row.sendId === sendId);
    expect(rows.map((row) => row.kind).sort()).toEqual(['fee', 'payment']);
  });

  test('gives the money back when the network turns a payment down', async () => {
    const client = await connected(MOCK_SCENARIO.SEND_REJECTED);
    const outcomes = [];
    client.on(NEXT_CLIENT_EVENT.SEND, (outcome) => outcomes.push(outcome));
    await client.send({ tokenId: HTR, to: deriveMockNextAddress('x'), amount: 100000000n });
    await jest.advanceTimersByTimeAsync(1000);
    expect(outcomes[0]).toMatchObject({ status: 'failed', reason: expect.any(String) });
    expect(client.getBalances().balances[HTR].available).toBe(2500000000n);
  });

  test('keeps an unanswered payment set aside', async () => {
    const client = await connected(MOCK_SCENARIO.SEND_UNCONFIRMED);
    const outcomes = [];
    client.on(NEXT_CLIENT_EVENT.SEND, (outcome) => outcomes.push(outcome));
    await client.send({ tokenId: HTR, to: deriveMockNextAddress('x'), amount: 100000000n });
    await jest.advanceTimersByTimeAsync(1000);
    expect(outcomes[0]).toMatchObject({ status: 'unconfirmed' });
    expect(client.getBalances().balances[HTR].available).toBe(2395000000n);
  });

  test('refuses a payment above the balance less the fee, before signing anything', async () => {
    const client = await connected();
    await expect(client.send({ tokenId: HTR, to: deriveMockNextAddress('x'), amount: 2500000000n }))
      .rejects.toMatchObject({ code: NEXT_CLIENT_ERROR.INSUFFICIENT_FUNDS });
    expect(client.getHistory(HTR).rows.every((row) => row.status === 'recorded')).toBe(true);
  });

  test("takes a token's amount from that token and the fee from HTR", async () => {
    const client = await connected();
    const token = Object.values(loadLedger(NETWORK).tokens).find((t) => t.symbol === 'TST');
    // The funded ledger holds 5.00 or 1.00 of each TST: 10.00 is more than either.
    await expect(client.send({ tokenId: token.id, to: deriveMockNextAddress('x'), amount: 1000000000n }))
      .rejects.toMatchObject({ code: NEXT_CLIENT_ERROR.INSUFFICIENT_FUNDS });
    const { sendId } = await client.send({ tokenId: token.id, to: deriveMockNextAddress('x'), amount: 50000000n });
    const fee = loadLedger(NETWORK).rows.find((row) => row.id === `${sendId}:fee`);
    expect(fee.tokenId).toBe(HTR);
  });

  test('refuses to send while the first sync runs, then ends it', async () => {
    const client = await connected(MOCK_SCENARIO.SLOW_SYNC);
    expect(client.getBalances().sweeping).toBe(true);
    await expect(client.send({ tokenId: HTR, to: deriveMockNextAddress('x'), amount: 1n }))
      .rejects.toMatchObject({ code: NEXT_CLIENT_ERROR.SWEEPING });
    await jest.advanceTimersByTimeAsync(21000);
    expect(client.getBalances().sweeping).toBe(false);
  });

  test('goes offline and comes back in the Goes offline scenario', async () => {
    const client = await connected(MOCK_SCENARIO.GOES_OFFLINE);
    const events = [];
    client.on(NEXT_CLIENT_EVENT.CONNECTION, (event) => events.push(event.online));
    await jest.advanceTimersByTimeAsync(31000);
    expect(client.isOnline()).toBe(false);
    await jest.advanceTimersByTimeAsync(21000);
    expect(events).toEqual([false, true]);
  });
});

describe('the simulated transfer', () => {
  const bridge = () => createMockBridge(
    getSideChainConfig(NETWORK),
    { network: NETWORK, decimalPlaces: 2 },
  );

  test('quotes the bridge fee out of the amount, in Hathor Next units', () => {
    expect(bridge().quote({ amount: 10000n, available: 125000n })).toEqual({
      bridgeFee: 10n,
      networkFee: 0n,
      receiveAmount: hathorToNextAmount(9990n, 2),
      etaSeconds: 120,
      min: 100n,
      max: 125000n,
    });
    expect(hathorToNextAmount(100n, 2)).toBe(100000000n);
  });

  test("refuses the way the bridge doesn't go yet", () => {
    expect(() => bridge().quote({
      from: 'hathor-next', to: 'hathor', amount: 10000n, available: 10000n,
    })).toThrow();
  });

  test('records the transfer, and it arrives on the connected client at its own address', async () => {
    const client = await connected(MOCK_SCENARIO.EMPTY);
    const balanceEvents = [];
    client.on(NEXT_CLIENT_EVENT.BALANCE, () => balanceEvents.push('balance'));
    const transferring = bridge().transfer({
      amount: 10000n, toAddress: client.getAddress(), ownAddress: client.getAddress(),
    });
    await jest.advanceTimersByTimeAsync(1000);
    const record = await transferring;
    expect(record).toMatchObject({
      from: 'hathor',
      to: 'hathor-next',
      hathorTokenId: HTR,
      nextTokenId: HTR,
      amount: '10000',
      receiveAmount: '9990000000',
      toOwn: true,
      status: TRANSFER_STATUS.PENDING,
      sourceTxId: null,
      debitedOnSource: false,
    });
    expect(bridge().getTransfers()).toEqual([expect.objectContaining({ id: record.id })]);
    expect(client.getBalances().balances[HTR].available).toBe(0n);
    await jest.advanceTimersByTimeAsync(120000);
    expect(client.getBalances().balances[HTR].available).toBe(9990000000n);
    expect(balanceEvents.length).toBeGreaterThan(0);
    expect(bridge().getTransfers()[0].status).toBe(TRANSFER_STATUS.ARRIVED);
  });

  test('records a transfer to another address, which never arrives here', async () => {
    resetLedger(NETWORK, MOCK_SCENARIO.EMPTY);
    const transferring = bridge().transfer({
      amount: 10000n, toAddress: deriveMockNextAddress('someone'), ownAddress: deriveMockNextAddress(WORDS),
    });
    await jest.advanceTimersByTimeAsync(1000);
    const record = await transferring;
    expect(record.toOwn).toBe(false);
    await jest.advanceTimersByTimeAsync(120000);
    expect(computeBalances(loadLedger(NETWORK))[HTR]).toBe(0n);
  });
});
