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
import { Connection, HathorWallet, walletUtils } from '@hathor/wallet-lib';
import { createBackendNextClient } from '../../../src/multichain/next/backendClient';
import { createBackendBridge } from '../../../src/multichain/next/backendBridge';
import { CHAIN, devBackendSideChain } from '../../../src/multichain/chains';

/**
 * The transfer on a local stack: a wallet-lib wallet on a hathor-core privatenet node, this app's
 * Hathor Next client and bridge, and the Hathor Next backend, which builds the burn this wallet
 * checks and signs. It runs only when the stack is up:
 *
 *   NEXT_E2E_BACKEND=http://127.0.0.1:8930 NEXT_E2E_HATHOR=http://127.0.0.1:18080/v1a \
 *     npx jest __tests__/multichain/next/e2eTransfer.test.js
 *
 * The node's own wallet (the privatenet seed, --wallet-enable-api) funds the test wallet.
 */

const BACKEND = process.env.NEXT_E2E_BACKEND;
const HATHOR = process.env.NEXT_E2E_HATHOR;
const run = BACKEND && HATHOR ? describe : describe.skip;
const PIN = '123456';

jest.setTimeout(420000);

function memoryStorage() {
  const data = {};
  return {
    getItem: (key) => (key in data ? JSON.parse(data[key]) : null),
    setItemAsync: async (key, value) => { data[key] = JSON.stringify(value); },
  };
}

const sleep = (ms) => new Promise((resolve) => { setTimeout(resolve, ms); });

async function until(check, what, timeoutMs = 300000) {
  const start = Date.now();
  for (;;) {
    // eslint-disable-next-line no-await-in-loop
    const value = await check();
    if (value) return value;
    if (Date.now() - start > timeoutMs) throw new Error(`Timed out waiting for ${what}`);
    // eslint-disable-next-line no-await-in-loop
    await sleep(2000);
  }
}

async function fund(address, value) {
  const status = await (await fetch(`${HATHOR}/status`)).json();
  const tip = await (await fetch(`${HATHOR}/transaction?id=${status.dag.best_block.hash}`)).json();
  const timestamp = Math.max(Math.floor(Date.now() / 1000), tip.tx.timestamp);
  const response = await fetch(`${HATHOR}/wallet/send_tokens`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ data: { outputs: [{ address, value }], inputs: [], timestamp } }),
  });
  const body = await response.json();
  if (!body.success) throw new Error(`funding: ${body.message}`);
}

run('a transfer from Hathor Network to Hathor Next on the local stack', () => {
  let wallet;
  let client;

  afterAll(async () => {
    client?.disconnect();
    await wallet?.stop({ cleanStorage: true });
  });

  it('checks the backend\'s burn, signs it with wallet-lib, and follows it on Hathor Next', async () => {
    const words = walletUtils.generateWalletWords(256);
    wallet = new HathorWallet({
      seed: words,
      connection: new Connection({ network: 'privatenet', servers: [`${HATHOR}/`] }),
      password: PIN,
      pinCode: PIN,
    });
    await wallet.start({ pinCode: PIN, password: PIN });
    await until(() => wallet.isReady(), 'the wallet to start', 60000);

    const { address } = await wallet.getCurrentAddress();
    await fund(address, 1000);
    await until(async () => {
      const [balance] = await wallet.getBalance('00');
      return balance && BigInt(balance.balance.unlocked) >= 1000n;
    }, 'the funding');

    const pins = await (await fetch(`${BACKEND}/v1/config`)).json();
    expect(pins.transfer).not.toBeNull();
    const config = devBackendSideChain({ url: BACKEND, pins });
    client = createBackendNextClient({ storage: memoryStorage(), WebSocketImpl: null });
    await client.prepareKeys({ words });
    await client.connect({ network: 'privatenet', config, birthday: 'genesis' });
    const own = client.getAddress();

    const bridge = createBackendBridge(config, {
      wallet,
      network: wallet.getNetworkObject(),
      client,
    });
    const record = await bridge.transfer({
      from: CHAIN.HATHOR,
      to: CHAIN.HATHOR_NEXT,
      tokenId: '00',
      amount: 600n,
      toAddress: own,
      ownAddress: own,
      pinCode: PIN,
    });
    expect(record.sourceTxId).toMatch(/^[0-9a-f]{64}$/);
    expect(record.toAddress).toBe(own);

    const stages = [];
    const final = await until(async () => {
      const [mine] = (await bridge.getTransfers()).filter((t) => t.id === record.id);
      const stage = `${mine?.progress.stage} ${mine?.progress.confirmations}/${mine?.progress.needed}`;
      if (stages[stages.length - 1] !== stage) stages.push(stage);
      return ['arrived', 'failed'].includes(mine?.status) ? mine : null;
    }, 'the transfer to arrive');
    // eslint-disable-next-line no-console
    console.log(`burn ${record.sourceTxId}: ${stages.join(' → ')}`);
    // The backend relays the mint once the burn is eligible, and follows it into the ledger.
    expect(final.status).toBe('arrived');
    expect(final.progress.mintTxId).toMatch(/^[0-9a-f]{64}$/);
  });
});
