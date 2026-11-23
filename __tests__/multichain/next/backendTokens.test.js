/**
 * Copyright (c) Hathor Labs and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import {
  afterEach,
  beforeEach,
  describe,
  it,
  expect,
  jest,
} from '@jest/globals';
import derivation from './fixtures/derivation.json';
import vectors from './fixtures/remote-issuance.json';
import { createBackendNextClient } from '../../../src/multichain/next/backendClient';
import * as signerModule from '../../../src/multichain/next/signer';
import * as nonceModule from '../../../src/multichain/next/tokenNonces';
import { NEXT_CLIENT_ERROR, NEXT_CLIENT_EVENT } from '../../../src/multichain/nextClientErrors';
import {
  deriveAccount,
  mnemonicToSeed,
  publicKeyOf,
  walletIdOf,
} from '../../../src/multichain/next/kit/keys';
import { deriveAuthority } from '../../../src/multichain/next/kit/authority';
import { encodeAddress } from '../../../src/multichain/next/kit/address';
import { INPUT_DOMAIN, verifyIn } from '../../../src/multichain/next/kit/inputSig';
import {
  parseIssuanceTx,
  txIdOf,
  withInputSignatures,
} from '../../../src/multichain/next/kit/tx';
import {
  bigintToBytesLE,
  bytesToHex,
  hexToBytes,
} from '../../../src/multichain/next/kit/scalar';
import { CREATE_1, SEND_0 } from '../fakes/sendIds';
import { loggedRefusals } from '../fakes/signing';

// The vectors' wallet is account 3 of the test mnemonic, this client's, and its creation names
// the keys this wallet derives at nonce 0: the nonce a wallet with no token takes. So the sign
// request below is a creation Hathor Next's own builder made for this very wallet.
const CASE = vectors.cases.find((c) => c.name === 'token-create from hidden funds');
const NATIVE = vectors.native_token;
const CONFIG = {
  backendUrl: 'http://backend.test',
  nextNetworkId: 1777,
  nativeTokenId: NATIVE,
  nativeTokenSymbol: 'HTR',
  nativeTokenName: 'Hathor',
  serviceViewPub: CASE.pub_a,
  wireFormat: 'v3',
  maxSendFee: '100000000',
};
const CREATION = {
  symbol: CASE.approved.symbol,
  name: CASE.approved.name,
  amount: BigInt(CASE.approved.amount),
  // The app approves the signing: the user agreed to the change it makes public.
  approveSigning: async () => true,
};
const STORAGE_KEY_PREFIX = 'multichain:nextTokenNonces:';

function memoryStorage(initial = {}) {
  const data = { ...initial };
  return {
    data,
    getItem: (key) => (key in data ? JSON.parse(data[key]) : null),
    setItemAsync: async (key, value) => { data[key] = JSON.stringify(value); },
  };
}

const signRequest = () => ({
  id: CREATE_1,
  intent_id: 'i',
  expires_at: 4000000000,
  unsigned_tx: CASE.unsigned_tx,
  signing_hash: CASE.signing_hash,
  sender_opening: CASE.sender_opening,
  inputs: CASE.inputs,
  outputs: CASE.outputs,
  fee: CASE.fee,
  status: 'awaiting_signatures',
  issuance: {
    kind: 'token-create',
    token_id: 'ff'.repeat(32),
    amount: CASE.approved.amount,
    symbol: CASE.approved.symbol,
    name: CASE.approved.name,
    mint_authority: CASE.approved.mint_authority,
    melt_authority: CASE.approved.melt_authority,
  },
});

// The id of the vector's creation signed with these signatures: its inputs' signatures are
// randomized, so each signing makes another.
const signedTxId = (signatures) => {
  const unsigned = hexToBytes(CASE.unsigned_tx);
  return bytesToHex(txIdOf(withInputSignatures(
    unsigned,
    parseIssuanceTx(unsigned),
    signatures.map(hexToBytes),
  )));
};

function fakeBackend({
  issuance = true,
  registry = [],
  // The registry once the creation is recorded, when it differs.
  registryAfter = null,
  createStatus = 200,
  request = signRequest(),
  onRegistry = null,
  amountWidth = null,
  // The id of the transaction the backend says it recorded: the one signed, unless told.
  recordedTxId = null,
  // Once signed, what the creation's status says: recorded, unless told.
  sendStatus: initialSendStatus = 'recorded',
  // The fee the backend quotes, and the native token the wallet holds.
  sendFee = CASE.fee,
  balance = '10000000',
  // What the backend says of an earlier payment the ledger holds (SEND_0): unreadable, unless told.
  earlierStatus = null,
  // A promise the other backend's config answer waits for.
  otherConfigGate = null,
} = {}) {
  const calls = [];
  let signatures = null;
  let sendStatus = initialSendStatus;
  const json = (status, body) => ({
    ok: status < 300,
    status,
    text: async () => JSON.stringify(body),
  });
  const walletId = bytesToHex(walletIdOf(hexToBytes(CASE.pub_a), hexToBytes(CASE.pub_b)));
  // Two backends answer alike: the one the client connects to, and another it may switch to.
  const fetchImpl = async (url, { method, body }) => {
    const [, host, path] = /^http:\/\/(backend|other)\.test(.*)$/.exec(url);
    const data = body ? JSON.parse(body) : null;
    calls.push({ method, host, path, data });
    if (path === '/v1/config' && host === 'other' && otherConfigGate) {
      await otherConfigGate;
    }
    if (path === '/v1/config') {
      return json(200, {
        next: {
          network_id: 1777,
          native_token: NATIVE,
          service_view_pub: CASE.pub_a,
          wire_format: 'v3',
          genesis_ms: 0,
          epoch_ms: 500,
          send_fee: sendFee,
          ...(amountWidth ? { amount_width: amountWidth } : {}),
        },
        issuance,
      });
    }
    if (path === '/v1/wallets') {
      return json(200, {
        // The registering wallet's own: another wallet may connect too.
        wallet_id: bytesToHex(walletIdOf(hexToBytes(CASE.pub_a), hexToBytes(data.pub_b))),
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
      return json(200, {
        balance_state: 'live',
        balances: [{ token: NATIVE, referenceable: balance }],
      });
    }
    if (path.includes('/history')) return json(200, { history: [] });
    if (path.startsWith('/v1/tokens')) {
      onRegistry?.();
      const rows = signatures && registryAfter ? registryAfter : registry;
      return json(200, path.includes('authorities=true') ? { tokens: rows } : { tokens: [] });
    }
    if (method === 'POST' && path === `/v1/wallets/${walletId}/tokens`) {
      return createStatus === 200 ? json(200, request) : json(createStatus, { error: 'refused' });
    }
    if (path === `/v1/sends/${CREATE_1}/signatures`) {
      ({ signatures } = data);
      return json(200, { id: CREATE_1, tx_id: CASE.tx_id, status: 'submitted' });
    }
    if (path === `/v1/sends/${SEND_0}` && method === 'GET') {
      return earlierStatus ? json(200, { id: SEND_0, status: earlierStatus }) : json(500, { error: 'try again' });
    }
    if (path === `/v1/sends/${CREATE_1}` && method === 'GET') {
      return json(200, signatures
        ? { id: CREATE_1, status: sendStatus, tx_id: recordedTxId ?? signedTxId(signatures) }
        : { id: CREATE_1, status: 'awaiting_signatures', tx_id: null });
    }
    if (method === 'DELETE') return json(200, {});
    return json(404, { error: 'not found' });
  };
  return {
    fetchImpl,
    calls,
    signatures: () => signatures,
    setSendStatus: (status) => { sendStatus = status; },
  };
}

// The storage, whose next write of the sign-once ledger that `when` picks fails, once.
function failingLedgerWrite(storage, when) {
  let failures = 1;
  return {
    ...storage,
    failed: () => failures === 0,
    setItemAsync: async (key, value) => {
      if (failures > 0 && key.startsWith('wallet:multichain:nextSigned:') && when(value)) {
        failures -= 1;
        throw new Error('The disk is full.');
      }
      return storage.setItemAsync(key, value);
    },
  };
}

async function connected(backend, storage = memoryStorage(), config = CONFIG, options = {}) {
  const client = createBackendNextClient({
    fetchImpl: backend.fetchImpl,
    WebSocketImpl: null,
    storage,
    sendPollMs: 5,
    ...options,
  });
  await client.prepareKeys({ words: derivation.mnemonic });
  await client.connect({ network: 'privatenet', config, birthday: 'genesis' });
  return client;
}

const createCalls = (backend) => backend.calls
  .filter((c) => c.method === 'POST' && c.path.endsWith('/tokens'));
const nonceRecord = (storage) => {
  const key = Object.keys(storage.data).find((k) => k.startsWith(STORAGE_KEY_PREFIX));
  return key ? JSON.parse(storage.data[key]) : null;
};

describe('a token created on Hathor Next through the backend', () => {
  let client = null;
  afterEach(() => {
    client?.disconnect();
    client = null;
  });

  it('asks for the token with this wallet\'s keys, checks it, signs and follows it', async () => {
    const backend = fakeBackend();
    const storage = memoryStorage();
    client = await connected(backend, storage);
    expect(client.canCreateTokens()).toBe(true);
    const recorded = new Promise((resolve) => {
      client.on(NEXT_CLIENT_EVENT.SEND, (event) => {
        if (event.status === 'recorded') resolve(event);
      });
    });

    const { sendId, tokenId } = await client.createToken({
      words: derivation.mnemonic,
      ...CREATION,
    });
    expect(sendId).toBe(CREATE_1);
    const [create] = createCalls(backend);
    expect(create.data).toMatchObject({
      symbol: CREATION.symbol,
      name: CREATION.name,
      amount: CASE.approved.amount,
      mint_authority: CASE.approved.mint_authority,
      melt_authority: CASE.approved.melt_authority,
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
    // The token is the transaction these signatures make.
    const unsigned = hexToBytes(CASE.unsigned_tx);
    const signed = withInputSignatures(unsigned, parseIssuanceTx(unsigned), sigs.map(hexToBytes));
    expect(tokenId).toBe(bytesToHex(txIdOf(signed)));
    // Signed at nonce 0: it stays reserved and the floor says it was signed.
    expect(nonceRecord(storage)).toEqual({ reserved: [0], signedFloor: 0 });
    await expect(recorded).resolves.toMatchObject({ sendId: CREATE_1, status: 'recorded' });
    expect(client.getCreation(CREATE_1)).toMatchObject({ status: 'recorded', txId: tokenId });
  });

  it('sends no secret: not the words, the seed, the spend key nor an authority\'s', async () => {
    const backend = fakeBackend();
    client = await connected(backend);
    await client.createToken({ words: derivation.mnemonic, ...CREATION });
    const seed = await mnemonicToSeed(derivation.mnemonic);
    const { b } = deriveAccount(seed);
    const scalars = [b];
    for (const kind of ['mint', 'melt']) {
      for (let n = 0; n < 3; n += 1) scalars.push(deriveAuthority(seed, 3, kind, n).secret);
    }
    const everything = backend.calls
      .map((c) => `${c.path} ${c.data ? JSON.stringify(c.data) : ''}`)
      .join('\n');
    const secrets = [...scalars.map((x) => bytesToHex(bigintToBytesLE(x))), bytesToHex(seed)];
    for (const secret of secrets) {
      expect(everything).not.toContain(secret);
    }
    // The creation asks for exactly these fields.
    const [create] = createCalls(backend);
    expect(Object.keys(create.data).sort()).toEqual([
      'amount', 'intent_id', 'max_fee', 'melt_authority', 'mint_authority', 'name', 'symbol',
    ]);
    // No body carries two of the words in a row, however they are written: in one string, or as
    // a list of them.
    const words = derivation.mnemonic.split(' ');
    const pairs = new Set(words.slice(1).map((word, i) => `${words[i]} ${word}`));
    const wordsOf = (value) => {
      if (typeof value === 'string') return value.toLowerCase().split(/[^a-z]+/).filter(Boolean);
      if (Array.isArray(value)) return value.flatMap(wordsOf);
      if (value && typeof value === 'object') return Object.values(value).flatMap(wordsOf);
      return [];
    };
    for (const call of backend.calls) {
      const sent = wordsOf(call.data);
      const found = sent.slice(1).some((word, i) => pairs.has(`${sent[i]} ${word}`));
      expect(found).toBe(false);
    }
  });

  it('never hands out a nonce twice: the next creation takes the next one, even unlisted', async () => {
    const backend = fakeBackend();
    const storage = memoryStorage();
    client = await connected(backend, storage);
    await client.createToken({ words: derivation.mnemonic, ...CREATION });
    // The registry doesn't list the first token yet. The backend answers the same creation, at
    // nonce 0's keys, which is not what this second one asked for: refused, and its nonce back.
    await expect(client.createToken({ words: derivation.mnemonic, ...CREATION }))
      .rejects.toMatchObject({ code: NEXT_CLIENT_ERROR.TOKEN_REFUSED });
    const [, second] = createCalls(backend);
    const seed = await mnemonicToSeed(derivation.mnemonic);
    expect(second.data.mint_authority).toBe(bytesToHex(deriveAuthority(seed, 3, 'mint', 1).pub));
    expect(second.data.melt_authority).toBe(bytesToHex(deriveAuthority(seed, 3, 'melt', 1).pub));
    expect(nonceRecord(storage)).toEqual({ reserved: [0], signedFloor: 0 });
    expect(backend.calls.some((c) => c.method === 'DELETE' && c.path === `/v1/sends/${CREATE_1}`))
      .toBe(true);
  });

  it('skips a nonce the registry shows this wallet already used', async () => {
    const seed = await mnemonicToSeed(derivation.mnemonic);
    const key = (kind, n) => bytesToHex(deriveAuthority(seed, 3, kind, n).pub);
    const backend = fakeBackend({
      registry: [{
        token_id: 'aa'.repeat(32),
        has_mint_authority: true,
        has_melt_authority: true,
        mint_authority: key('mint', 0),
        melt_authority: key('melt', 0),
      }],
    });
    client = await connected(backend);
    await expect(client.createToken({ words: derivation.mnemonic, ...CREATION })).rejects.toThrow();
    expect(createCalls(backend)[0].data.mint_authority).toBe(key('mint', 1));
  });

  it('refuses a token other than the one approved, signing nothing', async () => {
    const backend = fakeBackend();
    const storage = memoryStorage();
    client = await connected(backend, storage);
    await expect(client.createToken({ words: derivation.mnemonic, ...CREATION, symbol: 'USDX' }))
      .rejects.toMatchObject({ code: NEXT_CLIENT_ERROR.TOKEN_REFUSED });
    await expect(client.createToken({
      words: derivation.mnemonic,
      ...CREATION,
      amount: CREATION.amount + 1n,
    })).rejects.toMatchObject({ code: NEXT_CLIENT_ERROR.TOKEN_REFUSED });
    expect(backend.signatures()).toBeNull();
    // Nothing was signed, so both nonces went back.
    expect(nonceRecord(storage)).toEqual({ reserved: [], signedFloor: null });
  });

  it('refuses a creation that pays any of it to another wallet', async () => {
    const stranger = encodeAddress(CASE.pub_a, bytesToHex(publicKeyOf(5n)));
    const request = signRequest();
    request.outputs = request.outputs.map((o, i) => (i === 1 ? { ...o, address: stranger } : o));
    const backend = fakeBackend({ request });
    client = await connected(backend);
    await expect(client.createToken({ words: derivation.mnemonic, ...CREATION }))
      .rejects.toMatchObject({ code: NEXT_CLIENT_ERROR.TOKEN_REFUSED });
    expect(backend.signatures()).toBeNull();
  });

  it('asks nothing when the registry withholds a key, and gives the nonce back on a refusal', async () => {
    const withheld = fakeBackend({
      registry: [{ token_id: 'dd'.repeat(32), has_mint_authority: true, has_melt_authority: false }],
    });
    client = await connected(withheld);
    await expect(client.createToken({ words: derivation.mnemonic, ...CREATION }))
      .rejects.toMatchObject({ code: NEXT_CLIENT_ERROR.TOKEN_AUTHORITIES_UNKNOWN });
    expect(createCalls(withheld)).toHaveLength(0);
    client.disconnect();

    const storage = memoryStorage();
    const off = fakeBackend({ createStatus: 501 });
    client = await connected(off, storage);
    await expect(client.createToken({ words: derivation.mnemonic, ...CREATION }))
      .rejects.toMatchObject({ code: NEXT_CLIENT_ERROR.TOKENS_UNAVAILABLE });
    expect(nonceRecord(storage)).toEqual({ reserved: [], signedFloor: null });
  });

  it('refuses a request it can\'t read, cancels it and gives the nonce back', async () => {
    const request = signRequest();
    delete request.fee;
    const backend = fakeBackend({ request });
    const storage = memoryStorage();
    client = await connected(backend, storage);
    await expect(client.createToken({ words: derivation.mnemonic, ...CREATION }))
      .rejects.toMatchObject({ code: NEXT_CLIENT_ERROR.TOKEN_REFUSED });
    expect(backend.signatures()).toBeNull();
    expect(backend.calls.some((c) => c.method === 'DELETE' && c.path === `/v1/sends/${CREATE_1}`))
      .toBe(true);
    expect(nonceRecord(storage)).toEqual({ reserved: [], signedFloor: null });
  });

  it('holds a creation to the width pinned for the network: another is refused, nothing signed', async () => {
    // The vector's creation carries u64 amounts; this network is pinned at u128.
    const backend = fakeBackend({ amountWidth: 'u128' });
    const storage = memoryStorage();
    client = await connected(backend, storage, { ...CONFIG, amountWidth: 'u128' });
    await expect(client.createToken({ words: derivation.mnemonic, ...CREATION }))
      .rejects.toMatchObject({ code: NEXT_CLIENT_ERROR.TOKEN_REFUSED });
    expect(backend.signatures()).toBeNull();
    expect(nonceRecord(storage)).toEqual({ reserved: [], signedFloor: null });
  });

  it('reads the registry\'s keys as bytes: uppercase ones still take their nonce', async () => {
    const seed = await mnemonicToSeed(derivation.mnemonic);
    const key = (kind, n) => bytesToHex(deriveAuthority(seed, 3, kind, n).pub);
    const backend = fakeBackend({
      registry: [{
        token_id: 'AA'.repeat(32),
        has_mint_authority: true,
        has_melt_authority: true,
        mint_authority: key('mint', 0).toUpperCase(),
        melt_authority: key('melt', 0).toUpperCase(),
      }],
    });
    client = await connected(backend);
    await expect(client.createToken({ words: derivation.mnemonic, ...CREATION })).rejects.toThrow();
    expect(createCalls(backend)[0].data.mint_authority).toBe(key('mint', 1));
  });

  it.each([
    ['a row without its authority flags', [{ token_id: 'aa'.repeat(32) }]],
    ['a key that isn\'t hex', [{
      token_id: 'aa'.repeat(32),
      has_mint_authority: true,
      has_melt_authority: false,
      mint_authority: 'zz',
    }]],
  ])('asks nothing on %s', async (_, registry) => {
    const backend = fakeBackend({ registry });
    client = await connected(backend);
    await expect(client.createToken({ words: derivation.mnemonic, ...CREATION }))
      .rejects.toMatchObject({ code: NEXT_CLIENT_ERROR.TOKEN_AUTHORITIES_UNKNOWN });
    expect(createCalls(backend)).toHaveLength(0);
  });

  it('stops, and gives the nonce back, when the app locks while the registry is read', async () => {
    const storage = memoryStorage();
    let lock = null;
    const backend = fakeBackend({ onRegistry: () => lock?.() });
    client = await connected(backend, storage);
    lock = () => client.forgetKeys();
    await expect(client.createToken({ words: derivation.mnemonic, ...CREATION }))
      .rejects.toMatchObject({ code: NEXT_CLIENT_ERROR.NO_KEYS });
    expect(createCalls(backend)).toHaveLength(0);
    expect(nonceRecord(storage)?.reserved ?? []).toEqual([]);
  });

  it('asks no backend and signs nothing when the app leaves Hathor Next as the keys derive', async () => {
    const storage = memoryStorage();
    let leave = null;
    const backend = fakeBackend({ onRegistry: () => leave?.() });
    client = await connected(backend, storage);
    leave = () => client.disconnect();
    await expect(client.createToken({ words: derivation.mnemonic, ...CREATION }))
      .rejects.toMatchObject({ code: NEXT_CLIENT_ERROR.NOT_CONNECTED });
    expect(createCalls(backend)).toHaveLength(0);
    expect(backend.signatures()).toBeNull();
    // Nothing was reserved: no nonce was ever written for a Hathor Next the app left.
    expect(nonceRecord(storage)).toBeNull();
  });

  it('asks neither backend when the app goes to another one as the keys derive', async () => {
    const storage = memoryStorage();
    let reconnecting = null;
    let leave = null;
    const backend = fakeBackend({ onRegistry: () => leave?.() });
    client = await connected(backend, storage);
    leave = () => {
      leave = null;
      reconnecting = client.connect({
        network: 'privatenet',
        config: { ...CONFIG, backendUrl: 'http://other.test' },
        birthday: 'genesis',
      });
    };
    await expect(client.createToken({ words: derivation.mnemonic, ...CREATION }))
      .rejects.toMatchObject({ code: NEXT_CLIENT_ERROR.NOT_CONNECTED });
    await reconnecting;
    expect(createCalls(backend)).toHaveLength(0);
    expect(backend.signatures()).toBeNull();
    expect(nonceRecord(storage)?.reserved ?? []).toEqual([]);
  });

  // A creation signed for this backend, saved while the app goes to another one in front of the
  // same network: the other is asked nothing about it, and it goes out here at the next connect.
  it('leaves a creation saved as the app goes to another backend to its own', async () => {
    jest.spyOn(console, 'error').mockImplementation(() => {});
    const ledgerWrite = { reach: null, release: null };
    const reached = new Promise((resolve) => { ledgerWrite.reach = resolve; });
    const released = new Promise((resolve) => { ledgerWrite.release = resolve; });
    const base = memoryStorage();
    let held = false;
    const storage = {
      ...base,
      setItemAsync: async (key, value) => {
        if (!held && key.startsWith('wallet:multichain:nextSigned:')) {
          held = true;
          ledgerWrite.reach();
          await released;
        }
        return base.setItemAsync(key, value);
      },
    };
    let openOther;
    const otherConfigGate = new Promise((resolve) => { openOther = resolve; });
    const backend = fakeBackend({ otherConfigGate });
    client = await connected(backend, storage);
    const creating = client.createToken({ words: derivation.mnemonic, ...CREATION });
    creating.catch(() => {});
    await reached;

    const reconnecting = client.connect({
      network: 'privatenet',
      config: { ...CONFIG, backendUrl: 'http://other.test' },
      birthday: 'genesis',
    });
    await new Promise((resolve) => { setTimeout(resolve, 10); });
    ledgerWrite.release();
    await creating.catch(() => {});
    openOther();
    await reconnecting;
    await new Promise((resolve) => { setTimeout(resolve, 20); });

    expect(backend.calls.filter((c) => c.host === 'other' && c.path.includes(CREATE_1))).toEqual([]);
  });

  it('signs nothing when the app leaves Hathor Next while the backend builds the token', async () => {
    const storage = memoryStorage();
    const backend = fakeBackend();
    let leave = null;
    // The backend answers, and the app has left Hathor Next by the time its answer is read.
    const fetchImpl = async (url, init) => {
      const answer = await backend.fetchImpl(url, init);
      if (init.method === 'POST' && url.endsWith('/tokens')) {
        leave?.();
      }
      return answer;
    };
    client = await connected({ ...backend, fetchImpl }, storage);
    leave = () => client.disconnect();
    await expect(client.createToken({ words: derivation.mnemonic, ...CREATION }))
      .rejects.toMatchObject({ code: NEXT_CLIENT_ERROR.NOT_CONNECTED });
    expect(createCalls(backend)).toHaveLength(1);
    expect(backend.signatures()).toBeNull();
    expect(nonceRecord(storage)?.reserved ?? []).toEqual([]);
  });

  it('signs nothing when the app leaves Hathor Next while a build asked again after a 401 runs', async () => {
    const storage = memoryStorage();
    const backend = fakeBackend();
    let builds = 0;
    let leave = null;
    const fetchImpl = async (url, init) => {
      if (init.method !== 'POST' || !url.endsWith('/tokens')) {
        return backend.fetchImpl(url, init);
      }
      builds += 1;
      // The backend restarted: the session it gave is gone, and the client logs in again.
      if (builds === 1) {
        return { ok: false, status: 401, text: async () => JSON.stringify({ error: 'expired' }) };
      }
      const answer = await backend.fetchImpl(url, init);
      leave?.();
      return answer;
    };
    client = await connected({ ...backend, fetchImpl }, storage);
    leave = () => client.disconnect();
    await expect(client.createToken({ words: derivation.mnemonic, ...CREATION }))
      .rejects.toMatchObject({ code: NEXT_CLIENT_ERROR.NOT_CONNECTED });
    expect(builds).toBe(2);
    expect(backend.signatures()).toBeNull();
    expect(nonceRecord(storage)?.reserved ?? []).toEqual([]);
  });

  // Asked to approve with or without a change: the check before the approval stops what leaves
  // before it, the one after it what leaves during it.
  it.each([
    ['a change to show', null],
    ['no change', 0n],
  ])('signs nothing when the app leaves Hathor Next just before signing, with %s, and gives the nonce back', async (_, forcedChange) => {
    // The build's answer is checked as it comes, and signing follows a step later: the app may
    // leave in between. Each run leaves one step later than the one before, from the answer
    // until after signing, so one run leaves in that step.
    if (forcedChange !== null) {
      const realCheck = signerModule.checkCreateRequest;
      jest.spyOn(signerModule, 'checkCreateRequest')
        .mockImplementation((...args) => ({ ...realCheck(...args), publicChange: forcedChange }));
    }
    const realSign = signerModule.verifyAndSign;
    const order = [];
    jest.spyOn(signerModule, 'verifyAndSign').mockImplementation((...args) => {
      order.push('sign');
      return realSign(...args);
    });
    const runs = [];
    try {
      for (let steps = 0; steps < 8; steps += 1) {
        order.length = 0;
        const storage = memoryStorage();
        const backend = fakeBackend();
        let run = null;
        const leave = () => {
          let later = Promise.resolve();
          for (let i = 0; i < steps; i += 1) {
            later = later.then(() => {});
          }
          later.then(() => {
            run.disconnect();
            order.push('left');
          });
        };
        const fetchImpl = async (url, init) => {
          const answer = await backend.fetchImpl(url, init);
          if (init.method !== 'POST' || !url.endsWith('/tokens')) {
            return answer;
          }
          const body = await answer.text();
          return {
            ...answer,
            text: () => new Promise((resolve) => {
              resolve(body);
              leave();
            }),
          };
        };
        // eslint-disable-next-line no-await-in-loop
        run = await connected({ ...backend, fetchImpl }, storage);
        client = run;
        let outcome = 'created';
        try {
          // eslint-disable-next-line no-await-in-loop
          await run.createToken({
            words: derivation.mnemonic,
            ...CREATION,
            approveSigning: async () => {
              order.push('approve');
              return true;
            },
          });
        } catch (e) {
          outcome = e.code;
        }
        runs.push({
          order: order.join(' '),
          outcome,
          sent: backend.signatures() !== null,
          reserved: nonceRecord(storage)?.reserved ?? [],
        });
      }
    } finally {
      jest.restoreAllMocks();
    }
    // The runs went from leaving before the approval to leaving after signing. One that left
    // before it is never approved; one that left during it signs nothing.
    const leftFirst = runs.filter((r) => r.order.startsWith('left'));
    expect(leftFirst.length).toBeGreaterThan(0);
    expect(runs.some((r) => r.order.endsWith('sign left'))).toBe(true);
    for (const r of leftFirst) {
      expect(r).toEqual({
        order: 'left', outcome: NEXT_CLIENT_ERROR.NOT_CONNECTED, sent: false, reserved: [],
      });
    }
    for (const r of runs.filter((run) => run.order === 'approve left')) {
      expect(r).toMatchObject({
        outcome: NEXT_CLIENT_ERROR.NOT_CONNECTED, sent: false, reserved: [],
      });
    }
  });

  // An earlier payment holds the creation's outputs: the creation waits, and the earlier one goes
  // out again only while the backend says it is on its way. One whose state can't be read may have
  // expired, and is not sent again on a guess.
  it.each([
    ['whose state can\'t be read, sending it nothing', null, 0],
    ['on its way, sending it again', 'submitted', 1],
  ])('waits for an earlier payment over its outputs %s', async (_label, earlierStatus, resubmits) => {
    const walletId = bytesToHex(walletIdOf(hexToBytes(CASE.pub_a), hexToBytes(CASE.pub_b)));
    const earlier = {
      sendId: SEND_0,
      signingHash: 'ab'.repeat(32),
      inputs: CASE.inputs.map((i) => i.one_time_key),
      signatures: [],
      signedTx: 'cafe',
      txId: 'cd'.repeat(32),
    };
    const storage = memoryStorage({
      [`wallet:multichain:nextSigned:1777:0:${walletId}`]: JSON.stringify({ entries: [earlier] }),
    });
    const backend = fakeBackend({ earlierStatus });
    client = await connected(backend, storage);
    // The connect reads it, and leaves it as it is.
    backend.calls.length = 0;

    await expect(client.createToken({ words: derivation.mnemonic, ...CREATION }))
      .rejects.toMatchObject({ code: 'earlier-pending' });
    expect(backend.signatures()).toBeNull();
    expect(backend.calls.filter((c) => c.path === `/v1/sends/${SEND_0}/resubmit`)).toHaveLength(resubmits);
  });

  it('names the token the registry lists with this wallet\'s keys, once recorded', async () => {
    const recordedId = 'cd'.repeat(32);
    const backend = fakeBackend({
      recordedTxId: recordedId,
      registryAfter: [{
        token_id: recordedId,
        has_mint_authority: true,
        has_melt_authority: true,
        mint_authority: CASE.approved.mint_authority,
        melt_authority: CASE.approved.melt_authority,
      }],
    });
    client = await connected(backend);
    const named = new Promise((resolve) => {
      client.on(NEXT_CLIENT_EVENT.SEND, (event) => {
        if (event.txId === recordedId) resolve(event);
      });
    });
    await client.createToken({ words: derivation.mnemonic, ...CREATION });
    await expect(named).resolves.toMatchObject({ sendId: CREATE_1, status: 'recorded' });
    expect(client.getCreation(CREATE_1).txId).toBe(recordedId);
  });

  describe('the change a creation makes public, shown before anything is signed', () => {
    const CHANGE = BigInt(CASE.outputs.find((o) => o.is_change && o.token === NATIVE).amount);
    const deletes = (backend) => backend.calls.filter((c) => c.method === 'DELETE');
    const create = (run, approveSigning) => run.createToken({
      words: derivation.mnemonic, ...CREATION, approveSigning,
    });
    afterEach(() => {
      jest.restoreAllMocks();
    });

    it('asks with the change before signing, and signs once the user agrees', async () => {
      const backend = fakeBackend();
      client = await connected(backend);
      const seen = [];
      await create(client, async (change) => {
        seen.push({ change, signed: backend.signatures() !== null });
        return true;
      });
      expect(seen).toEqual([{ change: CHANGE, signed: false }]);
      expect(backend.signatures()).toHaveLength(CASE.inputs.length);
    });

    it('signs nothing when the user declines: the creation is cancelled, the nonce given back', async () => {
      const backend = fakeBackend();
      const storage = memoryStorage();
      client = await connected(backend, storage);
      await expect(create(client, async () => false))
        .rejects.toMatchObject({ code: NEXT_CLIENT_ERROR.TOKEN_DECLINED });
      expect(backend.signatures()).toBeNull();
      expect(deletes(backend).map((c) => c.path)).toEqual([`/v1/sends/${CREATE_1}`]);
      expect(nonceRecord(storage).reserved).toEqual([]);
    });

    it('signs nothing, and cancels nothing there, when the app leaves Hathor Next during the answer', async () => {
      const backend = fakeBackend();
      const storage = memoryStorage();
      client = await connected(backend, storage);
      await expect(create(client, async () => {
        client.disconnect();
        return true;
      })).rejects.toMatchObject({ code: NEXT_CLIENT_ERROR.NOT_CONNECTED });
      expect(backend.signatures()).toBeNull();
      expect(deletes(backend)).toEqual([]);
      expect(nonceRecord(storage).reserved).toEqual([]);
    });

    it('signs nothing when the app locks during the answer, and cancels the creation', async () => {
      const backend = fakeBackend();
      const storage = memoryStorage();
      client = await connected(backend, storage);
      await expect(create(client, async () => {
        client.forgetKeys();
        return true;
      })).rejects.toMatchObject({ code: NEXT_CLIENT_ERROR.NO_KEYS });
      expect(backend.signatures()).toBeNull();
      expect(deletes(backend).map((c) => c.path)).toEqual([`/v1/sends/${CREATE_1}`]);
      expect(nonceRecord(storage).reserved).toEqual([]);
    });

    it('signs nothing when the creation expires during the answer', async () => {
      let now = 1788000000 * 1000;
      const backend = fakeBackend({ request: { ...signRequest(), expires_at: 1788000600 } });
      const storage = memoryStorage();
      client = await connected(backend, storage, CONFIG, { nowMs: () => now });
      await expect(create(client, async () => {
        now = 1788000600 * 1000;
        return true;
      })).rejects.toMatchObject({ code: NEXT_CLIENT_ERROR.TOKEN_REVIEW_EXPIRED });
      expect(backend.signatures()).toBeNull();
      expect(nonceRecord(storage).reserved).toEqual([]);
    });

    // The app still approves it: the creation may no longer be allowed where it was asked for.
    it('asks for a creation with no change too, and signs nothing when the app says no', async () => {
      const realCheck = signerModule.checkCreateRequest;
      jest.spyOn(signerModule, 'checkCreateRequest')
        .mockImplementation((...args) => ({ ...realCheck(...args), publicChange: 0n }));
      const backend = fakeBackend();
      const storage = memoryStorage();
      client = await connected(backend, storage);
      const approve = jest.fn(async () => false);
      await expect(create(client, approve))
        .rejects.toMatchObject({ code: NEXT_CLIENT_ERROR.TOKEN_DECLINED });
      expect(approve).toHaveBeenCalledWith(0n);
      expect(backend.signatures()).toBeNull();
      expect(deletes(backend).map((c) => c.path)).toEqual([`/v1/sends/${CREATE_1}`]);
      expect(nonceRecord(storage).reserved).toEqual([]);
    });

    it('asks nothing of a creation its checks refuse, and says when it spends coins it doesn\'t need', async () => {
      jest.spyOn(signerModule, 'checkCreateRequest').mockImplementation(() => {
        throw new signerModule.CoinsNotNeededError();
      });
      const backend = fakeBackend();
      const storage = memoryStorage();
      client = await connected(backend, storage);
      const approve = jest.fn(async () => true);
      await expect(create(client, approve))
        .rejects.toMatchObject({ code: NEXT_CLIENT_ERROR.TOKEN_EXTRA_COINS });
      expect(approve).not.toHaveBeenCalled();
      expect(backend.signatures()).toBeNull();
      expect(deletes(backend).map((c) => c.path)).toEqual([`/v1/sends/${CREATE_1}`]);
      expect(nonceRecord(storage).reserved).toEqual([]);
    });

    it('creates nothing without a way to ask', async () => {
      const backend = fakeBackend();
      client = await connected(backend);
      await expect(create(client, undefined))
        .rejects.toMatchObject({ code: NEXT_CLIENT_ERROR.TOKEN_PREPARE_FAILED });
      expect(createCalls(backend)).toEqual([]);
    });
  });

  describe('after it is approved and signed', () => {
    afterEach(() => {
      jest.restoreAllMocks();
    });
    const RECORDED_ID = 'cd'.repeat(32);
    const recordedRow = {
      token_id: RECORDED_ID,
      has_mint_authority: true,
      has_melt_authority: true,
      mint_authority: CASE.approved.mint_authority,
      melt_authority: CASE.approved.melt_authority,
    };
    const settle = () => new Promise((resolve) => { setTimeout(resolve, 300); });

    it('gives the nonce back to its own wallet when the app reconnects to another during the approval', async () => {
      const OTHER = `${'abandon '.repeat(11)}about`;
      const backend = fakeBackend();
      const storage = memoryStorage();
      client = await connected(backend, storage);
      const { b } = deriveAccount(await mnemonicToSeed(OTHER));
      const otherId = bytesToHex(walletIdOf(hexToBytes(CASE.pub_a), publicKeyOf(b)));
      const otherKey = `${STORAGE_KEY_PREFIX}1777:${otherId}`;
      let ownKey = null;
      await expect(client.createToken({
        words: derivation.mnemonic,
        ...CREATION,
        approveSigning: async () => {
          [ownKey] = Object.keys(storage.data).filter((k) => k.startsWith(STORAGE_KEY_PREFIX));
          client.disconnect();
          await client.prepareKeys({ words: OTHER });
          await client.connect({ network: 'privatenet', config: CONFIG, birthday: 'genesis' });
          // The other wallet's own creation holds the same nonce.
          await storage.setItemAsync(otherKey, { reserved: [0], signedFloor: null });
          return true;
        },
      })).rejects.toMatchObject({ code: NEXT_CLIENT_ERROR.NOT_CONNECTED });
      expect(ownKey).not.toBe(otherKey);
      expect(JSON.parse(storage.data[ownKey]).reserved).toEqual([]);
      expect(JSON.parse(storage.data[otherKey]).reserved).toEqual([0]);
      expect(backend.signatures()).toBeNull();
    });

    it('still sends and follows a signed creation whose nonce couldn\'t be saved as signed', async () => {
      const realStore = nonceModule.createNonceStore;
      let failures = 1;
      jest.spyOn(nonceModule, 'createNonceStore').mockImplementation((...args) => {
        const store = realStore(...args);
        return {
          ...store,
          markSigned: async (nonce) => {
            if (failures > 0) {
              failures -= 1;
              throw new Error('The disk is full.');
            }
            return store.markSigned(nonce);
          },
        };
      });
      const backend = fakeBackend();
      const storage = memoryStorage();
      client = await connected(backend, storage);
      const recorded = new Promise((resolve) => {
        client.on(NEXT_CLIENT_EVENT.SEND, (event) => {
          if (event.status === 'recorded') resolve(event);
        });
      });
      const { sendId } = await client.createToken({ words: derivation.mnemonic, ...CREATION });
      expect(sendId).toBe(CREATE_1);
      expect(backend.signatures()).toHaveLength(CASE.inputs.length);
      // Still reserved, so no other creation takes it.
      expect(nonceRecord(storage)).toEqual({ reserved: [0], signedFloor: null });
      await recorded;
      await settle();
      // Saved as signed once the creation is recorded.
      expect(nonceRecord(storage)).toEqual({ reserved: [0], signedFloor: 0 });
    });

    it('reads the token\'s id again until the registry names it, whatever the refreshes do', async () => {
      // The backend recorded other bytes than those signed: the registry names its id.
      const backend = fakeBackend({ registryAfter: [recordedRow], recordedTxId: RECORDED_ID });
      let fail = { registry: 1, history: 1 };
      const fetchImpl = async (url, init) => {
        if (backend.signatures() !== null) {
          if (url.includes('authorities=true') && fail.registry > 0) {
            fail = { ...fail, registry: fail.registry - 1 };
            throw new Error('The registry is offline.');
          }
          if (url.includes('/history') && fail.history > 0) {
            fail = { ...fail, history: fail.history - 1 };
            throw new Error('The history is offline.');
          }
        }
        return backend.fetchImpl(url, init);
      };
      client = await connected({ ...backend, fetchImpl });
      const events = [];
      client.on(NEXT_CLIENT_EVENT.SEND, (event) => events.push(event));
      const { tokenId } = await client.createToken({ words: derivation.mnemonic, ...CREATION });
      expect(client.getCreation(CREATE_1)).toMatchObject({ txId: tokenId, provisional: true });
      await settle();
      expect(fail).toEqual({ registry: 0, history: 0 });
      expect(client.getCreation(CREATE_1)).toMatchObject({
        status: 'recorded', txId: RECORDED_ID, provisional: false,
      });
      // Recorded first, with the signed id still provisional; then the id read back.
      expect(events.find((e) => e.status === 'recorded')).toMatchObject({
        txId: tokenId, provisional: true,
      });
      expect(events.at(-1)).toMatchObject({ txId: RECORDED_ID, provisional: false });
    });

    // Anyone can create a token naming this wallet's mint key, after seeing this creation.
    const copyRow = { ...recordedRow, token_id: 'ee'.repeat(32) };

    it('takes the row carrying the recorded id, not another token naming the same key first', async () => {
      const backend = fakeBackend({
        registryAfter: [copyRow, recordedRow], recordedTxId: RECORDED_ID,
      });
      client = await connected(backend);
      await client.createToken({ words: derivation.mnemonic, ...CREATION });
      await settle();
      expect(client.getCreation(CREATE_1)).toMatchObject({
        status: 'recorded', txId: RECORDED_ID, provisional: false,
      });
    });

    it('leaves the id provisional when only another token names the key', async () => {
      const backend = fakeBackend({ registryAfter: [copyRow], recordedTxId: RECORDED_ID });
      client = await connected(backend);
      const events = [];
      client.on(NEXT_CLIENT_EVENT.SEND, (event) => events.push(event));
      const { tokenId } = await client.createToken({ words: derivation.mnemonic, ...CREATION });
      await settle();
      expect(client.getCreation(CREATE_1)).toMatchObject({
        status: 'recorded', txId: tokenId, provisional: true,
      });
      expect(events.some((e) => e.provisional === false)).toBe(false);
    });

    it('reads the id back after a reconnect to the same backend while the creation is on its way', async () => {
      const backend = fakeBackend({
        registryAfter: [recordedRow], recordedTxId: RECORDED_ID, sendStatus: 'submitted',
      });
      client = await connected(backend);
      await client.createToken({ words: derivation.mnemonic, ...CREATION });
      await settle();
      expect(client.getCreation(CREATE_1)).toMatchObject({ status: 'pending', provisional: true });
      await client.connect({ network: 'privatenet', config: CONFIG, birthday: 'genesis' });
      backend.setSendStatus('recorded');
      await settle();
      expect(client.getCreation(CREATE_1)).toMatchObject({
        status: 'recorded', txId: RECORDED_ID, provisional: false,
      });
    });

    it('reads the id back at the next connect when every read failed', async () => {
      const backend = fakeBackend({ registryAfter: [recordedRow], recordedTxId: RECORDED_ID });
      let registryDown = true;
      const readBacks = () => backend.calls.filter((c) => c.path.includes('authorities=true'));
      const fetchImpl = async (url, init) => {
        if (registryDown && backend.signatures() !== null && url.includes('authorities=true')) {
          backend.calls.push({ method: 'GET', path: url.replace('http://backend.test', '') });
          throw new Error('The registry is offline.');
        }
        return backend.fetchImpl(url, init);
      };
      client = await connected({ ...backend, fetchImpl });
      await client.createToken({ words: derivation.mnemonic, ...CREATION });
      await settle();
      const tried = readBacks().length;
      await settle();
      // Its reads ran out: none since.
      expect(readBacks().length).toBe(tried);
      expect(client.getCreation(CREATE_1)).toMatchObject({ status: 'recorded', provisional: true });
      registryDown = false;
      await client.connect({ network: 'privatenet', config: CONFIG, birthday: 'genesis' });
      await settle();
      expect(client.getCreation(CREATE_1)).toMatchObject({
        status: 'recorded', txId: RECORDED_ID, provisional: false,
      });
    });

    it('tells it was recorded, and reads its id back, when the ledger can\'t save it as recorded', async () => {
      const storage = failingLedgerWrite(
        memoryStorage(),
        ({ entries }) => entries.some((e) => e.recorded),
      );
      const backend = fakeBackend({ registryAfter: [recordedRow], recordedTxId: RECORDED_ID });
      client = await connected(backend, storage);
      const recorded = new Promise((resolve) => {
        client.on(NEXT_CLIENT_EVENT.SEND, (event) => {
          if (event.status === 'recorded') resolve(event);
        });
      });
      await client.createToken({ words: derivation.mnemonic, ...CREATION });
      await expect(recorded).resolves.toMatchObject({ sendId: CREATE_1, provisional: true });
      await settle();
      expect(storage.failed()).toBe(true);
      expect(client.getCreation(CREATE_1)).toMatchObject({ txId: RECORDED_ID, provisional: false });
    });

    it('cancels a creation whose signatures can\'t be saved, submits nothing and keeps its nonce', async () => {
      const storage = failingLedgerWrite(memoryStorage(), ({ entries }) => entries.length > 0);
      const backend = fakeBackend();
      client = await connected(backend, storage);
      await expect(client.createToken({ words: derivation.mnemonic, ...CREATION }))
        .rejects.toThrow('The disk is full.');
      expect(storage.failed()).toBe(true);
      expect(backend.signatures()).toBeNull();
      expect(backend.calls.filter((c) => c.method === 'DELETE').map((c) => c.path))
        .toEqual([`/v1/sends/${CREATE_1}`]);
      // Its signatures may exist: the nonce is never handed out again.
      expect(nonceRecord(storage)).toEqual({ reserved: [0], signedFloor: null });
    });

    it('refreshes balances and history before the tokens, as a refresh of everything does', async () => {
      const backend = fakeBackend({ registryAfter: [recordedRow] });
      client = await connected(backend);
      await client.createToken({ words: derivation.mnemonic, ...CREATION });
      await settle();
      const signedAt = backend.calls.findIndex((c) => c.path === `/v1/sends/${CREATE_1}/signatures`);
      const after = backend.calls.slice(signedAt + 1).map((c) => c.path);
      const firstTokens = after.findIndex((path) => path.startsWith('/v1/tokens')
        && !path.includes('authorities=true'));
      expect(firstTokens).toBeGreaterThan(0);
      expect(after.slice(0, firstTokens).some((path) => path.endsWith('/balance'))).toBe(true);
      expect(after.slice(0, firstTokens).some((path) => path.includes('/history'))).toBe(true);
    });
  });

  it('isn\'t offered by a backend that doesn\'t create tokens', async () => {
    const backend = fakeBackend({ issuance: false });
    client = await connected(backend);
    expect(client.canCreateTokens()).toBe(false);
    await expect(client.createToken({ words: derivation.mnemonic, ...CREATION }))
      .rejects.toMatchObject({ code: NEXT_CLIENT_ERROR.TOKENS_UNAVAILABLE });
    expect(backend.calls.some((c) => c.path.includes('authorities=true'))).toBe(false);
  });
});

// What holds a creation's signing, each on its own, with the refusal's words as the client logs
// them (it throws one code for them all).
describe('what holds a token creation\'s signing', () => {
  let client = null;
  let errors = null;
  beforeEach(() => {
    errors = jest.spyOn(console, 'error').mockImplementation(() => {});
  });
  afterEach(() => {
    client?.disconnect();
    client = null;
    jest.restoreAllMocks();
  });
  const create = (patch = {}) => client.createToken({
    words: derivation.mnemonic, ...CREATION, ...patch,
  });
  const refusals = () => loggedRefusals(
    errors,
    'next-backend-client',
    'A Hathor Next token creation was refused before signing: ',
  );
  const registryReads = (backend) => backend.calls.filter((c) => c.path.includes('authorities=true'));
  // The client's clock, pinned: the request expires long after it.
  const NOW = 1788000000;
  const clock = { nowMs: () => NOW * 1000 };

  it('signs the honest creation once the answer is true: every case below changes one thing', async () => {
    const backend = fakeBackend();
    client = await connected(backend, memoryStorage(), CONFIG, clock);
    await expect(create()).resolves.toMatchObject({ sendId: CREATE_1 });
    expect(backend.signatures()).toHaveLength(CASE.inputs.length);
    expect(refusals()).toEqual([]);
  });

  // Only `true` is a yes: nothing else a broken caller could hand back signs.
  it.each([
    ['nothing', undefined],
    ['null', null],
    ['a word', 'yes'],
    ['a number', 1],
    ['an object', { accept: true }],
  ])('signs nothing when the answer is %s', async (name, answer) => {
    const backend = fakeBackend();
    client = await connected(backend, memoryStorage(), CONFIG, clock);
    await expect(create({ approveSigning: async () => answer }))
      .rejects.toMatchObject({ code: NEXT_CLIENT_ERROR.TOKEN_DECLINED });
    expect(backend.signatures()).toBeNull();
  });

  // Its screen gone, its channel closed: an answer that never comes is a no.
  it('signs nothing when asking fails, and cancels the creation', async () => {
    const backend = fakeBackend();
    client = await connected(backend, memoryStorage(), CONFIG, clock);
    const approveSigning = async () => { throw new Error('the screen is gone'); };
    await expect(create({ approveSigning }))
      .rejects.toMatchObject({ code: NEXT_CLIENT_ERROR.TOKEN_DECLINED });
    expect(backend.signatures()).toBeNull();
    expect(backend.calls.filter((c) => c.method === 'DELETE').map((c) => c.path))
      .toEqual([`/v1/sends/${CREATE_1}`]);
  });

  // The backend quotes the fee the creation pays, and the request names it too: only the app's
  // own cap, pinned for the network, says no.
  it('holds the fee to the app\'s own cap, whatever the backend quotes and the request names', async () => {
    const backend = fakeBackend();
    const cap = String(BigInt(CASE.fee) - 1n);
    client = await connected(backend, memoryStorage(), { ...CONFIG, maxSendFee: cap }, clock);
    const approveSigning = jest.fn(async () => true);
    await expect(create({ approveSigning }))
      .rejects.toMatchObject({ code: NEXT_CLIENT_ERROR.TOKEN_REFUSED });
    expect(refusals()).toEqual(['The fee is not the one the user agreed to.']);
    expect(approveSigning).not.toHaveBeenCalled();
    expect(backend.signatures()).toBeNull();
    expect(createCalls(backend)[0].data.max_fee).toBe(cap);
  });

  it('holds the fee to the backend\'s quote, which the user saw', async () => {
    const backend = fakeBackend({ sendFee: String(BigInt(CASE.fee) - 1n) });
    client = await connected(backend, memoryStorage(), CONFIG, clock);
    await expect(create()).rejects.toMatchObject({ code: NEXT_CLIENT_ERROR.TOKEN_REFUSED });
    expect(refusals()).toEqual(['The fee is not the one the user agreed to.']);
    expect(backend.signatures()).toBeNull();
  });

  // Already past its time when the backend hands it over: refused by its checks, before the user
  // is asked anything.
  it('refuses a creation that expired before it reached the app', async () => {
    const backend = fakeBackend({ request: { ...signRequest(), expires_at: NOW - 1 } });
    client = await connected(backend, memoryStorage(), CONFIG, clock);
    const approveSigning = jest.fn(async () => true);
    await expect(create({ approveSigning }))
      .rejects.toMatchObject({ code: NEXT_CLIENT_ERROR.TOKEN_REFUSED });
    expect(refusals()).toEqual(['The token creation expired before it was signed.']);
    expect(approveSigning).not.toHaveBeenCalled();
    expect(backend.signatures()).toBeNull();
  });

  it.each([
    ['no symbol', { symbol: '' }],
    ['no name', { name: '' }],
    ['a symbol over 16 bytes', { symbol: 'S'.repeat(17) }],
    ['a symbol of 16 letters that are 17 bytes', { symbol: `${'S'.repeat(15)}é` }],
    ['a name over 64 bytes', { name: 'N'.repeat(65) }],
    ['no supply', { amount: 0n }],
    ['a supply below zero', { amount: -1n }],
  ])('reads no registry and asks no backend for a creation with %s', async (label, patch) => {
    const backend = fakeBackend();
    client = await connected(backend, memoryStorage(), CONFIG, clock);
    await expect(create(patch))
      .rejects.toMatchObject({ code: NEXT_CLIENT_ERROR.TOKEN_PREPARE_FAILED });
    expect(registryReads(backend)).toEqual([]);
    expect(createCalls(backend)).toEqual([]);
  });

  it('asks for a symbol of exactly 16 bytes and a name of exactly 64', async () => {
    const backend = fakeBackend();
    client = await connected(backend, memoryStorage(), CONFIG, clock);
    // The vector's creation is another token: it is asked for, then refused by its checks.
    await expect(create({ symbol: 'S'.repeat(16), name: 'N'.repeat(64) }))
      .rejects.toMatchObject({ code: NEXT_CLIENT_ERROR.TOKEN_REFUSED });
    expect(createCalls(backend)).toHaveLength(1);
    expect(refusals()).toEqual(['The token is not the one the user approved.']);
  });

  it('reads no registry and asks no backend for a creation whose fee the balance can\'t pay', async () => {
    const backend = fakeBackend({ balance: String(BigInt(CASE.fee) - 1n) });
    client = await connected(backend, memoryStorage(), CONFIG, clock);
    await expect(create()).rejects.toMatchObject({ code: NEXT_CLIENT_ERROR.INSUFFICIENT_FUNDS });
    expect(registryReads(backend)).toEqual([]);
    expect(createCalls(backend)).toEqual([]);
  });

  it('reads no registry and asks no backend while the app is locked', async () => {
    const backend = fakeBackend();
    client = await connected(backend, memoryStorage(), CONFIG, clock);
    client.forgetKeys();
    await expect(create()).rejects.toMatchObject({ code: NEXT_CLIENT_ERROR.NO_KEYS });
    expect(registryReads(backend)).toEqual([]);
    expect(createCalls(backend)).toEqual([]);
  });

  // The storage, whose first write of the nonces runs `during` before it ends.
  const reserving = (during) => {
    const storage = memoryStorage();
    let first = true;
    return {
      ...storage,
      setItemAsync: async (key, value) => {
        await storage.setItemAsync(key, value);
        if (first && key.startsWith(STORAGE_KEY_PREFIX)) {
          first = false;
          during();
        }
      },
    };
  };

  it.each([
    ['leaves Hathor Next', () => client.disconnect(), NEXT_CLIENT_ERROR.NOT_CONNECTED],
    ['locks', () => client.forgetKeys(), NEXT_CLIENT_ERROR.NO_KEYS],
  ])('asks no backend, and gives the nonce back, when the app %s as the nonce is reserved', async (name, during, code) => {
    const backend = fakeBackend();
    const storage = reserving(() => during());
    client = await connected(backend, storage, CONFIG, clock);
    await expect(create()).rejects.toMatchObject({ code });
    expect(createCalls(backend)).toEqual([]);
    expect(nonceRecord(storage).reserved).toEqual([]);
    expect(backend.signatures()).toBeNull();
  });
});
