import {
  all,
  put,
  takeLatest,
  delay,
} from 'redux-saga/effects';

function* fetchTokenBalance(action) {
  yield delay(2000);

  yield put({
    type: 'TOKEN_FETCH_BALANCE_SUCCESS',
    payload: action.payload,
  });
}

function* loadTokenMetadata() {
  yield put({
    type: 'teta',
  });
}

export function* saga() {
  yield all([
    takeLatest('LOAD_TOKEN_METADATA_REQUESTED', loadTokenMetadata),
    takeLatest('TOKEN_FETCH_BALANCE_REQUESTED', fetchTokenBalance),
  ]);
}
