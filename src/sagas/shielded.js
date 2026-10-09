/**
 * Copyright (c) Hathor Labs and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import {
  all,
  call,
  delay,
  put,
  select,
  takeEvery,
  takeLatest,
} from 'redux-saga/effects';
import { constants as hathorLibConstants } from '@hathor/wallet-lib';
import { DEFAULT_TOKEN } from '../constants';
import {
  types,
  tokenFetchBalanceRequested,
  tokenFetchHistoryRequested,
  tokenInvalidateHistory,
  walletRefreshSharedAddress,
} from '../actions';
import { getRegisteredTokenUids } from './helpers';
import { WALLET_STATUS } from './wallet';
import { selectShieldedCapability } from '../shielded/gating';
import { logger } from '../logger';

const log = logger('shielded');

/**
 * How long a capability change waits for the next one before the balances are refreshed. A
 * forced balance fetch whose balance didn't change is retried twice, so refreshing at every
 * event would cost almost a second per registered token.
 */
export const CAPABILITY_REFRESH_DELAY_MS = 300;

/**
 * Whether a change of the shielded capability can change the wallet's balances: its level,
 * cause or history completeness changed, or fewer of its outputs are locked or in error, since
 * a walk over the history decoded them.
 *
 * @param {Object|null} previous The capability the balances were loaded with
 * @param {Object|null} next The capability now
 * @returns {boolean}
 */
export function isBalanceRelevantChange(previous, next) {
  if (!next) {
    return false;
  }
  if (!previous) {
    return true;
  }
  return previous.level !== next.level
    || previous.cause !== next.cause
    || previous.historyComplete !== next.historyComplete
    || next.undecoded.locked < previous.undecoded.locked
    || next.undecoded.error < previous.undecoded.error;
}

/**
 * Fetches the balances of the registered tokens again, with the history of HTR and of the
 * default token, and marks the other histories stale, as handleTx does for the tokens a tx
 * touches. It runs only for the running wallet once its start finished and while it is ready:
 * a start or reload loads the balances itself, and a wallet that processes its history (after
 * an unlock or a reconnect) is not ready.
 *
 * @param {Object} wallet The wallet the refresh is for
 * @returns {Generator<unknown, boolean>} Whether it refreshed
 */
export function* refreshShieldedBalances(wallet) {
  const { currentWallet, walletStartState } = yield select((state) => ({
    currentWallet: state.wallet,
    walletStartState: state.walletStartState,
  }));
  if (!wallet
    || currentWallet !== wallet
    || walletStartState !== WALLET_STATUS.READY
    || !wallet.isReady()) {
    return false;
  }

  const htrUid = hathorLibConstants.NATIVE_TOKEN_UID;
  const registeredUids = yield select(getRegisteredTokenUids);
  for (const tokenUid of registeredUids) {
    yield put(tokenFetchBalanceRequested(tokenUid, true));
    if (tokenUid === htrUid || tokenUid === DEFAULT_TOKEN.uid) {
      yield put(tokenFetchHistoryRequested(tokenUid, true));
    } else {
      yield put(tokenInvalidateHistory(tokenUid));
    }
  }
  yield put(walletRefreshSharedAddress());
  return true;
}

/**
 * Remembers the capability the balances of the running wallet were last loaded with: at the end
 * of its start or of a reload, or at the last refresh.
 */
export function createLoadedCapability() {
  let loaded = { wallet: null, capability: null };
  return {
    /** The capability the balances of `wallet` were loaded with, or null. */
    of: (wallet) => (loaded.wallet === wallet ? loaded.capability : null),
    record: (wallet, capability) => {
      loaded = { wallet, capability };
    },
  };
}

/**
 * Handles SHIELDED_CAPABILITY_UPDATE: once the changes settle, refreshes the balances when the
 * capability differs from the one they were loaded with, in a way that can change them.
 *
 * @param {ReturnType<createLoadedCapability>} loaded
 */
export function* onShieldedCapabilityUpdate(loaded) {
  try {
    yield delay(CAPABILITY_REFRESH_DELAY_MS);
    const { wallet, capability } = yield select((state) => ({
      wallet: state.wallet,
      capability: selectShieldedCapability(state),
    }));
    if (!wallet || !isBalanceRelevantChange(loaded.of(wallet), capability)) {
      return;
    }
    if (yield call(refreshShieldedBalances, wallet)) {
      loaded.record(wallet, capability);
    }
  } catch (e) {
    log.error('Failed to refresh the balances after a shielded capability change.', e);
  }
}

/**
 * Handles START_WALLET_SUCCESS: a start, or a reload after a reconnect, has just loaded the
 * balances, with the capability the wallet has now.
 *
 * @param {ReturnType<createLoadedCapability>} loaded
 */
export function* onWalletBalancesLoaded(loaded) {
  try {
    const { wallet, capability } = yield select((state) => ({
      wallet: state.wallet,
      capability: selectShieldedCapability(state),
    }));
    loaded.record(wallet, capability);
  } catch (e) {
    log.error('Failed to record the shielded capability of the loaded balances.', e);
  }
}

export function* saga() {
  const loaded = createLoadedCapability();
  yield all([
    takeLatest(types.SHIELDED_CAPABILITY_UPDATE, onShieldedCapabilityUpdate, loaded),
    takeEvery(types.START_WALLET_SUCCESS, onWalletBalancesLoaded, loaded),
  ]);
}
