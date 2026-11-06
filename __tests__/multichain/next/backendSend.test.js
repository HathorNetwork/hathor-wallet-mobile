/**
 * Copyright (c) Hathor Labs and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { afterEach, describe, it, expect } from '@jest/globals';
import derivation from './fixtures/derivation.json';
import vectors from './fixtures/remote-signing.json';
import { createBackendNextClient, prepareError } from '../../../src/multichain/next/backendClient';
import { BackendError } from '../../../src/multichain/next/backendApi';
import { NEXT_CLIENT_EVENT } from '../../../src/multichain/nextClientErrors';
import { deriveAccount, mnemonicToSeed, walletIdOf } from '../../../src/multichain/next/kit/keys';
import { authSecret, readSecret } from '../../../src/multichain/next/kit/walletAuth';
import { encodeAddress } from '../../../src/multichain/next/kit/address';
import { INPUT_DOMAIN, verifyIn } from '../../../src/multichain/next/kit/inputSig';
import {
  bigintToBytesLE,
  bytesToBigintLE,
  bytesToHex,
  hexToBytes,
  modOrder,
} from '../../../src/multichain/next/kit/scalar';
import { parseTxV2 } from '../../../src/multichain/next/kit/txV2';

// The vectors' signer is account 3 of the test mnemonic: the account this client derives. So the
// sign request below is a transaction Hathor Next's own builder made for this very wallet.
const [CASE] = vectors.cases;
const NATIVE = vectors.native_token;
const PAYMENT = CASE.outputs.find((o) => !o.is_change);
const CONFIG = {
  backendUrl: 'http://backend.test',
  nextNetworkId: 1777,
  nativeTokenId: NATIVE,
  nativeTokenSymbol: 'USDT',
  nativeTokenName: 'Tether USD',
  serviceViewPub: CASE.pub_a,
  wireFormat: 'v2',
  maxSendFee: '10000000',
};

function memoryStorage(initial = {}) {
  const data = { ...initial };
  return {
    getItem: (key) => (key in data ? JSON.parse(data[key]) : null),
    setItemAsync: async (key, value) => { data[key] = JSON.stringify(value); },
  };
}

// The vector's inputs as an honest backend lists them: with the output index each one spends.
const SIGN_INPUTS = (() => {
  const tx = parseTxV2(hexToBytes(CASE.unsigned_tx));
  return CASE.inputs.map((input, i) => ({
    ...input,
    global_index: Number(tx.inputs[i].outputIndex),
  }));
})();

function fakeBackend({ request = null, resubmitStatus = 'submitted', sendStatus = null, earlierStatus = null, } = {}) {
  const calls = [];
  const resubmitted = [];
  let signatures = null;
  const json = (status, body) => ({
    ok: status < 300,
    status,
    text: async () => JSON.stringify(body),
  });
  const walletId = bytesToHex(walletIdOf(hexToBytes(CASE.pub_a), hexToBytes(CASE.pub_b)));
  const fetchImpl = async (url, { method, body }) => {
    const path = url.replace('http://backend.test', '');
    const data = body ? JSON.parse(body) : null;
    calls.push({ method, path, data });
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
        wallet_id: walletId,
        pub_a: CASE.pub_a,
        address: encodeAddress(CASE.pub_a, data.pub_b),
        birthday: 0,
        balance_sweep: false,
        scanned_from_epoch: 0,
      });
    }
    if (path.endsWith('/session')) {
      return json(200, { token: 't', scope: 'full', expires_at: 4000000000 });
    }
    if (path.endsWith('/balance')) {
      const balances = [{ token: NATIVE, referenceable: '100000' }];
      return json(200, { balance_state: 'live', balances });
    }
    if (path.includes('/history')) return json(200, { history: [] });
    if (path === '/v1/tokens') return json(200, { tokens: [] });
    if (method === 'POST' && path.endsWith('/sends')) {
      return json(200, request ?? {
        id: 'send-1',
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
    if (path.endsWith('/resubmit')) {
      resubmitted.push({ path, signedTx: data.signed_tx });
      return json(200, { status: resubmitStatus, reason: resubmitStatus === 'rejected' ? 'fee too low' : null });
    }
    if (path === '/v1/sends/send-1/signatures') {
      ({ signatures } = data);
      return json(200, { id: 'send-1', tx_id: 'x', status: 'submitted' });
    }
    if (path === '/v1/sends/send-0' && method === 'GET') {
      return earlierStatus ? json(200, { id: 'send-0', ...earlierStatus }) : json(404, { error: 'x' });
    }
    if (path === '/v1/sends/send-1') {
      if (sendStatus && signatures) return json(200, { id: 'send-1', ...sendStatus });
      return json(200, { id: 'send-1', status: signatures ? 'recorded' : 'awaiting_signatures' });
    }
    if (method === 'GET' && path.endsWith('/transfers')) {
      return json(200, [{ id: 't-1', amount: '600', status: 'confirming', confirmations: 3, needed: 21 }]);
    }
    if (method === 'DELETE') return json(200, {});
    return json(404, { error: 'not found' });
  };
  return {
    fetchImpl,
    calls,
    resubmitted,
    signatures: () => signatures,
  };
}

async function connected(backend, storage = memoryStorage()) {
  const client = createBackendNextClient({
    fetchImpl: backend.fetchImpl,
    WebSocketImpl: null,
    storage,
    sendPollMs: 5,
  });
  await client.prepareKeys({ words: derivation.mnemonic });
  await client.connect({ network: 'privatenet', config: CONFIG, birthday: 'genesis' });
  return client;
}

describe('a Hathor Next payment through the backend', () => {
  let client = null;
  afterEach(() => {
    client?.disconnect();
    client = null;
  });

  it('checks the backend\'s transaction, signs its inputs and follows it until recorded', async () => {
    const backend = fakeBackend();
    client = await connected(backend);
    expect(client.getSendFee()).toBe(BigInt(CASE.fee));
    const recorded = new Promise((resolve) => {
      client.on(NEXT_CLIENT_EVENT.SEND, (event) => {
        if (event.status === 'recorded') resolve(event);
      });
    });

    const { sendId } = await client.send({
      tokenId: NATIVE,
      to: PAYMENT.address,
      amount: BigInt(PAYMENT.amount),
    });
    expect(sendId).toBe('send-1');
    const create = backend.calls.find((c) => c.path.endsWith('/sends'));
    expect(create.data).toMatchObject({
      to: PAYMENT.address,
      amount: PAYMENT.amount,
      max_fee: CASE.fee,
    });

    const sigs = backend.signatures();
    expect(sigs).toHaveLength(CASE.inputs.length);
    sigs.forEach((sig, i) => {
      expect(verifyIn(
        INPUT_DOMAIN,
        hexToBytes(CASE.inputs[i].one_time_key),
        hexToBytes(CASE.signing_hash),
        hexToBytes(sig),
      )).toBe(true);
    });
    await expect(recorded).resolves.toMatchObject({ sendId: 'send-1', status: 'recorded' });
  });

  it('sends no secret to the backend: not the keys, not any input\'s, not the words', async () => {
    const backend = fakeBackend();
    client = await connected(backend);
    await client.send({ tokenId: NATIVE, to: PAYMENT.address, amount: BigInt(PAYMENT.amount) });

    const seed = await mnemonicToSeed(derivation.mnemonic);
    const { a, b } = deriveAccount(seed);
    // The vector's transaction is this wallet's: its inputs' secrets are these.
    expect(bytesToHex(bigintToBytesLE(b))).toBe(CASE.b);
    const auth = authSecret(b);
    const scalars = [a, b, auth, readSecret(auth)];
    // Each input's own secret, otk_offset + b: what signs it.
    for (const input of CASE.inputs) {
      scalars.push(modOrder(bytesToBigintLE(hexToBytes(input.otk_offset)) + b));
    }
    const secrets = scalars.map((x) => bytesToHex(bigintToBytesLE(x)));
    secrets.push(bytesToHex(seed));
    const everything = backend.calls
      .map((c) => `${c.path} ${c.data ? JSON.stringify(c.data) : ''}`)
      .join('\n');
    expect(backend.signatures()).toHaveLength(CASE.inputs.length);
    for (const secret of secrets) {
      expect(everything).not.toContain(secret);
    }
    for (const word of derivation.mnemonic.split(' ')) {
      expect(everything).not.toContain(` ${word} `);
    }
  });

  it('shows the payment as pending in the history while it is on its way', async () => {
    client = await connected(fakeBackend());
    await client.send({ tokenId: NATIVE, to: PAYMENT.address, amount: BigInt(PAYMENT.amount) });
    const { rows } = client.getHistory(NATIVE);
    expect(rows[0]).toMatchObject({
      direction: 'out',
      kind: 'payment',
      amount: PAYMENT.amount,
      peer: PAYMENT.address,
      sendId: 'send-1',
    });
  });

  it('signs nothing when the backend builds another payment', async () => {
    const outputs = CASE.outputs.map((o) => (o.is_change ? o : { ...o, amount: '29999' }));
    const backend = fakeBackend({
      request: {
        id: 'send-1',
        unsigned_tx: CASE.unsigned_tx,
        sender_opening: CASE.sender_opening,
        inputs: SIGN_INPUTS,
        outputs,
        fee: CASE.fee,
        expires_at: 4000000000,
      },
    });
    client = await connected(backend);
    await expect(client.send({
      tokenId: NATIVE,
      to: PAYMENT.address,
      amount: BigInt(PAYMENT.amount),
    })).rejects.toMatchObject({ code: 'refused' });
    expect(backend.signatures()).toBeNull();
    expect(backend.calls.some((c) => c.method === 'DELETE')).toBe(true);
  });
});

describe('a locked app', () => {
  let client = null;
  afterEach(() => {
    client?.disconnect();
    client = null;
  });

  it('drops the keys, keeps reading, and signs nothing until the keys come back', async () => {
    const backend = fakeBackend();
    client = await connected(backend);
    expect(client.forgetKeys()).toBe(true);
    expect(client.hasKeys()).toBe(false);
    expect(client.getBalances().balances[NATIVE].available).toBe(100000n);
    await expect(client.send({
      tokenId: NATIVE,
      to: PAYMENT.address,
      amount: BigInt(PAYMENT.amount),
    })).rejects.toMatchObject({ code: 'no-keys' });
    expect(backend.calls.some((c) => c.path.endsWith('/sends'))).toBe(false);

    await client.prepareKeys({ words: derivation.mnemonic });
    await expect(client.send({
      tokenId: NATIVE,
      to: PAYMENT.address,
      amount: BigInt(PAYMENT.amount),
    })).resolves.toMatchObject({ sendId: 'send-1' });
  });

  it('cancels a payment the backend prepared while the app locked, and signs nothing', async () => {
    const backend = fakeBackend();
    // The app locks while the backend prepares the payment.
    const { fetchImpl } = backend;
    backend.fetchImpl = async (url, options) => {
      const response = await fetchImpl(url, options);
      if (options.method === 'POST' && url.endsWith('/sends')) {
        client.forgetKeys();
      }
      return response;
    };
    client = await connected(backend);
    await expect(client.send({
      tokenId: NATIVE,
      to: PAYMENT.address,
      amount: BigInt(PAYMENT.amount),
    })).rejects.toMatchObject({ code: 'no-keys' });
    expect(backend.signatures()).toBeNull();
    expect(backend.calls).toContainEqual(expect.objectContaining({
      method: 'DELETE', path: '/v1/sends/send-1',
    }));
  });
});

describe('what the user is told when the backend can\'t prepare a payment', () => {
  it.each([
    [new BackendError(0, 'down'), 'offline'],
    [new BackendError(502, 'bad gateway'), 'offline'],
    [new BackendError(409, 'the wallet is sweeping'), 'sweeping'],
    [new BackendError(422, 'insufficient funds for the payment'), 'insufficient-funds'],
    [new BackendError(422, 'stuck claim'), 'prepare-failed'],
    // The wallet service's own words: they speak of what funds the output.
    [new BackendError(422, 'amount-leak: token=00 hidden_outputs=1 only public inputs fund this '
      + 'token\'s one hidden output, so its amount is readable on chain'), 'amount-visible'],
  ])('%s → %s', (error, code) => {
    expect(prepareError(error).code).toBe(code);
  });
});

describe('outputs an earlier payment signed', () => {
  let client = null;
  afterEach(() => {
    client?.disconnect();
    client = null;
  });

  it('are never signed again: the earlier payment goes out once more instead', async () => {
    const walletId = bytesToHex(walletIdOf(hexToBytes(CASE.pub_a), hexToBytes(CASE.pub_b)));
    const earlier = {
      sendId: 'send-0',
      signingHash: 'ab'.repeat(32),
      inputs: CASE.inputs.map((i) => i.one_time_key),
      signatures: [],
      signedTx: 'cafe',
      txId: 'cd'.repeat(32),
    };
    const data = {
      [`multichain:nextSigned:1777:${walletId}`]: JSON.stringify({ entries: [earlier] }),
    };
    const backend = fakeBackend();
    client = await connected(backend, memoryStorage(data));
    // Connecting already sent it again: the chain hasn't recorded it.
    expect(backend.resubmitted).toEqual([{ path: '/v1/sends/send-0/resubmit', signedTx: 'cafe' }]);

    await expect(client.send({
      tokenId: NATIVE,
      to: PAYMENT.address,
      amount: BigInt(PAYMENT.amount),
    })).rejects.toMatchObject({ code: 'earlier-pending' });
    expect(backend.signatures()).toBeNull();
    expect(backend.resubmitted).toHaveLength(2);
    // The new payment is cancelled before the earlier one goes out again: the backend refuses
    // to submit it while another payment holds its outputs.
    const order = backend.calls.map((c) => `${c.method} ${c.path}`);
    expect(order.indexOf('DELETE /v1/sends/send-1'))
      .toBeLessThan(order.lastIndexOf('POST /v1/sends/send-0/resubmit'));
  });
});

describe('a payment the network rejected', () => {
  let client = null;
  afterEach(() => {
    client?.disconnect();
    client = null;
  });

  const earlierEntry = () => ({
    sendId: 'send-0',
    signingHash: 'ab'.repeat(32),
    inputs: CASE.inputs.map((i) => i.one_time_key),
    signatures: [],
    signedTx: 'cafe',
    txId: 'cd'.repeat(32),
  });
  const ledgerKey = () => {
    const walletId = bytesToHex(walletIdOf(hexToBytes(CASE.pub_a), hexToBytes(CASE.pub_b)));
    return `multichain:nextSigned:1777:${walletId}`;
  };

  it('frees its outputs: a later payment signs them, and the entry stays as evidence', async () => {
    const storage = memoryStorage({
      [ledgerKey()]: JSON.stringify({ entries: [earlierEntry()] }),
    });
    const backend = fakeBackend({ resubmitStatus: 'rejected' });
    client = await connected(backend, storage);
    // Connecting sent it again, and the backend answered with the network's verdict.
    expect(backend.resubmitted).toHaveLength(1);

    await expect(client.send({
      tokenId: NATIVE,
      to: PAYMENT.address,
      amount: BigInt(PAYMENT.amount),
    })).resolves.toMatchObject({ sendId: 'send-1' });
    expect(backend.signatures()).toHaveLength(CASE.inputs.length);
    const { entries } = storage.getItem(ledgerKey());
    expect(entries).toMatchObject([
      { sendId: 'send-0', rejected: true, reason: 'fee too low' },
      { sendId: 'send-1' },
    ]);
  });

  it('is freed when the verdict comes while a later payment waits on it', async () => {
    const storage = memoryStorage({
      [ledgerKey()]: JSON.stringify({ entries: [earlierEntry()] }),
    });
    const backend = fakeBackend({ earlierStatus: { status: 'rejected', reason: 'fee too low' } });
    client = await connected(backend, storage);
    await expect(client.send({
      tokenId: NATIVE,
      to: PAYMENT.address,
      amount: BigInt(PAYMENT.amount),
    })).resolves.toMatchObject({ sendId: 'send-1' });
    expect(backend.signatures()).toHaveLength(CASE.inputs.length);
    expect(storage.getItem(ledgerKey()).entries[0]).toMatchObject({ rejected: true });
  });

  it('is freed when its own follow-up hears the verdict', async () => {
    const storage = memoryStorage();
    const backend = fakeBackend({ sendStatus: { status: 'rejected', reason: 'fee too low' } });
    client = await connected(backend, storage);
    const failed = new Promise((resolve) => {
      client.on(NEXT_CLIENT_EVENT.SEND, (event) => {
        if (event.status === 'failed') resolve(event);
      });
    });
    await client.send({ tokenId: NATIVE, to: PAYMENT.address, amount: BigInt(PAYMENT.amount) });
    await expect(failed).resolves.toMatchObject({ sendId: 'send-1', reason: 'fee too low' });
    const { entries } = storage.getItem(ledgerKey());
    expect(entries).toMatchObject([{ sendId: 'send-1', rejected: true }]);
    expect(client.getSend('send-1')).toMatchObject({ status: 'failed', reason: 'fee too low' });
  });

  it('frees nothing on any other answer: an expired or unknown payment goes out again', async () => {
    for (const resubmitStatus of ['expired', 'submitted', 'failed']) {
      const data = { [ledgerKey()]: JSON.stringify({ entries: [earlierEntry()] }) };
      const backend = fakeBackend({ resubmitStatus });
      // eslint-disable-next-line no-await-in-loop
      const one = await connected(backend, memoryStorage(data));
      // eslint-disable-next-line no-await-in-loop
      await expect(one.send({
        tokenId: NATIVE,
        to: PAYMENT.address,
        amount: BigInt(PAYMENT.amount),
      })).rejects.toMatchObject({ code: 'earlier-pending' });
      expect(backend.signatures()).toBeNull();
      one.disconnect();
    }
  });
});

describe('a sign request past its time', () => {
  it('is refused and cancelled, with nothing signed', async () => {
    const backend = fakeBackend({
      request: {
        id: 'send-1',
        unsigned_tx: CASE.unsigned_tx,
        sender_opening: CASE.sender_opening,
        inputs: SIGN_INPUTS,
        outputs: CASE.outputs,
        fee: CASE.fee,
        expires_at: 1000,
      },
    });
    const client = await connected(backend);
    await expect(client.send({
      tokenId: NATIVE,
      to: PAYMENT.address,
      amount: BigInt(PAYMENT.amount),
    })).rejects.toMatchObject({ code: 'refused' });
    expect(backend.signatures()).toBeNull();
    expect(backend.calls.some((c) => c.method === 'DELETE')).toBe(true);
    client.disconnect();
  });
});

describe('the wallet\'s transfers', () => {
  it('reads the backend\'s list of transfers', async () => {
    const client = await connected(fakeBackend());
    await expect(client.getTransfers()).resolves.toMatchObject([
      { id: 't-1', status: 'confirming', confirmations: 3 },
    ]);
    client.disconnect();
  });
});
