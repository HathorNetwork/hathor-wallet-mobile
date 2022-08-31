import {
  takeEvery,
  select,
  delay,
  call,
  all,
  put,
} from 'redux-saga/effects';
import { get } from 'lodash';
import { TxHistory } from '../models';
import {
  tokenFetchBalanceSuccess,
  tokenFetchBalanceFailed,
  tokenFetchHistorySuccess,
  tokenFetchHistoryFailed,
} from '../actions';

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
    console.log('E:', e);
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
    console.log('E: ', e);
    yield put(tokenFetchHistoryFailed(tokenId));
  }
}

function* routeTokenChange(action) {
  const wallet = yield select((state) => state.wallet);

  if (!wallet || !wallet.isReady()) {
    return false;
  }

  switch (action.type) {
    default:
    case 'SET_TOKENS':
      for (const token of action.payload) {
        yield put({ type: 'TOKEN_FETCH_BALANCE_REQUESTED', tokenId: token.uid });
      }
      break;
    case 'NEW_TOKEN':
      yield put({ type: 'TOKEN_FETCH_BALANCE_REQUESTED', tokenId: action.payload.uid });
      break;
  }
}

export function* saga() {
  yield all([
    // takeEvery('LOAD_TOKEN_METADATA_REQUESTED', loadTokenMetadata),
    takeEvery('TOKEN_FETCH_BALANCE_REQUESTED', fetchTokenBalance),
    takeEvery('TOKEN_FETCH_HISTORY_REQUESTED', fetchTokenHistory),
    takeEvery('NEW_TOKEN', routeTokenChange),
    takeEvery('SET_TOKENS', routeTokenChange),
  ]);
}
