/**
 * Copyright (c) Hathor Labs and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { randomBytes, utf8ToBytes } from '@noble/hashes/utils';
import { logger } from '../../logger';
import { STORE } from '../../store';
import { NEXT_CLIENT_ERROR, NEXT_CLIENT_EVENT, NextClientError } from '../nextClientErrors';
import { BackendError, createBackendApi } from './backendApi';
import { encodeAddress } from './kit/address';
import {
  AUTHORITY_GAP,
  AuthoritiesWithheldError,
  NonceBeyondReachError,
  RegistryUnreadableError,
  deriveAuthority,
  scanAuthorities,
} from './kit/authority';
import {
  HATHOR_NEXT_ACCOUNT_INDEX,
  deriveAccount,
  mnemonicToSeed,
  publicKeyOf,
  walletIdOf,
} from './kit/keys';
import { bytesToHex, hexToBytes } from './kit/scalar';
import {
  LedgerConflictError,
  SignRefusedError,
  checkCreateRequest,
  createSignLedger,
  verifyAndSign,
} from './signer';
import { createNonceStore } from './tokenNonces';
import {
  SCOPE,
  authSecret,
  keysMessage,
  loginMessage,
  readSecret,
  schnorrSign,
} from './kit/walletAuth';

const log = logger('next-backend-client');

const HISTORY_PAGE_SIZE = 20;
const HISTORY_FETCH_LIMIT = 500;
// The balance and history are read again this often, and at once when the feed announces a line.
const REFRESH_INTERVAL_MS = 30000;
const FEED_RETRY_MIN_MS = 1000;
const FEED_RETRY_MAX_MS = 30000;
// A session is renewed this long before it expires.
const SESSION_RENEW_MARGIN_S = 120;
// A payment's status is read this often until it is recorded or failed.
const SEND_POLL_MS = 2000;
// How many earlier payments a payment may find rejected, and free, before it gives up.
const MAX_LEDGER_ROUNDS = 4;
// The token registry is read a page at a time, up to this many pages, for a creation's nonce.
const REGISTRY_PAGE = 1000;
const REGISTRY_MAX_PAGES = 100;
// The longest symbol and name a creation may ask for, in bytes: the protocol's own caps.
const MAX_SYMBOL_BYTES = 16;
const MAX_NAME_BYTES = 64;
const SEND_STATUS = {
  submitted: 'pending',
  awaiting_signatures: 'pending',
  recorded: 'recorded',
  failed: 'failed',
  expired: 'failed',
  // The network refused it by name: failed, and its inputs are free again.
  rejected: 'failed',
};

/**
 * Whether the backend's pinned values are the ones this app was built with. The backend is
 * trusted to build transactions only for the network the app expects: a backend on any other
 * network is refused before anything is signed.
 *
 * @param {Object} config The side chain config
 * @param {Object} remote GET /v1/config
 * @returns {string|null} The first value that differs, or null
 */
export function pinMismatch(config, remote) {
  const next = remote?.next ?? {};
  const pins = [
    ['network_id', config.nextNetworkId, next.network_id],
    ['native_token', config.nativeTokenId, next.native_token],
    ['service_view_pub', config.serviceViewPub, next.service_view_pub],
    ['wire_format', config.wireFormat, next.wire_format],
  ];
  const wrong = pins.find(([, mine, theirs]) => mine !== theirs);
  return wrong ? wrong[0] : null;
}

/**
 * The rows one statement line makes in a token's history. A line carries both sides of what
 * moved; a payment the wallet made shows as what it paid and, apart, the fee.
 *
 * A line carries its transaction's fee whatever its token, and the fee is always paid in the
 * native token: only the native token's line has it. A payment in another token shows its whole
 * amount there, and the fee shows on the native token's line, alone.
 *
 * @param {Object} line A statement line
 * @param {{ genesisMs: number, epochMs: number }} timing
 * @param {Object|null} sent What this app sent in the line's transaction: { peer }
 * @param {string} nativeTokenId The network's native token
 * @returns {Object[]}
 */
export function rowsOfLine(line, timing, sent, nativeTokenId) {
  const credited = BigInt(line.credited ?? '0');
  const debited = BigInt(line.debited ?? '0');
  const fee = line.token === nativeTokenId ? BigInt(line.fee ?? '0') : 0n;
  const net = credited - debited;
  const base = {
    txId: line.tx_id ?? null,
    tokenId: line.token,
    status: 'recorded',
    at: timing.genesisMs + line.epoch * timing.epochMs,
    reason: null,
    sendId: null,
    transferId: null,
    mode: 'private',
    cursor: line.cursor,
  };
  if (net >= 0n) {
    return [{
      ...base,
      id: line.cursor,
      direction: 'in',
      kind: line.kind === 'mint' ? 'mint' : 'payment',
      amount: net.toString(),
      peer: null,
    }];
  }
  const paid = -net - fee;
  const rows = [];
  if (paid > 0n) {
    rows.push({
      ...base,
      id: line.cursor,
      direction: 'out',
      kind: 'payment',
      amount: paid.toString(),
      peer: sent?.peer ?? null,
    });
  }
  if (fee > 0n) {
    rows.push({
      ...base,
      id: `${line.cursor}:fee`,
      direction: 'out',
      kind: 'fee',
      amount: fee.toString(),
      peer: null,
    });
  }
  return rows;
}

/**
 * What the user is told when the backend couldn't prepare a payment.
 *
 * @param {Error} e
 * @param {{ tokenId: string, nativeTokenId: string }} [payment] What the payment sends, and the
 *   network's native token
 * @param {string} [fallback] The error of a refusal no other one names: a payment's, or a token
 *   creation's
 * @returns {Error}
 */
export function prepareError(e, payment = null, fallback = NEXT_CLIENT_ERROR.PREPARE_FAILED) {
  if (e instanceof NextClientError || !(e instanceof BackendError)) {
    return e;
  }
  if (e.unreachable) {
    return new NextClientError(NEXT_CLIENT_ERROR.OFFLINE);
  }
  if (e.status === 409 && /sweep/i.test(e.message)) {
    return new NextClientError(NEXT_CLIENT_ERROR.SWEEPING);
  }
  // The wallet service's `amount-leak: token=<id>` refusal: funds that arrived in public (a
  // transfer's mint) paying exactly one hidden output of that token. Its text speaks of funding,
  // so it goes first. In a payment of another token, the native token's one hidden output is the
  // fee's change: no amount of the token sent changes that.
  if (e.status === 422 && /amount-leak:/.test(e.message)) {
    const leaked = /amount-leak: token=([0-9a-f]+)/i.exec(e.message)?.[1]?.toLowerCase();
    const feeChange = payment && payment.tokenId !== payment.nativeTokenId
      && leaked === payment.nativeTokenId;
    return new NextClientError(
      feeChange ? NEXT_CLIENT_ERROR.FEE_AMOUNT_VISIBLE : NEXT_CLIENT_ERROR.AMOUNT_VISIBLE,
    );
  }
  if (e.status === 422 && /insufficient|not enough|funds/i.test(e.message)) {
    return new NextClientError(NEXT_CLIENT_ERROR.INSUFFICIENT_FUNDS);
  }
  if (fallback === NEXT_CLIENT_ERROR.TOKEN_PREPARE_FAILED && [404, 501].includes(e.status)) {
    return new NextClientError(NEXT_CLIENT_ERROR.TOKENS_UNAVAILABLE);
  }
  log.error('The Hathor Next backend refused to prepare a payment.', e);
  return new NextClientError(fallback);
}

function compareCursorsDesc(a, b) {
  if (a === b) {
    return 0;
  }
  return a < b ? 1 : -1;
}

/**
 * The Hathor Next client backed by the Hathor Next backend: the backend reads the wallet service
 * and builds transactions, and this client keeps the keys and signs. The keys live in this
 * closure only, from the unlock that derived them to the app's end; nothing secret is stored or
 * sent. Its interface is the client's (see nextClient.js).
 *
 * @param {{ fetchImpl?: Function, WebSocketImpl?: Function, nowMs?: Function }} [deps]
 */
export function createBackendNextClient({
  fetchImpl,
  WebSocketImpl = globalThis.WebSocket ?? null,
  nowMs = () => Date.now(),
  storage = STORE,
  sendPollMs = SEND_POLL_MS,
} = {}) {
  let keys = null;
  // How many times the keys were dropped: a derivation that a lock overtook keeps nothing.
  let lockCount = 0;
  let api = null;
  let config = null;
  let network = null;
  let timing = { genesisMs: 0, epochMs: 0 };
  let walletId = null;
  let address = null;
  let session = null;
  let connected = false;
  let online = false;
  let sweeping = false;
  let generation = 0;
  let balances = {};
  const lines = new Map();
  let tail = null;
  let tokenMeta = {};
  let sendFee = 0n;
  let transferConfig = null;
  let feedSession = null;
  let ledger = null;
  // Whether the backend creates tokens, from GET /v1/config; and the creation nonces this device
  // handed out.
  let issuance = false;
  let nonces = null;
  // sendId → the token creations this app made, as `sends` holds payments.
  const creations = new Map();
  // sendId → { sendId, txId, to, amount, tokenId, status, reason, at }: the payments this app
  // made, shown until the statement records them.
  const sends = new Map();
  let socket = null;
  let feedDelay = FEED_RETRY_MIN_MS;
  const timers = new Set();
  const listeners = new Map(Object.values(NEXT_CLIENT_EVENT).map((e) => [e, new Set()]));

  const nowS = () => Math.floor(nowMs() / 1000);

  const emit = (event, payload) => {
    for (const listener of listeners.get(event)) {
      try {
        listener(payload);
      } catch (e) {
        log.error('A Hathor Next listener failed.', e);
      }
    }
  };

  const schedule = (fn, ms) => {
    const timer = setTimeout(() => {
      timers.delete(timer);
      fn();
    }, ms);
    timers.add(timer);
  };

  const setOnline = (value) => {
    if (online !== value) {
      online = value;
      emit(NEXT_CLIENT_EVENT.CONNECTION, { online });
    }
  };

  const requireConnected = () => {
    if (!connected) {
      throw new NextClientError(NEXT_CLIENT_ERROR.NOT_CONNECTED);
    }
  };

  // A session of `scope`, signed with the auth key (full) or the read key (read).
  async function openSession(scope) {
    if (!keys) {
      // Locked: the keys come back with the next unlock.
      throw new NextClientError(NEXT_CLIENT_ERROR.NO_KEYS);
    }
    const ts = nowS();
    const secret = scope === SCOPE.FULL ? keys.auth : keys.read;
    const sig = schnorrSign(secret, loginMessage(walletId, scope, ts));
    return api.login(bytesToHex(walletId), { ts, scope, sig: bytesToHex(sig) });
  }

  async function login() {
    session = await openSession(SCOPE.FULL);
  }

  // A call with the session, logging in again once when the session expired.
  async function withSession(call) {
    if (!session || session.expires_at - SESSION_RENEW_MARGIN_S <= nowS()) {
      await login();
    }
    try {
      return await call(session.token);
    } catch (e) {
      if (!e.unauthorized) {
        throw e;
      }
      await login();
      return call(session.token);
    }
  }

  async function refreshBalances() {
    const body = await withSession((token) => api.getBalance(bytesToHex(walletId), token));
    const next = {};
    for (const entry of body.balances ?? []) {
      next[entry.token] = { available: BigInt(entry.referenceable ?? '0') };
    }
    balances = next;
    const wasSweeping = sweeping;
    sweeping = body.balance_state === 'sweeping';
    emit(NEXT_CLIENT_EVENT.BALANCE, null);
    if (wasSweeping !== sweeping) {
      emit(NEXT_CLIENT_EVENT.SWEEP, { sweeping });
    }
  }

  // One page of the statement from the tail on. `since` is inclusive, so the tail line comes back
  // and is skipped.
  async function readHistoryPage(since) {
    const id = bytesToHex(walletId);
    const page = await withSession((token) => api.getHistory(
      id,
      token,
      { since: since ?? undefined, limit: HISTORY_FETCH_LIMIT },
    ));
    let added = 0;
    for (const line of page.history ?? []) {
      if (!lines.has(line.cursor)) {
        lines.set(line.cursor, line);
        added += 1;
      }
    }
    const last = page.history?.[page.history.length - 1];
    const more = Boolean(page.next) && page.next !== since;
    return { added, tail: more ? page.next : (last?.cursor ?? since), more };
  }

  async function refreshHistory() {
    let added = 0;
    let page = { more: true, tail };
    while (page.more) {
      // Pages depend on the previous page's end, so they are read one after the other.
      // eslint-disable-next-line no-await-in-loop
      page = await readHistoryPage(page.tail);
      added += page.added;
    }
    tail = page.tail;
    const recorded = new Set([...lines.values()].map((line) => line.tx_id));
    for (const send of sends.values()) {
      if (send.status !== 'recorded' && send.txId && recorded.has(send.txId)) {
        send.status = 'recorded';
        ledger?.markRecorded(send.txId).catch((e) => log.error('Could not save a recorded payment.', e));
        emit(NEXT_CLIENT_EVENT.SEND, {
          sendId: send.sendId, status: 'recorded', reason: null, txId: send.txId,
        });
      }
    }
    if (added > 0) {
      emit(NEXT_CLIENT_EVENT.HISTORY, null);
    }
  }

  async function refreshTokens() {
    const body = await api.getTokens();
    const meta = {};
    for (const token of body.tokens ?? []) {
      meta[token.token_id] = { name: token.name, symbol: token.symbol };
    }
    tokenMeta = meta;
  }

  // The whole token registry with each token's authority keys: what a creation's nonce scan reads.
  async function readRegistry() {
    const rows = [];
    let from;
    for (let page = 0; page < REGISTRY_MAX_PAGES; page += 1) {
      // Each page names the next one.
      // eslint-disable-next-line no-await-in-loop
      const body = await api.getTokens({ from, limit: REGISTRY_PAGE, authorities: true });
      // A page without its list is not an empty registry.
      if (!Array.isArray(body?.tokens)) {
        throw new RegistryUnreadableError();
      }
      rows.push(...body.tokens);
      if (!body.next || body.next === from) {
        return rows;
      }
      from = body.next;
    }
    throw new Error('The token registry is longer than this wallet reads.');
  }

  // Follows something the backend submitted for this app until it settles, saying so with SEND
  // events. Bytes the backend lost go to it again, identical. `entry` is the payment's or the
  // creation's own record, which this keeps up to date.
  /* eslint-disable no-param-reassign */
  function followSent(mine, entry, signed, onRecorded) {
    const tick = () => schedule(async () => {
      if (mine !== generation || entry.status === 'recorded' || entry.status === 'failed') return;
      try {
        const status = await withSession((token) => api.getSend(entry.sendId, token));
        const next = SEND_STATUS[status.status] ?? 'pending';
        if (status.status === 'rejected') {
          await ledger.markRejected(entry.txId, status.reason);
        }
        if (status.status === 'awaiting_signatures') {
          await withSession((token) => api.resubmitSend(entry.sendId, token, signed.signedTx));
        }
        if (next !== entry.status) {
          entry.status = next;
          entry.reason = status.reason ?? null;
          emit(NEXT_CLIENT_EVENT.SEND, {
            sendId: entry.sendId, status: next, reason: entry.reason, txId: entry.txId,
          });
          emit(NEXT_CLIENT_EVENT.HISTORY, null);
          if (next === 'recorded') {
            await onRecorded();
          }
        }
      } catch (e) {
        log.error('Could not read a Hathor Next payment.', e);
      }
      tick();
    }, sendPollMs);
    tick();
  }
  /* eslint-enable no-param-reassign */

  // The most a payment may cost: the backend's quote, never above the app's own cap.
  function maxFee() {
    const cap = BigInt(config.maxSendFee);
    return cap < sendFee ? cap : sendFee;
  }

  // Submits again the exact bytes a ledger entry saved. Failures are logged: the next connect
  // tries again.
  /**
   * Submits an entry's signed bytes again, unchanged, and settles the entry by what the backend
   * answers: recorded, or rejected (its inputs free again).
   *
   * @returns {Promise<Object|null>} The send's status, or null when the backend didn't answer
   */
  async function resubmit(entry) {
    let status;
    try {
      status = await withSession((token) => api.resubmitSend(entry.sendId, token, entry.signedTx));
    } catch (e) {
      log.error('Could not submit a signed Hathor Next payment again.', e);
      return null;
    }
    if (status?.status === 'rejected') {
      await ledger.markRejected(entry.txId, status.reason);
    } else if (status?.status === 'recorded') {
      await ledger.markRecorded(entry.txId);
    }
    return status;
  }

  /**
   * What the backend says of an entry's payment, settling the entry by it: recorded, or rejected
   * (its inputs free again). Nothing is submitted.
   *
   * @returns {Promise<Object|null>} The send's status, or null when the backend didn't answer
   */
  async function statusOf(entry) {
    let status;
    try {
      status = await withSession((token) => api.getSend(entry.sendId, token));
    } catch (e) {
      log.error('Could not read an earlier Hathor Next payment.', e);
      return null;
    }
    if (status?.status === 'rejected') {
      await ledger.markRejected(entry.txId, status.reason);
    } else if (status?.status === 'recorded') {
      await ledger.markRecorded(entry.txId);
    }
    return status;
  }

  // After a restart, what this app signed and the chain hasn't settled goes out again, byte for
  // byte: the backend may have lost it, and nothing else may ever spend those outputs.
  async function resubmitPending() {
    const recorded = new Set([...lines.values()].map((line) => line.tx_id));
    await Promise.all(ledger.pending().map(async (entry) => {
      if (recorded.has(entry.txId)) {
        await ledger.markRecorded(entry.txId);
        return;
      }
      await resubmit(entry);
    }));
  }

  async function refreshAll() {
    await Promise.all([refreshBalances(), refreshHistory(), refreshTokens()]);
  }

  // Online is whether the backend answers these reads. The feed only brings news sooner: one that
  // closes or is refused leaves Send on, and the reads every REFRESH_INTERVAL_MS go on.
  async function refreshReachability() {
    try {
      await refreshAll();
      setOnline(true);
    } catch (e) {
      if (e.unreachable) setOnline(false);
      throw e;
    }
  }

  function startRefreshing(mine) {
    schedule(async () => {
      if (mine !== generation) return;
      try {
        await refreshReachability();
      } catch (e) {
        log.error('Could not refresh Hathor Next.', e);
      }
      startRefreshing(mine);
    }, REFRESH_INTERVAL_MS);
  }

  function openFeed(mine) {
    if (!WebSocketImpl || mine !== generation) {
      return;
    }
    // The feed's token travels in the URL, where a proxy may log it: a read session's, which can
    // only read.
    const url = api.feedUrl(bytesToHex(walletId), feedSession.token, tail);
    const ws = new WebSocketImpl(url);
    socket = ws;
    ws.onopen = () => {
      feedDelay = FEED_RETRY_MIN_MS;
    };
    ws.onmessage = (event) => {
      let frame;
      try {
        frame = JSON.parse(event.data);
      } catch (e) {
        return;
      }
      if (['entry', 'lagged', 'spendable', 'stuck'].includes(frame.type)) {
        Promise.all([refreshHistory(), refreshBalances()]).catch((e) => {
          log.error('Could not read Hathor Next after a feed frame.', e);
        });
      }
    };
    ws.onclose = () => {
      if (socket !== ws || mine !== generation) {
        return;
      }
      socket = null;
      const delay = feedDelay;
      feedDelay = Math.min(feedDelay * 2, FEED_RETRY_MAX_MS);
      schedule(async () => {
        if (mine !== generation) return;
        try {
          if (feedSession.expires_at - SESSION_RENEW_MARGIN_S <= nowS()) {
            feedSession = await openSession(SCOPE.READ);
          }
          await refreshReachability();
        } catch (e) {
          log.error('Could not reach Hathor Next.', e);
        }
        openFeed(mine);
      }, delay);
    };
    ws.onerror = () => {};
  }

  // Closes the session. The keys stay. A connect still running fails.
  function disconnect() {
    generation += 1;
    for (const timer of timers) {
      clearTimeout(timer);
    }
    timers.clear();
    const ws = socket;
    socket = null;
    ws?.close();
    connected = false;
    online = false;
    session = null;
    feedSession = null;
    balances = {};
    lines.clear();
    sends.clear();
    creations.clear();
    tail = null;
  }

  return {
    /**
     * Derives the wallet's Hathor Next keys from its words. No network. The keys live from an
     * unlock to the next lock: if the app locks while they are derived, they are never kept.
     *
     * @param {{ words: string }} params
     * @returns {Promise<{ pubB: string }>}
     * @throws {NextClientError} NO_KEYS when the app locked meanwhile
     */
    async prepareKeys({ words }) {
      const started = lockCount;
      const seed = await mnemonicToSeed(words);
      if (lockCount !== started) {
        seed.fill(0);
        throw new NextClientError(NEXT_CLIENT_ERROR.NO_KEYS);
      }
      const { b } = deriveAccount(seed);
      seed.fill(0);
      const auth = authSecret(b);
      const read = readSecret(auth);
      keys = {
        b,
        auth,
        read,
        pubB: publicKeyOf(b),
        authPub: publicKeyOf(auth),
        readPub: publicKeyOf(read),
      };
      return { pubB: bytesToHex(keys.pubB) };
    },

    /** @returns {boolean} */
    hasKeys() {
      return keys !== null;
    },

    /**
     * Drops the keys when the app locks. The session stays, so the wallet keeps reading; signing
     * and logging in again wait for the keys the next unlock derives.
     *
     * @returns {boolean} Whether there were keys to drop
     */
    forgetKeys() {
      lockCount += 1;
      const had = keys !== null;
      keys = null;
      return had;
    },

    /**
     * Checks the backend's pins, registers the wallet's public keys (idempotent), opens a
     * session and reads the wallet.
     *
     * @param {{ network: string, config: Object, birthday: 'genesis' }} params
     */
    async connect({ network: connectNetwork, config: connectConfig, birthday }) {
      if (!keys) {
        throw new NextClientError(NEXT_CLIENT_ERROR.NO_KEYS);
      }
      disconnect();
      generation += 1;
      const mine = generation;
      network = connectNetwork;
      config = connectConfig;
      api = createBackendApi(config.backendUrl, { fetchImpl });
      try {
        const remote = await api.getConfig();
        const wrong = pinMismatch(config, remote);
        if (wrong) {
          log.error(`The Hathor Next backend is on another network: ${wrong} differs.`);
          throw new NextClientError(NEXT_CLIENT_ERROR.CONNECT_FAILED);
        }
        // The app holds its own ceiling on a payment's fee: without one pinned for the network,
        // the backend's quote would be the only limit.
        if (config.maxSendFee === undefined || config.maxSendFee === null) {
          log.error('No fee ceiling is pinned for this Hathor Next network.');
          throw new NextClientError(NEXT_CLIENT_ERROR.CONNECT_FAILED);
        }
        timing = { genesisMs: remote.next.genesis_ms, epochMs: remote.next.epoch_ms };
        sendFee = BigInt(remote.next.send_fee ?? '0');
        transferConfig = remote.transfer ?? null;
        issuance = remote.issuance === true;
        const pubA = hexToBytes(config.serviceViewPub);
        walletId = walletIdOf(pubA, keys.pubB);
        // One ledger per Hathor Next wallet and network, whatever Hathor Network runs beside it.
        // Outside the `wallet:` keys, so a wallet reset keeps it: the same words come back to the
        // same outputs.
        ledger = createSignLedger(
          storage,
          `multichain:nextSigned:${config.nextNetworkId}:${bytesToHex(walletId)}`,
        );
        nonces = createNonceStore(
          storage,
          `multichain:nextTokenNonces:${config.nextNetworkId}:${bytesToHex(walletId)}`,
        );
        address = encodeAddress(config.serviceViewPub, bytesToHex(keys.pubB));

        const ts = nowS();
        const message = keysMessage(keys.pubB, keys.authPub, keys.readPub, ts);
        const registration = await api.register({
          pub_b: bytesToHex(keys.pubB),
          auth_pub: bytesToHex(keys.authPub),
          read_pub: bytesToHex(keys.readPub),
          ts,
          sig_b: bytesToHex(schnorrSign(keys.b, message)),
          sig_auth: bytesToHex(schnorrSign(keys.auth, message)),
          ...(birthday === 'genesis' ? { birthday: 0 } : {}),
        });
        if (
          registration.wallet_id !== bytesToHex(walletId)
          || registration.pub_a !== config.serviceViewPub
          || registration.address !== address
        ) {
          log.error('The Hathor Next backend registered another wallet than this one.');
          throw new NextClientError(NEXT_CLIENT_ERROR.CONNECT_FAILED);
        }
        sweeping = Boolean(registration.balance_sweep) || registration.scanned_from_epoch === null;

        await login();
        feedSession = await openSession(SCOPE.READ);
        await refreshAll();
        await resubmitPending();
      } catch (e) {
        if (mine === generation) {
          disconnect();
        }
        if (e instanceof NextClientError) {
          throw e;
        }
        log.error('Could not connect to Hathor Next.', e);
        throw new NextClientError(e.unreachable ? NEXT_CLIENT_ERROR.OFFLINE
          : NEXT_CLIENT_ERROR.CONNECT_FAILED);
      }
      if (mine !== generation) {
        throw new NextClientError(NEXT_CLIENT_ERROR.NOT_CONNECTED);
      }
      connected = true;
      online = true;
      openFeed(mine);
      startRefreshing(mine);
    },

    /** Closes the session. The keys stay. A connect still running fails. */
    disconnect,

    /** @returns {string|null} The address on the connected network */
    getAddress() {
      return address;
    },

    /** @returns {string|null} */
    getNetwork() {
      return connected ? network : null;
    },

    /** @returns {boolean} */
    isOnline() {
      return connected && online;
    },

    /**
     * The tokens the wallet holds or has a history in, with when each last moved.
     *
     * @returns {{ id: string, name: string, symbol: string, lastActivityAt: number|null }[]}
     */
    getTokens() {
      requireConnected();
      const last = {};
      for (const line of lines.values()) {
        const at = timing.genesisMs + line.epoch * timing.epochMs;
        last[line.token] = Math.max(last[line.token] ?? 0, at);
      }
      const ids = new Set([...Object.keys(balances), ...Object.keys(last)]);
      return [...ids].map((id) => {
        const native = id === config.nativeTokenId;
        const meta = tokenMeta[id] ?? {};
        return {
          id,
          // The native token's name is the app's own: the token list is anyone's to fill.
          name: native ? config.nativeTokenName : (meta.name ?? id.slice(0, 8)),
          symbol: native ? config.nativeTokenSymbol : (meta.symbol ?? id.slice(0, 4).toUpperCase()),
          lastActivityAt: last[id] ?? null,
        };
      });
    },

    /**
     * @returns {{ sweeping: boolean, balances: { [tokenId: string]: { available: bigint } } }}
     */
    getBalances() {
      requireConnected();
      return { sweeping, balances: { ...balances } };
    },

    /**
     * A token's rows, newest first.
     *
     * @param {string} tokenId
     * @param {{ cursor?: number }} [options] Where the previous page ended
     * @returns {{ rows: Object[], cursor: number|null }}
     */
    getHistory(tokenId, { cursor = 0 } = {}) {
      requireConnected();
      const sentByTx = new Map([...sends.values()].filter((x) => x.txId).map((x) => [x.txId, x]));
      const recorded = new Set();
      const rows = [...lines.values()]
        .filter((line) => line.token === tokenId)
        .flatMap((line) => {
          recorded.add(line.tx_id);
          const sent = sentByTx.get(line.tx_id);
          return rowsOfLine(line, timing, sent ? { peer: sent.to } : null, config.nativeTokenId)
            .map((row) => (sent ? { ...row, sendId: sent.sendId } : row));
        });
      for (const send of sends.values()) {
        if (send.tokenId === tokenId && !recorded.has(send.txId)) {
          rows.push({
            id: send.sendId,
            txId: send.txId,
            tokenId,
            direction: 'out',
            kind: 'payment',
            amount: send.amount.toString(),
            peer: send.to,
            status: send.status,
            at: send.at,
            reason: send.reason,
            sendId: send.sendId,
            transferId: null,
            mode: 'private',
            cursor: '',
          });
        }
      }
      // Newest first; a payment and its fee, from one line, keep their order.
      rows.sort((a, b) => b.at - a.at || compareCursorsDesc(a.cursor, b.cursor));
      const page = rows.slice(cursor, cursor + HISTORY_PAGE_SIZE);
      const end = cursor + page.length;
      return { rows: page, cursor: end < rows.length ? end : null };
    },

    /** @returns {bigint} The fee of a payment, in the native token */
    getSendFee() {
      return sendFee;
    },

    /**
     * Makes a payment. The backend builds it; this client checks every byte against the payment
     * (signer.js), signs each input once, saves the signed transaction, and only then sends the
     * signatures. The outcome arrives as SEND events.
     *
     * @param {{ tokenId: string, to: string, amount: bigint }} draft
     * @returns {Promise<{ sendId: string }>}
     */
    async send({ tokenId, to, amount }) {
      requireConnected();
      if (!keys) {
        throw new NextClientError(NEXT_CLIENT_ERROR.NO_KEYS);
      }
      if (!online) {
        throw new NextClientError(NEXT_CLIENT_ERROR.OFFLINE);
      }
      if (sweeping) {
        throw new NextClientError(NEXT_CLIENT_ERROR.SWEEPING);
      }
      const available = balances[tokenId]?.available ?? 0n;
      const native = config.nativeTokenId;
      const needed = tokenId === native ? amount + sendFee : amount;
      if (amount <= 0n || needed > available
        || (tokenId !== native && sendFee > (balances[native]?.available ?? 0n))) {
        throw new NextClientError(NEXT_CLIENT_ERROR.INSUFFICIENT_FUNDS);
      }
      const mine = generation;
      const id = bytesToHex(walletId);
      let request;
      try {
        request = await withSession((token) => api.createSend(id, token, {
          intent_id: bytesToHex(randomBytes(16)),
          to,
          amount: amount.toString(),
          ...(tokenId === native ? {} : { token: tokenId }),
          max_fee: maxFee().toString(),
        }));
      } catch (e) {
        throw prepareError(e, { tokenId, nativeTokenId: native });
      }
      const cancel = () => withSession((token) => api.cancelSend(request.id, token))
        .catch((e) => log.error('Could not cancel an unsigned Hathor Next payment.', e));
      // The app may have locked while the backend prepared it: the keys are gone, so nothing
      // signs, and the backend lets its outputs go now rather than when it expires.
      if (!keys) {
        await cancel();
        throw new NextClientError(NEXT_CLIENT_ERROR.NO_KEYS);
      }
      const context = {
        b: keys.b,
        pubB: keys.pubB,
        intent: { to, amount, tokenId },
        nativeTokenId: native,
        serviceViewPub: config.serviceViewPub,
        wireFormat: config.wireFormat,
        maxFee: maxFee(),
        nowS: Math.floor(nowMs() / 1000),
        ledger,
      };
      let signed = null;
      // An earlier payment holding the same outputs is asked about first: if the network rejected
      // it, its outputs are free and this payment signs them; otherwise its saved bytes go out
      // once more, and this payment waits for it. Each round frees one entry at most.
      for (let round = 0; !signed; round += 1) {
        try {
          // Each round depends on the previous one's verdict.
          // eslint-disable-next-line no-await-in-loop
          signed = await verifyAndSign(request, context);
        } catch (e) {
          if (e instanceof LedgerConflictError && round < MAX_LEDGER_ROUNDS) {
            // eslint-disable-next-line no-await-in-loop
            const earlier = await statusOf(e.entry);
            if (earlier?.status !== 'rejected') {
              log.error('A Hathor Next payment found its outputs signed into an earlier one.');
              // This payment holds the same outputs until it is cancelled, and the backend
              // refuses to submit the earlier one meanwhile: cancel first, then submit it.
              // eslint-disable-next-line no-await-in-loop
              await cancel();
              // eslint-disable-next-line no-await-in-loop
              await resubmit(e.entry);
              throw new NextClientError(NEXT_CLIENT_ERROR.EARLIER_PENDING);
            }
          } else if (e instanceof SignRefusedError) {
            log.error(`A Hathor Next payment was refused before signing: ${e.message}`);
            cancel();
            throw new NextClientError(
              e instanceof LedgerConflictError
                ? NEXT_CLIENT_ERROR.EARLIER_PENDING
                : NEXT_CLIENT_ERROR.REFUSED,
            );
          } else {
            throw e;
          }
        }
      }
      const send = {
        sendId: request.id,
        txId: signed.txId,
        to,
        amount,
        tokenId,
        status: 'pending',
        reason: null,
        at: nowMs(),
      };
      sends.set(send.sendId, send);
      emit(NEXT_CLIENT_EVENT.HISTORY, null);
      try {
        await withSession((token) => api.signSend(request.id, token, signed.signatures));
      } catch (e) {
        // Signed and saved: the identical bytes go again until the backend has them.
        log.error('The signatures did not reach the Hathor Next backend; resubmitting.', e);
      }
      followSent(mine, send, signed, () => Promise.all([refreshHistory(), refreshBalances()]));
      return { sendId: send.sendId };
    },

    /**
     * A payment's state as this client knows it. The saga asks once it has the id: a payment can
     * settle, and its event fire, before send() returns.
     *
     * @param {string} sendId
     * @returns {{ sendId: string, status: string, reason: string|null, txId: string|null }|null}
     */
    getSend(sendId) {
      const send = sends.get(sendId);
      return send
        ? { sendId, status: send.status, reason: send.reason, txId: send.txId }
        : null;
    },

    /** @returns {boolean} Whether this backend creates tokens on Hathor Next */
    canCreateTokens() {
      return connected && issuance;
    },

    /**
     * Creates a token on Hathor Next, its whole supply paid to this wallet. The backend builds the
     * creation; this client derives the token's mint and melt keys from the words (they never
     * leave the app; their public halves go into the token), checks every byte against what the
     * user approved, signs each input once, and only then sends the signatures. The outcome
     * arrives as SEND events; the token's id is the creation's transaction id.
     *
     * The words are needed once, to derive the keys at a nonce no other token of this wallet has
     * used, and are dropped before this returns.
     *
     * @param {{ words: string, symbol: string, name: string, amount: bigint }} creation
     * @returns {Promise<{ sendId: string, tokenId: string }>}
     */
    async createToken({ words, symbol, name, amount }) {
      requireConnected();
      if (!keys) {
        throw new NextClientError(NEXT_CLIENT_ERROR.NO_KEYS);
      }
      if (!issuance) {
        throw new NextClientError(NEXT_CLIENT_ERROR.TOKENS_UNAVAILABLE);
      }
      if (!online) {
        throw new NextClientError(NEXT_CLIENT_ERROR.OFFLINE);
      }
      if (sweeping) {
        throw new NextClientError(NEXT_CLIENT_ERROR.SWEEPING);
      }
      const bytesOf = (text) => utf8ToBytes(text).length;
      if (!symbol || !name || bytesOf(symbol) > MAX_SYMBOL_BYTES || bytesOf(name) > MAX_NAME_BYTES
        || amount <= 0n) {
        throw new NextClientError(NEXT_CLIENT_ERROR.TOKEN_PREPARE_FAILED);
      }
      const native = config.nativeTokenId;
      if (sendFee > (balances[native]?.available ?? 0n)) {
        throw new NextClientError(NEXT_CLIENT_ERROR.INSUFFICIENT_FUNDS);
      }
      const mine = generation;
      const id = bytesToHex(walletId);

      // The keys, at a nonce the registry and this device both show free, reserved on disk first.
      // The registry is read before the seed exists, so the seed lives only while it derives.
      const started = lockCount;
      let registry;
      try {
        registry = await readRegistry();
      } catch (e) {
        log.error('Could not read the Hathor Next token registry.', e);
        throw new NextClientError(e.unreachable ? NEXT_CLIENT_ERROR.OFFLINE
          : NEXT_CLIENT_ERROR.TOKEN_AUTHORITIES_UNKNOWN);
      }
      const seed = await mnemonicToSeed(words);
      let scan;
      const derived = { mint: new Map(), melt: new Map() };
      try {
        if (lockCount !== started) {
          throw new NextClientError(NEXT_CLIENT_ERROR.NO_KEYS);
        }
        const derivePub = (kind, n) => {
          const { pub } = deriveAuthority(seed, HATHOR_NEXT_ACCOUNT_INDEX, kind, n);
          derived[kind].set(n, pub);
          return pub;
        };
        try {
          scan = scanAuthorities(derivePub, registry);
        } catch (e) {
          if (!(e instanceof AuthoritiesWithheldError)) {
            log.error('Could not read the Hathor Next token registry.', e);
          }
          throw new NextClientError(NEXT_CLIENT_ERROR.TOKEN_AUTHORITIES_UNKNOWN);
        }
        // The next nonce is at most one past the scan's window: derive its keys too, so nothing
        // needs the seed once the reservation is on disk.
        const window = scan.highest + 1 + AUTHORITY_GAP;
        derivePub('mint', window);
        derivePub('melt', window);
      } finally {
        seed.fill(0);
      }
      let nonce;
      try {
        nonce = await nonces.reserve(scan);
      } catch (e) {
        if (e instanceof NonceBeyondReachError) {
          throw new NextClientError(NEXT_CLIENT_ERROR.TOKEN_NONCE_BEYOND_REACH);
        }
        log.error('Could not reserve a nonce for a Hathor Next token.', e);
        throw new NextClientError(NEXT_CLIENT_ERROR.TOKEN_AUTHORITIES_UNKNOWN);
      }
      const mintAuthority = derived.mint.get(nonce);
      const meltAuthority = derived.melt.get(nonce);
      if (lockCount !== started || !mintAuthority || !meltAuthority) {
        await nonces.release(nonce);
        throw new NextClientError(NEXT_CLIENT_ERROR.NO_KEYS);
      }

      let request;
      try {
        request = await withSession((token) => api.createToken(id, token, {
          intent_id: bytesToHex(randomBytes(16)),
          symbol,
          name,
          amount: amount.toString(),
          mint_authority: bytesToHex(mintAuthority),
          melt_authority: bytesToHex(meltAuthority),
          max_fee: maxFee().toString(),
        }));
      } catch (e) {
        // Nothing was signed: no creation carrying the nonce exists, so the next one takes it.
        await nonces.release(nonce);
        throw prepareError(e, null, NEXT_CLIENT_ERROR.TOKEN_PREPARE_FAILED);
      }
      const cancel = () => withSession((token) => api.cancelSend(request.id, token))
        .catch((e) => log.error('Could not cancel an unsigned Hathor Next token creation.', e));
      if (!keys) {
        await cancel();
        await nonces.release(nonce);
        throw new NextClientError(NEXT_CLIENT_ERROR.NO_KEYS);
      }
      const context = {
        b: keys.b,
        pubB: keys.pubB,
        intent: { symbol, name, amount, mintAuthority, meltAuthority },
        nativeTokenId: native,
        serviceViewPub: config.serviceViewPub,
        maxFee: maxFee(),
        nowS: Math.floor(nowMs() / 1000),
        ledger,
      };
      let signed;
      try {
        signed = await verifyAndSign(request, context, checkCreateRequest);
      } catch (e) {
        if (e instanceof LedgerConflictError) {
          // An earlier transaction signed these outputs: it goes out again, and this one waits.
          await cancel();
          await nonces.release(nonce);
          await resubmit(e.entry);
          throw new NextClientError(NEXT_CLIENT_ERROR.EARLIER_PENDING);
        }
        if (e instanceof SignRefusedError) {
          log.error(`A Hathor Next token creation was refused before signing: ${e.message}`);
          await cancel();
          await nonces.release(nonce);
          throw new NextClientError(NEXT_CLIENT_ERROR.TOKEN_REFUSED);
        }
        throw e;
      }
      // Signed: bytes carrying the nonce exist, so it never comes round again.
      await nonces.markSigned(nonce);
      const creation = {
        sendId: request.id,
        txId: signed.txId,
        symbol,
        name,
        amount,
        status: 'pending',
        reason: null,
        at: nowMs(),
      };
      creations.set(creation.sendId, creation);
      try {
        await withSession((token) => api.signSend(request.id, token, signed.signatures));
      } catch (e) {
        log.error('The signatures did not reach the Hathor Next backend; resubmitting.', e);
      }
      // Recorded: the registry names the token now, and the balance holds its supply. The token's
      // id is the recorded transaction's, which the builder could have made other than the bytes
      // signed here (it holds the excess's secret): the registry row carrying this wallet's own
      // keys at this nonce names the token that exists.
      const mintHex = bytesToHex(mintAuthority);
      followSent(mine, creation, signed, async () => {
        await refreshTokens();
        await Promise.all([refreshHistory(), refreshBalances()]);
        try {
          const row = (await readRegistry())
            .find((r) => r.mint_authority?.toLowerCase() === mintHex);
          if (row && row.token_id.toLowerCase() !== creation.txId) {
            creation.txId = row.token_id.toLowerCase();
            emit(NEXT_CLIENT_EVENT.SEND, {
              sendId: creation.sendId,
              status: creation.status,
              reason: creation.reason,
              txId: creation.txId,
            });
          }
        } catch (e) {
          log.error('Could not read the created token from the registry.', e);
        }
      });
      return { sendId: creation.sendId, tokenId: signed.txId };
    },

    /**
     * A token creation's state as this client knows it.
     *
     * @param {string} sendId
     * @returns {{ sendId: string, status: string, reason: string|null, txId: string|null }|null}
     */
    getCreation(sendId) {
      const creation = creations.get(sendId);
      return creation
        ? { sendId, status: creation.status, reason: creation.reason, txId: creation.txId }
        : null;
    },

    /** @returns {Object|null} The backend's transfer values, from GET /v1/config */
    getTransferConfig() {
      return transferConfig;
    },

    /**
     * Asks the backend for the burn that moves HTR to an address on Hathor Next: this wallet's own,
     * or anyone's.
     *
     * @param {{ amount: bigint, utxos: { txId: string, index: number }[],
     *   changeAddress: string|null, destination: string }} transfer
     * @returns {Promise<Object>} The transfer request, with its unsigned transaction
     */
    async createTransfer({ amount, utxos, changeAddress, destination }) {
      requireConnected();
      const id = bytesToHex(walletId);
      return withSession((token) => api.createTransfer(id, token, {
        intent_id: bytesToHex(randomBytes(16)),
        amount: amount.toString(),
        utxos: utxos.map((u) => ({ tx_id: u.txId, index: u.index })),
        change_address: changeAddress,
        destination,
      }));
    },

    /**
     * @param {string} transferId
     * @param {string[]} inputData
     * @returns {Promise<Object>} The transfer's status
     */
    async signTransfer(transferId, inputData) {
      requireConnected();
      return withSession((token) => api.signTransfer(transferId, token, inputData));
    },

    /**
     * @param {string} transferId
     * @returns {Promise<Object>} The transfer's status
     */
    async getTransfer(transferId) {
      requireConnected();
      return withSession((token) => api.getTransfer(transferId, token));
    },

    /**
     * Cancels a transfer whose burn was never signed, so the backend stops holding it.
     *
     * @param {string} transferId
     */
    async cancelTransfer(transferId) {
      requireConnected();
      await withSession((token) => api.cancelTransfer(transferId, token));
    },

    /** @returns {Promise<Object[]>} This wallet's transfers, as the backend follows them */
    async getTransfers() {
      requireConnected();
      const id = bytesToHex(walletId);
      const body = await withSession((token) => api.getTransfers(id, token));
      // The backend answers a bare list.
      return Array.isArray(body) ? body : [];
    },

    /**
     * @param {string} event One of NEXT_CLIENT_EVENT
     * @param {Function} listener
     * @returns {Function} Removes the listener
     */
    on(event, listener) {
      listeners.get(event).add(listener);
      return () => listeners.get(event).delete(listener);
    },
  };
}
