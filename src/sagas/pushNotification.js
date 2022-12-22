import {
  HathorWalletServiceWallet,
} from '@hathor/wallet-lib';
import {
  race,
  take,
  put,
  takeEvery,
  all,
} from 'redux-saga/effects';
import {
  types,
  pushRegisterSuccess,
  pushRegisterFailed,
  pushUpdateSuccess,
  pushUpdateFailed,
} from '../actions';

export const PUSH_API_STATUS = {
  READY: 'ready',
  FAILED: 'failed',
  LOADING: 'loading',
};

/**
 * This function is the actual opt-in of a user to the Push Notifications feature.
 * It should be called when the push notifications are not loaded and/or registered.
 * This should load the wallet on the wallet-service and register it with the deviceId.
 */
export function* firstTimeRegistration({ deviceId, xpub }) {
  // const walletId = HathorWalletServiceWallet.getWalletIdFromXPub(xpub);
  
  // yield put(pushWalletIdUpdated({ walletId }));
  // yield put(pushWalletLoadRequested({ xpub }));
  
  // const { success, error } = yield race({
  //   success: take(types.PUSH_WALLET_LOAD_SUCCESS),
  //   error: take(types.PUSH_WALLET_LOAD_FAILED),
  // });
  
  // If the wallet loading failed, we can consider the registration failure as a whole
  // if (error) {
  //   return;
  // }
  
  // yield put(pushRegister({
  //   enablePush: true,
  //   deviceId,
  //   wallet: success.wallet,
  // }));
  // const { success } = PushNotificationFromLib.registerDevice(this.props.wallet, { token: '123' });
  const success = true;
  if (success) {
    yield put(pushRegisterSuccess({ enabled: true, hasBeenEnabled: true }));
  } else {
    yield put(pushRegisterFailed());
  }
}

export function* updateRegistration({ payload: { enabled, showAmountEnabled }}) {
  const success = true;
  if (success) {
    yield put(pushUpdateSuccess({ enabled, showAmountEnabled }));
  } else {
    yield put(pushUpdateFailed());
  }
}

export function* saga() {
  yield all([
    takeEvery(types.PUSH_FIRST_REGISTRATION_REQUESTED, firstTimeRegistration),
    takeEvery(types.PUSH_UPDATE_REQUESTED, updateRegistration),
  ]);
}
