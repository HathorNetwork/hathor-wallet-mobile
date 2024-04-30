/**
 * Copyright (c) Hathor Labs and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import {
  takeEvery,
  select,
  delay,
  call,
  fork,
  take,
  all,
  put,
} from 'redux-saga/effects';
import { metadataApi } from '@hathor/wallet-lib';
import { channel } from 'redux-saga';
import { get } from 'lodash';
import { specificTypeAndPayload, dispatchAndWait, getRegisteredTokenUids } from './helpers';
import { mapToTxHistory } from '../utils';
import {
  types,
  tokenFetchBalanceRequested,
  tokenFetchBalanceSuccess,
  tokenFetchBalanceFailed,
  tokenFetchHistoryRequested,
  tokenFetchHistorySuccess,
  tokenFetchHistoryFailed,
} from '../actions';
import { logger } from '../logger';

const log = logger('tokens-saga');

/**
 * @readonly
 * @enum {string}
 */
export const TOKEN_DOWNLOAD_STATUS = {
  READY: 'ready',
  FAILED: 'failed',
  LOADING: 'loading',
  INVALIDATED: 'invalidated',
};

const CONCURRENT_FETCH_REQUESTS = 5;
const METADATA_MAX_RETRIES = 3;

/**
 * This saga will create a channel to queue TOKEN_FETCH_BALANCE_REQUESTED actions and
 * consumers that will run in parallel consuming those actions.
 *
 * More information about channels can be read on https://redux-saga.js.org/docs/api/#takechannel
 */
function* fetchTokenBalanceQueue() {
  const fetchTokenBalanceChannel = yield call(channel);

  // Fork CONCURRENT_FETCH_REQUESTS threads to download token balances
  for (let i = 0; i < CONCURRENT_FETCH_REQUESTS; i += 1) {
    yield fork(fetchTokenBalanceConsumer, fetchTokenBalanceChannel);
  }

  while (true) {
    const action = yield take(types.TOKEN_FETCH_BALANCE_REQUESTED);
    yield put(fetchTokenBalanceChannel, action);
  }
}

/**
 * This saga will consume the fetchTokenBalanceChannel for TOKEN_FETCH_BALANCE_REQUEST actions
 * and wait until the TOKEN_FETCH_BALANCE_SUCCESS action is dispatched with the specific tokenId
 */
function* fetchTokenBalanceConsumer(fetchTokenBalanceChannel) {
  while (true) {
    const action = yield take(fetchTokenBalanceChannel);

    yield fork(fetchTokenBalance, action);
    // Wait until the success action is dispatched before consuming another action
    yield take(
      specificTypeAndPayload([
        types.TOKEN_FETCH_BALANCE_SUCCESS,
        types.TOKEN_FETCH_BALANCE_FAILED,
      ], {
        tokenId: action.tokenId,
      }),
    );
  }
}

function* fetchTokenBalance(action) {
  const { tokenId, force } = action;

  try {
    const wallet = yield select((state) => state.wallet);
    const tokenBalance = yield select((state) => get(state.tokensBalance, tokenId));

    if (!force && tokenBalance && tokenBalance.oldStatus === TOKEN_DOWNLOAD_STATUS.READY) {
      // The data is already loaded, we should dispatch success
      yield put(tokenFetchBalanceSuccess(tokenId, tokenBalance.data));
      return;
    }

    const response = yield call(wallet.getBalance.bind(wallet), tokenId);
    const token = get(response, 0, {
      balance: {
        unlocked: 0,
        locked: 0,
      }
    });

    const balance = {
      available: token.balance.unlocked,
      locked: token.balance.locked,
    };

    log.debug('Success fetching token balance.');
    yield put(tokenFetchBalanceSuccess(tokenId, balance));
  } catch (e) {
    log.error('Error while fetching token balance.', e);
    yield put(tokenFetchBalanceFailed(tokenId));
  }
}

function* fetchTokenHistory(action) {
  const { tokenId, force } = action;

  try {
    const wallet = yield select((state) => state.wallet);
    const tokenHistory = yield select((state) => get(state.tokensHistory, tokenId));

    if (!force && tokenHistory && tokenHistory.oldStatus === TOKEN_DOWNLOAD_STATUS.READY) {
      // The data is already loaded, we should dispatch success
      log.debug('Success fetching token history from store.');
      yield put(tokenFetchHistorySuccess(tokenId, tokenHistory.data));
      return;
    }

    const response = yield call(wallet.getTxHistory.bind(wallet), { token_id: tokenId });
    const data = response.map(mapToTxHistory(tokenId));

    log.debug('Success fetching token history.');
    yield put(tokenFetchHistorySuccess(tokenId, data));
  } catch (e) {
    log.error('Error while fetching token history.', e);
    yield put(tokenFetchHistoryFailed(tokenId));
  }
}

/**
 * This saga will route the actions dispatched from SET_TOKEN and NEW_TOKEN to the
 * TOKEN_FETCH_BALANCE_REQUESTED saga, the idea is to load the balance for new tokens
 * registered or created on the app.
 * @param {{type: string; payload: Object;}} action to route
 */
function* routeTokenChange(action) {
  const wallet = yield select((state) => state.wallet);

  if (!wallet || !wallet.isReady()) {
    return;
  }

  switch (action.type) {
    case 'NEW_TOKEN':
      yield put({ type: types.TOKEN_FETCH_BALANCE_REQUESTED, tokenId: action.payload.uid });
      break;
    case 'SET_TOKENS':
    default:
      for (const uid of getRegisteredTokenUids({ tokens: action.payload })) {
        yield put({ type: types.TOKEN_FETCH_BALANCE_REQUESTED, tokenId: uid });
      }
      break;
  }
}

/**
 * This saga will create a channel to queue TOKEN_FETCH_METADATA_REQUESTED actions and
 * consumers that will run in parallel consuming those actions.
 *
 * More information about channels can be read on https://redux-saga.js.org/docs/api/#takechannel
 */
function* fetchTokenMetadataQueue() {
  const fetchTokenMetadataChannel = yield call(channel);

  // Fork CONCURRENT_FETCH_REQUESTS threads to download token balances
  for (let i = 0; i < CONCURRENT_FETCH_REQUESTS; i += 1) {
    yield fork(fetchTokenMetadataConsumer, fetchTokenMetadataChannel);
  }

  while (true) {
    const action = yield take(types.TOKEN_FETCH_METADATA_REQUESTED);
    yield put(fetchTokenMetadataChannel, action);
  }
}

/**
 * This saga will consume the fetchTokenBalanceChannel for TOKEN_FETCH_BALANCE_REQUEST actions
 * and wait until the TOKEN_FETCH_BALANCE_SUCCESS action is dispatched with the specific tokenId
 */
function* fetchTokenMetadataConsumer(fetchTokenMetadataChannel) {
  while (true) {
    const action = yield take(fetchTokenMetadataChannel);

    yield fork(fetchTokenMetadata, action);

    // Wait until the success action is dispatched before consuming another action
    yield take(
      specificTypeAndPayload([
        types.TOKEN_FETCH_METADATA_SUCCESS,
        types.TOKEN_FETCH_METADATA_FAILED,
      ], {
        tokenId: action.tokenId,
      }),
    );
  }
}

/**
 * Fetch a single token from the metadataApi
 *
 * @param {Array} token The token to fetch from the metadata api
 * @param {String} network Network name
 *
 * @memberof Wallet
 * @inner
 */
export function* fetchTokenMetadata({ tokenId }) {
  const { network } = yield select((state) => state.serverInfo);

  try {
    // Retry mechanism
    for (let i = 0; i <= METADATA_MAX_RETRIES; i += 1) {
      try {
        const data = yield call(metadataApi.getDagMetadata, tokenId, network);

        log.debug('Success fetching token metadata.');
        yield put({
          type: types.TOKEN_FETCH_METADATA_SUCCESS,
          tokenId,
          data: get(data, tokenId, null),
        });
        return;
      } catch (e) {
        log.error('Error trying to get DAG metadata.', e);
        yield delay(1000); // Wait 1s before trying again
      }
    }

    throw new Error(`Max retries requesting metadata for ${tokenId}`);
  } catch (e) {
    yield put({
      type: types.TOKEN_FETCH_METADATA_FAILED,
      tokenId,
    });
    log.log(`Error downloading metadata of token ${tokenId}`);
  }
}

export function* fetchTokenData(tokenId, force = false) {
  const fetchBalanceResponse = yield call(
    dispatchAndWait,
    tokenFetchBalanceRequested(tokenId),
    specificTypeAndPayload(types.TOKEN_FETCH_BALANCE_SUCCESS, {
      tokenId,
    }),
    specificTypeAndPayload(types.TOKEN_FETCH_BALANCE_FAILED, {
      tokenId,
    }),
  );
  const fetchHistoryResponse = yield call(
    dispatchAndWait,
    tokenFetchHistoryRequested(tokenId, force),
    specificTypeAndPayload(types.TOKEN_FETCH_HISTORY_SUCCESS, {
      tokenId,
    }),
    specificTypeAndPayload(types.TOKEN_FETCH_HISTORY_FAILED, {
      tokenId,
    }),
  );

  if (fetchHistoryResponse.failure || fetchBalanceResponse.failure) {
    throw new Error(`Error loading HTR history or balance for token ${tokenId}`);
  }
}

export function* saga() {
  yield all([
    fork(fetchTokenBalanceQueue),
    fork(fetchTokenMetadataQueue),
    takeEvery(types.TOKEN_FETCH_HISTORY_REQUESTED, fetchTokenHistory),
    takeEvery(types.NEW_TOKEN, routeTokenChange),
    takeEvery(types.SET_TOKENS, routeTokenChange),
  ]);
}
