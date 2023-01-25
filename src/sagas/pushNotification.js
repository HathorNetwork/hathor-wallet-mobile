/* eslint-disable max-len */
import {
  HathorWalletServiceWallet,
  PushNotification as pushLib,
  wallet as walletUtil,
  Network,
  config,
  tokens,
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
  takeLatest,
  debounce,
} from 'redux-saga/effects';
import messaging from '@react-native-firebase/messaging';
import notifee from '@notifee/react-native';
import { t } from 'ttag';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  types,
  pushRegisterSuccess,
  pushRegisterFailed,
  pushUpdateSuccess,
  pushUpdateFailed,
  pushUpdateDeviceId,
  pushRegistrationRequested,
  pushLoadWalletRequested,
  pushLoadWalletSuccess,
  pushLoadWalletFailed,
  pushInit,
  pushAskOptInQuestion,
  pushReset,
  pushLoadTxDetails,
  initPushNotification,
} from '../actions';
import {
  pushNotificationKey,
  STORE,
  WALLET_SERVICE_MAINNET_BASE_WS_URL,
  WALLET_SERVICE_MAINNET_BASE_URL,
  NETWORK,
  NEW_TRANSACTION_RECEIVED_DESCRIPTION_SHOW_AMOUNTS_ENABLED,
  NEW_TRANSACTION_RECEIVED_DESCRIPTION_SHOW_AMOUNTS_DISABLED,
  NEW_TRANSACTION_RECEIVED_TITLE,
  TRANSACTION_CHANNEL_ID,
} from '../constants';
import { getPushNotificationSettings } from '../utils';
import { showPinScreenForResult } from './helpers';
import { name as appName } from '../../app.json';

export const PUSH_API_STATUS = {
  READY: 'ready',
  FAILED: 'failed',
  LOADING: 'loading',
};

export const PUSH_TRANSACTION_ID = {
  NEW_TRANSACTION: 'new-transaction',
};

const TRANSACTION_CHANNEL_NAME = t`Transaction`;

/**
 * This function gets the device id registered in the FCM.
 * @returns {Promise<string>} the device id
 */
const getDeviceId = async () => {
  try {
    const deviceId = await messaging().getToken();
    return deviceId;
  } catch (error) {
    console.error('Error getting deviceId from firebase.', error);
    return null;
  }
};

/**
 * localization utils to map the message key to the correct message to localize
 */
const localization = {
  keys: new Set([
    NEW_TRANSACTION_RECEIVED_DESCRIPTION_SHOW_AMOUNTS_ENABLED,
    NEW_TRANSACTION_RECEIVED_DESCRIPTION_SHOW_AMOUNTS_DISABLED,
    NEW_TRANSACTION_RECEIVED_TITLE
  ]),
  hasKey: (key) => localization.keys.has(key),
  getMessage: (key, args) => {
    if (!localization.hasKey(key)) {
      console.debug('Unknown localization key for push notification message.', key);
      return '';
    }

    let message = '';
    if (key === NEW_TRANSACTION_RECEIVED_DESCRIPTION_SHOW_AMOUNTS_ENABLED) {
      if (!args) {
        console.debug(`The args for push notification message key ${NEW_TRANSACTION_RECEIVED_DESCRIPTION_SHOW_AMOUNTS_ENABLED} cannot be null or undefined.`, key);
        return '';
      }
      /**
       * We have 3 cases:
       * - 3 or more tokens: You have received 10 T2, 5 T1 and 2 other token on a new transaction.
       * - 2 tokens: You have received 10 T2 and 5 T1 on a new transaction.
       * - 1 token: You have received 10 T2 on a new transaction.
      */
      const countArgs = args.length;
      if (countArgs === 3) {
        const [firstToken, secondToken, other] = args;
        const otherCount = parseInt(other, 10);
        /**
         * @example
         * You have received 10 T2, 5 T1 and 2 other token on a new transaction.
         */
        message = t`You have received ${firstToken}, ${secondToken} and ${otherCount} other token on a new transaction.`;
      } else if (countArgs === 2) {
        const [firstToken, secondToken] = args;
        /**
         * @example
         * You have received 10 T2 and 5 T1 on a new transaction.
         */
        message = t`You have received ${firstToken} and ${secondToken}.`;
      } else if (countArgs === 1) {
        const [firstToken] = args;
        /**
         * @example
         * You have received 10 T2 on a new transaction.
         */
        message = t`You have received ${firstToken}.`;
      }
    } else if (key === NEW_TRANSACTION_RECEIVED_DESCRIPTION_SHOW_AMOUNTS_DISABLED) {
      message = t`There is a new transaction in your wallet.`;
    } else if (key === NEW_TRANSACTION_RECEIVED_TITLE) {
      message = t`New transaction received`;
    }
    return message;
  }
};

const onForegroundMessage = async (message) => {
  await messageHandler(message, true);
};

/**
 * Handle the message received when application is in foreground and background (not closed) state
 * @param {{ data: Object, from: string, messageId: string, sentTime: number, ttl: number }} message - Message received from wallet-service
 * @param {boolean?} isForeground - If the application is in foreground or not
 *
 * @example
 * {
 *   bodyLocArgs: '[\"10 T2\",\"5 T1\",\"2\"]',
 *   bodyLocKey: 'new_transaction_received_description_with_tokens',
 *   titleLocKey: 'new_transaction_received_title',
 *   txId: 'txId1',
 * }
 * @inner
 */
export const messageHandler = async (message, isForeground) => {
  const usePushNotification = await AsyncStorage.getItem(pushNotificationKey.use) === 'true';

  if (!usePushNotification) {
    console.debug('Push notification is disabled. Ignoring message.');
    return;
  }

  const { data } = message;
  if (!localization.hasKey(data.titleLocKey)) {
    console.debug('unknown message titleLocKey', data.titleLocKey);
    return;
  }

  if (!localization.hasKey(data.bodyLocKey)) {
    console.debug('unknown message bodyLocKey', data.bodyLocKey);
    return;
  }

  const bodyArgs = data.bodyLocArgs && JSON.parse(data.bodyLocArgs);
  const title = localization.getMessage(data.titleLocKey);
  const body = localization.getMessage(data.bodyLocKey, bodyArgs);
  const { txId } = data;

  try {
    notifee.displayNotification({
      id: txId,
      title,
      body,
      android: {
        channelId: TRANSACTION_CHANNEL_ID,
        pressAction: {
          id: PUSH_TRANSACTION_ID.NEW_TRANSACTION,
          ...(!isForeground && { mainComponent: appName })
        }
      },
      data: {
        txId
      }
    });
  } catch (error) {
    console.error('Error displaying notification from notifee while handling message.', error);
  }
};

const confirmDeviceRegistrationOnFirebase = async () => {
  try {
    const isDeviceRegistered = messaging().isDeviceRegisteredForRemoteMessages;
    if (!isDeviceRegistered) {
      await messaging().registerDeviceForRemoteMessages();
    }
  } catch (error) {
    console.error('Error confirming the device is registered on firebase.', error);
  }
};

function* handleMessage(message) {
  yield call(messageHandler, message);
}

/**
 * This flag is used to avoid installing the listener more than once.
 * It is effemeral and will be reset when the application is closed.
 */
let isForegroundListenerInstalled = false;

/**
 * Install the listener to handle push notifications when the application is in foreground.
 */
const installForegroundListener = () => {
  if (isForegroundListenerInstalled) {
    return;
  }

  try {
    // Add listeners for push notifications on foreground and background
    messaging().onMessage(onForegroundMessage);
    isForegroundListenerInstalled = true;
  } catch (error) {
    console.error('Error installing foreground listener to push notification.', error);
  }
};

const createChannelIfNotExists = async () => {
  try {
    const hasTransactionChannel = await notifee.isChannelCreated(TRANSACTION_CHANNEL_ID);
    if (!hasTransactionChannel) {
      await notifee.createChannel({
        id: TRANSACTION_CHANNEL_ID,
        name: TRANSACTION_CHANNEL_NAME,
      });
    }
  } catch (error) {
    console.error('Error creating channel for push notification.', error);
  }
};

/**
 * This function is called when the wallet is initialized with success.
 */
export function* init() {
  // If push notification feature flag is disabled, we should not initialize it.
  const usePushNotification = yield select((state) => state.pushNotification.use);
  if (!usePushNotification) {
    console.log('onAppInitialization: halting push notification initialization');
    return;
  }

  const { enabled, showAmountEnabled } = STORE.getItem(pushNotificationKey.settings) || { enabled: false, showAmountEnabled: false };
  const hasBeenEnabled = STORE.getItem(pushNotificationKey.hasBeenEnabled) || false;
  const enabledAt = STORE.getItem(pushNotificationKey.enabledAt) || 0;

  const persistedDeviceId = STORE.getItem(pushNotificationKey.deviceId);
  const deviceId = yield call(getDeviceId);
  // If the deviceId is different from the persisted one, we should update it.
  // The first time the perisistedDeviceId will be null, and the deviceId will be
  // the one returned by getDeviceId, which gets the deviceId from FCM.
  if (deviceId && persistedDeviceId !== deviceId) {
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

  yield call(createChannelIfNotExists);
  yield call(confirmDeviceRegistrationOnFirebase);
  yield call(installForegroundListener);

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

  // If the user has not been asked yet, we should ask him if he wants to enable push notifications
  // We should appear only once, so we should save the fact that the user has dismissed the question
  const optInDismissed = STORE.getItem(pushNotificationKey.optInDismissed);
  if (optInDismissed === null || !optInDismissed) {
    yield put(pushAskOptInQuestion());
  }
}

/**
 * It is responsible for persisting the usePushNotification value, so we can use it when the app in any state.
 * By using STORE we couln't use it on quit state.
 * @param {{ payload: boolean }} action - The action that contains the value of the usePushNotification
 */
export function* setUsePushNotification(action) {
  const use = action.payload;
  yield call(AsyncStorage.setItem, pushNotificationKey.use, use.toString());
  yield put(initPushNotification());
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
    return;
  }

  const { walletService } = loadWalletSuccess.payload;
  try {
    const { success } = yield call(pushLib.PushNotification.registerDevice, walletService, {
      pushProvider: Platform.OS,
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
    console.error('Error registering device in wallet-service for the first time.', error);
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
    return;
  }

  const { walletService } = loadWalletSuccess.payload;
  try {
    const { success } = yield call(pushLib.PushNotification.registerDevice, walletService, {
      pushProvider: Platform.OS,
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
    console.error('Error registering device in wallet-service.', error);
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
    console.error('Error updating device in wallet-service.', error);
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

/**
 * This function is responsible for save the state of opt-in dismissed.
 */
export function* dismissOptInQuestion() {
  yield STORE.setItem(pushNotificationKey.optInDismissed, true);
}

/**
 * This function retrieves the tx details from the wallet history.
 * @param {Object} wallet the current wallet
 * @param {string} txId the tx id
 * @returns {Promise<{
 *  tx: { txId: string, timestamp: number, voided: boolean },
 *  tokens: { uid: string, name: string, symbol: string, balance: number, isRegistered: boolean }[]
 * }>} the tx details
 * @example
 * {
 *   tx: {
 *     txId: '000021e7addbb94a8e43d7f1237d556d47efc4d34800c5923ed3a75bf5a2886e',
 *     timestamp: 1673039453,
 *     voided: false,
 *   },
 *   tokens: [
 *     {
 *       uid: '00',
 *       name: 'Hathor',
 *       symbol: 'HTR',
 *       balance: 500,
 *       isRegistered: true,
 *     }
 *   ],
 */
export const getTxDetails = async (wallet, txId) => {
  const txTokensBalance = await wallet.getTxById(txId);
  const [tx] = txTokensBalance;
  const txDetails = {
    tx: {
      txId: tx.txId,
      timestamp: tx.timestamp,
      voided: tx.voided,
    },
    tokens: txTokensBalance.map((each) => ({
      uid: each.tokenId,
      name: each.tokenName,
      symbol: each.tokenSymbol,
      balance: each.balance,
      isRegistered: !!tokens.tokenExists(each.tokenId),
    })),
  };
  return txDetails;
};

export function setInitialNotificationData(notification) {
  STORE.setItem(pushNotificationKey.notificationData, notification.data);
}

/**
 * This function is responsible for checking if the app was opened by a push notification
 * and if so, it will load the tx and token data to show the tx detail modal.
 */
export function* checkOpenPushNotification() {
  try {
    const notificationData = STORE.getItem(pushNotificationKey.notificationData);
    // Check if the app was opened by a push notification on press action
    if (notificationData) {
      STORE.removeItem(pushNotificationKey.notificationData);
      // Wait for the wallet to be loaded
      yield take(types.START_WALLET_SUCCESS);

      const wallet = yield select((state) => state.wallet);
      const txDetails = yield call(getTxDetails, wallet, notificationData.txId);
      yield put(pushLoadTxDetails(txDetails));
    }
  } catch (error) {
    console.error('Error checking if app was opened by a push notification', error);
  }
}

const cleanToken = async () => {
  await messaging().unregisterDeviceForRemoteMessages();
  await messaging().deleteToken();
};

/**
 * This function is responsible for reset the push notification.
 */
export function* resetPushNotification() {
  // Unregister the device from FCM
  yield call(cleanToken);
  // Clean the store
  yield STORE.removeItem(pushNotificationKey.enabledAt);
  yield STORE.removeItem(pushNotificationKey.settings);
  yield STORE.removeItem(pushNotificationKey.hasBeenEnabled);
  yield STORE.removeItem(pushNotificationKey.optInDismissed);
  yield STORE.removeItem(pushNotificationKey.deviceId);
  // Reset the state
  yield put(pushReset());
  yield put(initPushNotification());
  console.log('Push notification reset successfully');
}

export function* saga() {
  yield all([
    debounce(500, [[types.START_WALLET_SUCCESS, types.INIT_PUSH_NOTIFICATION]], init),
    takeLatest(types.SET_USE_PUSH_NOTIFICATION, setUsePushNotification),
    takeEvery(types.PUSH_WALLET_LOAD_REQUESTED, loadWallet),
    takeEvery(types.PUSH_FIRST_REGISTRATION_REQUESTED, firstTimeRegistration),
    takeEvery(types.PUSH_REGISTRATION_REQUESTED, registration),
    takeEvery(types.PUSH_UPDATE_REQUESTED, updateRegistration),
    takeEvery([types.PUSH_REGISTER_SUCCESS, types.PUSH_UPDATE_SUCCESS], updateStore),
    takeLatest(types.PUSH_DISMISS_OPT_IN_QUESTION, dismissOptInQuestion),
    takeEvery(types.PUSH_HANDLE_MESSAGE, handleMessage),
    takeEvery(types.SET_INIT_WALLET, checkOpenPushNotification),
    takeEvery(types.RESET_WALLET, resetPushNotification)
  ]);
}
