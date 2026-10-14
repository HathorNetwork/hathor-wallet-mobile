/**
 * Copyright (c) Hathor Labs and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import {
  all,
  call,
  cancelled,
  delay,
  put,
  select,
  spawn,
  takeEvery,
  takeLatest,
} from 'redux-saga/effects';
import { constants as hathorLibConstants, errors } from '@hathor/wallet-lib';
import {
  DEFAULT_TOKEN,
  SHIELDED_PROVIDER_STATUS,
  SHIELDED_UNLOCK_SOURCE,
} from '../constants';
import {
  types,
  onExceptionCaptured,
  sharedAddressUpdate,
  shieldedCapabilityUpdate,
  shieldedReceiveAddressUpdate,
  shieldedUnlockStatusUpdate,
  tokenFetchBalanceRequested,
  tokenFetchHistoryRequested,
  tokenInvalidateHistory,
  walletRefreshSharedAddress,
} from '../actions';
import { getRegisteredTokenUids } from './helpers';
import { WALLET_STATUS } from './wallet';
import { isShieldedEnvironment, selectShieldedCapability } from '../shielded/gating';
import { SHIELDED_UNLOCK_STATUS, unlockShieldedViewIfLocked } from '../shielded/unlock';
import { getWalletShieldedCapability } from '../shielded/capability';
import {
  RECEIVE_REASON_ERROR,
  SHIELDED_RECEIVE_INITIAL_STATE,
  SHIELDED_RECEIVE_STATUS,
  isSameReceiveState,
  receiveStateFromCapability,
  receiveStateFromError,
  selectShieldedReceive,
} from '../shielded/receiveState';
import { SHIELDED_UNLOCK_PROGRESS } from '../shielded/unlockState';
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
 * @param {HathorWallet|HathorWalletServiceWallet} wallet A started wallet
 * @returns {Promise<Object>} The receive state: status, address, index and reason
 */
export async function readShieldedReceive(wallet) {
  const capability = await getWalletShieldedCapability(wallet);
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
 * Where the shielded UI is on, it also puts the shared address (lastSharedAddress): the current
 * shielded address, or none while that address can't be read, never the legacy one. Elsewhere
 * the wallet saga's refreshSharedAddress puts the legacy address.
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

    const { currentWallet, current, sharedAddress } = yield select((state) => ({
      currentWallet: state.wallet,
      current: selectShieldedReceive(state),
      sharedAddress: state.lastSharedAddress,
    }));
    if (!refreshes.isLatest(refresh) || currentWallet !== wallet) {
      return;
    }
    if (environment && sharedAddress !== next.address) {
      yield put(sharedAddressUpdate(next.address, next.index));
    }
    if (!isSameReceiveState(current, next)) {
      yield put(shieldedReceiveAddressUpdate(next));
    }
  } catch (e) {
    log.error('Failed to refresh the private receive address.', e);
  }
}

/**
 * Handles FEATURE_TOGGLE_UPDATED: when the shielded UI turned on or off for the running wallet,
 * reads its shared address and its private receive state again, as the shared address is the
 * shielded one only while the shielded UI is on, and nothing else reads it again until the next
 * tx or reload. The receive state is idle exactly when it was last read with the shielded UI
 * off. A wallet that is starting reads both at the end of its start.
 */
export function* onFeatureToggleUpdated() {
  try {
    const { walletReady, environment, receive } = yield select((state) => ({
      walletReady: state.walletStartState === WALLET_STATUS.READY,
      environment: isShieldedEnvironment(state),
      receive: selectShieldedReceive(state),
    }));
    const readInEnvironment = receive.status !== SHIELDED_RECEIVE_STATUS.IDLE;
    if (walletReady && environment !== readInEnvironment) {
      yield put(walletRefreshSharedAddress());
    }
  } catch (e) {
    log.error('Failed to read the shared address again after a flag change.', e);
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
 * Puts where the unlock or the retry the user asked for stands.
 *
 * @param {string} status One of SHIELDED_UNLOCK_PROGRESS
 * @param {string|null} [errorCode] The code of wallet-lib's refusal
 */
const unlockProgress = (status, errorCode = null) => put(
  shieldedUnlockStatusUpdate({ status, errorCode }),
);

/**
 * Ends the progress of an unlock or a retry for the wallet it ran on. Another wallet that runs
 * by then started with its own progress, which this leaves alone.
 *
 * @param {Object} wallet The wallet the unlock or the retry ran on
 */
function* endUnlockProgress(wallet) {
  const currentWallet = yield select((state) => state.wallet);
  if (currentWallet === wallet) {
    yield unlockProgress(SHIELDED_UNLOCK_PROGRESS.IDLE);
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
 * @param {boolean} [reportsProgress] Whether the unlock reports its progress, which then ends
 */
export function* refreshAfterUnlockWalk(loaded, wallet, reprocessed, reportsProgress = false) {
  try {
    const capability = yield call(() => reprocessed);
    if (yield call(refreshShieldedBalances, wallet)) {
      loaded.record(wallet, capability);
    }
  } catch (e) {
    log.error('Failed to refresh the balances after a shielded unlock.', e);
  } finally {
    if (reportsProgress) {
      yield call(endUnlockProgress, wallet);
    }
  }
}

/**
 * Handles SHIELDED_VIEW_UNLOCK_REQUESTED: unlocks the shielded view key of the running wallet
 * with the PIN the user entered, when the wallet holds its shielded outputs locked. It runs only
 * where the crypto provider passed its self-test: without it, nothing can be decoded. The PIN is
 * never logged.
 *
 * The unlock the user asks for from a locked private balance reports its progress: unlocking,
 * then decoding until the walk ends and the balances are refreshed, then idle; or failed, with
 * the code of wallet-lib's refusal. An error nothing expects then goes to the error modal. A
 * later PIN entry that replaces it puts it back to idle. The unlock at the lock screen shows
 * nothing: a refusal is only logged.
 *
 * @param {ReturnType<createLoadedCapability>} loaded
 * @param {Object} action The SHIELDED_VIEW_UNLOCK_REQUESTED action
 */
export function* onShieldedViewUnlockRequested(loaded, action) {
  const reportsProgress = action.payload.source === SHIELDED_UNLOCK_SOURCE.USER;
  // Whether this handler put a progress that only it ends.
  let progressOpen = false;
  try {
    const { wallet, providerStatus } = yield select((state) => ({
      wallet: state.wallet,
      providerStatus: state.shielded?.providerStatus,
    }));
    if (!wallet || providerStatus !== SHIELDED_PROVIDER_STATUS.READY) {
      return;
    }

    if (reportsProgress) {
      progressOpen = true;
      yield unlockProgress(SHIELDED_UNLOCK_PROGRESS.UNLOCKING);
    }
    const result = yield call(unlockShieldedViewIfLocked, wallet, action.payload.pinCode);
    if (result.status === SHIELDED_UNLOCK_STATUS.FAILED) {
      log.error('The shielded view key was not unlocked at a PIN entry.', {
        source: action.payload.source,
        errorCode: result.errorCode,
      });
      if (reportsProgress) {
        progressOpen = false;
        yield unlockProgress(SHIELDED_UNLOCK_PROGRESS.FAILED, result.errorCode);
      }
      return;
    }
    if (result.status !== SHIELDED_UNLOCK_STATUS.UNLOCKED) {
      if (reportsProgress) {
        progressOpen = false;
        yield unlockProgress(SHIELDED_UNLOCK_PROGRESS.IDLE);
      }
      return;
    }

    yield put(shieldedCapabilityUpdate(result.capability));
    if (reportsProgress) {
      yield unlockProgress(SHIELDED_UNLOCK_PROGRESS.DECODING);
    }
    // Detached, so that the next PIN entry, which replaces this handler, doesn't cancel it.
    yield spawn(refreshAfterUnlockWalk, loaded, wallet, result.reprocessed, reportsProgress);
    progressOpen = false;
  } catch (e) {
    log.error('Failed to unlock the shielded view key at a PIN entry.', e);
    if (reportsProgress) {
      progressOpen = false;
      yield unlockProgress(SHIELDED_UNLOCK_PROGRESS.FAILED);
      yield put(onExceptionCaptured(e, false));
    }
  } finally {
    if (progressOpen && (yield cancelled())) {
      yield unlockProgress(SHIELDED_UNLOCK_PROGRESS.IDLE);
    }
  }
}

/**
 * Handles SHIELDED_REPROCESS_REQUESTED, the user's retry of the private funds the running wallet
 * failed to read: processes its history again, then refreshes its balances. It reports its
 * progress as decoding until the walk ends, then idle. A wallet that is connecting or stopped
 * refuses ('shielded-not-ready' or 'shielded-not-started'), and the walk of its next connection
 * retries them, so the refusal is only logged. An error nothing expects goes to the error modal.
 * A wallet that can't process its history again, as on the wallet-service facade, where the
 * service decodes the private outputs, is skipped.
 *
 * @param {ReturnType<createLoadedCapability>} loaded
 */
export function* onShieldedReprocessRequested(loaded) {
  let decodingWallet = null;
  try {
    const { wallet, providerStatus } = yield select((state) => ({
      wallet: state.wallet,
      providerStatus: state.shielded?.providerStatus,
    }));
    if (!wallet
      || providerStatus !== SHIELDED_PROVIDER_STATUS.READY
      || typeof wallet.reprocessShieldedOutputs !== 'function') {
      return;
    }

    decodingWallet = wallet;
    yield unlockProgress(SHIELDED_UNLOCK_PROGRESS.DECODING);
    const capability = yield call([wallet, wallet.reprocessShieldedOutputs]);
    if (yield call(refreshShieldedBalances, wallet)) {
      loaded.record(wallet, capability);
    }
  } catch (e) {
    if (e instanceof errors.ShieldedKeyError) {
      log.error('The shielded outputs were not processed again.', { errorCode: e.errorCode });
    } else {
      log.error('Failed to process the shielded outputs again.', e);
      yield put(onExceptionCaptured(e, false));
    }
  } finally {
    if (decodingWallet) {
      yield call(endUnlockProgress, decodingWallet);
    }
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
    takeLatest(types.SHIELDED_REPROCESS_REQUESTED, onShieldedReprocessRequested, loaded),
    takeLatest(types.FEATURE_TOGGLE_UPDATED, onFeatureToggleUpdated),
  ]);
}
