/**
 * Copyright (c) Hathor Labs and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { types } from '../actions';
import { DEFAULT_MOCK_SCENARIO } from './mock/scenarios';

/**
 * Where turning "Connect to side chain" on stands: idle, unlocking (the passkey ceremony that
 * derives the keys), connecting, or failed (the setting stayed off, with the error).
 */
export const CONNECT_STATUS = {
  IDLE: 'idle',
  UNLOCKING: 'unlocking',
  CONNECTING: 'connecting',
  FAILED: 'failed',
};

/**
 * Where Hathor Next stands: stopped (not connected), connecting, ready, or failed.
 */
export const NEXT_STATUS = {
  STOPPED: 'stopped',
  CONNECTING: 'connecting',
  READY: 'ready',
  FAILED: 'failed',
};

/**
 * Where a Hathor Next payment, or a transfer between chains, stands. A send's outcome is the
 * status of its row: recorded, unconfirmed or failed.
 */
export const OPERATION_STATUS = {
  IDLE: 'idle',
  SENDING: 'sending',
  RECORDED: 'recorded',
  UNCONFIRMED: 'unconfirmed',
  FAILED: 'failed',
  ERROR: 'error',
  DONE: 'done',
};

/**
 * Where a transfer between chains stands: on its way, or arrived on the other chain.
 */
export const TRANSFER_STATUS = {
  PENDING: 'pending',
  ARRIVED: 'arrived',
};

export const NEXT_INITIAL_STATE = {
  status: NEXT_STATUS.STOPPED,
  online: true,
  // Whether the keys are in memory, so loading Hathor Next needs no PIN or passkey.
  keysReady: false,
  // The one address, saved: it is public.
  address: null,
  error: null,
  sweeping: false,
  // The flat fee of a payment, in the native token's units.
  sendFee: 0n,
  // tokenId → { id, name, symbol, lastActivityAt }
  tokens: {},
  // tokenId → { status, data: { available } }
  balances: {},
  // tokenId → { status, data: rows newest first, cursor }
  history: {},
};

const CONNECT_INITIAL_STATE = {
  status: CONNECT_STATUS.IDLE,
  error: null,
};

const SEND_INITIAL_STATE = {
  status: OPERATION_STATUS.IDLE,
  draftId: null,
  sendId: null,
  txId: null,
  reason: null,
  error: null,
};

const TRANSFER_INITIAL_STATE = {
  status: OPERATION_STATUS.IDLE,
  record: null,
  error: null,
};

export const MULTICHAIN_INITIAL_STATE = {
  // network → true, where "Connect to side chain" is on
  connectedNetworks: {},
  connect: CONNECT_INITIAL_STATE,
  next: NEXT_INITIAL_STATE,
  // The transfers between chains, newest first (TransferRecord, src/multichain/bridge.js)
  transfers: [],
  send: SEND_INITIAL_STATE,
  transfer: TRANSFER_INITIAL_STATE,
  mock: { scenario: DEFAULT_MOCK_SCENARIO },
};

/**
 * Whether an action belongs to the multichain state.
 *
 * @param {Object} action
 * @returns {boolean}
 */
export function isMultichainAction(action) {
  return typeof action.type === 'string' && action.type.startsWith('MULTICHAIN_');
}

/**
 * The multichain part of the state. Actions that carry a PIN are never stored.
 *
 * @param {Object} state state.multichain
 * @param {Object} action
 * @returns {Object}
 */
export function multichainReducer(state = MULTICHAIN_INITIAL_STATE, action) {
  switch (action.type) {
    case types.MULTICHAIN_CONNECTED_NETWORKS_SET:
      return { ...state, connectedNetworks: action.payload ?? {} };
    case types.MULTICHAIN_CONNECT_UPDATE:
      return { ...state, connect: { ...state.connect, ...action.payload } };
    case types.MULTICHAIN_NEXT_UPDATE:
      return { ...state, next: { ...state.next, ...action.payload } };
    case types.MULTICHAIN_NEXT_RESET:
      return {
        ...state,
        next: {
          ...NEXT_INITIAL_STATE,
          keysReady: state.next.keysReady,
          address: state.next.address,
        },
        transfers: [],
        send: SEND_INITIAL_STATE,
      };
    case types.MULTICHAIN_NEXT_HISTORY_UPDATE: {
      const { tokenId, status, data, cursor } = action.payload;
      const previous = state.next.history[tokenId] ?? {};
      return {
        ...state,
        next: {
          ...state.next,
          history: {
            ...state.next.history,
            [tokenId]: {
              status,
              data: data ?? previous.data ?? [],
              cursor: cursor === undefined ? (previous.cursor ?? null) : cursor,
            },
          },
        },
      };
    }
    case types.MULTICHAIN_TRANSFERS_SET:
      return { ...state, transfers: action.payload ?? [] };
    case types.MULTICHAIN_NEXT_SEND_UPDATE:
      return { ...state, send: { ...state.send, ...action.payload } };
    case types.MULTICHAIN_NEXT_SEND_RESET:
      return { ...state, send: SEND_INITIAL_STATE };
    case types.MULTICHAIN_TRANSFER_UPDATE:
      return { ...state, transfer: { ...state.transfer, ...action.payload } };
    case types.MULTICHAIN_TRANSFER_RESET:
      return { ...state, transfer: TRANSFER_INITIAL_STATE };
    case types.MULTICHAIN_MOCK_UPDATE:
      return { ...state, mock: { ...state.mock, ...action.payload } };
    default:
      return state;
  }
}
