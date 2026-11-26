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
import { tokenText } from './tokenText';
import {
  CoinsNotNeededError,
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
// A feed must stay open this long before its next reconnect waits the shortest time again: one the
// backend opens and ends at once would otherwise reconnect without pause.
const FEED_STABLE_MS = 10000;
// The most statement pages one read follows, whatever the backend says comes next.
const HISTORY_MAX_PAGES = 50;
// The token registry is read a page at a time, until every token the wallet holds is named.
const TOKEN_PAGE = 1000;
const TOKEN_MAX_PAGES = 20;
// A token's name and symbol, as the protocol caps them, in UTF-8 bytes.
const MAX_TOKEN_NAME_BYTES = 64;
const MAX_TOKEN_SYMBOL_BYTES = 16;
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
// A payment's state as the screens know it, from the backend's.
const SEND_STATUS = {
  submitted: 'pending',
  awaiting_signatures: 'pending',
  recorded: 'recorded',
  // Not a verdict that the bytes can never land: the wallet keeps following them, and submits
  // them again now and then, and at its next connect. Not settled yet.
  failed: 'unconfirmed',
  // The backend never took the signatures: the payment won't land, and its inputs are free again.
  expired: 'expired',
  // The network refused it by name: its inputs are free again.
  rejected: 'failed',
};

// The backend's states after which a payment's inputs are free: the app takes its word for it.
const FREES_INPUTS = ['rejected', 'expired'];

// The states a payment is no longer followed in. One the backend calls failed (unconfirmed) is
// still followed: it can still settle.
const SEND_SETTLED = ['recorded', 'failed', 'expired'];

// How often a payment the backend calls failed is submitted again while it is followed.
const FAILED_RESUBMIT_MS = 60000;

// How many times a created token's id is read from the registry, a poll apart, once its
// creation is recorded: a read that fails, or a registry that doesn't list it yet, is read again.
const TOKEN_ID_READS = 10;
// How often a payment that isn't settled yet (the backend calls it failed) is read: no sooner
// than it is submitted again. It can stay so for the whole session.
export const UNCONFIRMED_POLL_MS = FAILED_RESUBMIT_MS;

// The sign-once ledgers, one per storage and key (a Hathor Next wallet and chain), whatever
// client or connect asks: a payment from before a connect may still be writing to its ledger,
// and a second ledger of the same key wouldn't see that write.
const ledgers = new WeakMap();

function ledgerOf(storage, key) {
  if (!ledgers.has(storage)) {
    ledgers.set(storage, new Map());
  }
  const byKey = ledgers.get(storage);
  if (!byKey.has(key)) {
    byKey.set(key, createSignLedger(storage, key));
  }
  return byKey.get(key);
}

/**
 * The transaction id a send's status gives, lowercase, or null without a well-formed one.
 *
 * @param {Object} status The backend's
 * @returns {string|null}
 */
const txIdOfStatus = (status) => (
  typeof status?.tx_id === 'string' && /^[0-9a-f]{64}$/i.test(status.tx_id)
    ? status.tx_id.toLowerCase()
    : null
);

const sendStatusOf = (status) => (
  typeof status === 'string' && Object.prototype.hasOwnProperty.call(SEND_STATUS, status)
    ? SEND_STATUS[status]
    : 'pending'
);

/**
 * Whether the backend's answer to a resubmit says the payment can never be submitted again: its
 * reservation was released and the wallet service no longer keeps it.
 *
 * @param {Error} e
 * @returns {boolean}
 */
const forgotten = (e) => e instanceof BackendError && e.status === 409
  && /no longer keeps it/i.test(e.message);

/**
 * A non-negative amount from the backend, or null when it isn't one.
 *
 * @param {*} value
 * @returns {bigint|null}
 */
function readAmount(value) {
  if (typeof value !== 'string' || !/^[0-9]+$/.test(value)) {
    return null;
  }
  return BigInt(value);
}

/** What pinMismatch names a backend that serves no transfer block, where the app transfers. */
export const TRANSFER_PIN = 'transfer';

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
  // The Hathor Network it transfers from, which the app is on (getSideChainConfig).
  if (config.hathorNetwork) {
    pins.push(['hathor.network', config.hathorNetwork, remote?.hathor?.network]);
  }
  // The chain's genesis, which names the sign-once ledger: a backend that changed it would get a
  // new, empty one, and signatures again over outputs a payment still on its way spends.
  if (config.genesisMs !== undefined && config.genesisMs !== null) {
    pins.push(['genesis_ms', config.genesisMs, next.genesis_ms]);
  }
  // The amounts' width the signer holds a transaction to.
  if (config.amountWidth) {
    pins.push(['amount_width', config.amountWidth, next.amount_width]);
  }
  // The token a transfer mints, which its rows and the balance it arrives in are read in. A
  // backend that names none mints the native token. One that serves no transfer block transfers
  // nothing: the app transfers by its own pins, so HTR it burned to the transfer address would
  // never arrive. That backend is refused too, under its own name (TRANSFER_PIN).
  const minted = config.tokenMap?.find((pair) => pair.hathor === '00')?.next;
  if (minted) {
    pins.push([TRANSFER_PIN, true, Boolean(remote?.transfer)]);
    pins.push(['transfer.mint_token', minted, remote?.transfer?.mint_token ?? next.native_token]);
  }
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
 * @param {{ tokenId: string, nativeTokenId: string, feeSymbol?: string }} [payment] What the
 *   payment sends, and the network's native token, which pays the fee, and its symbol
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
  // The wallet service's `amount-leak: token=<id>` refusal: public funds (a transfer's mint, a
  // level-1 payment from another wallet, or the change of a token creation, whose outputs are
  // public) paying exactly one hidden output of that token. Its text speaks of funding, so it goes
  // first. In a payment of another token, the native token's one hidden output is the fee's
  // change: no amount of the token sent changes that.
  if (e.status === 422 && /amount-leak:/.test(e.message)) {
    const leaked = /amount-leak: token=([0-9a-f]+)/i.exec(e.message)?.[1]?.toLowerCase();
    const feeChange = payment && payment.tokenId !== payment.nativeTokenId
      && leaked === payment.nativeTokenId;
    return new NextClientError(
      feeChange ? NEXT_CLIENT_ERROR.FEE_AMOUNT_VISIBLE : NEXT_CLIENT_ERROR.AMOUNT_VISIBLE,
      { feeSymbol: payment?.feeSymbol },
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
 * closure, from the unlock that derived them to the next lock; the client stores nothing secret,
 * and sends only public keys and signatures. (The app keeps the spend secret encrypted with the
 * PIN, as it keeps the words: src/multichain/keys.js.) Its interface is the client's (see
 * nextClient.js).
 *
 * @param {{ fetchImpl?: Function, WebSocketImpl?: Function, nowMs?: Function }} [deps]
 */
export function createBackendNextClient({
  fetchImpl,
  WebSocketImpl = globalThis.WebSocket ?? null,
  nowMs = () => Date.now(),
  storage = STORE,
  sendPollMs = SEND_POLL_MS,
  unconfirmedPollMs = UNCONFIRMED_POLL_MS,
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
  let amountWidth = null;
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

  // Every key, from the spend secret: the auth key derives from it, and the read key from that.
  const keysOf = (b) => {
    const auth = authSecret(b);
    const read = readSecret(auth);
    return {
      b,
      auth,
      read,
      pubB: publicKeyOf(b),
      authPub: publicKeyOf(auth),
      readPub: publicKeyOf(read),
    };
  };

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

  // A login that a disconnect or another connect overtook keeps nothing: its session is another
  // backend's, and the next request would carry it there.
  async function login() {
    const mine = generation;
    const opened = await openSession(SCOPE.FULL);
    if (mine !== generation) {
      throw new NextClientError(NEXT_CLIENT_ERROR.NOT_CONNECTED);
    }
    session = opened;
  }

  // A call with the session, logging in again once when the session expired. A call that a
  // disconnect or another connect overtook stops at its next step: the session and the backend it
  // would use next may be another connect's.
  async function withSession(call) {
    const mine = generation;
    const current = () => {
      if (mine !== generation) {
        throw new NextClientError(NEXT_CLIENT_ERROR.NOT_CONNECTED);
      }
    };
    if (!session || session.expires_at - SESSION_RENEW_MARGIN_S <= nowS()) {
      await login();
      current();
    }
    try {
      const result = await call(session.token);
      current();
      return result;
    } catch (e) {
      if (!e.unauthorized) {
        throw e;
      }
      // Asked again with a new session (the backend restarted, say): its answer is checked as the
      // first one's is, or a payment built meanwhile for a backend the app left would be signed.
      await login();
      current();
      const result = await call(session.token);
      current();
      return result;
    }
  }

  async function refreshBalances() {
    const body = await withSession((token) => api.getBalance(bytesToHex(walletId), token));
    const next = {};
    // One entry the app can't read is left out, and logged: the rest of the balance still shows.
    for (const entry of Array.isArray(body?.balances) ? body.balances : []) {
      const available = readAmount(entry?.referenceable ?? '0');
      if (typeof entry?.token !== 'string' || available === null) {
        log.error('A Hathor Next balance could not be read; it was left out.');
      } else {
        next[entry.token] = { available };
      }
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
    // An empty answer is an empty page, and a line the app can't read is left out, and logged:
    // the rest of the statement still shows.
    const history = Array.isArray(page?.history) ? page.history : [];
    const readable = history.filter((line) => {
      const ok = line !== null && typeof line === 'object'
        && (typeof line.cursor === 'string' || typeof line.cursor === 'number')
        && typeof line.token === 'string';
      if (!ok) {
        log.error('A Hathor Next statement line could not be read; it was left out.');
      }
      return ok;
    });
    for (const line of readable) {
      if (!lines.has(line.cursor)) {
        lines.set(line.cursor, line);
        added += 1;
      }
    }
    const last = readable[readable.length - 1];
    const more = Boolean(page?.next) && page.next !== since;
    return { added, tail: more ? page.next : (last?.cursor ?? since), more };
  }

  async function refreshHistory() {
    const mine = generation;
    let added = 0;
    let page = { more: true, tail };
    // As many pages as the backend says follow, up to HISTORY_MAX_PAGES, and none once Hathor
    // Next disconnected: the next read goes on from where this one stopped.
    for (let read = 0; page.more && read < HISTORY_MAX_PAGES; read += 1) {
      // Pages depend on the previous page's end, so they are read one after the other.
      // eslint-disable-next-line no-await-in-loop
      page = await readHistoryPage(page.tail);
      if (mine !== generation) {
        throw new NextClientError(NEXT_CLIENT_ERROR.NOT_CONNECTED);
      }
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

  // The names of the tokens the wallet holds or moved, a registry page at a time until each one
  // is named, up to TOKEN_MAX_PAGES. Anyone writes a token's name and symbol: they are made safe
  // to show (tokenText), and one that isn't text is left out.
  async function refreshTokens() {
    const wanted = new Set([
      ...Object.keys(balances),
      ...[...lines.values()].map((line) => line.token),
    ]);
    const meta = Object.create(null);
    let from;
    for (let read = 0; read < TOKEN_MAX_PAGES; read += 1) {
      // Each page names the next one.
      // eslint-disable-next-line no-await-in-loop
      const body = await api.getTokens({ from, limit: TOKEN_PAGE });
      for (const token of Array.isArray(body?.tokens) ? body.tokens : []) {
        const name = tokenText(token?.name, MAX_TOKEN_NAME_BYTES);
        const symbol = tokenText(token?.symbol, MAX_TOKEN_SYMBOL_BYTES);
        if (typeof token?.token_id === 'string' && name && symbol) {
          meta[token.token_id] = { name, symbol };
        }
      }
      const unnamed = [...wanted].some((id) => !meta[id]);
      if (!unnamed || !body?.next || body.next === from) {
        break;
      }
      from = body.next;
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
  // Reads a payment's or a creation's status until it settles: each answer can move it on, free
  // its inputs or ask for its signatures again. A reconnect follows again the ones still on their
  // way. One not settled yet is read only as often as it is submitted again. `entry.onRecorded`
  // runs once the statement records it, with the generation of the follower that saw it.
  function followSent(mine, entry) {
    const tick = () => schedule(async () => {
      if (mine !== generation || SEND_SETTLED.includes(entry.status)) return;
      try {
        let status = await withSession((token) => api.getSend(entry.sendId, token));
        // Failed is no verdict: the same bytes go out again, now and then, as at a connect. An
        // answer that settles it (recorded, or its inputs free) is its state from now on.
        if (status?.status === 'failed'
          && nowMs() - (entry.resubmittedAt ?? 0) >= FAILED_RESUBMIT_MS) {
          entry.resubmittedAt = nowMs();
          const answer = await resubmit(entry);
          if (answer && ['recorded', ...FREES_INPUTS].includes(answer.status)) {
            status = answer;
          }
        }
        const next = sendStatusOf(status?.status);
        if (FREES_INPUTS.includes(status?.status)) {
          await ledger.markRejected(entry.txId, status.reason ?? status.status);
        }
        if (status?.status === 'awaiting_signatures') {
          await withSession((token) => api.resubmitSend(entry.sendId, token, entry.signedTx));
        }
        if (next !== entry.status) {
          entry.status = next;
          entry.reason = status.reason ?? null;
          if (next === 'recorded') {
            // The transaction the backend recorded, by the id it gives: a token's id is its
            // creation's. Without one, the transaction signed here.
            entry.recordedTxId = txIdOfStatus(status) ?? entry.txId;
            // The outcome is told whatever this write does: the next tick sees it settled and
            // stops. An entry left unmarked goes out again at the next connect, and the
            // backend's answer, recorded, marks it then.
            try {
              await ledger.markRecorded(entry.txId);
            } catch (e) {
              log.error('Could not save a recorded payment.', e);
            }
          }
          emit(NEXT_CLIENT_EVENT.SEND, {
            sendId: entry.sendId,
            status: next,
            reason: entry.reason,
            txId: entry.txId,
            // A creation's: whether its token id is still the signed one, not yet read back.
            ...('provisional' in entry ? { provisional: entry.provisional } : {}),
          });
          emit(NEXT_CLIENT_EVENT.HISTORY, null);
          if (next === 'recorded') {
            await entry.onRecorded(mine);
          }
        }
      } catch (e) {
        log.error('Could not read a Hathor Next payment.', e);
      }
      tick();
    }, entry.status === 'unconfirmed' ? unconfirmedPollMs : sendPollMs);
    tick();
  }

  // Reads a recorded creation's token id back from the registry: the row naming this wallet's
  // mint key at its nonce and carrying the id of the transaction the backend recorded. Anyone can
  // create a token naming that key, so the key alone names nothing: a row with another id leaves
  // the id provisional. Found, the id is final, and a SEND event says so. A read that fails, or a
  // registry that doesn't list it yet, is read again a poll later, TOKEN_ID_READS times at most;
  // a connect to the same wallet and backend reads again.
  function resolveCreatedToken(mine, creation, reads = 0) {
    schedule(async () => {
      if (mine !== generation) return;
      try {
        const row = (await readRegistry()).find((r) => (
          typeof r?.token_id === 'string'
          && r.token_id.toLowerCase() === creation.recordedTxId
          && r.mint_authority?.toLowerCase() === creation.mint
        ));
        if (row) {
          creation.txId = creation.recordedTxId;
          creation.provisional = false;
          emit(NEXT_CLIENT_EVENT.SEND, {
            sendId: creation.sendId,
            status: creation.status,
            reason: creation.reason,
            txId: creation.txId,
            provisional: false,
          });
          return;
        }
      } catch (e) {
        log.error('Could not read the created token from the registry.', e);
      }
      if (reads + 1 < TOKEN_ID_READS) {
        resolveCreatedToken(mine, creation, reads + 1);
      }
    }, reads === 0 ? 0 : sendPollMs);
  }
  /* eslint-enable no-param-reassign */

  // The most a payment may cost: the backend's quote, never above the app's own cap.
  function maxFee() {
    const cap = BigInt(config.maxSendFee);
    return cap < sendFee ? cap : sendFee;
  }

  // Settles a ledger entry by what the backend says of its payment: recorded, or its inputs free
  // again (rejected, or expired before the backend took its signatures).
  async function settleEntry(entry, status) {
    if (FREES_INPUTS.includes(status?.status)) {
      await ledger.markRejected(entry.txId, status.reason ?? status.status);
    } else if (status?.status === 'recorded') {
      await ledger.markRecorded(entry.txId);
    }
  }

  /**
   * Submits an entry's signed bytes again, unchanged, and settles the entry by what the backend
   * answers. A backend whose wallet service no longer keeps the payment can never take it again:
   * its inputs are free. Other failures are logged, and the next connect tries again.
   *
   * @returns {Promise<Object|null>} The send's status, or null when the backend didn't answer
   */
  async function resubmit(entry) {
    let status;
    try {
      status = await withSession((token) => api.resubmitSend(entry.sendId, token, entry.signedTx));
    } catch (e) {
      if (forgotten(e)) {
        await ledger.markRejected(entry.txId, 'forgotten');
        return { status: 'expired', reason: 'forgotten' };
      }
      log.error('Could not submit a signed Hathor Next payment again.', e);
      return null;
    }
    await settleEntry(entry, status);
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
    await settleEntry(entry, status);
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

  // The token names come last: they are looked up for the tokens the balance and history name.
  async function refreshAll() {
    await Promise.all([refreshBalances(), refreshHistory()]);
    await refreshTokens();
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
    let openedAt = null;
    ws.onopen = () => {
      openedAt = nowMs();
    };
    ws.onmessage = (event) => {
      let frame;
      try {
        frame = JSON.parse(event.data);
      } catch (e) {
        return;
      }
      // Anything but an object with a type is not a frame: `null` parses too.
      if (['entry', 'lagged', 'spendable', 'stuck'].includes(frame?.type)) {
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
      // Only a feed that stayed up starts its waits over: one ended at once waits longer each time.
      if (openedAt !== null && nowMs() - openedAt >= FEED_STABLE_MS) {
        feedDelay = FEED_RETRY_MIN_MS;
      }
      // Spread out, so many phones the backend dropped together don't all come back at once.
      const delay = Math.round(feedDelay * (0.5 + Math.random() / 2));
      feedDelay = Math.min(feedDelay * 2, FEED_RETRY_MAX_MS);
      schedule(async () => {
        if (mine !== generation) return;
        try {
          if (feedSession.expires_at - SESSION_RENEW_MARGIN_S <= nowS()) {
            const opened = await openSession(SCOPE.READ);
            if (mine !== generation) return;
            feedSession = opened;
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
    tail = null;
    // The payments being followed stay: a connect to the same network follows them again.
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
      keys = keysOf(b);
      // The spend secret goes back to the unlock alone, which keeps it encrypted with the PIN on
      // this device (multichain/keys.js): every other key derives from it.
      return { pubB: bytesToHex(keys.pubB), spendSecret: b };
    },

    /**
     * Puts the keys back from the spend secret an unlock decrypted with the PIN, with no
     * stretching of the words.
     *
     * @param {{ spendSecret: bigint }} params
     * @returns {{ pubB: string }}
     */
    prepareKeysFromSecret({ spendSecret }) {
      keys = keysOf(spendSecret);
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
      // Payments and creations followed on another network or backend are no longer this one's.
      if (connectNetwork !== network || connectConfig.backendUrl !== config?.backendUrl) {
        sends.clear();
        creations.clear();
      }
      generation += 1;
      const mine = generation;
      // A disconnect or another connect overtook this one: it stops before its next step, so it
      // never goes on with the other connect's backend or session.
      const current = () => {
        if (mine !== generation) {
          throw new NextClientError(NEXT_CLIENT_ERROR.NOT_CONNECTED);
        }
      };
      network = connectNetwork;
      config = connectConfig;
      api = createBackendApi(config.backendUrl, { fetchImpl });
      try {
        const remote = await api.getConfig();
        current();
        const wrong = pinMismatch(config, remote);
        if (wrong) {
          log.error(wrong === TRANSFER_PIN
            ? 'The Hathor Next backend serves no transfer block: it transfers nothing, and this app transfers HTR to it.'
            : `The Hathor Next backend is on another network: ${wrong} differs.`);
          throw new NextClientError(NEXT_CLIENT_ERROR.NETWORK_CHANGED);
        }
        // The app holds its own ceiling on a payment's fee: without one pinned for the network,
        // the backend's quote would be the only limit.
        if (config.maxSendFee === undefined || config.maxSendFee === null) {
          log.error('No fee ceiling is pinned for this Hathor Next network.');
          throw new NextClientError(NEXT_CLIENT_ERROR.CONNECT_FAILED);
        }
        timing = { genesisMs: remote.next.genesis_ms, epochMs: remote.next.epoch_ms };
        sendFee = readAmount(remote.next.send_fee ?? '0') ?? 0n;
        // The pinned width, which the backend's matched: the signer holds transactions to it.
        amountWidth = config.amountWidth ?? remote.next.amount_width ?? null;
        issuance = remote.issuance === true;
        const pubA = hexToBytes(config.serviceViewPub);
        walletId = walletIdOf(pubA, keys.pubB);
        // One ledger per Hathor Next wallet and chain, whatever Hathor Network runs beside it. The
        // genesis tells a chain apart from the one before a reset, which keeps the network id and
        // the view key and starts the global indexes over (pinned, so a backend can't change it).
        // Under the `wallet:` keys, so a wallet reset clears it with the rest of the wallet.
        ledger = ledgerOf(
          storage,
          `wallet:multichain:nextSigned:${config.nextNetworkId}:`
            + `${remote.next.genesis_ms}:${bytesToHex(walletId)}`,
        );
        // The ledger kept before under another key: its payments still on their way move to this
        // one, so they keep holding their outputs and go out again below; then it goes. It named
        // no chain: only what was signed since this chain's genesis is this chain's. Anything
        // older was signed on the chain before a reset, whose outputs this one's indexes reuse.
        const oldKey = `multichain:nextSigned:${config.nextNetworkId}:${bytesToHex(walletId)}`;
        const old = storage.getItem(oldKey);
        if (old) {
          const entries = Array.isArray(old.entries) ? old.entries : [];
          await ledger.adopt(entries.filter((e) => Number(e?.signedAt) >= timing.genesisMs));
          storage.removeItem?.(oldKey);
        }
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
        current();
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
        current();
        const readSession = await openSession(SCOPE.READ);
        current();
        feedSession = readSession;
        await refreshAll();
        current();
        await resubmitPending();
      } catch (e) {
        if (mine === generation) {
          disconnect();
        }
        if (e instanceof NextClientError) {
          throw e;
        }
        log.error('Could not connect to Hathor Next.', e);
        // The wallet service names the clock when it refuses a login for its time.
        if (e instanceof BackendError && e.unauthorized && /auth-timestamp-shift/.test(e.message)) {
          throw new NextClientError(NEXT_CLIENT_ERROR.CLOCK);
        }
        throw new NextClientError(e.unreachable ? NEXT_CLIENT_ERROR.OFFLINE
          : NEXT_CLIENT_ERROR.CONNECT_FAILED);
      }
      current();
      connected = true;
      online = true;
      openFeed(mine);
      startRefreshing(mine);
      // The payments and creations followed before a reconnect are followed again: their outcome
      // still comes.
      for (const entry of [...sends.values(), ...creations.values()]) {
        if (!SEND_SETTLED.includes(entry.status)) {
          followSent(mine, entry);
        }
      }
      // A recorded creation whose token id isn't read back yet (its reads ran out, or the app
      // left meanwhile) is read again, on the wallet that made it. Another network or backend
      // cleared it above.
      const wallet = bytesToHex(walletId);
      for (const creation of creations.values()) {
        if (creation.status === 'recorded' && creation.provisional && creation.wallet === wallet) {
          resolveCreatedToken(mine, creation);
        }
      }
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
      // The HTR a transfer mints as a token of its own is HTR here too, as on Hathor Network.
      const mintedHtr = config.tokenMap?.find((pair) => pair.hathor === '00')?.next;
      return [...ids].map((id) => {
        const native = id === config.nativeTokenId;
        const meta = id === mintedHtr && !native ? { name: 'Hathor', symbol: 'HTR' } : (tokenMeta[id] ?? {});
        return {
          id,
          // The names of the native token and of the minted HTR are the app's own: the token list
          // is anyone's to fill.
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
        throw prepareError(e, {
          tokenId, nativeTokenId: native, feeSymbol: config.nativeTokenSymbol,
        });
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
        amountWidth,
        maxFee: maxFee(),
        nowS: Math.floor(nowMs() / 1000),
        ledger,
      };
      let signed = null;
      // An earlier payment holding the same outputs is asked about first: if the network rejected
      // it, its outputs are free and this payment signs them; otherwise its saved bytes go out
      // once more, and this payment waits for it. Each round frees one entry at most.
      for (let round = 0; !signed; round += 1) {
        // A round may come after the app locked, while it asked about an earlier payment: the
        // keys are read now, and gone, nothing is signed.
        if (!keys) {
          // eslint-disable-next-line no-await-in-loop
          await cancel();
          throw new NextClientError(NEXT_CLIENT_ERROR.NO_KEYS);
        }
        context.b = keys.b;
        context.pubB = keys.pubB;
        try {
          // Each round depends on the previous one's verdict.
          // eslint-disable-next-line no-await-in-loop
          signed = await verifyAndSign(request, context);
        } catch (e) {
          if (e instanceof LedgerConflictError && round < MAX_LEDGER_ROUNDS) {
            // eslint-disable-next-line no-await-in-loop
            const earlier = await statusOf(e.entry);
            if (!FREES_INPUTS.includes(earlier?.status)) {
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
            // Not signed, or its signatures not saved (the ledger's write failed): nothing was
            // submitted, which comes after signing returns. The backend lets the payment's
            // outputs go now rather than when it expires.
            // eslint-disable-next-line no-await-in-loop
            await cancel();
            throw e;
          }
        }
      }
      const send = {
        sendId: request.id,
        txId: signed.txId,
        signedTx: signed.signedTx,
        to,
        amount,
        tokenId,
        status: 'pending',
        reason: null,
        at: nowMs(),
        onRecorded: () => Promise.all([refreshHistory(), refreshBalances()]),
      };
      sends.set(send.sendId, send);
      emit(NEXT_CLIENT_EVENT.HISTORY, null);
      try {
        await withSession((token) => api.signSend(request.id, token, signed.signatures));
      } catch (e) {
        // Signed and saved: the identical bytes go again until the backend has them.
        log.error('The signatures did not reach the Hathor Next backend; resubmitting.', e);
      }
      followSent(mine, send);
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
     * A creation's outputs are all public, its HTR change too. Once the checks pass, and right
     * before anything is signed, `approveSigning` is asked with that change's amount, read from
     * the bytes (0n for none): the user's consent to it, and the app's that the creation is still
     * allowed where the user authorized it. The creation is signed only if it answers true, and
     * is cancelled otherwise.
     *
     * @param {{ words: string, symbol: string, name: string, amount: bigint,
     *   approveSigning: function(bigint): Promise<boolean> }} creation
     * @returns {Promise<{ sendId: string, tokenId: string }>}
     */
    async createToken({ words, symbol, name, amount, approveSigning }) {
      if (typeof approveSigning !== 'function') {
        throw new NextClientError(NEXT_CLIENT_ERROR.TOKEN_PREPARE_FAILED);
      }
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
      // This wallet's nonces: a reconnect to another wallet replaces the client's store, and
      // this attempt's nonce stays in the one it was taken from.
      const store = nonces;
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
      // Nothing is reserved for a Hathor Next the app left while the registry was read.
      if (mine !== generation) {
        throw new NextClientError(NEXT_CLIENT_ERROR.NOT_CONNECTED);
      }
      let nonce;
      try {
        nonce = await store.reserve(scan);
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
        await store.release(nonce);
        throw new NextClientError(NEXT_CLIENT_ERROR.NO_KEYS);
      }
      // The app left Hathor Next (its flag turned off), or went to another backend, while the
      // keys were derived: no backend is asked for the token, and nothing is signed. The session
      // stops one that comes while the backend builds it, and the check right before signing one
      // that comes after.
      if (mine !== generation) {
        await store.release(nonce);
        throw new NextClientError(NEXT_CLIENT_ERROR.NOT_CONNECTED);
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
        await store.release(nonce);
        throw prepareError(e, null, NEXT_CLIENT_ERROR.TOKEN_PREPARE_FAILED);
      }
      const cancel = () => withSession((token) => api.cancelSend(request.id, token))
        .catch((e) => log.error('Could not cancel an unsigned Hathor Next token creation.', e));
      // Once more right before signing, as signing and its fee can't be undone: nothing is signed
      // for a Hathor Next the app left. Not cancelled, which would log in again where it left:
      // the unsigned creation expires.
      if (mine !== generation) {
        await store.release(nonce);
        throw new NextClientError(NEXT_CLIENT_ERROR.NOT_CONNECTED);
      }
      if (!keys) {
        await cancel();
        await store.release(nonce);
        throw new NextClientError(NEXT_CLIENT_ERROR.NO_KEYS);
      }
      let context = {
        b: keys.b,
        pubB: keys.pubB,
        intent: { symbol, name, amount, mintAuthority, meltAuthority },
        nativeTokenId: native,
        serviceViewPub: config.serviceViewPub,
        amountWidth,
        maxFee: maxFee(),
        nowS: Math.floor(nowMs() / 1000),
        ledger,
      };
      const refused = async (e) => {
        log.error(`A Hathor Next token creation was refused before signing: ${e.message}`);
        await cancel();
        await store.release(nonce);
        return new NextClientError(
          e instanceof CoinsNotNeededError
            ? NEXT_CLIENT_ERROR.TOKEN_EXTRA_COINS : NEXT_CLIENT_ERROR.TOKEN_REFUSED,
          { feeSymbol: config.nativeTokenSymbol },
        );
      };
      // Checked once before it is approved, so the change the user sees is the one they'd sign.
      let reviewed;
      try {
        reviewed = checkCreateRequest(request, context);
      } catch (e) {
        throw await refused(e instanceof SignRefusedError
          ? e : new SignRefusedError(`The request can't be read: ${e.message}`));
      }
      let approved = false;
      try {
        approved = (await approveSigning(reviewed.publicChange)) === true;
      } catch (e) {
        log.error('The signing of a Hathor Next token creation was not answered.', e);
      }
      // The answer may take a while: the app may have left Hathor Next, locked or let the
      // creation expire meanwhile. Not cancelled where it left, which would log in again there.
      if (mine !== generation) {
        await store.release(nonce);
        throw new NextClientError(NEXT_CLIENT_ERROR.NOT_CONNECTED);
      }
      if (!approved) {
        await cancel();
        await store.release(nonce);
        throw new NextClientError(NEXT_CLIENT_ERROR.TOKEN_DECLINED);
      }
      if (!keys) {
        await cancel();
        await store.release(nonce);
        throw new NextClientError(NEXT_CLIENT_ERROR.NO_KEYS);
      }
      const nowS = Math.floor(nowMs() / 1000);
      if (request.expires_at <= nowS) {
        await store.release(nonce);
        throw new NextClientError(NEXT_CLIENT_ERROR.TOKEN_REVIEW_EXPIRED);
      }
      context = { ...context, b: keys.b, pubB: keys.pubB, nowS };
      let signed;
      try {
        signed = await verifyAndSign(request, context, checkCreateRequest);
      } catch (e) {
        if (e instanceof LedgerConflictError) {
          // An earlier transaction signed these outputs: it goes out again, and this one waits.
          await cancel();
          await store.release(nonce);
          await resubmit(e.entry);
          throw new NextClientError(NEXT_CLIENT_ERROR.EARLIER_PENDING);
        }
        if (e instanceof SignRefusedError) {
          throw await refused(e);
        }
        // Not signed, or its signatures not saved (the ledger's write failed): nothing was
        // submitted, which comes after signing returns, so the creation is cancelled. Its nonce
        // stays reserved: the failed write may still have saved the signatures, and a nonce whose
        // signatures may exist is never used again. One left unused so costs nothing.
        await cancel();
        throw e;
      }
      // Signed: bytes carrying the nonce exist, so it never comes round again. The signed
      // transaction is saved already and goes out below, whatever this write does: one that fails
      // leaves the nonce reserved, which holds it all the same, and is made again once the
      // creation is recorded.
      let floorSaved = false;
      const saveFloor = async () => {
        try {
          await store.markSigned(nonce);
          floorSaved = true;
        } catch (e) {
          log.error('Could not save a Hathor Next token\'s nonce as signed; it stays reserved.', e);
        }
      };
      await saveFloor();
      // Recorded: the registry names the token now, and the balance holds its supply. The token's
      // id is the recorded transaction's, which the builder could have made other than the bytes
      // signed here (it holds the excess's secret): until the registry row carrying this wallet's
      // own mint key at this nonce and the recorded id names the token, the signed id is
      // provisional.
      const creation = {
        sendId: request.id,
        txId: signed.txId,
        provisional: true,
        // What the read-back needs: the wallet and mint key it was made with, and the recorded
        // transaction's id once the backend gives it.
        wallet: id,
        mint: bytesToHex(mintAuthority),
        recordedTxId: null,
        signedTx: signed.signedTx,
        symbol,
        name,
        amount,
        status: 'pending',
        reason: null,
        at: nowMs(),
        onRecorded: async (at) => {
          // As refreshAll does: balances and history first, so the tokens read next include it.
          try {
            await Promise.all([refreshHistory(), refreshBalances()]);
            await refreshTokens();
          } catch (e) {
            log.error('Could not refresh Hathor Next after a token creation.', e);
          }
          if (!floorSaved) {
            await saveFloor();
          }
          resolveCreatedToken(at, creation);
        },
      };
      creations.set(creation.sendId, creation);
      try {
        await withSession((token) => api.signSend(request.id, token, signed.signatures));
      } catch (e) {
        log.error('The signatures did not reach the Hathor Next backend; resubmitting.', e);
      }
      followSent(mine, creation);
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
        ? {
          sendId,
          status: creation.status,
          reason: creation.reason,
          txId: creation.txId,
          provisional: creation.provisional,
        }
        : null;
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
      // The backend answers a bare list. Anything else is no answer, never an empty list: a
      // transfer missing from it would count as one the backend no longer knows.
      if (!Array.isArray(body)) {
        throw new Error('The Hathor Next backend\'s list of transfers is not a list.');
      }
      return body;
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
