/**
 * Copyright (c) Hathor Labs and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import {
  afterAll,
  describe,
  it,
  expect,
  jest,
} from '@jest/globals';
import { walletUtils } from '@hathor/wallet-lib';
import { createBackendNextClient } from '../../../src/multichain/next/backendClient';
import { devBackendSideChain } from '../../../src/multichain/chains';
import { NEXT_CLIENT_EVENT } from '../../../src/multichain/nextClientErrors';

/**
 * The whole path on a local stack: this app's client, the Hathor Next backend, the wallet service
 * and a node, with a faucet wallet that pays the test wallet. It runs only when the stack is up:
 *
 *   NEXT_E2E_BACKEND=http://127.0.0.1:8930 NEXT_E2E_FAUCET=http://127.0.0.1:8915 \
 *     npx jest __tests__/multichain/next/e2eLocal.test.js
 *
 * NEXT_E2E_SENDS=1 adds the payment back, which needs the backend's sends.
 */

const BACKEND = process.env.NEXT_E2E_BACKEND;
const FAUCET = process.env.NEXT_E2E_FAUCET;
const run = BACKEND && FAUCET ? describe : describe.skip;

jest.setTimeout(180000);

function memoryStorage() {
  const data = {};
  return {
    getItem: (key) => (key in data ? JSON.parse(data[key]) : null),
    setItemAsync: async (key, value) => { data[key] = JSON.stringify(value); },
  };
}

const sleep = (ms) => new Promise((resolve) => { setTimeout(resolve, ms); });

async function until(check, what, timeoutMs = 120000) {
  const start = Date.now();
  for (;;) {
    // eslint-disable-next-line no-await-in-loop
    const value = await check();
    if (value) return value;
    if (Date.now() - start > timeoutMs) throw new Error(`Timed out waiting for ${what}`);
    // eslint-disable-next-line no-await-in-loop
    await sleep(1000);
  }
}

async function faucetPay(address, amount) {
  const { wallets } = await (await fetch(`${FAUCET}/v1/wallets`)).json();
  const id = wallets[0].wallet_id;
  const response = await fetch(`${FAUCET}/v1/wallets/${id}/send`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'idempotency-key': `e2e-${Date.now()}` },
    body: JSON.stringify({ outputs: [{ address, amount: amount.toString() }], max_fee: '5000000' }),
  });
  if (!response.ok) throw new Error(`faucet: ${response.status} ${await response.text()}`);
  return wallets[0].address;
}

run('Hathor Next on the local stack', () => {
  let client;
  let config;
  let faucetAddress;
  let words;
  const received = 100000000n;

  afterAll(() => client?.disconnect());

  it('registers the wallet\'s public keys and opens a session', async () => {
    const pins = await (await fetch(`${BACKEND}/v1/config`)).json();
    config = devBackendSideChain({ url: BACKEND, pins });
    client = createBackendNextClient({
      storage: memoryStorage(),
      WebSocketImpl: globalThis.WebSocket ?? null,
    });
    words = walletUtils.generateWalletWords(256);
    await client.prepareKeys({ words });
    await client.connect({ network: 'privatenet', config, birthday: 'genesis' });
    expect(client.getAddress()).toMatch(/^samba1z/);
    expect(client.isOnline()).toBe(true);
  });

  it('reads a payment the faucet makes to it', async () => {
    const native = config.nativeTokenId;
    faucetAddress = await faucetPay(client.getAddress(), received);
    await until(() => {
      const balance = client.getBalances().balances[native]?.available ?? 0n;
      return balance === received;
    }, 'the faucet payment');
    const { rows } = client.getHistory(native);
    expect(rows[0]).toMatchObject({ direction: 'in', amount: received.toString() });
  });

  (process.env.NEXT_E2E_SENDS ? it : it.skip)('pays the faucet back, signing only here', async () => {
    const native = config.nativeTokenId;
    const paid = 10000000n;
    const recorded = new Promise((resolve, reject) => {
      client.on(NEXT_CLIENT_EVENT.SEND, (event) => {
        if (event.status === 'recorded') resolve(event);
        if (event.status === 'failed') reject(new Error(`send failed: ${event.reason}`));
      });
    });
    await client.send({ tokenId: native, to: faucetAddress, amount: paid });
    await recorded;
    const fee = client.getSendFee();
    await until(() => {
      const balance = client.getBalances().balances[native]?.available ?? 0n;
      return balance === received - paid - fee;
    }, 'the change');
  });

  it('finds the same wallet, balance and history from the words alone on a new device', async () => {
    const native = config.nativeTokenId;
    const restored = createBackendNextClient({ storage: memoryStorage(), WebSocketImpl: null });
    try {
      await restored.prepareKeys({ words });
      await restored.connect({ network: 'privatenet', config, birthday: 'genesis' });
      expect(restored.getAddress()).toBe(client.getAddress());
      await until(() => {
        const mine = restored.getBalances().balances[native]?.available;
        return mine !== undefined && mine === client.getBalances().balances[native]?.available;
      }, 'the restored balance');
      const ids = (c) => c.getHistory(native).rows.map((r) => r.id);
      expect(ids(restored)).toEqual(ids(client));
    } finally {
      restored.disconnect();
    }
  });
});
