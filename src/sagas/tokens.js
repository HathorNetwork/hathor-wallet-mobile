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
  join,
} from 'redux-saga/effects';
import { t } from 'ttag';
import { metadataApi } from '@hathor/wallet-lib';
import { channel } from 'redux-saga';
import { get } from 'lodash';
import { specificTypeAndPayload, dispatchAndWait, getRegisteredTokenUids } from './helpers';
import { mapToTxHistory, splitInGroups } from '../utils';
import {
  types,
  tokenFetchBalanceRequested,
  tokenFetchBalanceSuccess,
  tokenFetchBalanceFailed,
  tokenFetchHistoryRequested,
  tokenFetchHistorySuccess,
  tokenFetchHistoryFailed,
  onExceptionCaptured,
  unregisteredTokensUpdate,
  unregisteredTokensEnd,
} from '../actions';
import { logger } from '../logger';
import { NODE_RATE_LIMIT_CONF } from '../constants';

const log = logger('tokens-saga');

const failureMessage = {
  walletNotReadyError: t`Wallet is not ready yet.`,
  someTokensNotLoaded: t`Error loading the details of some tokens.`,
};

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
      log.debug(`Token download status READY.`);
      log.debug(`Token balance already downloaded for token ${tokenId}. Skipping download.`);
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

    log.debug(`Success fetching token balance for token ${tokenId}.`);
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

/**
 * Get token details from wallet.
 *
 * @param {Object} wallet The application wallet.
 * @param {string} uid Token UID.
 *
 * @description
 * The token endpoint has 3r/s with 10r of burst and 3s of delay.
 */
export function* getTokenDetails(wallet, uid) {
  try {
    const { tokenInfo: { symbol, name } } = yield call([wallet, wallet.getTokenDetails], uid);
    yield put(unregisteredTokensUpdate({ tokens: { [uid]: { uid, symbol, name } } }));
  } catch (e) {
    log.error(`Fail getting token data for token ${uid}.`, e);
    yield put(unregisteredTokensUpdate({ error: failureMessage.someTokensNotLoaded }));
  }
}

/**
 * Request token details of unregistered tokens to feed new
 * nano contract request actions.
 *
 * @description
 * It optimizes for burst because we need the data as soon as possible,
 * at the same time we should avoid request denials from the endpoint,
 * which justifies a delay from burst to burst.
 *
 * @param {Object} action
 * @param {Object} action.payload
 * @param {string[]} action.payload.uids
 */
export function* requestUnregisteredTokens(action) {
  const { uids } = action.payload;

  if (uids.length === 0) {
    log.debug('No uids to request token details.');
    yield put(unregisteredTokensEnd());
    return;
  }

  const wallet = yield select((state) => state.wallet);
  if (!wallet.isReady()) {
    log.error('Fail updating loading tokens data because wallet is not ready yet.');
    // This will show user an error modal with the option to send the error to sentry.
    yield put(onExceptionCaptured(new Error(failureMessage.walletNotReadyError), true));
    return;
  }

  /**
   * NOTE: We can improve the follwoing strategy by adopting a more robust
   * rate-limit algorithm, like the sliding window or token bucket.
   */

  // These are the default values configured in the nginx conf public nodes.
  const perBurst = NODE_RATE_LIMIT_CONF.thin_wallet_token.burst;
  const burstDelay = NODE_RATE_LIMIT_CONF.thin_wallet_token.delay;
  const uidGroups = splitInGroups(uids, perBurst);
  for (const group of uidGroups) {
    // Fork is a non-blocking effect, it doesn't cause the caller suspension.
    const tasks = yield all(group.map((uid) => fork(getTokenDetails, wallet, uid)));
    // Awaits a group to finish before burst the next group
    yield join(tasks);
    // Skip delay if there is only one group or is the last group
    if (uidGroups.length === 1 || group === uidGroups.at(-1)) {
      break;
    }
    // This is a quick request, we should give a break before next burst
    yield delay(burstDelay * 1000);
  }
  log.log('Success getting tokens data to feed unregisteredTokens.');
  yield put(unregisteredTokensEnd());
}

export function* saga() {
  yield all([
    fork(fetchTokenBalanceQueue),
    fork(fetchTokenMetadataQueue),
    takeEvery(types.TOKEN_FETCH_HISTORY_REQUESTED, fetchTokenHistory),
    takeEvery(types.NEW_TOKEN, routeTokenChange),
    takeEvery(types.SET_TOKENS, routeTokenChange),
    takeEvery(types.UNREGISTEREDTOKENS_REQUEST, requestUnregisteredTokens),
  ]);
}
