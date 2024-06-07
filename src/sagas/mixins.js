/**
 * Copyright (c) Hathor Labs and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import {
  takeEvery,
  select,
  all,
  put,
  call,
} from 'redux-saga/effects';
import { t } from 'ttag';
import {
  types,
  selectAddressAddressesSuccess,
  selectAddressAddressesFailure,
  onExceptionCaptured,
  firstAddressSuccess,
  firstAddressFailure,
} from '../actions';
import { logger } from '../logger';
import { getAllAddresses, getFirstAddress } from '../utils';

const log = logger('mixins');

export function* fetchAllWalletAddresses() {
  const wallet = yield select((state) => state.wallet);
  if (!wallet.isReady()) {
    log.error('Fail fetching all wallet addresses because wallet is not ready yet.');
    const errorMsg = t`Wallet is not ready to load addresses.`;
    // This will show the message in the feedback content at SelectAddressModal
    yield put(selectAddressAddressesFailure(errorMsg));
    // This will show user an error modal with the option to send the error to sentry.
    yield put(onExceptionCaptured(new Error(errorMsg), false));
    return;
  }

  try {
    const addresses = yield call(getAllAddresses, wallet);
    log.log('All wallet addresses loaded with success.');
    yield put(selectAddressAddressesSuccess({ addresses }));
  } catch (error) {
    log.error('Error while fetching all wallet addresses.', error);
    // This will show the message in the feedback content at SelectAddressModal
    yield put(selectAddressAddressesFailure({
      error: t`There was an error while loading wallet addresses. Try again.`
    }));
  }
}

export function* fetchFirstWalletAddress() {
  const wallet = yield select((state) => state.wallet);
  if (!wallet.isReady()) {
    log.error('Fail fetching first wallet address because wallet is not ready yet.');
    const errorMsg = t`Wallet is not ready to load the first address.`;
    // This will show the message in the feedback content
    yield put(firstAddressFailure({ error: errorMsg }));
    // This will show user an error modal with the option to send the error to sentry.
    yield put(onExceptionCaptured(new Error(errorMsg), false));
    return;
  }

  try {
    const address = yield call(getFirstAddress, wallet);
    log.log('First wallet address loaded with success.');
    yield put(firstAddressSuccess({ address }));
  } catch (error) {
    log.error('Error while fetching first wallet address.', error);
    // This will show the message in the feedback content
    yield put(firstAddressFailure({
      error: t`There was an error while loading first wallet address. Try again.`
    }));
  }
}

export function* saga() {
  yield all([
    takeEvery(types.SELECTADDRESS_ADDRESSES_REQUEST, fetchAllWalletAddresses),
    takeEvery(types.FIRSTADDRESS_REQUEST, fetchFirstWalletAddress),
  ]);
}
