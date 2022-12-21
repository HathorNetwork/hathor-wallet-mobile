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
} from '../actions';

/**
 * This function is the actual opt-in of a user to the Push Notifications feature.
 * It should be called when the push notifications are not loaded and/or registered.
 * This should load the wallet on the wallet-service and register it with the deviceId.
 */
export function* firstTimeRegistration({ deviceId, xpub }) {
  console.log('firstTimeRegistration');
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
  yield put(pushRegisterSuccess({ enabled: true, hasBeenEnabled: false }));
  // yield put(pushRegisterFailed());
}

export function* saga() {
  yield all([
    takeEvery(types.PUSH_FIRST_REGISTRATION_REQUESTED, firstTimeRegistration),
  ]);
}
