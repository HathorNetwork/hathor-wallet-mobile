/**
 * Copyright (c) Hathor Labs and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { getIntegerAmount } from '../../utils';
import { NEXT_DECIMAL_PLACES } from '../chains';
import { NEXT_CLIENT_EVENT, NextClientError, NEXT_CLIENT_ERROR } from '../nextClientErrors';
import {
  computeBalances,
  fakeTxId,
  lastActivity,
  ledgerTransfers,
  loadLedger,
  MOCK_NATIVE_TOKEN,
  onTransferAdded,
  saveLedger,
} from './mockLedger';
import { MOCK_SCENARIO } from './scenarios';
import { deriveMockNextAddress } from './mockAddress';
import {
  CONNECT_DELAY_MS,
  NEXT_SEND_FEE,
  OFFLINE_AFTER_MS,
  OFFLINE_FOR_MS,
  SEND_DELAY_MS,
  SLOW_SYNC_MS,
} from './mockValues';

export { deriveMockNextAddress, mockPeerAddress } from './mockAddress';

const HISTORY_PAGE_SIZE = 20;

const REJECTION_REASON = 'Rejected by the network: the transaction failed validation.';

const wait = (ms) => new Promise((resolve) => { setTimeout(resolve, ms); });

/**
 * A simulated Hathor Next client, with the interface of the real one
 * (src/multichain/nextClient.js). Nothing it does leaves the device: its ledger is saved per
 * network (mockLedger.js) and it behaves as the ledger's scenario says.
 */
export function createMockNextClient() {
  const listeners = new Map(Object.values(NEXT_CLIENT_EVENT).map((event) => [event, new Set()]));
  const timers = new Set();
  let address = null;
  // The fullnode's network name, which keys the ledger. Set by connect.
  let network = null;
  let connected = false;
  let online = false;
  let sweeping = false;
  let sendCount = 0;
  let stopTransferWatch = null;
  // Each connect and disconnect starts a new one: a connect still waiting when a disconnect
  // happens finds it changed, and fails instead of connecting.
  let generation = 0;

  const emit = (event, payload) => {
    for (const listener of listeners.get(event)) {
      listener(payload);
    }
  };

  const schedule = (fn, ms) => {
    const timer = setTimeout(() => {
      timers.delete(timer);
      fn();
    }, ms);
    timers.add(timer);
  };

  const ledger = () => loadLedger(network);

  const emitLedgerChanged = () => {
    emit(NEXT_CLIENT_EVENT.BALANCE, null);
    emit(NEXT_CLIENT_EVENT.HISTORY, null);
  };

  // Announces each transfer still on its way when it arrives, while the client is connected: the
  // ledger counts it by the clock, so the balance changes then.
  const scheduleArrivals = () => {
    const now = Date.now();
    for (const transfer of ledgerTransfers(ledger(), now)) {
      if (transfer.arriveAt > now) {
        schedule(emitLedgerChanged, transfer.arriveAt - now);
      }
    }
  };

  const sendFee = () => getIntegerAmount(NEXT_SEND_FEE, NEXT_DECIMAL_PLACES);

  const requireConnected = () => {
    if (!connected) {
      throw new NextClientError(NEXT_CLIENT_ERROR.NOT_CONNECTED);
    }
  };

  return {
    simulated: true,

    /**
     * Derives the wallet's Hathor Next keys from its words. No network.
     *
     * @param {{ words: string }} params
     * @returns {Promise<{ address: string }>}
     */
    async prepareKeys({ words }) {
      address = await deriveMockNextAddress(words);
      return { address };
    },

    /** @returns {boolean} Whether the keys were derived */
    hasKeys() {
      return address !== null;
    },

    /**
     * The simulated keys are no secret, so a lock keeps them.
     *
     * @returns {boolean} false: nothing was dropped
     */
    forgetKeys() {
      return false;
    },

    /**
     * Registers the wallet on first use and opens its session.
     *
     * @param {{ network: string, config: Object, birthday: 'genesis' }} params
     */
    async connect({ network: connectNetwork }) {
      if (!address) {
        throw new NextClientError(NEXT_CLIENT_ERROR.NO_KEYS);
      }
      generation += 1;
      const mine = generation;
      network = connectNetwork;
      await wait(CONNECT_DELAY_MS);
      if (mine !== generation) {
        throw new NextClientError(NEXT_CLIENT_ERROR.NOT_CONNECTED);
      }
      const { scenario } = ledger();
      if (scenario === MOCK_SCENARIO.CONNECT_FAILS) {
        throw new NextClientError(NEXT_CLIENT_ERROR.CONNECT_FAILED);
      }
      connected = true;
      online = true;
      scheduleArrivals();
      stopTransferWatch = onTransferAdded((transferNetwork) => {
        if (transferNetwork === network) {
          scheduleArrivals();
        }
      });
      if (scenario === MOCK_SCENARIO.SLOW_SYNC) {
        sweeping = true;
        schedule(() => {
          sweeping = false;
          emit(NEXT_CLIENT_EVENT.SWEEP, { sweeping });
          emitLedgerChanged();
        }, SLOW_SYNC_MS);
      }
      if (scenario === MOCK_SCENARIO.GOES_OFFLINE) {
        schedule(() => {
          online = false;
          emit(NEXT_CLIENT_EVENT.CONNECTION, { online });
          schedule(() => {
            online = true;
            emit(NEXT_CLIENT_EVENT.CONNECTION, { online });
          }, OFFLINE_FOR_MS);
        }, OFFLINE_AFTER_MS);
      }
    },

    /**
     * Closes the session. The keys stay, so a later connect needs no unlock. A connect still
     * waiting fails.
     */
    disconnect() {
      generation += 1;
      for (const timer of timers) {
        clearTimeout(timer);
      }
      timers.clear();
      stopTransferWatch?.();
      stopTransferWatch = null;
      connected = false;
      online = false;
      sweeping = false;
    },

    /** @returns {string|null} */
    getAddress() {
      return address;
    },

    /** @returns {string|null} The network the client is connected to */
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
      const current = ledger();
      const last = lastActivity(current);
      return Object.values(current.tokens).map((token) => (
        { ...token, lastActivityAt: last[token.id] ?? null }
      ));
    },

    /**
     * @returns {{ sweeping: boolean, balances: { [tokenId: string]: { available: bigint } } }}
     */
    getBalances() {
      requireConnected();
      const balances = computeBalances(ledger());
      return {
        sweeping,
        balances: Object.fromEntries(
          Object.entries(balances).map(([tokenId, available]) => [tokenId, { available }]),
        ),
      };
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
      const rows = ledger().rows
        .filter((row) => row.tokenId === tokenId)
        .sort((a, b) => b.at - a.at);
      const page = rows.slice(cursor, cursor + HISTORY_PAGE_SIZE);
      const end = cursor + page.length;
      return { rows: page, cursor: end < rows.length ? end : null };
    },

    /** @returns {bigint} The flat fee of a payment, in the native token */
    getSendFee() {
      return sendFee();
    },

    /**
     * Signs and submits a payment. Sign-once: the draft is spent the moment this is called, and
     * nothing may call it again for the same draft. The outcome arrives as a SEND event.
     *
     * @param {{ tokenId: string, to: string, amount: bigint }} draft
     * @returns {Promise<{ sendId: string }>}
     */
    async send({ tokenId, to, amount }) {
      requireConnected();
      if (!online) {
        throw new NextClientError(NEXT_CLIENT_ERROR.OFFLINE);
      }
      if (sweeping) {
        throw new NextClientError(NEXT_CLIENT_ERROR.SWEEPING);
      }
      const current = ledger();
      const fee = sendFee();
      const balances = computeBalances(current);
      const native = MOCK_NATIVE_TOKEN.id;
      // The amount comes out of the token sent, and the fee out of the native token.
      const needed = { [tokenId]: amount };
      needed[native] = (needed[native] ?? 0n) + fee;
      const short = Object.entries(needed).some(([id, value]) => value > (balances[id] ?? 0n));
      if (amount <= 0n || short) {
        throw new NextClientError(NEXT_CLIENT_ERROR.INSUFFICIENT_FUNDS);
      }

      sendCount += 1;
      const sendId = `send-${Date.now()}-${sendCount}`;
      const now = Date.now();
      const base = {
        txId: null,
        tokenId,
        direction: 'out',
        mode: 'private',
        status: 'pending',
        at: now,
        reason: null,
        sendId,
      };
      saveLedger(network, {
        ...current,
        rows: [
          ...current.rows,
          { ...base, id: sendId, kind: 'payment', amount: amount.toString(), peer: to },
          {
            ...base,
            id: `${sendId}:fee`,
            tokenId: native,
            kind: 'fee',
            amount: fee.toString(),
            peer: null,
          },
        ],
      });
      emitLedgerChanged();

      schedule(() => {
        const { scenario } = ledger();
        let status = 'recorded';
        let reason = null;
        if (scenario === MOCK_SCENARIO.SEND_REJECTED) {
          status = 'failed';
          reason = REJECTION_REASON;
        } else if (scenario === MOCK_SCENARIO.SEND_UNCONFIRMED) {
          status = 'unconfirmed';
        }
        const txId = status === 'failed' ? null : fakeTxId(now % 2147483647);
        const settled = ledger();
        saveLedger(network, {
          ...settled,
          rows: settled.rows.map((row) => (
            row.sendId === sendId ? { ...row, status, reason, txId } : row
          )),
        });
        emit(NEXT_CLIENT_EVENT.SEND, { sendId, status, reason, txId });
        emitLedgerChanged();
      }, SEND_DELAY_MS);

      return { sendId };
    },

    /**
     * A payment's state as the simulated ledger has it.
     *
     * @param {string} sendId
     * @returns {{ sendId: string, status: string, reason: string|null, txId: string|null }|null}
     */
    getSend(sendId) {
      const row = connected ? ledger().rows.find((r) => r.id === sendId) : null;
      return row ? { sendId, status: row.status, reason: row.reason, txId: row.txId } : null;
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
