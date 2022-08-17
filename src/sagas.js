import {
  call,
  put,
  takeEvery,
  all,
} from 'redux-saga/effects';

function* fetchToken(action) {
  const tokenId = action.payload;

  try {
    const randomFail = Math.random() * 100;

    // Fake API call
    yield call(() => new Promise((resolve) => setTimeout(resolve, Math.random() * 1000)));

    // Fake random fail rate
    if (randomFail > 70) {
      throw new Error('');
    }

    yield put({
      type: 'TOKEN_FETCH_SUCCEEDED',
      payload: tokenId,
    });
  } catch (e) {
    yield put({
      type: 'TOKEN_FETCH_FAILED',
      payload: tokenId,
    });
  }
}

// We should get different payloads depending on the action, this saga should transform it
// and dispatch the TOKEN_FETCH_REQUESTED action with the correct payload
function* routeTokenChange(action) {
  switch (action.type) {
    default:
    case 'SET_TOKENS':
      for (const token of action.payload) {
        yield put({ type: 'TOKEN_FETCH_REQUESTED', payload: token.uid });
      }
      break;
    case 'NEW_TOKEN':
      yield put({ type: 'TOKEN_FETCH_REQUESTED', payload: action.payload.uid });
      break;
  }
}

function* defaultSaga() {
  yield all([
    takeEvery('TOKEN_FETCH_REQUESTED', fetchToken),

    // Capture actions that mutate the token list
    takeEvery('NEW_TOKEN', routeTokenChange),
    takeEvery('SET_TOKENS', routeTokenChange),
  ]);
}

export default defaultSaga;
