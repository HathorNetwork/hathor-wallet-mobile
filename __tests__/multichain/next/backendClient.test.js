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
import { createBackendNextClient, rowsOfLine } from '../../../src/multichain/next/backendClient';
import { NEXT_CLIENT_ERROR, NEXT_CLIENT_EVENT } from '../../../src/multichain/nextClientErrors';
import { encodeAddress } from '../../../src/multichain/next/kit/address';
import {
  deriveAccount,
  mnemonicToSeed,
  publicKeyOf,
  walletIdOf,
} from '../../../src/multichain/next/kit/keys';
import {
  bigintToBytesLE,
  bytesToHex,
  hexToBytes,
} from '../../../src/multichain/next/kit/scalar';
import {
  authSecret,
  keysMessage,
  loginMessage,
  readSecret,
  schnorrVerify,
} from '../../../src/multichain/next/kit/walletAuth';

const WORDS = derivation.mnemonic;
const SERVICE_VIEW_PUB = derivation.vectors[0].pub_a;
const NATIVE = 'aa'.repeat(32);
const OTHER_TOKEN = 'bb'.repeat(32);

const CONFIG = {
  backendUrl: 'http://backend.test/',
  nextNetworkId: 1777,
  nativeTokenId: NATIVE,
  nativeTokenSymbol: 'USDT',
  nativeTokenName: 'Tether USD',
  serviceViewPub: SERVICE_VIEW_PUB,
  wireFormat: 'v2',
  maxSendFee: '10000000',
};

const REMOTE_CONFIG = {
  contract: 1,
  hathor: { network: 'privatenet' },
  next: {
    network_id: 1777,
    native_token: NATIVE,
    service_view_pub: SERVICE_VIEW_PUB,
    wire_format: 'v2',
    amount_width: 'u64',
    genesis_ms: 1000000,
    epoch_ms: 500,
  },
  transfer: null,
};

const HISTORY = [
  {
    cursor: '0:00:aa',
    epoch: 0,
    tx_id: '00'.repeat(32),
    direction: 'in',
    token: NATIVE,
    credited: '1000000000',
    debited: '0',
  },
  {
    cursor: '57:5e:aa',
    epoch: 57,
    tx_id: '5e'.repeat(32),
    direction: 'internal',
    kind: 'transfer',
    token: NATIVE,
    credited: '899000000',
    debited: '1000000000',
    fee: '1000000',
  },
  {
    cursor: '60:61:bb',
    epoch: 60,
    tx_id: '61'.repeat(32),
    direction: 'in',
    kind: 'transfer',
    token: OTHER_TOKEN,
    credited: '42',
    debited: '0',
  },
];

/**
 * A backend that checks what the client signs, as the real one's wallet service does.
 */
function fakeBackend({
  remote = REMOTE_CONFIG,
  registerAs = null,
  expireOnce = false,
  balances = null,
  history = null,
  tokens = null,
  loginError = null,
} = {}) {
  const requests = [];
  const registered = {};
  let tokenCount = 0;
  let expired = !expireOnce;
  const json = (status, body) => ({
    ok: status >= 200 && status < 300,
    status,
    text: async () => JSON.stringify(body),
  });
  const fetchImpl = async (url, { method, headers, body }) => {
    const path = url.replace('http://backend.test', '');
    requests.push({ method, path, headers, body });
    const data = body ? JSON.parse(body) : null;
    if (method === 'GET' && path === '/v1/config') return json(200, remote);
    if (method === 'GET' && path.split('?')[0] === '/v1/tokens') {
      if (tokens) return json(200, tokens(new URLSearchParams(path.split('?')[1] ?? '')));
      return json(200, { tokens: [{ token_id: OTHER_TOKEN, symbol: 'TKN', name: 'Token' }] });
    }
    if (method === 'POST' && path === '/v1/wallets') {
      const message = keysMessage(
        hexToBytes(data.pub_b),
        hexToBytes(data.auth_pub),
        hexToBytes(data.read_pub),
        data.ts,
      );
      if (!schnorrVerify(hexToBytes(data.pub_b), message, hexToBytes(data.sig_b))
        || !schnorrVerify(hexToBytes(data.auth_pub), message, hexToBytes(data.sig_auth))) {
        return json(400, { error: 'bad signature' });
      }
      const pubB = registerAs ?? data.pub_b;
      const walletId = bytesToHex(walletIdOf(hexToBytes(SERVICE_VIEW_PUB), hexToBytes(pubB)));
      registered[walletId] = { full: data.auth_pub, read: data.read_pub };
      return json(200, {
        wallet_id: walletId,
        pub_a: SERVICE_VIEW_PUB,
        address: encodeAddress(SERVICE_VIEW_PUB, pubB),
        birthday: data.birthday ?? 5,
        balance_sweep: false,
        scanned_from_epoch: 0,
      });
    }
    const session = path.match(/^\/v1\/wallets\/([0-9a-f]{64})\/session$/);
    if (method === 'POST' && session && loginError) return json(401, { error: loginError });
    if (method === 'POST' && session) {
      const authPub = registered[session[1]]?.[data.scope];
      const message = loginMessage(hexToBytes(session[1]), data.scope, data.ts);
      if (!authPub || !schnorrVerify(hexToBytes(authPub), message, hexToBytes(data.sig))) {
        return json(401, { error: 'bad login' });
      }
      tokenCount += 1;
      return json(200, { token: `token-${tokenCount}`, scope: data.scope, expires_at: 4000000000 });
    }
    if (!headers.authorization) return json(401, { error: 'no session' });
    if (path.endsWith('/balance')) {
      if (!expired) {
        expired = true;
        return json(401, { error: 'session expired' });
      }
      return json(200, {
        balance_state: 'live',
        balances: balances ?? [
          { token: NATIVE, tracked: '899000000', referenceable: '899000000' },
          { token: OTHER_TOKEN, tracked: '42', referenceable: '42' },
        ],
      });
    }
    if (path.includes('/history')) {
      if (history) return json(200, history(new URLSearchParams(path.split('?')[1] ?? '')));
      return json(200, { history: HISTORY });
    }
    return json(404, { error: 'not found' });
  };
  return { fetchImpl, requests };
}

async function connectedClient(backend) {
  const client = createBackendNextClient({ fetchImpl: backend.fetchImpl, WebSocketImpl: null });
  await client.prepareKeys({ words: WORDS });
  await client.connect({ network: 'privatenet', config: CONFIG, birthday: 'genesis' });
  return client;
}

describe('the Hathor Next backend client', () => {
  let client = null;
  afterEach(() => {
    client?.disconnect();
    client = null;
  });

  it('registers, logs in with its own signatures and reads the wallet', async () => {
    const backend = fakeBackend();
    client = await connectedClient(backend);

    const seed = await mnemonicToSeed(WORDS);
    const pubB = bytesToHex(publicKeyOf(deriveAccount(seed).b));
    expect(client.getAddress()).toBe(encodeAddress(SERVICE_VIEW_PUB, pubB));
    expect(client.isOnline()).toBe(true);
    const registration = backend.requests.find((r) => r.path === '/v1/wallets');
    expect(JSON.parse(registration.body).birthday).toBe(0);

    expect(client.getBalances()).toEqual({
      sweeping: false,
      balances: { [NATIVE]: { available: 899000000n }, [OTHER_TOKEN]: { available: 42n } },
    });
    const tokens = client.getTokens();
    expect(tokens.find((t) => t.id === NATIVE)).toMatchObject({ symbol: 'USDT', name: 'Tether USD' });
    expect(tokens.find((t) => t.id === OTHER_TOKEN)).toMatchObject({ symbol: 'TKN' });

    const { rows } = client.getHistory(NATIVE);
    expect(rows.map((r) => [r.kind, r.direction, r.amount])).toEqual([
      ['payment', 'out', '100000000'],
      ['fee', 'out', '1000000'],
      ['payment', 'in', '1000000000'],
    ]);
    expect(rows[0].at).toBe(1000000 + 57 * 500);
  });

  it('sends no secret to the backend', async () => {
    const backend = fakeBackend();
    client = await connectedClient(backend);

    const seed = await mnemonicToSeed(WORDS);
    const { a, b } = deriveAccount(seed);
    const auth = authSecret(b);
    const secrets = [a, b, auth, readSecret(auth)].map((x) => bytesToHex(bigintToBytesLE(x)));
    secrets.push(bytesToHex(seed));
    const everything = backend.requests.map((r) => `${r.path} ${r.body ?? ''}`).join('\n');
    for (const secret of secrets) {
      expect(everything).not.toContain(secret);
    }
    for (const word of WORDS.split(' ')) {
      expect(everything).not.toContain(` ${word} `);
    }
  });

  it('keeps no keys from a derivation the app locked during', async () => {
    client = createBackendNextClient({ fetchImpl: fakeBackend().fetchImpl, WebSocketImpl: null });
    const deriving = client.prepareKeys({ words: WORDS });
    // The lock lands while the words become a seed, before any key exists.
    expect(client.forgetKeys()).toBe(false);
    await expect(deriving).rejects.toMatchObject({ code: NEXT_CLIENT_ERROR.NO_KEYS });
    expect(client.hasKeys()).toBe(false);
    // The next unlock derives them as usual.
    await client.prepareKeys({ words: WORDS });
    expect(client.hasKeys()).toBe(true);
  });

  it('refuses a backend on another network before registering', async () => {
    const backend = fakeBackend({
      remote: { ...REMOTE_CONFIG, next: { ...REMOTE_CONFIG.next, service_view_pub: 'cc'.repeat(32) } },
    });
    client = createBackendNextClient({ fetchImpl: backend.fetchImpl, WebSocketImpl: null });
    await client.prepareKeys({ words: WORDS });
    await expect(client.connect({ network: 'privatenet', config: CONFIG, birthday: 'genesis' }))
      .rejects.toMatchObject({ code: NEXT_CLIENT_ERROR.NETWORK_CHANGED });
    expect(backend.requests.map((r) => r.path)).toEqual(['/v1/config']);
  });

  it('refuses a network with no fee ceiling of the app\'s own, before registering', async () => {
    const backend = fakeBackend();
    client = createBackendNextClient({ fetchImpl: backend.fetchImpl, WebSocketImpl: null });
    await client.prepareKeys({ words: WORDS });
    const noCeiling = { ...CONFIG };
    delete noCeiling.maxSendFee;
    await expect(client.connect({ network: 'privatenet', config: noCeiling, birthday: 'genesis' }))
      .rejects.toMatchObject({ code: NEXT_CLIENT_ERROR.CONNECT_FAILED });
    expect(backend.requests.map((r) => r.path)).toEqual(['/v1/config']);
  });

  it('refuses a backend that registers another wallet', async () => {
    const backend = fakeBackend({ registerAs: derivation.vectors[1].pub_b });
    client = createBackendNextClient({ fetchImpl: backend.fetchImpl, WebSocketImpl: null });
    await client.prepareKeys({ words: WORDS });
    await expect(client.connect({ network: 'privatenet', config: CONFIG, birthday: 'genesis' }))
      .rejects.toMatchObject({ code: NEXT_CLIENT_ERROR.CONNECT_FAILED });
    expect(backend.requests.some((r) => r.path.endsWith('/session'))).toBe(false);
  });

  it('logs in again once when the session expired', async () => {
    const backend = fakeBackend({ expireOnce: true });
    client = await connectedClient(backend);
    // A full session, a read session for the feed, and the full one again once it expired.
    expect(backend.requests.filter((r) => r.path.endsWith('/session'))).toHaveLength(3);
    expect(client.getBalances().balances[NATIVE].available).toBe(899000000n);
  });

  it('needs keys to connect', async () => {
    client = createBackendNextClient({ fetchImpl: fakeBackend().fetchImpl, WebSocketImpl: null });
    await expect(client.connect({ network: 'privatenet', config: CONFIG }))
      .rejects.toMatchObject({ code: NEXT_CLIENT_ERROR.NO_KEYS });
  });
});

describe('statement lines as history rows', () => {
  const timing = { genesisMs: 0, epochMs: 1000 };

  it('shows a receipt as one incoming row', () => {
    expect(rowsOfLine(HISTORY[0], timing, null, NATIVE)).toMatchObject([
      { direction: 'in', kind: 'payment', amount: '1000000000', at: 0 },
    ]);
  });

  it('shows a payment as what was paid and, apart, the fee', () => {
    expect(rowsOfLine(HISTORY[1], timing, { peer: 'samba1zxyz' }, NATIVE)).toMatchObject([
      { direction: 'out', kind: 'payment', amount: '100000000', peer: 'samba1zxyz' },
      { direction: 'out', kind: 'fee', amount: '1000000' },
    ]);
  });

  it('shows a mint as an incoming mint', () => {
    expect(rowsOfLine({ ...HISTORY[0], kind: 'mint' }, timing, null, NATIVE)).toMatchObject([
      { direction: 'in', kind: 'mint' },
    ]);
  });

  // Both lines of one payment of 10.00 of another token: each carries the transaction's fee.
  const tokenPayment = {
    cursor: '70:7a:cc',
    epoch: 70,
    tx_id: '7a'.repeat(32),
    direction: 'internal',
    kind: 'transfer',
    credited: '15000000000',
    debited: '25000000000',
    token: OTHER_TOKEN,
    fee: '5000000',
  };

  it('shows a payment in another token as its whole amount, with no fee', () => {
    expect(rowsOfLine(tokenPayment, timing, { peer: 'samba1zxyz' }, NATIVE)).toEqual([
      expect.objectContaining({
        direction: 'out', kind: 'payment', amount: '10000000000', tokenId: OTHER_TOKEN,
      }),
    ]);
  });

  it("shows that payment's fee on the native token's line, alone", () => {
    const nativeLine = {
      ...tokenPayment,
      cursor: '70:7a:aa',
      token: NATIVE,
      credited: '435000000',
      debited: '440000000',
    };
    expect(rowsOfLine(nativeLine, timing, null, NATIVE)).toEqual([
      expect.objectContaining({ direction: 'out', kind: 'fee', amount: '5000000', tokenId: NATIVE }),
    ]);
  });
});

describe('losing the backend', () => {
  it('goes offline when the backend can\'t be reached, and back online when it can', async () => {
    jest.useFakeTimers();
    const backend = fakeBackend();
    let down = false;
    const fetchImpl = async (...args) => {
      if (down) throw new Error('connection refused');
      return backend.fetchImpl(...args);
    };
    const client = createBackendNextClient({ fetchImpl, WebSocketImpl: null });
    const events = [];
    client.on(NEXT_CLIENT_EVENT.CONNECTION, (e) => events.push(e.online));
    try {
      await client.prepareKeys({ words: WORDS });
      await client.connect({ network: 'privatenet', config: CONFIG, birthday: 'genesis' });
      expect(client.isOnline()).toBe(true);
      down = true;
      await jest.advanceTimersByTimeAsync(31000);
      expect(client.isOnline()).toBe(false);
      down = false;
      await jest.advanceTimersByTimeAsync(31000);
      expect(client.isOnline()).toBe(true);
      expect(events).toEqual([false, true]);
    } finally {
      client.disconnect();
      jest.useRealTimers();
    }
  });

  it('stays online while the backend refuses its feed, as the reads still reach it', async () => {
    jest.useFakeTimers();
    const backend = fakeBackend();
    let feeds = 0;
    // What a wallet with all its feeds taken gets: the upgrade is refused, so the socket closes.
    class RefusedSocket {
      constructor() {
        feeds += 1;
        setTimeout(() => {
          this.onerror?.();
          this.onclose?.();
        }, 0);
      }

      close() {}
    }
    const client = createBackendNextClient({
      fetchImpl: backend.fetchImpl,
      WebSocketImpl: RefusedSocket,
    });
    const events = [];
    client.on(NEXT_CLIENT_EVENT.CONNECTION, (e) => events.push(e.online));
    try {
      await client.prepareKeys({ words: WORDS });
      await client.connect({ network: 'privatenet', config: CONFIG, birthday: 'genesis' });
      await jest.advanceTimersByTimeAsync(65000);
      expect(feeds).toBeGreaterThan(3);
      expect(client.isOnline()).toBe(true);
      expect(events).toEqual([]);
    } finally {
      client.disconnect();
      jest.useRealTimers();
    }
  });

  it('goes offline once a dropped feed finds the backend gone, before the next read', async () => {
    jest.useFakeTimers();
    const backend = fakeBackend();
    let down = false;
    const fetchImpl = async (...args) => {
      if (down) throw new Error('connection refused');
      return backend.fetchImpl(...args);
    };
    const sockets = [];
    // Opens while the backend is up; refused while it is down.
    class Socket {
      constructor() {
        sockets.push(this);
        setTimeout(() => (down ? this.onclose?.() : this.onopen?.()), 0);
      }

      close() {}
    }
    const client = createBackendNextClient({ fetchImpl, WebSocketImpl: Socket });
    const events = [];
    client.on(NEXT_CLIENT_EVENT.CONNECTION, (e) => events.push(e.online));
    try {
      await client.prepareKeys({ words: WORDS });
      await client.connect({ network: 'privatenet', config: CONFIG, birthday: 'genesis' });
      await jest.advanceTimersByTimeAsync(0);
      down = true;
      sockets[0].onclose();
      await jest.advanceTimersByTimeAsync(1500);
      expect(client.isOnline()).toBe(false);
      down = false;
      await jest.advanceTimersByTimeAsync(5000);
      expect(client.isOnline()).toBe(true);
      expect(events).toEqual([false, true]);
    } finally {
      client.disconnect();
      jest.useRealTimers();
    }
  });
});

describe('what the backend answers, read with care', () => {
  let client = null;
  afterEach(() => {
    client?.disconnect();
    client = null;
    jest.useRealTimers();
  });

  it('leaves out a balance it can\'t read, and still connects', async () => {
    client = await connectedClient(fakeBackend({
      balances: [
        { token: NATIVE, referenceable: '899000000' },
        { token: OTHER_TOKEN, referenceable: 'not a number' },
        { token: 'ab'.repeat(32), referenceable: '-5' },
      ],
    }));
    expect(client.getBalances().balances).toEqual({ [NATIVE]: { available: 899000000n } });
  });

  it('reads at most so many statement pages, whatever the backend says comes next', async () => {
    let pages = 0;
    const backend = fakeBackend({
      history: () => {
        pages += 1;
        return { history: [], next: `cursor-${pages}` };
      },
    });
    client = await connectedClient(backend);
    expect(pages).toBeLessThanOrEqual(50);
  });

  it('reads the registry on until every token the wallet holds is named', async () => {
    const backend = fakeBackend({
      tokens: (query) => (query.get('from')
        ? { tokens: [{ token_id: OTHER_TOKEN, symbol: 'TKN', name: 'Token' }] }
        : { tokens: [{ token_id: 'ef'.repeat(32), symbol: 'X', name: 'X' }], next: 'page-2' }),
    });
    client = await connectedClient(backend);
    expect(client.getTokens().find((token) => token.id === OTHER_TOKEN))
      .toMatchObject({ name: 'Token', symbol: 'TKN' });
  });

  it("shows a token's name and symbol safe: no control characters, within the caps", async () => {
    const backend = fakeBackend({
      tokens: () => ({
        tokens: [{
          token_id: OTHER_TOKEN,
          symbol: 'H\u202eTR\u0007',
          name: `Hathor\n${'x'.repeat(100)}`,
        }],
      }),
    });
    client = await connectedClient(backend);
    const token = client.getTokens().find((t) => t.id === OTHER_TOKEN);
    expect(token.symbol).toBe('HTR');
    expect(new TextEncoder().encode(token.name).length).toBeLessThanOrEqual(64);
    expect(token.name).not.toMatch(/\n/);
  });

  it("says the phone's clock is off when the wallet service refuses the login for its time", async () => {
    const backend = fakeBackend({
      loginError: 'auth-timestamp-shift: the timestamp is shifted 300 s from this server\'s clock',
    });
    client = createBackendNextClient({ fetchImpl: backend.fetchImpl, WebSocketImpl: null });
    await client.prepareKeys({ words: WORDS });
    await expect(client.connect({ network: 'privatenet', config: CONFIG, birthday: 'genesis' }))
      .rejects.toMatchObject({ code: NEXT_CLIENT_ERROR.CLOCK });
  });

  it('leaves out a statement line it can\'t read, and reads an empty answer as no lines', async () => {
    client = await connectedClient(fakeBackend({
      history: () => ({ history: [null, 7, { cursor: 'x' }, ...HISTORY] }),
    }));
    expect(client.getHistory(NATIVE).rows.length).toBeGreaterThan(0);
    client.disconnect();
    client = await connectedClient(fakeBackend({ history: () => null }));
    expect(client.getHistory(NATIVE).rows).toEqual([]);
  });

  it('refuses a backend whose genesis or amounts\' width differ from the pinned ones', async () => {
    const backend = fakeBackend();
    client = createBackendNextClient({ fetchImpl: backend.fetchImpl, WebSocketImpl: null });
    await client.prepareKeys({ words: WORDS });
    const connect = (config) => client.connect({ network: 'privatenet', config, birthday: 'genesis' });
    await expect(connect({ ...CONFIG, genesisMs: 1000001 }))
      .rejects.toMatchObject({ code: NEXT_CLIENT_ERROR.NETWORK_CHANGED });
    await expect(connect({ ...CONFIG, amountWidth: 'u128' }))
      .rejects.toMatchObject({ code: NEXT_CLIENT_ERROR.NETWORK_CHANGED });
    await expect(connect({ ...CONFIG, genesisMs: 1000000, amountWidth: 'u64' })).resolves
      .toBeUndefined();
  });

  it('never takes the session of a login that a disconnect overtook to the next backend', async () => {
    const a = fakeBackend();
    const b = fakeBackend();
    let releaseLogin;
    const loginHeld = new Promise((resolve) => { releaseLogin = resolve; });
    let loginAsked;
    const loginStarted = new Promise((resolve) => { loginAsked = resolve; });
    const fetchImpl = async (url, options) => {
      if (url.startsWith('http://a.test')) {
        const answer = await a.fetchImpl(url.replace('http://a.test', 'http://backend.test'), options);
        if (!/\/session$/.test(url)) return answer;
        loginAsked();
        await loginHeld;
        const body = JSON.parse(await answer.text());
        return { ...answer, text: async () => JSON.stringify({ ...body, token: `a-${body.token}` }) };
      }
      return b.fetchImpl(url, options);
    };
    client = createBackendNextClient({ fetchImpl, WebSocketImpl: null });
    await client.prepareKeys({ words: WORDS });
    const toA = client.connect({
      network: 'privatenet', config: { ...CONFIG, backendUrl: 'http://a.test/' }, birthday: 'genesis',
    });
    await loginStarted;
    client.disconnect();
    await client.connect({ network: 'privatenet', config: CONFIG, birthday: 'genesis' });
    releaseLogin();
    await expect(toA).rejects.toMatchObject({ code: NEXT_CLIENT_ERROR.NOT_CONNECTED });
    await client.getTransfer('t-1').catch(() => {});
    const asked = b.requests.filter((r) => r.path.startsWith('/v1/transfers'));
    expect(asked).toHaveLength(1);
    expect(JSON.stringify(asked[0].headers)).not.toContain('a-token');
  });

  it('stops a connect that a disconnect overtook, before its next request', async () => {
    const backend = fakeBackend();
    let release;
    const slowConfig = new Promise((resolve) => { release = resolve; });
    const fetchImpl = async (url, options) => {
      if (url.endsWith('/v1/config')) await slowConfig;
      return backend.fetchImpl(url, options);
    };
    client = createBackendNextClient({ fetchImpl, WebSocketImpl: null });
    await client.prepareKeys({ words: WORDS });
    const connecting = client.connect({ network: 'privatenet', config: CONFIG, birthday: 'genesis' });
    client.disconnect();
    release();
    await expect(connecting).rejects.toMatchObject({ code: NEXT_CLIENT_ERROR.NOT_CONNECTED });
    expect(backend.requests.map((r) => r.path)).toEqual(['/v1/config']);
  });

  it('takes a feed frame of null for nothing', async () => {
    const sockets = [];
    class Socket {
      constructor() { sockets.push(this); }

      close() {}
    }
    client = createBackendNextClient({ fetchImpl: fakeBackend().fetchImpl, WebSocketImpl: Socket });
    await client.prepareKeys({ words: WORDS });
    await client.connect({ network: 'privatenet', config: CONFIG, birthday: 'genesis' });
    expect(() => sockets[0].onmessage({ data: 'null' })).not.toThrow();
  });

  it('reconnects a feed ended as soon as it opens ever more slowly', async () => {
    jest.useFakeTimers();
    const sockets = [];
    class Socket {
      constructor() {
        sockets.push(this);
        setTimeout(() => {
          this.onopen?.();
          this.onclose?.();
        }, 0);
      }

      close() {}
    }
    client = createBackendNextClient({ fetchImpl: fakeBackend().fetchImpl, WebSocketImpl: Socket });
    await client.prepareKeys({ words: WORDS });
    await client.connect({ network: 'privatenet', config: CONFIG, birthday: 'genesis' });
    await jest.advanceTimersByTimeAsync(120000);
    // 1 s, 2 s, 4 s… up to 30 s apart: a dozen sockets in two minutes, not one a second.
    expect(sockets.length).toBeLessThan(20);
  });
});
