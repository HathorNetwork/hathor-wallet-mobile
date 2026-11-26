/**
 * Copyright (c) Hathor Labs and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import {
  afterEach, describe, it, expect, jest,
} from '@jest/globals';
import derivation from './fixtures/derivation.json';
import vectors from './fixtures/remote-signing.json';
import { createBackendNextClient, prepareError } from '../../../src/multichain/next/backendClient';
import { BackendError } from '../../../src/multichain/next/backendApi';
import { NEXT_CLIENT_ERROR, NEXT_CLIENT_EVENT } from '../../../src/multichain/nextClientErrors';
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
import * as signer from '../../../src/multichain/next/signer';

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
    removeItem: (key) => { delete data[key]; },
    items: () => data,
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

// A token besides the native one, which the vectors' builder never pays.
const OTHER_TOKEN = 'c230a6631f721ad5cab42b3eeb726513274f411134bbcd474471a76088979873';

function fakeBackend({
  request = null,
  resubmitStatus = 'submitted',
  sendStatus: initialSendStatus = null,
  earlierStatus = null,
  balances = [{ token: NATIVE, referenceable: '100000' }],
  transfers = [{ id: 't-1', amount: '600', status: 'confirming', confirmations: 3, needed: 21 }],
  genesisMs = 0,
  // What the backend answers a payment it can't prepare: { status, error }.
  prepareFailure = null,
} = {}) {
  const calls = [];
  let sendStatus = initialSendStatus;
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
          genesis_ms: genesisMs,
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
      return json(200, { balance_state: 'live', balances });
    }
    if (path.includes('/history')) return json(200, { history: [] });
    if (path.split('?')[0] === '/v1/tokens') return json(200, { tokens: [] });
    if (method === 'POST' && path.endsWith('/sends')) {
      if (prepareFailure) {
        return json(prepareFailure.status, { error: prepareFailure.error });
      }
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
      if (resubmitStatus === 'forgotten') {
        return json(409, {
          error: "this send's reservation was released and the wallet service no longer keeps it; "
            + 'it cannot be resubmitted',
        });
      }
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
      return json(200, transfers);
    }
    if (method === 'DELETE') return json(200, {});
    return json(404, { error: 'not found' });
  };
  return {
    fetchImpl,
    calls,
    resubmitted,
    signatures: () => signatures,
    setSendStatus: (status) => { sendStatus = status; },
  };
}

// The storage, whose next write of the sign-once ledger that `when` picks fails, once.
function failingLedgerWrite(storage, when) {
  let failures = 1;
  return {
    ...storage,
    setItemAsync: async (key, value) => {
      if (failures > 0 && key.startsWith('wallet:multichain:nextSigned:') && when(value)) {
        failures -= 1;
        throw new Error('The disk is full.');
      }
      return storage.setItemAsync(key, value);
    },
  };
}

async function connected(backend, storage = memoryStorage(), options = {}) {
  const client = createBackendNextClient({
    fetchImpl: backend.fetchImpl,
    WebSocketImpl: null,
    storage,
    sendPollMs: 5,
    unconfirmedPollMs: 5,
    ...options,
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

  it('signs nothing when the app leaves Hathor Next while the backend builds the payment', async () => {
    const backend = fakeBackend();
    const { fetchImpl } = backend;
    let builds = 0;
    backend.fetchImpl = async (url, options) => {
      if (options.method !== 'POST' || !url.endsWith('/sends')) {
        return fetchImpl(url, options);
      }
      builds += 1;
      const response = await fetchImpl(url, options);
      // The flag turned off while the backend built it.
      client.disconnect();
      return response;
    };
    client = await connected(backend);
    await expect(client.send({
      tokenId: NATIVE,
      to: PAYMENT.address,
      amount: BigInt(PAYMENT.amount),
    })).rejects.toMatchObject({ code: NEXT_CLIENT_ERROR.NOT_CONNECTED });
    expect(builds).toBe(1);
    expect(backend.signatures()).toBeNull();
  });

  it('signs nothing when the app leaves Hathor Next while a build asked again after a 401 runs', async () => {
    const backend = fakeBackend();
    const { fetchImpl } = backend;
    let builds = 0;
    backend.fetchImpl = async (url, options) => {
      if (options.method !== 'POST' || !url.endsWith('/sends')) {
        return fetchImpl(url, options);
      }
      builds += 1;
      // The backend restarted: the session it gave is gone, and the client logs in again.
      if (builds === 1) {
        return { ok: false, status: 401, text: async () => JSON.stringify({ error: 'expired' }) };
      }
      const response = await fetchImpl(url, options);
      // The flag turned off while the backend built it again.
      client.disconnect();
      return response;
    };
    client = await connected(backend);
    await expect(client.send({
      tokenId: NATIVE,
      to: PAYMENT.address,
      amount: BigInt(PAYMENT.amount),
    })).rejects.toMatchObject({ code: NEXT_CLIENT_ERROR.NOT_CONNECTED });
    expect(builds).toBe(2);
    expect(backend.signatures()).toBeNull();
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

  // The words the wallet service used on devnet-alpha for a token payment whose fee only public
  // native funds could pay.
  const feeLeak = new BackendError(422, `prepare failed (amount-leak): wallet service 422: amount-leak: token=${NATIVE} hidden_outputs=1 only public inputs fund this token's one hidden output, so its amount is readable on chain. Pay a second hidden output in this token (change does), spend a hidden input, or set allow_amount_leak to send anyway`);

  it('tells a payment in another token that its fee is the trouble, not its amount', () => {
    expect(prepareError(feeLeak, { tokenId: OTHER_TOKEN, nativeTokenId: NATIVE }).code)
      .toBe('fee-amount-visible');
  });

  it('tells a payment of the native token to send a little less', () => {
    expect(prepareError(feeLeak, { tokenId: NATIVE, nativeTokenId: NATIVE }).code)
      .toBe('amount-visible');
  });

  describe('from the client, on a network whose fees are paid in USDT', () => {
    let client = null;
    afterEach(() => {
      client?.disconnect();
      client = null;
    });

    it('names USDT when the fee would make the change public', async () => {
      const backend = fakeBackend({
        balances: [
          { token: NATIVE, referenceable: '100000000' },
          { token: OTHER_TOKEN, referenceable: '1000' },
        ],
        prepareFailure: { status: 422, error: feeLeak.message },
      });
      client = await connected(backend);
      const refused = client.send({ tokenId: OTHER_TOKEN, to: PAYMENT.address, amount: 10n });
      await expect(refused).rejects.toMatchObject({ code: 'fee-amount-visible' });
      await expect(refused).rejects.toThrow('Send some USDT to your own Hathor Next address');
      expect(backend.signatures()).toBeNull();
    });
  });

  it("tells a payment in another token to send less when that token's amount would show", () => {
    const tokenLeak = new BackendError(422, `amount-leak: token=${OTHER_TOKEN} hidden_outputs=1 only public inputs fund this token's one hidden output`);
    expect(prepareError(tokenLeak, { tokenId: OTHER_TOKEN, nativeTokenId: NATIVE }).code)
      .toBe('amount-visible');
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
      [`wallet:multichain:nextSigned:1777:0:${walletId}`]: JSON.stringify({ entries: [earlier] }),
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
    // Under the wallet's keys, so a reset clears it; the genesis tells a chain reset apart.
    return `wallet:multichain:nextSigned:1777:0:${walletId}`;
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
    const rejected = entries.find((entry) => entry.sendId === 'send-0');
    expect(rejected).toMatchObject({ rejected: true, reason: 'fee too low' });
    expect(entries.map((entry) => entry.sendId)).toContain('send-1');
    // Settled, it keeps only what the check needs: the ledger is one row the app reads at start.
    expect(rejected).not.toHaveProperty('signedTx');
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

  it.each([
    ['expired before the backend took its signatures', 'expired'],
    ['no longer kept by the wallet service, so it can never be sent again', 'forgotten'],
  ])('is freed when the backend says it %s', async (_label, resubmitStatus) => {
    const storage = memoryStorage({
      [ledgerKey()]: JSON.stringify({ entries: [earlierEntry()] }),
    });
    const backend = fakeBackend({ resubmitStatus });
    client = await connected(backend, storage);
    await expect(client.send({
      tokenId: NATIVE,
      to: PAYMENT.address,
      amount: BigInt(PAYMENT.amount),
    })).resolves.toMatchObject({ sendId: 'send-1' });
    expect(backend.signatures()).toHaveLength(CASE.inputs.length);
  });

  it('frees nothing on any other answer: a payment submitted or failed goes out again', async () => {
    for (const resubmitStatus of ['submitted', 'failed']) {
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

  it('takes an answer that is no list for no answer, never for an empty list', async () => {
    // A transfer missing from an empty list would count as one the backend no longer knows.
    const client = await connected(fakeBackend({ transfers: { transfers: [] } }));
    await expect(client.getTransfers()).rejects.toThrow('is not a list');
    client.disconnect();
  });
});

describe('a Hathor Next payment in another token', () => {
  let client = null;
  afterEach(() => {
    client?.disconnect();
    client = null;
  });

  const holding = (native) => [
    { token: NATIVE, referenceable: native },
    { token: OTHER_TOKEN, referenceable: '50000' },
  ];

  // The backend builds what the request names; the signer checks the token it pays all the same.
  it('names the token to the backend, and signs nothing that pays another', async () => {
    const backend = fakeBackend({ balances: holding('100000') });
    client = await connected(backend);
    await expect(client.send({
      tokenId: OTHER_TOKEN,
      to: PAYMENT.address,
      amount: 30000n,
    })).rejects.toMatchObject({ code: 'refused' });
    const create = backend.calls.find((c) => c.method === 'POST' && c.path.endsWith('/sends'));
    expect(create.data).toMatchObject({ to: PAYMENT.address, amount: '30000', token: OTHER_TOKEN });
    expect(backend.signatures()).toBeNull();
    expect(backend.calls.some((c) => c.method === 'DELETE')).toBe(true);
  });

  it('names no token for a payment in the native one', async () => {
    const backend = fakeBackend({ balances: holding('100000') });
    client = await connected(backend);
    await client.send({ tokenId: NATIVE, to: PAYMENT.address, amount: BigInt(PAYMENT.amount) });
    const create = backend.calls.find((c) => c.method === 'POST' && c.path.endsWith('/sends'));
    expect(create.data).not.toHaveProperty('token');
  });

  it("asks nothing of the backend when the native token can't pay the fee", async () => {
    const backend = fakeBackend({ balances: holding('4999') });
    client = await connected(backend);
    await expect(client.send({ tokenId: OTHER_TOKEN, to: PAYMENT.address, amount: 30000n }))
      .rejects.toMatchObject({ code: 'insufficient-funds' });
    expect(backend.calls.some((c) => c.method === 'POST' && c.path.endsWith('/sends'))).toBe(false);
  });
});

describe('a payment on its way', () => {
  let client = null;
  afterEach(() => {
    client?.disconnect();
    client = null;
  });

  const waitFor = (status) => new Promise((resolve) => {
    client.on(NEXT_CLIENT_EVENT.SEND, (event) => {
      if (event.status === status) resolve(event);
    });
  });

  it('is not settled yet when the backend says it failed: its outputs stay held', async () => {
    const storage = memoryStorage();
    const backend = fakeBackend({ sendStatus: { status: 'failed', reason: 'busy' } });
    client = await connected(backend, storage);
    const unconfirmed = waitFor('unconfirmed');
    await client.send({ tokenId: NATIVE, to: PAYMENT.address, amount: BigInt(PAYMENT.amount) });
    await expect(unconfirmed).resolves.toMatchObject({ sendId: 'send-1' });
    const { entries } = storage.getItem(Object.keys(storage.items()).find(
      (key) => key.startsWith('wallet:multichain:nextSigned:'),
    ));
    expect(entries).toMatchObject([{ sendId: 'send-1' }]);
    expect(entries[0].rejected).toBeUndefined();
  });

  it('expired, with its signatures never taken: its outputs are free', async () => {
    const storage = memoryStorage();
    const backend = fakeBackend({ sendStatus: { status: 'expired', reason: null } });
    client = await connected(backend, storage);
    const expired = waitFor('expired');
    await client.send({ tokenId: NATIVE, to: PAYMENT.address, amount: BigInt(PAYMENT.amount) });
    await expect(expired).resolves.toMatchObject({ sendId: 'send-1' });
    const { entries } = storage.getItem(Object.keys(storage.items()).find(
      (key) => key.startsWith('wallet:multichain:nextSigned:'),
    ));
    expect(entries).toMatchObject([{ sendId: 'send-1', rejected: true, reason: 'expired' }]);
  });

  it('the backend calls failed is still followed: it goes out again, and settles', async () => {
    const backend = fakeBackend({ sendStatus: { status: 'failed', reason: 'busy' } });
    client = await connected(backend);
    const unconfirmed = waitFor('unconfirmed');
    await client.send({ tokenId: NATIVE, to: PAYMENT.address, amount: BigInt(PAYMENT.amount) });
    await unconfirmed;
    // The same signed bytes went out again, without waiting for the next connect.
    expect(backend.resubmitted.length).toBeGreaterThan(0);
    const recorded = waitFor('recorded');
    backend.setSendStatus({ status: 'recorded' });
    await expect(recorded).resolves.toMatchObject({ sendId: 'send-1' });
  });

  it('not settled yet is read only as often as it goes out again: once a minute', async () => {
    const timers = jest.spyOn(global, 'setTimeout');
    try {
      const backend = fakeBackend({ sendStatus: { status: 'failed', reason: 'busy' } });
      // The client's own pace for it, not this file's.
      client = await connected(backend, memoryStorage(), { unconfirmedPollMs: undefined });
      const unconfirmed = waitFor('unconfirmed');
      await client.send({ tokenId: NATIVE, to: PAYMENT.address, amount: BigInt(PAYMENT.amount) });
      await unconfirmed;
      const reads = () => backend.calls
        .filter((c) => c.method === 'GET' && c.path === '/v1/sends/send-1').length;
      const before = reads();
      // A payment on its way is read every 5 ms here: one not settled yet waits a minute.
      await new Promise((resolve) => { setTimeout(resolve, 100); });
      expect(reads()).toBe(before);
      expect(timers.mock.calls.some(([, ms]) => ms === 60000)).toBe(true);
    } finally {
      timers.mockRestore();
    }
  });

  it('the backend calls failed, and no longer keeps, frees its outputs', async () => {
    const storage = memoryStorage();
    const backend = fakeBackend({
      sendStatus: { status: 'failed', reason: 'busy' },
      resubmitStatus: 'forgotten',
    });
    client = await connected(backend, storage);
    const expired = waitFor('expired');
    await client.send({ tokenId: NATIVE, to: PAYMENT.address, amount: BigInt(PAYMENT.amount) });
    await expect(expired).resolves.toMatchObject({ sendId: 'send-1', reason: 'forgotten' });
    const { entries } = storage.getItem(Object.keys(storage.items()).find(
      (key) => key.startsWith('wallet:multichain:nextSigned:'),
    ));
    expect(entries).toMatchObject([{ sendId: 'send-1', rejected: true }]);
  });

  it('heard recorded by its follow-up is recorded in the ledger: its outputs are never signed again', async () => {
    const storage = memoryStorage();
    const backend = fakeBackend();
    client = await connected(backend, storage);
    const recorded = waitFor('recorded');
    await client.send({ tokenId: NATIVE, to: PAYMENT.address, amount: BigInt(PAYMENT.amount) });
    await recorded;
    const key = Object.keys(storage.items())
      .find((k) => k.startsWith('wallet:multichain:nextSigned:'));
    // The statement doesn't list it yet (its history is empty): only the follow-up said so.
    // Its ledger write follows the event.
    await new Promise((resolve) => { setTimeout(resolve, 20); });
    expect(storage.getItem(key).entries).toMatchObject([{ sendId: 'send-1', recorded: true }]);
  });

  it('heard recorded while its ledger write fails is still told, and marked at the next connect', async () => {
    const memory = memoryStorage();
    const storage = failingLedgerWrite(memory, ({ entries }) => entries.some((e) => e.recorded));
    // A recorded payment submitted again: the backend answers that it is recorded.
    const backend = fakeBackend({ resubmitStatus: 'recorded' });
    client = await connected(backend, storage);
    const recorded = waitFor('recorded');
    await client.send({ tokenId: NATIVE, to: PAYMENT.address, amount: BigInt(PAYMENT.amount) });
    await expect(recorded).resolves.toMatchObject({ sendId: 'send-1' });
    const key = Object.keys(memory.items())
      .find((k) => k.startsWith('wallet:multichain:nextSigned:'));
    expect(memory.getItem(key).entries).toMatchObject([{ sendId: 'send-1' }]);
    expect(memory.getItem(key).entries[0].recorded).toBeUndefined();
    // Its bytes go out again at the next connect, and the backend's answer marks it.
    await client.connect({ network: 'privatenet', config: CONFIG, birthday: 'genesis' });
    expect(memory.getItem(key).entries).toMatchObject([{ sendId: 'send-1', recorded: true }]);
  });

  it('is followed again after a reconnect to the same network, and settles', async () => {
    const backend = fakeBackend({ sendStatus: { status: 'submitted' } });
    client = await connected(backend);
    await client.send({ tokenId: NATIVE, to: PAYMENT.address, amount: BigInt(PAYMENT.amount) });
    // A wallet reload connects again: the payment it follows must not be lost.
    await client.connect({ network: 'privatenet', config: CONFIG, birthday: 'genesis' });
    expect(client.getSend('send-1')).toMatchObject({ status: 'pending' });
    const recorded = waitFor('recorded');
    backend.setSendStatus({ status: 'recorded' });
    await expect(recorded).resolves.toMatchObject({ sendId: 'send-1' });
  });
});

describe('a payment whose signatures can\'t be saved', () => {
  it('is cancelled, and nothing is submitted', async () => {
    const backend = fakeBackend();
    const storage = failingLedgerWrite(memoryStorage(), ({ entries }) => entries.length > 0);
    const client = await connected(backend, storage);
    try {
      await expect(client.send({
        tokenId: NATIVE, to: PAYMENT.address, amount: BigInt(PAYMENT.amount),
      })).rejects.toThrow('The disk is full.');
      expect(backend.signatures()).toBeNull();
      expect(backend.calls.filter((c) => c.method === 'DELETE').map((c) => c.path))
        .toEqual(['/v1/sends/send-1']);
    } finally {
      client.disconnect();
    }
  });
});

describe('a lock while a payment asks about an earlier one', () => {
  it('signs nothing: the keys are read for each round, and they are gone', async () => {
    const walletId = bytesToHex(walletIdOf(hexToBytes(CASE.pub_a), hexToBytes(CASE.pub_b)));
    const storage = memoryStorage({
      [`wallet:multichain:nextSigned:1777:0:${walletId}`]: JSON.stringify({
        entries: [{
          sendId: 'send-0',
          signingHash: 'ab'.repeat(32),
          inputs: CASE.inputs.map((i) => i.one_time_key),
          signatures: [],
          signedTx: 'cafe',
          txId: 'cd'.repeat(32),
        }],
      }),
    });
    const backend = fakeBackend({ earlierStatus: { status: 'rejected', reason: 'fee too low' } });
    let client = null;
    // The app locks while the backend is asked about the earlier payment.
    const fetchImpl = async (url, options) => {
      if (url.endsWith('/v1/sends/send-0') && options.method === 'GET') {
        client.forgetKeys();
      }
      return backend.fetchImpl(url, options);
    };
    client = await connected({ ...backend, fetchImpl }, storage);
    try {
      await expect(client.send({
        tokenId: NATIVE, to: PAYMENT.address, amount: BigInt(PAYMENT.amount),
      })).rejects.toMatchObject({ code: 'no-keys' });
      expect(backend.signatures()).toBeNull();
    } finally {
      client.disconnect();
    }
  });
});

describe('the sign-once ledger kept before', () => {
  const walletId = bytesToHex(walletIdOf(hexToBytes(CASE.pub_a), hexToBytes(CASE.pub_b)));
  const entry = (sendId, extra = {}) => ({
    sendId,
    signingHash: 'ab'.repeat(32),
    inputs: CASE.inputs.map((i) => i.one_time_key),
    signatures: [],
    signedTx: 'cafe',
    txId: sendId.replace('send-', '').padStart(64, '0'),
    signedAt: 1,
    ...extra,
  });

  it('moves its payments still on their way to the ledger kept now, then goes', async () => {
    const storage = memoryStorage({
      [`multichain:nextSigned:1777:${walletId}`]: JSON.stringify({
        entries: [entry('send-0'), entry('send-9', { recorded: true })],
      }),
    });
    const backend = fakeBackend();
    const client = await connected(backend, storage);
    client.disconnect();
    expect(Object.keys(storage.items())).not.toContain(`multichain:nextSigned:1777:${walletId}`);
    const { entries } = storage.getItem(`wallet:multichain:nextSigned:1777:0:${walletId}`);
    // The one still on its way holds its outputs here now, and went out again; a settled one
    // has nothing left to hold.
    expect(entries.map((e) => e.sendId)).toEqual(['send-0']);
    expect(backend.resubmitted.map((r) => r.path)).toEqual(['/v1/sends/send-0/resubmit']);
  });

  it('moves only what was signed on this chain: anything older was the chain before a reset\'s', async () => {
    // It named no chain. A reset chain keeps its network id and starts its output indexes over:
    // an older payment would hold outputs of this chain that it never spent.
    const storage = memoryStorage({
      [`multichain:nextSigned:1777:${walletId}`]: JSON.stringify({
        entries: [
          entry('send-0', { signedAt: 6000 }),
          entry('send-7', { signedAt: 4000 }),
          entry('send-8'),
          entry('send-9', { signedAt: undefined }),
        ],
      }),
    });
    const backend = fakeBackend({ genesisMs: 5000 });
    const client = await connected(backend, storage);
    client.disconnect();
    const { entries } = storage.getItem(`wallet:multichain:nextSigned:1777:5000:${walletId}`);
    expect(entries.map((e) => e.sendId)).toEqual(['send-0']);
    expect(backend.resubmitted.map((r) => r.path)).toEqual(['/v1/sends/send-0/resubmit']);
  });
});

describe('the sign-once ledger of a wallet and chain', () => {
  it('is the same across connects: a payment from before one may still be writing to it', async () => {
    const created = jest.spyOn(signer, 'createSignLedger');
    try {
      const backend = fakeBackend();
      const client = await connected(backend);
      await client.connect({ network: 'privatenet', config: CONFIG, birthday: 'genesis' });
      client.disconnect();
      expect(created).toHaveBeenCalledTimes(1);
    } finally {
      created.mockRestore();
    }
  });

  it('is the same after a connect to another chain and back', async () => {
    const created = jest.spyOn(signer, 'createSignLedger');
    try {
      const before = fakeBackend();
      const reset = fakeBackend({ genesisMs: 5000 });
      let current = before;
      const backend = { fetchImpl: (...args) => current.fetchImpl(...args) };
      const client = await connected(backend);
      current = reset;
      await client.connect({ network: 'privatenet', config: CONFIG, birthday: 'genesis' });
      current = before;
      await client.connect({ network: 'privatenet', config: CONFIG, birthday: 'genesis' });
      client.disconnect();
      // One for each chain: the first chain's again is the one made at its first connect.
      expect(created.mock.calls.map(([, key]) => key.split(':')[4])).toEqual(['0', '5000']);
    } finally {
      created.mockRestore();
    }
  });

  it('is the same for every client of the same storage', async () => {
    const created = jest.spyOn(signer, 'createSignLedger');
    try {
      const storage = memoryStorage();
      const one = await connected(fakeBackend(), storage);
      const other = await connected(fakeBackend(), storage);
      one.disconnect();
      other.disconnect();
      expect(created).toHaveBeenCalledTimes(1);
    } finally {
      created.mockRestore();
    }
  });
});
