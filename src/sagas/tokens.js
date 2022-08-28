import {
  takeEvery,
  delay,
  all,
  put,
} from 'redux-saga/effects';

function* fetchTokenBalance(action) {
  yield delay(4000);

  yield put({
    type: 'TOKEN_FETCH_BALANCE_SUCCESS',
    payload: action.payload,
  });
}

function* loadTokenMetadata() {
}

function* routeTokenChange(action) {
  switch (action.type) {
    default:
    case 'SET_TOKENS':
      for (const token of action.payload) {
        yield put({ type: 'TOKEN_FETCH_BALANCE_REQUESTED', payload: token.uid });
      }
      break;
    case 'NEW_TOKEN':
      yield put({ type: 'TOKEN_FETCH_BALANCE_REQUESTED', payload: action.payload.uid });
      break;
  }
}

export function* saga() {
  yield all([
    takeEvery('LOAD_TOKEN_METADATA_REQUESTED', loadTokenMetadata),
    takeEvery('TOKEN_FETCH_BALANCE_REQUESTED', fetchTokenBalance),
    takeEvery('NEW_TOKEN', routeTokenChange),
    takeEvery('SET_TOKENS', routeTokenChange),
  ]);
}
