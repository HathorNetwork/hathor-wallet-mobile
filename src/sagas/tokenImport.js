/**
 * Copyright (c) Hathor Labs and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import {
  call,
  delay,
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
  tokenImportFetchSuccess,
  tokenImportFetchFailed,
  tokenImportSuccess,
  tokenImportFailed,
  tokenFetchBalanceRequested,
  newToken,
} from '../actions';
import { getRegisteredTokens } from './helpers';
import { logger } from '../logger';

const log = logger('tokenImport');

const THROTTLE_MS = 200;

/**
 * Get all token UIDs the wallet has interacted with.
 */
function* fetchAllTokenUids(wallet) {
  const tokens = yield call(() => wallet.getTokens());
  return tokens;
}

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
 * Fetch balance for a single token.
 */
function* fetchTokenBalance(wallet, uid) {
  try {
    const balanceResult = yield call(() => wallet.getBalance(uid));
    if (Array.isArray(balanceResult) && balanceResult.length > 0) {
      const { balance } = balanceResult[0];
      return {
        available: balance.unlocked,
        locked: balance.locked,
      };
    }
    return { available: 0, locked: 0 };
  } catch (e) {
    log.error(`Failed to fetch balance for token ${uid}:`, e);
    return { available: 0, locked: 0 };
  }
}

/**
 * Main saga: fetch all unregistered tokens on wallet ready.
 */
export function* fetchUnregisteredTokens() {
  const wallet = yield select((state) => state.wallet);

  if (!wallet || !wallet.isReady()) {
    yield put(tokenImportFetchFailed());
    return;
  }

  try {
    const htrUid = hathorLibConstants.NATIVE_TOKEN_UID;

    const allTokenUids = yield call(fetchAllTokenUids, wallet);

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
      const balance = yield call(fetchTokenBalance, wallet, uid);
      unregisteredTokens[uid] = {
        uid: details.uid,
        name: details.name,
        symbol: details.symbol,
        balance,
      };
      yield delay(THROTTLE_MS);
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
 */
export function* handleNewTokenDetection(action) {
  const tokenUids = action.payload;
  const wallet = yield select((state) => state.wallet);

  if (!wallet || !wallet.isReady()) {
    return;
  }

  const newTokens = {};
  for (const uid of tokenUids) {
    const details = yield call(fetchTokenDetails, wallet, uid);
    const balance = yield call(fetchTokenBalance, wallet, uid);
    newTokens[uid] = {
      uid: details.uid,
      name: details.name,
      symbol: details.symbol,
      balance,
    };
    yield delay(THROTTLE_MS);
  }

  yield put({
    type: types.TOKEN_IMPORT_NEW_DETECTED,
    payload: newTokens,
  });
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
    const successUids = [];
    for (const token of tokens) {
      try {
        const registeredTokens = yield call(getRegisteredTokens, wallet);
        if (registeredTokens[token.uid]) {
          successUids.push(token.uid);
          continue;
        }

        yield call(
          [wallet.storage, wallet.storage.registerToken],
          { uid: token.uid, name: token.name, symbol: token.symbol },
        );
        yield put(newToken({ uid: token.uid, name: token.name, symbol: token.symbol }));
        yield put(tokenFetchBalanceRequested(token.uid, true));

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
 * When any token gets registered (from any flow), remove it from tokenImport state.
 */
function* onTokenRegistered(action) {
  const token = action.payload;
  if (!token || !token.uid) return;

  const { unregisteredTokens } = yield select((state) => state.tokenImport);
  if (unregisteredTokens[token.uid]) {
    yield put(tokenImportSuccess([token.uid]));
  }
}

export function* saga() {
  yield takeLatest(types.TOKEN_IMPORT_FETCH_REQUESTED, fetchUnregisteredTokens);
  yield takeLatest(types.TOKEN_IMPORT_NEW_TX_TOKENS, handleNewTokenDetection);
  yield takeLatest(types.TOKEN_IMPORT_REQUESTED, importSelectedTokens);
  yield takeEvery(types.NEW_TOKEN, onTokenRegistered);
}
