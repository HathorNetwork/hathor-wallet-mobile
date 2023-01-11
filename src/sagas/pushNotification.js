/* eslint-disable max-len */
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
  race,
  take,
  fork,
} from 'redux-saga/effects';
import messaging from '@react-native-firebase/messaging';
import notifee from '@notifee/react-native';
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
  pushLoadWalletRequested,
  pushLoadWalletSuccess,
  pushLoadWalletFailed,
  pushInit,
} from '../actions';
import {
  pushNotificationKey,
  STORE,
  WALLET_SERVICE_MAINNET_BASE_WS_URL,
  WALLET_SERVICE_MAINNET_BASE_URL,
} from '../constants';
import NavigationService from '../NavigationService';
import { getPushNotificationSettings } from '../utils';

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
/**
 * this is the message key for localization of new transaction when show amount is enabled
 */
const NEW_TRANSACTION_RECEIVED_DESCRIPTION_WITH_TOKENS = 'new_transaction_received_description_with_tokens';
/**
 * this is the message key for localization of new transaction when show amount is disabled
 */
const NEW_TRANSACTION_RECEIVED_DESCRIPTION_WITHOUT_TOKENS = 'new_transaction_received_description_without_tokens';
/**
 * this is the message key for localization of new transaction title
 */
const NEW_TRANSACTION_RECEIVED_TITLE = 'new_transaction_received_title';
/**
 * this is the channel id for the transaction notification
 */
const TRANSACTION_CHANNEL_ID = 'transaction';
const TRANSACTION_CHANNEL_NAME = t`Transaction`;

const getDeviceId = async () => {
  try {
    const deviceId = await messaging().getToken();
    return deviceId;
  } catch (error) {
    console.error(`Error getting deviceId: ${error.message}`, error);
    return null;
  }
};

/**
 * localization utils to map the message key to the correct message to localize
 */
const localization = {
  keys: new Set([
    NEW_TRANSACTION_RECEIVED_DESCRIPTION_WITH_TOKENS,
    NEW_TRANSACTION_RECEIVED_DESCRIPTION_WITHOUT_TOKENS,
    NEW_TRANSACTION_RECEIVED_TITLE
  ]),
  hasKey: (key) => localization.keys.has(key),
  getMessage: (key, args) => {
    if (!localization.hasKey(key)) {
      console.log('Unknown localization key for push notification message.', key);
      return '';
    }

    let message = '';
    if (key === NEW_TRANSACTION_RECEIVED_DESCRIPTION_WITH_TOKENS) {
      if (!args) {
        console.log(`The args for push notification message key ${NEW_TRANSACTION_RECEIVED_DESCRIPTION_WITH_TOKENS} cannot be null or undefined.`, key);
        return '';
      }
      const countArgs = args.length;
      if (countArgs === 3) {
        const [firstToken, secondToken, other] = args;
        const otherCount = parseInt(other, 10);
        message = t`You have received ${firstToken}, ${secondToken} and ${otherCount} other token on a new transaction.`;
      } else if (countArgs === 2) {
        const [firstToken, secondToken] = args;
        message = t`You have received ${firstToken} and ${secondToken}.`;
      } else if (countArgs === 1) {
        const [firstToken] = args;
        message = t`You have received ${firstToken}.`;
      }
    } else if (key === NEW_TRANSACTION_RECEIVED_DESCRIPTION_WITHOUT_TOKENS) {
      message = t`There is a new transaction in your wallet.`;
    } else if (key === NEW_TRANSACTION_RECEIVED_TITLE) {
      message = t`New transaction received`;
    }
    return message;
  }
};

const onForegroundMessage = async (message) => {
  await messageHandler(message);
};

const onBackgroundMessage = async (message) => {
  await messageHandler(message);
};

/**
 * Handle the message received when application is in foreground and background (not closed) state
 * @param {{ data: Object, from: string, messageId: string, sentTime: number, ttl: number }} message - Message received from wallet-service
 * @example
 * {
 *   bodyLocArgs: '[\"10 T2\",\"5 T1\",\"2\"]',
 *   bodyLocKey: 'new_transaction_received_description_with_tokens',
 *   titleLocKey: 'new_transaction_received_title',
 *   txId: 'txId1',
 * }
 * @inner
 */
const messageHandler = async (message) => {
  const { data } = message;
  if (!localization.hasKey(data.titleLocKey)) {
    console.log('unknown message titleLocKey', data.titleLocKey);
    return;
  }

  if (!localization.hasKey(data.bodyLocKey)) {
    console.log('unknown message bodyLocKey', data.bodyLocKey);
    return;
  }

  const bodyArgs = JSON.parse(data.bodyLocArgs);
  const title = localization.getMessage(data.titleLocKey);
  const body = localization.getMessage(data.bodyLocKey, bodyArgs);

  notifee.displayNotification({
    title,
    body,
    android: {
      channelId: TRANSACTION_CHANNEL_ID,
    },
  });
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
 * This function is called when the wallet is initialized with success.
 */
export function* onAppInitialization() {
  yield take(types.START_WALLET_SUCCESS);

  const { enabled, showAmountEnabled } = STORE.getItem(pushNotificationKey.settings);
  const hasBeenEnabled = STORE.getItem(pushNotificationKey.hasBeenEnabled);
  const enabledAt = STORE.getItem(pushNotificationKey.enabledAt);

  const persistedDeviceId = STORE.getItem(pushNotificationKey.deviceId);
  const deviceId = yield call(getDeviceId);
  // If the deviceId is different from the persisted one, we should update it
  if (persistedDeviceId && persistedDeviceId !== deviceId.toString()) {
    STORE.setItem(pushNotificationKey.deviceId, deviceId);
    yield put(pushUpdateDeviceId({ deviceId }));
  }

  // Initialize the pushNotification state on the redux store
  yield put(pushInit({
    deviceId,
    settings: {
      enabled,
      showAmountEnabled,
    },
    hasBeenEnabled,
    enabledAt,
  }));

  // Create the transaction channel if it doesn't exist
  const hasTransactionChannel = yield call(notifee.isChannelCreated, TRANSACTION_CHANNEL_ID);
  if (!hasTransactionChannel) {
    yield call(notifee.createChannel, {
      id: TRANSACTION_CHANNEL_ID,
      name: TRANSACTION_CHANNEL_NAME,
    });
  }

  // Make sure deviceId is registered on the FCM
  messaging().registerDeviceForRemoteMessages();
  // Add listeners for push notifications on foreground and background
  messaging().onMessage(onForegroundMessage);
  messaging().setBackgroundMessageHandler(onBackgroundMessage);

  // Check if the last registration call was made more then a week ago
  if (hasBeenEnabled) {
    const timeSinceLastRegistration = moment().diff(enabledAt, 'weeks');
    if (timeSinceLastRegistration > 1) {
      // Update the registration, as per Firebase's recommendation
      yield put(pushRegistrationRequested({
        enabled,
        showAmountEnabled,
        deviceId,
      }));
    }
  }
}

/**
 * It is responsible for loading the wallet for every push notification action that requires
 * to interact with the wallet service api. When the user is using the facade wallet, it will
 * load the wallet service, otherwise it will use the wallet already loaded in the redux store.
 */
export function* loadWallet() {
  // This is a work-around so we can dispatch actions from inside callbacks.
  let dispatch;
  yield put((_dispatch) => {
    dispatch = _dispatch;
  });

  const useWalletService = yield select((state) => state.useWalletService);

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
      yield put(pushLoadWalletFailed({ error }));
    }
  } else {
    walletService = yield select((state) => state.wallet);
  }

  yield put(pushLoadWalletSuccess({ walletService }));
}

/**
 * This function is the actual opt-in of a user to the Push Notifications feature.
 * It should be called when the push notifications are not loaded and/or registered.
 * This should load the wallet on the wallet-service and register it with the deviceId.
 * @param {{ payload: { deviceId: string } }} action
 */
export function* firstTimeRegistration({ payload: { deviceId } }) {
  yield put(pushLoadWalletRequested());

  // wait for the wallet to be loaded
  const [loadWalletSuccess, loadWalletFail] = yield race([
    take(types.PUSH_WALLET_LOAD_SUCCESS),
    take(types.PUSH_WALLET_LOAD_FAILED)
  ]);

  if (loadWalletFail) {
    yield put(pushRegisterFailed());
  }

  const { walletService } = loadWalletSuccess.payload;
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
      // NOTE: theoretically, this should never happen because when the client call fails, it throws an error
      yield put(pushRegisterFailed());
    }
  } catch (error) {
    console.log('Error registering device for the first time: ', error.cause);
    yield put(pushRegisterFailed());
  }
}

/**
 * This function is responsible for registering the device on the wallet-service in the event
 * of renewing the registration.
 */
export function* registration({ payload: { enabled, showAmountEnabled, deviceId } }) {
  yield put(pushLoadWalletRequested());

  // wait for the wallet to be loaded
  const [loadWalletSuccess, loadWalletFail] = yield race([
    take(types.PUSH_WALLET_LOAD_SUCCESS),
    take(types.PUSH_WALLET_LOAD_FAILED)
  ]);

  if (loadWalletFail) {
    yield put(pushRegisterFailed());
  }

  const { walletService } = loadWalletSuccess.payload;
  try {
    const { success } = yield call(pushLib.PushNotification.registerDevice, walletService, {
      pushProvider: pushLib.PushNotificationProvider.ANDROID,
      deviceId,
      enablePush: true,
    });

    if (success) {
      const enabledAt = Date.now();
      STORE.setItem(pushNotificationKey.enabledAt, enabledAt);
      yield put(pushRegisterSuccess({ enablePush: enabled, enableShowAmounts: showAmountEnabled, hasBeenEnabled: true, enabledAt }));
    } else {
      // NOTE: theoretically, this should never happen because when the client call fails, it throws an error
      yield put(pushRegisterFailed());
    }
  } catch (error) {
    console.log('Error registering device: ', error.cause);
    yield put(pushRegisterFailed());
  }
}

/**
 * This function is responsible for updating the registration of the device on the wallet-service
 * in the event of changing the settings of the push notifications.
 * @param {{ payload: { enabled: boolean, showAmountEnabled: boolean, deviceId: string } }} action
 */
export function* updateRegistration({ payload: { enabled, showAmountEnabled, deviceId } }) {
  yield put(pushLoadWalletRequested());

  // wait for the wallet to be loaded
  const [loadWalletSuccess, loadWalletFail] = yield race([
    take(types.PUSH_WALLET_LOAD_SUCCESS),
    take(types.PUSH_WALLET_LOAD_FAILED)
  ]);

  if (loadWalletFail) {
    yield put(pushRegisterFailed());
    return;
  }

  const { walletService } = loadWalletSuccess.payload;
  try {
    const { success } = yield call(pushLib.PushNotification.updateDevice, walletService, {
      deviceId,
      enablePush: enabled,
      enableShowAmounts: showAmountEnabled,
    });
    if (success) {
      yield put(pushUpdateSuccess({ enabled, showAmountEnabled }));
    } else {
      // NOTE: theoretically, this should never happen because when the client call fails, it throws an error
      yield put(pushUpdateFailed());
    }
  } catch (error) {
    console.log('Error updating device: ', error.cause);
    yield put(pushUpdateFailed());
  }
}

/**
 * This function is responsible for updating the store with the new push notification settings.
 */
export function* updateStore() {
  const { enabled, showAmountEnabled } = yield select((state) => getPushNotificationSettings(state.pushNotification));
  STORE.setItem(pushNotificationKey.settings, { enabled, showAmountEnabled });
}

export function* saga() {
  yield all([
    fork(onAppInitialization),
    takeEvery(types.PUSH_WALLET_LOAD_REQUESTED, loadWallet),
    takeEvery(types.PUSH_FIRST_REGISTRATION_REQUESTED, firstTimeRegistration),
    takeEvery(types.PUSH_REGISTRATION_REQUESTED, registration),
    takeEvery(types.PUSH_UPDATE_REQUESTED, updateRegistration),
    takeEvery([types.PUSH_REGISTER_SUCCESS, types.PUSH_UPDATE_SUCCESS], updateStore),
  ]);
}
