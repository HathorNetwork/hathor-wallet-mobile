/**
 * Copyright (c) Hathor Labs and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import {
  call,
  put,
  select,
  takeEvery,
  takeLatest,
} from 'redux-saga/effects';
import {
  constants as hathorLibConstants,
} from '@hathor/wallet-lib';
import {
  types,
  tokenImportFetchRequested,
  tokenImportFetchSuccess,
  tokenImportFetchFailed,
  tokenImportNewDetected,
  tokenImportSuccess,
  tokenImportFailed,
  tokenImportRemoveFromList,
  tokenFetchBalanceRequested,
  newToken,
} from '../actions';
import { getRegisteredTokens } from './helpers';
import { logger } from '../logger';

const log = logger('tokenImport');

/**
 * Fetch details (name, symbol) for a single token.
 */
function* fetchTokenDetails(wallet, uid) {
  try {
    const storedToken = yield call(() => wallet.storage.getToken(uid));
    if (storedToken) {
      return storedToken;
    }
  } catch (e) {
    log.error(`Failed to get stored token ${uid}, falling back to API:`, e);
  }

  try {
    const details = yield call(() => wallet.getTokenDetails(uid));
    if (details && details.tokenInfo) {
      return {
        uid,
        name: details.tokenInfo.name,
        symbol: details.tokenInfo.symbol,
      };
    }
  } catch (e) {
    log.error(`Failed to fetch details for token ${uid}:`, e);
  }

  return { uid, name: uid.slice(0, 8), symbol: '???' };
}

/**
 * Main saga: fetch all unregistered tokens on wallet ready.
 *
 * Balances are not fetched here. We dispatch `tokenFetchBalanceRequested` per
 * uid so the canonical balance pipeline (`state.tokensBalance`) populates
 * them. The dedup queue in `sagas/tokens.js` serializes the requests, so
 * we don't need to throttle this loop.
 */
export function* fetchUnregisteredTokens() {
  const wallet = yield select((state) => state.wallet);

  if (!wallet || !wallet.isReady()) {
    yield put(tokenImportFetchFailed());
    return;
  }

  try {
    const htrUid = hathorLibConstants.NATIVE_TOKEN_UID;

    const allTokenUids = yield call(() => wallet.getTokens());

    const registeredTokens = yield call(getRegisteredTokens, wallet);
    const registeredUids = Object.keys(registeredTokens);

    const unregisteredUids = allTokenUids.filter(
      (uid) => uid !== htrUid && !registeredUids.includes(uid),
    );

    if (unregisteredUids.length === 0) {
      yield put(tokenImportFetchSuccess({}));
      return;
    }

    const unregisteredTokens = {};
    for (const uid of unregisteredUids) {
      const details = yield call(fetchTokenDetails, wallet, uid);
      unregisteredTokens[uid] = {
        uid: details.uid,
        name: details.name,
        symbol: details.symbol,
      };
      yield put(tokenFetchBalanceRequested(uid, true));
    }

    yield put(tokenImportFetchSuccess(unregisteredTokens));
  } catch (e) {
    log.error('Failed to fetch unregistered tokens:', e);
    yield put(tokenImportFetchFailed());
  }
}

/**
 * Handle new unregistered token UIDs detected from a transaction.
 * Fetches details and dispatches TOKEN_IMPORT_NEW_DETECTED with full objects.
 *
 * Registered with `takeEvery` (not `takeLatest`) so that bursts of incoming
 * transactions during sync/reconnect cannot cancel an in-flight handler and
 * silently drop the UIDs it had already accumulated.
 */
export function* handleNewTokenDetection(action) {
  const tokenUids = action.payload ?? [];
  const wallet = yield select((state) => state.wallet);

  if (!wallet || !wallet.isReady()) {
    return;
  }

  const newTokens = {};
  for (const uid of tokenUids) {
    const details = yield call(fetchTokenDetails, wallet, uid);
    newTokens[uid] = {
      uid: details.uid,
      name: details.name,
      symbol: details.symbol,
    };
    yield put(tokenFetchBalanceRequested(uid, true));
  }

  yield put(tokenImportNewDetected(newTokens));
}

/**
 * Batch-register selected tokens.
 */
export function* importSelectedTokens(action) {
  const tokens = action.payload;
  const wallet = yield select((state) => state.wallet);

  if (!wallet || !wallet.isReady()) {
    yield put(tokenImportFailed());
    return;
  }

  try {
    // eslint-disable-next-line no-unreachable
    // Snapshot once: the loop only adds to this set, so we don't need to
    // re-iterate the storage's async registered-tokens iterator per item.
    const registeredTokens = yield call(getRegisteredTokens, wallet);
    const alreadyRegistered = new Set(Object.keys(registeredTokens));

    const successUids = [];
    for (const token of tokens) {
      try {
        if (alreadyRegistered.has(token.uid)) {
          successUids.push(token.uid);
          continue;
        }

        yield call(
          [wallet.storage, wallet.storage.registerToken],
          { uid: token.uid, name: token.name, symbol: token.symbol },
        );
        yield put(newToken({ uid: token.uid, name: token.name, symbol: token.symbol }));
        yield put(tokenFetchBalanceRequested(token.uid, true));

        alreadyRegistered.add(token.uid);
        successUids.push(token.uid);
      } catch (e) {
        log.error(`Failed to register token ${token.uid}:`, e);
        yield put(tokenImportFailed());
        return;
      }
    }

    yield put(tokenImportSuccess(successUids));
  } catch (e) {
    log.error('Failed to import tokens:', e);
    yield put(tokenImportFailed());
  }
}

/**
 * When any token gets registered (from any flow — including the manual
 * Register Token screen), drop it from the unregistered list. We use
 * TOKEN_IMPORT_REMOVE_FROM_LIST instead of TOKEN_IMPORT_SUCCESS so that
 * importStatus is NOT flipped to SUCCESS for unrelated registrations.
 */
function* onTokenRegistered(action) {
  const token = action.payload;
  if (!token || !token.uid) return;

  const { unregisteredTokens } = yield select((state) => state.tokenImport);
  if (unregisteredTokens[token.uid]) {
    yield put(tokenImportRemoveFromList([token.uid]));
  }
}

// On unregister, re-run the unregistered-tokens scan so the banner reappears
// for any token still known to the wallet. Preserves `bannerDismissed` (the
// fetch-success reducer doesn't touch it), so a banner dismissed in this
// session stays hidden.
function* onTokenUnregistered() {
  yield put(tokenImportFetchRequested());
}

export function* saga() {
  yield takeLatest(types.TOKEN_IMPORT_FETCH_REQUESTED, fetchUnregisteredTokens);
  yield takeEvery(types.TOKEN_IMPORT_NEW_TX_TOKENS, handleNewTokenDetection);
  yield takeLatest(types.TOKEN_IMPORT_REQUESTED, importSelectedTokens);
  yield takeEvery(types.NEW_TOKEN, onTokenRegistered);
  yield takeEvery(types.TOKEN_METADATA_REMOVED, onTokenUnregistered);
}
