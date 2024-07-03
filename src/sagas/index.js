/**
 * Copyright (c) Hathor Labs and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { all, call, put, spawn } from 'redux-saga/effects';
import { saga as walletSagas } from './wallet';
import { saga as tokensSagas } from './tokens';
import { saga as pushNotificationSaga } from './pushNotification';
import { saga as errorHandlerSagas } from './errorHandler';
import { saga as featureToggleSagas } from './featureToggle';
import { saga as permissionsSagas } from './permissions';
import { saga as walletConnectSagas } from './walletConnect';
import { saga as networkSettingsSagas } from './networkSettings';
import { saga as nanoContractSagas } from './nanoContract';
import { logger } from '../logger';
import { onExceptionCaptured } from '../actions';

function* rootSaga() {
  const sagas = [
    ['walletSagas', walletSagas],
    ['tokensSagas', tokensSagas],
    ['pushNotificationSaga', pushNotificationSaga],
    ['networkSettingsSagas', networkSettingsSagas],
    ['errorHandlerSagas', errorHandlerSagas],
    ['featureToggleSagas', featureToggleSagas],
    ['permissionsSagas', permissionsSagas],
    ['walletConnectSagas', walletConnectSagas],
    ['nanoContractSagas', nanoContractSagas],
  ];

  yield all(sagas.map(([name, saga]) => spawn(function* supervisor() {
    while (true) {
      try {
        logger('rootSaga').debug(`Starting saga: ${name}`);
        yield call(saga)
        break
      } catch (e) {
        // TODO: We should have a retry strategy, e.g. if the wallet saga restarts
        // more than 3 times, we should restart the app and yield a fatal exception
        yield put(onExceptionCaptured(e, false));
      }
    }
  })));
}

export default rootSaga;
