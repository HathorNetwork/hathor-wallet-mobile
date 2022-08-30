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
  const tokenId = action.payload;

  try {
    const wallet = yield select((state) => state.wallet);
    const [token] = yield call(wallet.getBalance.bind(wallet), tokenId);
    const balance = {
      available: token.balance.unlocked,
      locked: token.balance.locked,
    };

    yield put({
      type: 'TOKEN_FETCH_BALANCE_SUCCESS',
      payload: {
        tokenId,
        data: balance,
      },
    });
  } catch (e) {
    yield put({
      type: 'TOKEN_FETCH_BALANCE_FAILED',
      payload: { tokenId },
    });
  }
}

function* fetchTokenHistory(action) {
  const { tokenId } = action;

  try {
    const wallet = yield select((state) => state.wallet);
    const tokensHistory = yield select((state) => state.tokensHistory);
    const tokenHistory = get(tokensHistory, tokenId);

    if (tokenHistory && tokenHistory.oldStatus === 'ready') {
      // The data is already loaded, we should dispatch success
      yield put({
        type: 'TOKEN_FETCH_HISTORY_SUCCESS',
        payload: {
          tokenId,
          data: tokenHistory.data,
        },
      });
    }

    yield delay(1500);

    const response = yield call(wallet.getTxHistory.bind(wallet), { token_id: tokenId });
    const data = response.map((txHistory) => mapTokenHistory(txHistory, tokenId));

    yield put({
      type: 'TOKEN_FETCH_HISTORY_SUCCESS',
      payload: {
        tokenId,
        data,
      }
    });
  } catch (e) {
    console.log('E: ', e);
    yield put({
      type: 'TOKEN_FETCH_HISTORY_FAILED',
      payload: { tokenId },
    });
  }
}

function* routeTokenChange(action) {
  /* switch (action.type) {
    default:
    case 'SET_TOKENS':
      for (const token of action.payload) {
        yield put({ type: 'TOKEN_FETCH_BALANCE_REQUESTED', payload: token.uid });
      }
      break;
    case 'NEW_TOKEN':
      yield put({ type: 'TOKEN_FETCH_BALANCE_REQUESTED', payload: action.payload.uid });
      break;
  } */
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
