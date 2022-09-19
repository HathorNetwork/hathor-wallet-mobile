/**
 * Copyright (c) Hathor Labs and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { all, fork } from 'redux-saga/effects';
import { saga as walletSagas } from './wallet';
import { saga as tokensSagas } from './tokens';

const sagas = [
  walletSagas,
  tokensSagas,
];

function* defaultSaga() {
  yield all(
    sagas.map((saga) => fork(saga))
  );
}

export default defaultSaga;
