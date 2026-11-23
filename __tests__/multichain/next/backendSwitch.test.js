/**
 * Copyright (c) Hathor Labs and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import {
  afterEach,
  describe,
  it,
  expect,
  jest,
} from '@jest/globals';
import derivation from './fixtures/derivation.json';
import vectors from './fixtures/remote-signing.json';
import { createBackendNextClient } from '../../../src/multichain/next/backendClient';
import { walletIdOf } from '../../../src/multichain/next/kit/keys';
import { encodeAddress } from '../../../src/multichain/next/kit/address';
import { bytesToHex, hexToBytes } from '../../../src/multichain/next/kit/scalar';
import { parseTxV2 } from '../../../src/multichain/next/kit/txV2';
import { SEND_1 } from '../fakes/sendIds';

// A login is signed over the wallet id, the scope and the time: no host in it. A login that names
// one backend's wallet, posted to another backend, would be good at the first one's wallet service
// for a minute. While the client switches backends its wallet id is still the one before's until
// the new backend's config answers: nothing may log in meanwhile.

const [CASE] = vectors.cases;
const NATIVE = vectors.native_token;
const PAYMENT = CASE.outputs.find((o) => !o.is_change);
const A = 'https://backend-a.test';
const B = 'https://backend-b.test';
const CONFIG_A = {
  backendUrl: A,
  nextNetworkId: 1777,
  nativeTokenId: NATIVE,
  nativeTokenSymbol: 'USDT',
  nativeTokenName: 'Tether USD',
  serviceViewPub: CASE.pub_a,
  wireFormat: 'v2',
  maxSendFee: '10000000',
};
// Another backend, of another wallet service: its own view key, so its own wallet id.
const CONFIG_B = { ...CONFIG_A, backendUrl: B, nextNetworkId: 2888, serviceViewPub: CASE.pub_b };
const WALLET_A = bytesToHex(walletIdOf(hexToBytes(CASE.pub_a), hexToBytes(CASE.pub_b)));

const SIGN_INPUTS = (() => {
  const tx = parseTxV2(hexToBytes(CASE.unsigned_tx));
  return CASE.inputs.map((input, i) => ({
    ...input, global_index: Number(tx.inputs[i].outputIndex),
  }));
})();

const json = (status, body) => ({
  ok: status < 300, status, text: async () => JSON.stringify(body),
});
const deferred = () => {
  let resolve;
  const promise = new Promise((r) => { resolve = r; });
  return { promise, resolve };
};
const settle = () => new Promise((r) => { setTimeout(r, 10); });

/**
 * Backend A, a wallet's own; backend B answers its config only when the test says so. `toA` and
 * `toB` record what each was asked.
 */
function twoBackends() {
  const toA = [];
  const toB = [];
  const configOfB = deferred();
  const fetchImpl = async (url, { method = 'GET', body, headers } = {}) => {
    const data = body ? JSON.parse(body) : null;
    if (url.startsWith(B)) {
      const path = url.slice(B.length);
      toB.push({ method, path, data, authorization: headers?.authorization ?? null });
      if (path === '/v1/config') {
        await configOfB.promise;
        return json(503, { error: 'later' });
      }
      if (path.endsWith('/session')) {
        return json(200, { token: 'token-of-b', scope: data.scope, expires_at: 4000000000 });
      }
      return json(200, { id: SEND_1, status: 'submitted', tx_id: 'x' });
    }
    const path = url.slice(A.length);
    toA.push({ method, path, data });
    if (path === '/v1/config') {
      return json(200, {
        next: {
          network_id: 1777,
          native_token: NATIVE,
          service_view_pub: CASE.pub_a,
          wire_format: 'v2',
          genesis_ms: 0,
          epoch_ms: 500,
          send_fee: CASE.fee,
        },
      });
    }
    if (path === '/v1/wallets') {
      return json(200, {
        wallet_id: WALLET_A,
        pub_a: CASE.pub_a,
        address: encodeAddress(CASE.pub_a, data.pub_b),
        birthday: 0,
        balance_sweep: false,
        scanned_from_epoch: 0,
      });
    }
    if (path.endsWith('/session')) {
      return json(200, { token: 'token-of-a', scope: data.scope, expires_at: 4000000000 });
    }
    if (path.endsWith('/balance')) {
      return json(200, { balance_state: 'live', balances: [{ token: NATIVE, referenceable: '100000' }] });
    }
    if (path.includes('/history')) return json(200, { history: [] });
    if (path.split('?')[0] === '/v1/tokens') return json(200, { tokens: [] });
    if (method === 'POST' && path.endsWith('/sends')) {
      return json(200, {
        id: SEND_1,
        unsigned_tx: CASE.unsigned_tx,
        signing_hash: CASE.signing_hash,
        sender_opening: CASE.sender_opening,
        inputs: SIGN_INPUTS,
        outputs: CASE.outputs,
        fee: CASE.fee,
        expires_at: 4000000000,
        status: 'awaiting_signatures',
      });
    }
    if (path === `/v1/sends/${SEND_1}` && method === 'GET') {
      return json(200, { id: SEND_1, status: 'awaiting_signatures' });
    }
    return json(200, { id: SEND_1, status: 'submitted' });
  };
  return { fetchImpl, toA, toB, configOfB };
}

describe('a client switching to another backend', () => {
  let client = null;
  afterEach(() => {
    client?.disconnect();
    client = null;
    jest.restoreAllMocks();
  });

  it('never logs in there with the wallet of the backend before: a payment still saving waits', async () => {
    const errors = jest.spyOn(console, 'error').mockImplementation(() => {});
    const backends = twoBackends();
    // The write of the sign-once ledger waits until the test lets it through, as a slow disk would.
    const data = {};
    const ledgerWrite = deferred();
    const reachedLedgerWrite = deferred();
    const storage = {
      getItem: (key) => (key in data ? JSON.parse(data[key]) : null),
      setItemAsync: async (key, value) => {
        if (key.startsWith('wallet:multichain:nextSigned:')) {
          reachedLedgerWrite.resolve();
          await ledgerWrite.promise;
        }
        data[key] = JSON.stringify(value);
      },
      removeItem: (key) => { delete data[key]; },
    };
    client = createBackendNextClient({
      fetchImpl: backends.fetchImpl,
      WebSocketImpl: null,
      storage,
      sendPollMs: 5,
      unconfirmedPollMs: 5,
    });
    await client.prepareKeys({ words: derivation.mnemonic });
    await client.connect({ network: 'privatenet', config: CONFIG_A, birthday: 'genesis' });

    // A payment on backend A: checked, signed, and saving its signatures.
    const sending = client.send({
      tokenId: NATIVE, to: PAYMENT.address, amount: BigInt(PAYMENT.amount),
    });
    sending.catch(() => {});
    await reachedLedgerWrite.promise;

    // The app goes to backend B, which hasn't answered its config yet; then the disk answers.
    const connecting = client.connect({ network: 'privatenet', config: CONFIG_B, birthday: 'genesis' });
    connecting.catch(() => {});
    await settle();
    ledgerWrite.resolve();
    await sending.catch(() => {});
    await settle();

    // Backend B was asked its config, and nothing else: no login, no signatures. The login was
    // refused as "not connected", before anything was signed for it.
    expect(backends.toB.map((c) => c.path)).toEqual(['/v1/config']);
    const unsent = errors.mock.calls
      .filter(([line]) => String(line).includes('The signatures did not reach'));
    expect(unsent).toHaveLength(1);
    expect(unsent[0][1]).toMatchObject({ name: 'NextClientError', code: 'not-connected' });
    backends.configOfB.resolve();
    await connecting.catch(() => {});

    // The payment is signed and kept for backend A, where it goes out once the app is back.
    const ledgerKey = Object.keys(data).find((key) => key.startsWith('wallet:multichain:nextSigned:'));
    expect(JSON.parse(data[ledgerKey]).entries).toMatchObject([{ sendId: SEND_1, backend: A }]);
    await client.connect({ network: 'privatenet', config: CONFIG_A, birthday: 'genesis' });
    expect(backends.toA.filter((c) => c.path === `/v1/sends/${SEND_1}/resubmit`)).toHaveLength(1);
  });

  it('reads nothing on a frame from the feed it left', async () => {
    const backends = twoBackends();
    const sockets = [];
    class Socket {
      constructor(url) {
        this.url = url;
        sockets.push(this);
      }

      // eslint-disable-next-line class-methods-use-this
      close() {}
    }
    client = createBackendNextClient({
      fetchImpl: backends.fetchImpl,
      WebSocketImpl: Socket,
      sendPollMs: 5,
      unconfirmedPollMs: 5,
    });
    await client.prepareKeys({ words: derivation.mnemonic });
    await client.connect({ network: 'privatenet', config: CONFIG_A, birthday: 'genesis' });
    await client.connect({ network: 'privatenet', config: CONFIG_A, birthday: 'genesis' });
    await settle();
    expect(sockets).toHaveLength(2);
    const reads = () => backends.toA.filter((c) => c.path.includes('/history')).length;
    const before = reads();

    sockets[0].onmessage({ data: JSON.stringify({ type: 'entry' }) });
    await settle();
    expect(reads()).toBe(before);

    // The feed it follows now does read.
    sockets[1].onmessage({ data: JSON.stringify({ type: 'entry' }) });
    await settle();
    expect(reads()).toBe(before + 1);
  });
});
