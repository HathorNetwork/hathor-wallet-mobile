/**
 * Copyright (c) Hathor Labs and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { all, fork } from 'redux-saga/effects';
import { saga as walletSagas } from './wallet';
import { saga as tokensSagas } from './tokens';
import { saga as pushNotificationSaga } from './pushNotification';
import { saga as errorHandlerSagas } from './errorHandler';
import { saga as featureToggleSagas } from './featureToggle';
import { saga as permissionsSagas } from './permissions';
import { saga as walletConnectSagas } from './walletConnect';
import { saga as networkSettingsSagas } from './networkSettings';

const sagas = [
  walletSagas,
  tokensSagas,
  pushNotificationSaga,
  networkSettingsSagas,
  errorHandlerSagas,
  featureToggleSagas,
  permissionsSagas,
  walletConnectSagas,
];

function* defaultSaga() {
  yield all(
    sagas.map((saga) => fork(saga))
  );
}

export default defaultSaga;
