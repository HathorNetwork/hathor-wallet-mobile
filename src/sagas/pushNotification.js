import {
  HathorWalletServiceWallet,
  PushNotification as pushLib,
  wallet as walletUtil,
  Network,
  config,
} from '@hathor/wallet-lib';
import moment from 'moment';
import {
  put,
  takeEvery,
  all,
  call,
  select,
} from 'redux-saga/effects';
import messaging from '@react-native-firebase/messaging';
import { TOKEN_AUTHORITY_MASK } from '@hathor/wallet-lib/lib/constants';
import { t } from 'ttag';
import {
  types,
  pushRegisterSuccess,
  pushRegisterFailed,
  pushUpdateSuccess,
  pushUpdateFailed,
  pushUpdateDeviceId,
  pushRegistrationRequested,
  setIsShowingPinScreen,
} from '../actions';
import {
  pushNotificationKey,
  STORE,
  WALLET_SERVICE_MAINNET_BASE_WS_URL,
  WALLET_SERVICE_MAINNET_BASE_URL,
} from '../constants';
import NavigationService from '../NavigationService';

export const PUSH_API_STATUS = {
  READY: 'ready',
  FAILED: 'failed',
  LOADING: 'loading',
};

/**
 * this is the network name that will be used to load the wallet on the wallet-service,
 * it is first hardcoded in the `startWallet` saga function, @see src\sagas\wallet.js.
 */
const NETWORK = 'mainnet';


const getDeviceId = async () => {
  try {
    const deviceId = await messaging().getToken();
    return deviceId;
  } catch (error) {
    console.error(`Error getting deviceId: ${error.message}`, error);
    return null;
  }
};

const onNotificationClick = async (notification) => {
  const { data: { txId } } = notification;
  put(pushTxClick({
    txId,
  }));
};

const onBackgroundMessage = async (message) => {
  console.log('onBackgroundMessage', message);
};

const showPinScreenForResult = async (dispatch) => new Promise((resolve) => {
  const params = {
    cb: (_pin) => {
      dispatch(setIsShowingPinScreen(false));
      resolve(_pin);
    },
    canCancel: false,
    screenText: t`Enter your 6-digit pin to authorize operation`,
    biometryText: t`Authorize operation`,
  };

  NavigationService.navigate('PinScreen', params);

  // We should set the global isShowingPinScreen
  dispatch(setIsShowingPinScreen(true));
});

/**
 * @param {{ payload: { deviceId: string, settings: { enabled, showAmountEnabled }, hasBeenEnabled: boolean, enabledAt: number } }} action 
 */
export function* appInitialization(action) {
  const {
    payload: {
      deviceId: persistedDeviceId,
      settings: {
        enabled,
        showAmountEnabled
      },
      hasBeenEnabled,
      enabledAt
    }
  } = action;
  const deviceId = yield call(getDeviceId);

  if (persistedDeviceId && persistedDeviceId !== deviceId.toString()) {
    STORE.setItem(pushNotificationKey.deviceId, deviceId);
    // TODO: this action should call the wallet-service to update the deviceId
    put(pushUpdateDeviceId({ deviceId }));
  }
  console.log('deviceId', deviceId);

  // Make sure deviceId is registered on the FCM
  messaging().registerDeviceForRemoteMessages();

  messaging().onMessage(onBackgroundMessage);
  messaging().setBackgroundMessageHandler(onBackgroundMessage);

  // Handling notifications and navigating to MainScreen -> TxDetails modal
  // TODO: this listener should be implemented on details modal screen

  // Check if the last registration call was made more then a week ago
  if (hasBeenEnabled) {
    const timeSinceLastRegistration = moment().diff(enabledAt, 'weeks');
    if (timeSinceLastRegistration > 1) {
      // Update the registration, as per Firebase's recommendation
      put(pushRegistrationRequested({
        enabled,
        showAmountEnabled,
        deviceId,
      }));
    }
  }
}

/**
 * This function is the actual opt-in of a user to the Push Notifications feature.
 * It should be called when the push notifications are not loaded and/or registered.
 * This should load the wallet on the wallet-service and register it with the deviceId.
 */
export function* firstTimeRegistration({ payload: { deviceId } }) {
  // This is a work-around so we can dispatch actions from inside callbacks.
  let dispatch;
  yield put((_dispatch) => {
    dispatch = _dispatch;
  });

  const wallet = yield select((state) => state.wallet);
  const useWalletService = yield select((state) => state.useWalletService);
  // const deviceId = yield select((state) => state.pushNotification.deviceId);

  // If the user is not using the wallet-service,
  // we need to initialize the wallet on the wallet-service first
  let walletService;
  if (!useWalletService) {
    // Set urls for wallet service
    config.setWalletServiceBaseUrl(WALLET_SERVICE_MAINNET_BASE_URL);
    config.setWalletServiceBaseWsUrl(WALLET_SERVICE_MAINNET_BASE_WS_URL);
    const network = new Network(NETWORK);

    const pin = yield call(showPinScreenForResult, dispatch);
    walletService = new HathorWalletServiceWallet({
      requestPassword: pin,
      seed: walletUtil.getWalletWords(pin),
      network,
      enableWs: false,
    });

    try {
      yield call(walletService.start.bind(walletService), {
        pinCode: pin,
        password: pin,
      });
    } catch (error) {
      yield put(pushRegisterFailed());
    }
  } else {
    walletService = wallet;
  }

  try {
    const { success } = yield call(pushLib.PushNotification.registerDevice, walletService, {
      pushProvider: pushLib.PushNotificationProvider.ANDROID,
      deviceId,
      enablePush: true,
    });

    if (success) {
      const enabledAt = Date.now();
      STORE.setItem(pushNotificationKey.enabledAt, enabledAt);
      STORE.setItem(pushNotificationKey.hasBeenEnabled, true);
      yield put(pushRegisterSuccess({ enabled: true, hasBeenEnabled: true, enabledAt }));
    } else {
      yield put(pushRegisterFailed());
    }
  } catch (error) {
    yield put(pushRegisterFailed());
  }
}

export function* registration({ payload: { enabled, showAmountEnabled, deviceId } }) {
  // const { success } = PushNotificationFromLib.registerDevice(wallet, { pushProvider: 'android', enablePush: enabled, enableShowAmount: showAmountEnabled, deviceId });
  const success = true;
  if (success) {
    const enabledAt = Date.now();
    STORE.setItem(pushNotificationKey.enabledAt, enabledAt);
    STORE.setItem(pushNotificationKey.hasBeenEnabled, true);
    yield put(pushRegisterSuccess({ enabled, showAmountEnabled, hasBeenEnabled: true, enabledAt }));
  } else {
    yield put(pushRegisterFailed());
  }
}

export function* updateRegistration({ payload: { enabled, showAmountEnabled, deviceId } }) {
  // const { success } = PushNotificationFromLib.updateDevice(wallet, { enablePush: enabled, enableShowAmount: showAmountEnabled, deviceId });
  const success = true;
  if (success) {
    yield put(pushUpdateSuccess({ enabled, showAmountEnabled }));
  } else {
    yield put(pushUpdateFailed());
  }
}

export function* saga() {
  yield all([
    takeEvery(types.PUSH_INIT, appInitialization),
    takeEvery(types.PUSH_FIRST_REGISTRATION_REQUESTED, firstTimeRegistration),
    takeEvery(types.PUSH_REGISTRATION_REQUESTED, registration),
    takeEvery(types.PUSH_UPDATE_REQUESTED, updateRegistration),
  ]);
}
