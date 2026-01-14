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
import { specificTypeAndPayload, dispatchAndWait, getRegisteredTokenUids, getNetworkSettings } from './helpers';
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
 * Configuration for balance fetch retry mechanism.
 * Used when force=true to handle eventual consistency with wallet-service.
 */
const BALANCE_FETCH_RETRY_DELAY_MS = 300;
const BALANCE_FETCH_MAX_RETRIES = 3;

/**
 * Map to track pending balance fetch requests per tokenId.
 * This enables request deduplication and force upgrade capability.
 *
 * Structure: Map<tokenId, { force: boolean }>
 * - force: whether the pending request should force a fresh fetch
 */
const pendingBalanceRequests = new Map();

/**
 * This saga will create a channel to queue TOKEN_FETCH_BALANCE_REQUESTED actions and
 * consumers that will run in parallel consuming those actions.
 *
 * Key improvements over the original implementation:
 * 1. Request deduplication: Only one fetch per tokenId at a time
 * 2. Force upgrade: If a force=true request arrives while a force=false is pending,
 *    the pending request is upgraded to force=true
 * 3. Race condition prevention: Prevents multiple consumers from processing the same tokenId
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
    const { tokenId, force } = action;

    // Check if there's already a pending request for this tokenId
    if (pendingBalanceRequests.has(tokenId)) {
      const pending = pendingBalanceRequests.get(tokenId);

      // Upgrade to force=true if the new request has force=true
      // This ensures that if a transaction triggers a force refresh while
      // a non-forced fetch is pending, we'll still get fresh data
      if (force && !pending.force) {
        log.debug(`Upgrading pending balance request for ${tokenId} to force=true`);
        pending.force = true;
      }

      // Skip queueing duplicate request - the existing one will handle it
      log.debug(`Skipping duplicate balance request for ${tokenId}, pending request exists`);
      continue;
    }

    // Create new pending entry and queue the request
    pendingBalanceRequests.set(tokenId, { force });
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

/**
 * Fetches the balance for a specific token.
 *
 * Key improvements:
 * 1. Checks pendingBalanceRequests for the latest force value (supports force upgrade)
 * 2. For force=true requests, implements retry logic to handle eventual consistency
 *    with the wallet-service backend
 * 3. Properly cleans up pending request tracking on completion
 *
 * @param {Object} action - The action containing tokenId and force flag
 */
function* fetchTokenBalance(action) {
  const { tokenId } = action;

  // Get the current force value from pending requests (may have been upgraded)
  const pendingRequest = pendingBalanceRequests.get(tokenId);
  const force = pendingRequest?.force ?? action.force;

  try {
    const wallet = yield select((state) => state.wallet);
    const tokenBalance = yield select((state) => get(state.tokensBalance, tokenId));

    // Use cached data if not forced and data is ready
    if (!force && tokenBalance && tokenBalance.oldStatus === TOKEN_DOWNLOAD_STATUS.READY) {
      log.debug(`Token download status READY.`);
      log.debug(`Token balance already downloaded for token ${tokenId}. Skipping download.`);
      yield put(tokenFetchBalanceSuccess(tokenId, tokenBalance.data));
      return;
    }

    // For forced fetches, implement retry logic to handle eventual consistency
    // This is important because the wallet-service websocket notification may arrive
    // before the backend has fully processed the transaction into its balance database
    let balance = null;
    const attempts = force ? BALANCE_FETCH_MAX_RETRIES : 1;

    for (let attempt = 0; attempt < attempts; attempt += 1) {
      const response = yield call(wallet.getBalance.bind(wallet), tokenId);
      const token = get(response, 0, {
        balance: {
          unlocked: 0n,
          locked: 0n,
        }
      });

      balance = {
        available: token.balance.unlocked,
        locked: token.balance.locked,
      };

      // For forced fetches, check if balance actually changed
      // If it hasn't and we have retries left, wait and try again
      if (force && attempt < attempts - 1 && tokenBalance?.data) {
        const previousBalance = tokenBalance.data;
        const balanceUnchanged = previousBalance.available === balance.available
          && previousBalance.locked === balance.locked;

        if (balanceUnchanged) {
          log.debug(`Balance unchanged for ${tokenId} on attempt ${attempt + 1}, retrying after delay...`);
          yield delay(BALANCE_FETCH_RETRY_DELAY_MS * (attempt + 1));
          continue;
        }
      }

      // Balance fetched successfully (or changed, or no more retries)
      break;
    }

    log.debug(`Success fetching token balance for token ${tokenId}.`);
    yield put(tokenFetchBalanceSuccess(tokenId, balance));
  } catch (e) {
    log.error('Error while fetching token balance.', e);
    yield put(tokenFetchBalanceFailed(tokenId));
  } finally {
    // Clean up pending request tracking
    pendingBalanceRequests.delete(tokenId);
  }
}

function* fetchTokenHistory(action) {
  const { tokenId, force } = action;

  try {
    const wallet = yield select((state) => state.wallet);
    const tokenHistory = yield select((state) => get(state.tokensHistory, tokenId));

    if (!force && tokenHistory && tokenHistory.oldStatus === TOKEN_DOWNLOAD_STATUS.READY) {
      // The data is already loaded, we should dispatch success
      log.debug(`Token history already downloaded for token ${tokenId}. Skipping download.`);
      yield put(tokenFetchHistorySuccess(tokenId, tokenHistory.data));
      return;
    }

    const response = yield call([wallet, wallet.getTxHistory], { token_id: tokenId });
    const data = response.map(mapToTxHistory(tokenId));

    log.debug(`Success fetching token history for token ${tokenId}.`);
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
      log.debug('[routeTokenChange] fetching token balance on NEW_TOKEN event');
      yield put({ type: types.TOKEN_FETCH_BALANCE_REQUESTED, tokenId: action.payload.uid });
      break;
    case 'SET_TOKENS':
    default:
      log.debug('[routeTokenChange] fetching token balance on SET_TOKENS event');
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
  const { network } = yield select((state) => getNetworkSettings(state));

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
    tokenFetchBalanceRequested(tokenId, force),
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
