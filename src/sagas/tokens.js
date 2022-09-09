import {
  takeEvery,
  select,
  call,
  fork,
  take,
  all,
  put,
} from 'redux-saga/effects';
import { channel } from 'redux-saga';
import { get } from 'lodash';
import { TxHistory } from '../models';
import { specificTypeAndPayload } from './helpers';
import {
  types,
  tokenFetchBalanceSuccess,
  tokenFetchBalanceFailed,
  tokenFetchHistorySuccess,
  tokenFetchHistoryFailed,
} from '../actions';

const CONCURRENT_FETCH_BALANCE_REQUESTS = 5;

const mapTokenHistory = (element, token) => {
  const data = {
    txId: element.txId,
    timestamp: element.timestamp,
    balance: element.balance,
    // in wallet service this comes as 0/1 and in the full node comes with true/false
    voided: Boolean(element.voided),
    tokenUid: token
  };
  return new TxHistory(data);
};

/**
 * This saga will create a channel to queue TOKEN_FETCH_BALANCE_REQUESTED actions and
 * consumers that will run in parallel consuming those actions.
 *
 * More information about channels can be read on https://redux-saga.js.org/docs/api/#takechannel
 */
function* fetchTokenBalanceQueue() {
  const fetchTokenBalanceChannel = yield call(channel);

  // Fork CONCURRENT_FETCH_BALANCE_REQUESTS threads to download token balances
  for (let i = 0; i < CONCURRENT_FETCH_BALANCE_REQUESTS; i += 1) {
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
      specificTypeAndPayload(types.TOKEN_FETCH_BALANCE_SUCCESS, {
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

    if (!force && tokenBalance && tokenBalance.oldStatus === 'ready') {
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

    yield put(tokenFetchBalanceSuccess(tokenId, balance));
  } catch (e) {
    yield put(tokenFetchBalanceFailed(tokenId));
  }
}

function* fetchTokenHistory(action) {
  const { tokenId, force } = action;

  try {
    const wallet = yield select((state) => state.wallet);
    const tokenHistory = yield select((state) => get(state.tokensHistory, tokenId));

    if (!force && tokenHistory && tokenHistory.oldStatus === 'ready') {
      // The data is already loaded, we should dispatch success
      yield put(tokenFetchHistorySuccess(tokenId, tokenHistory.data));
      return;
    }

    const response = yield call(wallet.getTxHistory.bind(wallet), { token_id: tokenId });
    const data = response.map((txHistory) => mapTokenHistory(txHistory, tokenId));

    yield put(tokenFetchHistorySuccess(tokenId, data));
  } catch (e) {
    yield put(tokenFetchHistoryFailed(tokenId));
  }
}

/**
 * This saga will route the actions dispatched from SET_TOKEN and NEW_TOKEN to the
 * TOKEN_FETCH_BALANCE_REQUESTED saga, the idea is to load the balance for new tokens
 * registered or created on the app.
 */
function* routeTokenChange(action) {
  const wallet = yield select((state) => state.wallet);

  if (!wallet || !wallet.isReady()) {
    return;
  }

  switch (action.type) {
    default:
    case 'SET_TOKENS':
      for (const token of action.payload) {
        yield put({ type: types.TOKEN_FETCH_BALANCE_REQUESTED, tokenId: token.uid });
      }
      break;
    case 'NEW_TOKEN':
      yield put({ type: types.TOKEN_FETCH_HISTORY_REQUESTED, tokenId: action.payload.uid });
      break;
  }
}

export function* saga() {
  yield all([
    fork(fetchTokenBalanceQueue),
    takeEvery(types.TOKEN_FETCH_HISTORY_REQUESTED, fetchTokenHistory),
    takeEvery(types.NEW_TOKEN, routeTokenChange),
    takeEvery(types.SET_TOKENS, routeTokenChange),
  ]);
}
