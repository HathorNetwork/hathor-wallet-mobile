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
  spawn,
  takeEvery,
  takeLatest,
} from 'redux-saga/effects';
import { constants as hathorLibConstants } from '@hathor/wallet-lib';
import { DEFAULT_TOKEN, SHIELDED_PROVIDER_STATUS } from '../constants';
import {
  types,
  shieldedCapabilityUpdate,
  tokenFetchBalanceRequested,
  tokenFetchHistoryRequested,
  tokenInvalidateHistory,
  walletRefreshSharedAddress,
} from '../actions';
import { getRegisteredTokenUids } from './helpers';
import { WALLET_STATUS } from './wallet';
import { selectShieldedCapability } from '../shielded/gating';
import { SHIELDED_UNLOCK_STATUS, unlockShieldedViewIfLocked } from '../shielded/unlock';
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

/**
 * Waits for the walk an unlock requested, then refreshes the balances, which the walk changed,
 * if the wallet still runs. The walk's end changes the capability, but the event that carries
 * it fires only when the capability differs from the last one it carried.
 *
 * @param {ReturnType<createLoadedCapability>} loaded
 * @param {Object} wallet The unlocked wallet
 * @param {Promise<Object>} reprocessed Resolves with the capability once the walk ends
 */
export function* refreshAfterUnlockWalk(loaded, wallet, reprocessed) {
  try {
    const capability = yield call(() => reprocessed);
    if (yield call(refreshShieldedBalances, wallet)) {
      loaded.record(wallet, capability);
    }
  } catch (e) {
    log.error('Failed to refresh the balances after a shielded unlock.', e);
  }
}

/**
 * Handles SHIELDED_VIEW_UNLOCK_REQUESTED: unlocks the shielded view key of the running wallet
 * with the PIN the user entered, when the wallet holds its shielded outputs locked. It runs only
 * where the crypto provider passed its self-test: without it, nothing can be decoded. The PIN is
 * never logged, and a refusal shows nothing to the user.
 *
 * @param {ReturnType<createLoadedCapability>} loaded
 * @param {Object} action The SHIELDED_VIEW_UNLOCK_REQUESTED action
 */
export function* onShieldedViewUnlockRequested(loaded, action) {
  try {
    const { wallet, providerStatus } = yield select((state) => ({
      wallet: state.wallet,
      providerStatus: state.shielded?.providerStatus,
    }));
    if (!wallet || providerStatus !== SHIELDED_PROVIDER_STATUS.READY) {
      return;
    }

    const result = yield call(unlockShieldedViewIfLocked, wallet, action.payload.pinCode);
    if (result.status === SHIELDED_UNLOCK_STATUS.FAILED) {
      log.error('The shielded view key was not unlocked at a PIN entry.', {
        source: action.payload.source,
        errorCode: result.errorCode,
      });
      return;
    }
    if (result.status !== SHIELDED_UNLOCK_STATUS.UNLOCKED) {
      return;
    }

    yield put(shieldedCapabilityUpdate(result.capability));
    // Detached, so that the next PIN entry, which replaces this handler, doesn't cancel it.
    yield spawn(refreshAfterUnlockWalk, loaded, wallet, result.reprocessed);
  } catch (e) {
    log.error('Failed to unlock the shielded view key at a PIN entry.', e);
  }
}

export function* saga() {
  const loaded = createLoadedCapability();
  yield all([
    takeLatest(types.SHIELDED_CAPABILITY_UPDATE, onShieldedCapabilityUpdate, loaded),
    takeEvery(types.START_WALLET_SUCCESS, onWalletBalancesLoaded, loaded),
    takeLatest(types.SHIELDED_VIEW_UNLOCK_REQUESTED, onShieldedViewUnlockRequested, loaded),
  ]);
}
