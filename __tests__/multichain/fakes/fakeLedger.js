/**
 * Copyright (c) Hathor Labs and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { STORE } from '../../../src/store';
import { getIntegerAmount } from '../../../src/utils';
import { CHAIN, NEXT_DECIMAL_PLACES } from '../../../src/multichain/chains';
import { TRANSFER_STATUS } from '../../../src/multichain/state';
import { DEFAULT_FAKE_SCENARIO, isFundedScenario } from './scenarios';
import { fakePeerAddress } from './fakeAddress';

/**
 * The test fake's Hathor Next ledger of a network: its tokens, the wallet's transaction rows and
 * the transfers between chains (TransferRecord, src/multichain/bridge.js). It is saved, so a
 * balance survives a restart of the saga, and a reset of the wallet sweeps it (its key has the
 * 'wallet:' prefix). A transfer arrives by the clock: one to the wallet's own address adds to its
 * Hathor Next balance once its arrival time passes.
 *
 * Rows have the shape of the Hathor Next wallet's Tx (hathor-next-wallet-mobile's
 * src/mocks/data.ts): amounts are strings in base units, `peer` is null on incoming rows (nobody
 * can know who paid), and a fee is a row of its own in the native token's history, never added to
 * the payment.
 *
 * @typedef {Object} NextTx
 * @property {string} id Row identity
 * @property {string|null} txId The transaction id, once signed
 * @property {string} tokenId
 * @property {'in'|'out'} direction
 * @property {'payment'|'fee'} kind
 * @property {string} amount Base units
 * @property {'pending'|'recorded'|'failed'|'unconfirmed'|'attention'} status
 * @property {'private'} mode
 * @property {number} at Unix ms
 * @property {string|null} peer The address paid, on an outgoing payment
 * @property {string|null} [reason] The network's words about a refusal
 * @property {string|null} [sendId] The send this row belongs to
 */

/**
 * Where the ledger of a network is saved.
 *
 * @param {string} network
 * @returns {string}
 */
export function fakeLedgerKey(network) {
  return `wallet:multichain:fake:${network}`;
}

// 2: transfer records replaced the credits on their way.
const LEDGER_VERSION = 2;

// The running fake clients, told when a transfer is added so they announce its arrival.
const transferListeners = new Set();

/**
 * @param {Function} listener Called with the network a transfer was added on
 * @returns {Function} Removes the listener
 */
export function onTransferAdded(listener) {
  transferListeners.add(listener);
  return () => transferListeners.delete(listener);
}

export const FAKE_NATIVE_TOKEN = { id: '00', name: 'Hathor', symbol: 'HTR' };

// Two tokens with the same name and symbol and different ids: on Hathor Next a token's id is its
// only identity, so the screens must tell these apart.
const MOCK_TOKEN_A = {
  id: 'a1b2c3d4e5f60718293a4b5c6d7e8f90a1b2c3d4e5f60718293a4b5c6d7e8f90',
  name: 'Test Token',
  symbol: 'TST',
};
const MOCK_TOKEN_B = {
  id: '9f8e7d6c5b4a39281706f5e4d3c2b1a09f8e7d6c5b4a39281706f5e4d3c2b1a0',
  name: 'Test Token',
  symbol: 'TST',
};

const MOCK_PEER = fakePeerAddress('peer');

const units = (amount) => getIntegerAmount(amount, NEXT_DECIMAL_PLACES).toString();

const fakeTxId = (seed) => {
  let hex = '';
  let x = seed;
  while (hex.length < 64) {
    x = (x * 1103515245 + 12345) % 2147483648;
    hex += x.toString(16).padStart(8, '0');
  }
  return hex.slice(0, 64);
};

/**
 * A new ledger for a scenario: the funded scenarios hold 25.00 HTR and two tokens that share a
 * symbol.
 *
 * @param {string} scenario One of FAKE_SCENARIO
 * @param {number} [now] Unix ms
 * @returns {Object}
 */
export function seedLedger(scenario, now = Date.now()) {
  const ledger = {
    version: LEDGER_VERSION,
    scenario,
    tokens: { [FAKE_NATIVE_TOKEN.id]: FAKE_NATIVE_TOKEN },
    rows: [],
    transfers: [],
  };
  if (!isFundedScenario(scenario)) {
    return ledger;
  }

  const day = 24 * 60 * 60 * 1000;
  const row = (index, fields) => ({
    id: fakeTxId(index),
    txId: fakeTxId(index),
    kind: 'payment',
    mode: 'private',
    status: 'recorded',
    peer: null,
    reason: null,
    sendId: null,
    ...fields,
  });
  ledger.tokens[MOCK_TOKEN_A.id] = MOCK_TOKEN_A;
  ledger.tokens[MOCK_TOKEN_B.id] = MOCK_TOKEN_B;
  ledger.rows = [
    row(1, { tokenId: '00', direction: 'in', amount: units('30.00'), at: now - 3 * day }),
    row(2, { tokenId: MOCK_TOKEN_A.id, direction: 'in', amount: units('5.00'), at: now - 2 * day }),
    row(3, { tokenId: MOCK_TOKEN_B.id, direction: 'in', amount: units('1.00'), at: now - 2 * day }),
    row(4, {
      tokenId: '00', direction: 'out', amount: units('4.95'), at: now - day, peer: MOCK_PEER,
    }),
    {
      ...row(4, {
        tokenId: '00', direction: 'out', kind: 'fee', amount: units('0.05'), at: now - day,
      }),
      id: `${fakeTxId(4)}:fee`,
    },
  ];
  return ledger;
}

/**
 * The saved ledger of a network, or a new one in the default scenario.
 *
 * @param {string} network The fullnode's network name
 * @returns {Object}
 */
export function loadLedger(network) {
  const saved = STORE.getItem(fakeLedgerKey(network));
  if (saved?.version === LEDGER_VERSION) {
    return saved;
  }
  return seedLedger(DEFAULT_FAKE_SCENARIO);
}

/**
 * @param {string} network
 * @param {Object} ledger
 */
export function saveLedger(network, ledger) {
  STORE.setItem(fakeLedgerKey(network), ledger);
}

/**
 * Whether a row moves the balance: everything but a refused payment, which never left the
 * wallet. A payment that wasn't confirmed yet keeps its coins set aside.
 *
 * @param {NextTx} row
 * @returns {boolean}
 */
const countsInBalance = (row) => row.status !== 'failed';

/**
 * A transfer record with its status as of now: it arrives when its arrival time passes.
 *
 * @param {Object} transfer
 * @param {number} [now] Unix ms
 * @returns {Object}
 */
export function transferAsOf(transfer, now = Date.now()) {
  return {
    ...transfer,
    status: transfer.arriveAt <= now ? TRANSFER_STATUS.ARRIVED : TRANSFER_STATUS.PENDING,
  };
}

/**
 * The ledger's transfers as of now, newest first.
 *
 * @param {Object} ledger
 * @param {number} [now] Unix ms
 * @returns {Object[]}
 */
export function ledgerTransfers(ledger, now = Date.now()) {
  return ledger.transfers
    .map((transfer) => transferAsOf(transfer, now))
    .sort((a, b) => b.sentAt - a.sentAt);
}

/**
 * The available balance of every token the ledger knows, in base units: its rows, plus the
 * transfers to the wallet's own address that arrived, less the ones that left Hathor Next.
 *
 * @param {Object} ledger
 * @param {number} [now] Unix ms
 * @returns {{ [tokenId: string]: bigint }}
 */
export function computeBalances(ledger, now = Date.now()) {
  const balances = {};
  const add = (tokenId, amount) => {
    balances[tokenId] = (balances[tokenId] ?? 0n) + amount;
  };
  for (const tokenId of Object.keys(ledger.tokens)) {
    balances[tokenId] = 0n;
  }
  for (const row of ledger.rows) {
    if (countsInBalance(row)) {
      const amount = BigInt(row.amount);
      add(row.tokenId, row.direction === 'in' ? amount : -amount);
    }
  }
  for (const transfer of ledgerTransfers(ledger, now)) {
    if (transfer.from === CHAIN.HATHOR_NEXT) {
      add(transfer.nextTokenId, -BigInt(transfer.amount));
    } else if (transfer.toOwn && transfer.status === TRANSFER_STATUS.ARRIVED) {
      add(transfer.nextTokenId, BigInt(transfer.receiveAmount));
    }
  }
  return balances;
}

/**
 * When each token last moved: its rows and the transfers that reached it.
 *
 * @param {Object} ledger
 * @param {number} [now] Unix ms
 * @returns {{ [tokenId: string]: number }} Unix ms
 */
export function lastActivity(ledger, now = Date.now()) {
  const last = {};
  const seen = (tokenId, at) => {
    last[tokenId] = Math.max(last[tokenId] ?? 0, at);
  };
  for (const row of ledger.rows) {
    seen(row.tokenId, row.at);
  }
  for (const transfer of ledgerTransfers(ledger, now)) {
    if (transfer.toOwn && transfer.status === TRANSFER_STATUS.ARRIVED) {
      seen(transfer.nextTokenId, transfer.arriveAt);
    }
  }
  return last;
}

/**
 * Adds a transfer between chains to the ledger of a network.
 *
 * @param {string} network
 * @param {Object} transfer TransferRecord, amounts as strings
 * @returns {Object} The new ledger
 */
export function addTransfer(network, transfer) {
  const ledger = loadLedger(network);
  const next = { ...ledger, transfers: [...ledger.transfers, transfer] };
  saveLedger(network, next);
  for (const listener of transferListeners) {
    listener(network);
  }
  return next;
}

/**
 * Starts the ledger over in a scenario. Transfers stay: they happened on Hathor Network too.
 *
 * @param {string} network
 * @param {string} scenario One of FAKE_SCENARIO
 * @returns {Object} The new ledger
 */
export function resetLedger(network, scenario) {
  const { transfers } = loadLedger(network);
  const ledger = { ...seedLedger(scenario), transfers };
  saveLedger(network, ledger);
  return ledger;
}

export { fakeTxId };
