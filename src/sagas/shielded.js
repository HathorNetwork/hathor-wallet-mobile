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
  shieldedReceiveAddressUpdate,
  tokenFetchBalanceRequested,
  tokenFetchHistoryRequested,
  tokenInvalidateHistory,
  walletRefreshSharedAddress,
} from '../actions';
import { getRegisteredTokenUids } from './helpers';
import { WALLET_STATUS } from './wallet';
import { isShieldedEnvironment, selectShieldedCapability } from '../shielded/gating';
import { SHIELDED_UNLOCK_STATUS, unlockShieldedViewIfLocked } from '../shielded/unlock';
import {
  RECEIVE_REASON_ERROR,
  SHIELDED_RECEIVE_INITIAL_STATE,
  SHIELDED_RECEIVE_STATUS,
  isSameReceiveState,
  receiveStateFromCapability,
  receiveStateFromError,
  selectShieldedReceive,
} from '../shielded/receiveState';
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
 * Reads where the private receive address of a wallet stands: its shielded capability, then, at
 * level 'view' or 'full', its current shielded address. It throws the errors the receive state
 * doesn't expect.
 *
 * @param {HathorWallet} wallet A started fullnode-facade wallet
 * @returns {Promise<Object>} The receive state: status, address, index and reason
 */
export async function readShieldedReceive(wallet) {
  const capability = await wallet.getShieldedCapability();
  const fromCapability = receiveStateFromCapability(capability);
  if (fromCapability) {
    return { ...SHIELDED_RECEIVE_INITIAL_STATE, ...fromCapability };
  }

  try {
    const { address, index } = await wallet.getCurrentAddress({}, { legacy: false });
    return {
      status: SHIELDED_RECEIVE_STATUS.READY,
      address,
      index,
      reason: null,
    };
  } catch (e) {
    const fromError = receiveStateFromError(e);
    if (!fromError) {
      throw e;
    }
    return { ...SHIELDED_RECEIVE_INITIAL_STATE, ...fromError };
  }
}

/**
 * Numbers the refreshes of the private receive state, so that a refresh another one started
 * after doesn't overwrite what the later one read.
 */
export function createReceiveRefreshes() {
  let latest = 0;
  return {
    /** Starts a refresh and returns its number. */
    next: () => {
      latest += 1;
      return latest;
    },
    /** Whether no refresh started after the one numbered `refresh`. */
    isLatest: (refresh) => refresh === latest,
  };
}

/**
 * Refreshes state.shielded.receive: the running wallet's private receive address, or why it
 * gives none out. While the shielded UI is off, it reads nothing from the wallet and the state
 * goes back to idle. It keeps what it read only for the wallet that still runs, when no refresh
 * started after it, and puts nothing when the state is the same.
 *
 * @param {ReturnType<createReceiveRefreshes>} refreshes
 */
export function* refreshShieldedReceive(refreshes) {
  const refresh = refreshes.next();
  try {
    const { wallet, environment } = yield select((state) => ({
      wallet: state.wallet,
      environment: isShieldedEnvironment(state),
    }));

    let next = SHIELDED_RECEIVE_INITIAL_STATE;
    if (wallet && environment) {
      try {
        next = yield call(readShieldedReceive, wallet);
      } catch (e) {
        log.error('Failed to read the private receive address.', e);
        next = {
          ...SHIELDED_RECEIVE_INITIAL_STATE,
          status: SHIELDED_RECEIVE_STATUS.UNAVAILABLE,
          reason: RECEIVE_REASON_ERROR,
        };
      }
    }

    const { currentWallet, current } = yield select((state) => ({
      currentWallet: state.wallet,
      current: selectShieldedReceive(state),
    }));
    if (!refreshes.isLatest(refresh)
      || currentWallet !== wallet
      || isSameReceiveState(current, next)) {
      return;
    }
    yield put(shieldedReceiveAddressUpdate(next));
  } catch (e) {
    log.error('Failed to refresh the private receive address.', e);
  }
}

/**
 * Handles SHIELDED_CAPABILITY_UPDATE: once the changes settle, refreshes the private receive
 * address, and refreshes the balances when the capability differs from the one they were loaded
 * with, in a way that can change them.
 *
 * @param {ReturnType<createLoadedCapability>} loaded
 * @param {ReturnType<createReceiveRefreshes>} receiveRefreshes
 */
export function* onShieldedCapabilityUpdate(loaded, receiveRefreshes) {
  try {
    yield delay(CAPABILITY_REFRESH_DELAY_MS);
    yield call(refreshShieldedReceive, receiveRefreshes);
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
  const receiveRefreshes = createReceiveRefreshes();
  yield all([
    takeLatest(
      types.SHIELDED_CAPABILITY_UPDATE,
      onShieldedCapabilityUpdate,
      loaded,
      receiveRefreshes,
    ),
    takeEvery(types.START_WALLET_SUCCESS, onWalletBalancesLoaded, loaded),
    takeLatest(types.SHIELDED_VIEW_UNLOCK_REQUESTED, onShieldedViewUnlockRequested, loaded),
    // Dispatched at the end of a start or a reload, by handleTx and after a balance refresh.
    takeEvery(types.WALLET_REFRESH_SHARED_ADDRESS, refreshShieldedReceive, receiveRefreshes),
  ]);
}
