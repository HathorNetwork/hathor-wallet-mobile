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
import { onExceptionCaptured } from '../actions';

const MAX_RETRIES = 5;

const sagas = {
  walletSagas: { saga: walletSagas, retryCount: 0, critical: true },
  tokensSagas: { saga: tokensSagas, retryCount: 0, critical: true },
  pushNotificationSaga: { saga: pushNotificationSaga, retryCount: 0, critical: true },
  networkSettingsSagas: { saga: networkSettingsSagas, retryCount: 0, critical: true },
  errorHandlerSagas: { saga: errorHandlerSagas, retryCount: 0, critical: true },
  featureToggleSagas: { saga: featureToggleSagas, retryCount: 0, critical: true },
  permissionsSagas: { saga: permissionsSagas, retryCount: 0, critical: true },
  walletConnectSagas: { saga: walletConnectSagas, retryCount: 0, critical: false },
  nanoContractSagas: { saga: nanoContractSagas, retryCount: 0, critical: true },
};

function* rootSaga() {
  yield all(Object.keys(sagas).map((name) => spawn(function* supervisor() {
    while (true) {
      const { saga, retryCount, critical } = sagas[name];

      try {
        if (retryCount > MAX_RETRIES && !critical) {
          continue;
        }

        yield call(saga);

        break
      } catch (e) {
        sagas[name].retryCount = retryCount + 1;

        if (retryCount >= MAX_RETRIES) {
          yield put(onExceptionCaptured(e, critical));
          break;
        }

        yield put(onExceptionCaptured(e, false));
      }
    }
  })));
}

export default rootSaga;
