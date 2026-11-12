/**
 * Copyright (c) Hathor Labs and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { afterEach, describe, it, expect } from '@jest/globals';
import derivation from './fixtures/derivation.json';
import vectors from './fixtures/remote-issuance.json';
import { createBackendNextClient } from '../../../src/multichain/next/backendClient';
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
  id: 'create-1',
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

function fakeBackend({
  issuance = true,
  registry = [],
  // The registry once the creation is recorded, when it differs.
  registryAfter = null,
  createStatus = 200,
  request = signRequest(),
  onRegistry = null,
} = {}) {
  const calls = [];
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
          wire_format: 'v3',
          genesis_ms: 0,
          epoch_ms: 500,
          send_fee: CASE.fee,
        },
        issuance,
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
      return json(200, {
        balance_state: 'live',
        balances: [{ token: NATIVE, referenceable: '10000000' }],
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
    if (path === '/v1/sends/create-1/signatures') {
      ({ signatures } = data);
      return json(200, { id: 'create-1', tx_id: CASE.tx_id, status: 'submitted' });
    }
    if (path === '/v1/sends/create-1' && method === 'GET') {
      return json(200, { id: 'create-1', status: signatures ? 'recorded' : 'awaiting_signatures' });
    }
    if (method === 'DELETE') return json(200, {});
    return json(404, { error: 'not found' });
  };
  return { fetchImpl, calls, signatures: () => signatures };
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
    expect(sendId).toBe('create-1');
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
    await expect(recorded).resolves.toMatchObject({ sendId: 'create-1', status: 'recorded' });
    expect(client.getCreation('create-1')).toMatchObject({ status: 'recorded', txId: tokenId });
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
    for (const word of derivation.mnemonic.split(' ')) {
      expect(everything).not.toContain(` ${word} `);
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
    expect(backend.calls.some((c) => c.method === 'DELETE' && c.path === '/v1/sends/create-1'))
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
    expect(backend.calls.some((c) => c.method === 'DELETE' && c.path === '/v1/sends/create-1'))
      .toBe(true);
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

  it('names the token the registry lists with this wallet\'s keys, once recorded', async () => {
    const recordedId = 'cd'.repeat(32);
    const backend = fakeBackend({
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
    await expect(named).resolves.toMatchObject({ sendId: 'create-1', status: 'recorded' });
    expect(client.getCreation('create-1').txId).toBe(recordedId);
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
