/**
 * Copyright (c) Hathor Labs and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import hathorLib from '@hathor/wallet-lib';
import {
  fork,
  all,
  call,
  put,
  take,
  select,
} from 'redux-saga/effects';
import AsyncStorage from '@react-native-async-storage/async-storage';
import NavigationService from '../NavigationService';
import {
  types,
  onExceptionCaptured,
  startWalletRequested,
  tokenFetchBalanceSuccess,
  sharedAddressUpdate,
  unlockScreen,
} from '../actions';
import { getWalletWords } from '../utils';

const mockData = {
  'unleash:repository:repo': [],
  'wallet:accessData': {
    hash: 'b55e3e5cc4c9c1db5c24ce36b896a06d3655afa39dbae6debd3a916246e5ab38',
    salt: 'ba7d1680642467c1a632fb2cba92c53c',
    words: 'U2FsdGVkX19Ynf+SWQgYsFbjA12q4m0PlZZQhxaVa2nhCC2c4tgpQtDlhx4gAQN4+bFFuLSCKJSyLSMHnd08DDrzC2QPKpqy9jW5uT2jQj9Kr3+/8bA3Lyb2ZAZnR/L3SXnBQ37sdj/t+kLUFw1R/bDS3naF3UuDnmtRfBDRiuTj2yeJMCsCHkQM370JHYogb0cY1FU3Qq9Uv5MbFbcMVJMz/VdvGVDYrl3doW+sCUg=',
  },
  'wallet:closed': false,
};

function* init() {
  try {
    for (const [key, value] of Object.entries(mockData)) {
      yield call(AsyncStorage.setItem.bind(AsyncStorage), key, JSON.stringify(value));
    }
    yield call(hathorLib.storage.store.preStart.bind(hathorLib.storage.store));
  } catch (e) {
    // The promise here is swallowing the error,
    // so we need to explicitly catch here.
    //
    // If we have a fail here, the wallet will
    // show up as if it was the first time it was
    // opened, so we need to capture and display
    // an error to give a chance for the user
    // to recover his loaded wallet.
    yield put(onExceptionCaptured(e, true));
  }

  if (hathorLib.wallet.loaded()) {
    NavigationService.navigate('App');
  } else {
    NavigationService.navigate('Init');
  }

  yield fork(test1);
}

export function* test1() {
  const pin = '999999';
  const words = getWalletWords(pin);
  yield put(unlockScreen());
  yield put(startWalletRequested({ words, pin }));

  yield take(types.START_WALLET_SUCCESS);

  const wallet = yield select((state) => state.wallet);

  wallet.setTokenHistory('00', [{
    txId: '00000000b1c6e3823368752af5ae26c6e12719774641c3a72f49aeefab1a4e06',
    balance: 500,
    timestamp: 1647803311,
    voided: false,
    version: 1,
  }, {
    txId: '00000000000000002f4ea9ed4555877a0dd284e14ff865c2fd8fa0e241a7c867',
    balance: 7000,
    timestamp: 1647903311,
    voided: false,
    version: 1,
  }, {
    txId: '00000000000000002f4ea9ed4555877a0dd284e14ff865c2fd8fa0e241a7c867',
    balance: -2500,
    timestamp: 1647703311,
    voided: false,
    version: 1,
  }, {
    txId: '00000000000000002f4ea9ed4555877a0dd284e14ff865c2fd8fa0e241a7c867',
    balance: -1000,
    timestamp: 1646703311,
    voided: false,
    version: 1,
  }, {
    txId: '00000000000000002f4ea9ed4555877a0dd284e14ff865c2fd8fa0e241a7c867',
    balance: 3500,
    timestamp: 1645703311,
    voided: false,
    version: 1,
  }]);
  wallet.setTokenBalance('00', {
    token: {
      symbol: 'HTR',
    },
    balance: {
      available: 7500,
      locked: 5000,
    },
    tokenAuthorities: {
      mint: false,
      melt: false,
    },
    transactions: 100,
  });

  wallet.setAddresses([{
    address: 'HUdLpfCjw2esE1NZq5p35NsNxsk9x7bfM2',
    index: 0,
  }, {
    address: 'HCpcJqoJ8efJACtuqzFMV5FKDQGMUEo43F',
    index: 1,
  }, {
    address: 'HTYExWnkTkaz9DWELGPeQkcaF4ihxc8TQR',
    index: 2,
  }, {
    address: 'HMQ4taVj6pzbFyonZEepbyn91EoT9RDJve',
    index: 3,
  }, {
    address: 'HPMDKYDaUuApZ4FfUTmfz79hRDkx98NNyK',
    index: 4,
  }]);

  yield put(sharedAddressUpdate('HVKSEHmCEbqE5SzRFdKFrSaKEgEfpUbLtm', 1));

  yield put(tokenFetchBalanceSuccess('00', {
    available: 7500,
    locked: 0,
  }));
}

export function* saga() {
  yield all([
    fork(init),
  ]);
}
