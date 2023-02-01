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
  fork,
} from 'redux-saga/effects';
import messaging from '@react-native-firebase/messaging';
import notifee from '@notifee/react-native';
import { Linking, Platform } from 'react-native';
import { t } from 'ttag';
import {
  types,
  pushRegisterSuccess,
  pushRegisterFailed,
  pushUpdateDeviceId,
  pushRegistrationRequested,
  pushLoadWalletRequested,
  pushLoadWalletSuccess,
  pushLoadWalletFailed,
  pushInit,
  pushAskOptInQuestion,
  pushReset,
  onExceptionCaptured,
  pushTxDetailsRequested,
  pushTxDetailsSuccess,
} from '../actions';
import {
  pushNotificationKey,
  STORE,
  WALLET_SERVICE_MAINNET_BASE_WS_URL,
  WALLET_SERVICE_MAINNET_BASE_URL,
  NETWORK,
  PUSH_CHANNEL_TRANSACTION,
} from '../constants';
import { getPushNotificationSettings } from '../utils';
import { showPinScreenForResult } from './helpers';
import { messageHandler } from '../pushNotificationHandler';

const TRANSACTION_CHANNEL_NAME = t`Transaction`;

/**
 * Creates the channel for the push notification on Android.
 * The channel gives the user a fine grained control over notification in the app.
 * @returns {boolean} true if the channel was created or already exists, false otherwise
 */
function* createChannelIfNotExists() {
  // We only create the channel on Android
  if (Platform.OS !== 'android') {
    return true;
  }

  try {
    const hasTransactionChannel = yield call(notifee.isChannelCreated, PUSH_CHANNEL_TRANSACTION);
    if (!hasTransactionChannel) {
      yield call(notifee.createChannel, {
        id: PUSH_CHANNEL_TRANSACTION,
        name: TRANSACTION_CHANNEL_NAME,
      });
    }
    return true;
  } catch (error) {
    console.error('Error creating channel for push notification.', error);
    yield put(onExceptionCaptured(error));
    return false;
  }
}

/**
 * Register the device to receive remote messages from FCM.
 * @returns {boolean} true if the device is registered on the FCM, false otherwise
 */
function* confirmDeviceRegistrationOnFirebase() {
  try {
    // Make sure deviceId is registered on the FCM
    if (!messaging().isDeviceRegisteredForRemoteMessages) {
      yield call(messaging().registerDeviceForRemoteMessages);
    }
    return true;
  } catch (error) {
    console.error('Error confirming the device is registered on firebase.', error);
    yield put(onExceptionCaptured(error));
    return false;
  }
}

/**
 * Gets the device id registered in the FCM.
 * @returns {string} the device id
 */
async function getDeviceId() {
  try {
    const deviceId = await messaging().getToken();
    return deviceId;
  } catch (error) {
    console.error('Error getting deviceId from firebase.', error);
    return null;
  }
}

/**
 * This flag is used to install the listener only once.
 * It is effemeral and will be reset when the application is closed.
 */
let isForegroundListenerInstalled = false;

/**
 * Install a message listener on firebase to handle
 * push notifications when the application is in foreground.
 * @returns {boolean}
 */
function* installForegroundListener() {
  if (isForegroundListenerInstalled) {
    return true;
  }

  let dispatch;
  yield put((_dispatch) => {
    dispatch = _dispatch;
  });

  /**
   * Handle the message received from firebase when the application is in foreground.
   * @param {Promise<void>} message - The message received from firebase
   */
  const onForegroundMessage = async (message) => {
    console.log('onForegroundMessage', message);
    try {
      await messageHandler(message, true);
    } catch (error) {
      dispatch(onExceptionCaptured(error));
    }
  };

  try {
    // Add listeners for push notifications on foreground and background
    messaging().onMessage(onForegroundMessage);
    isForegroundListenerInstalled = true;
    return true;
  } catch (error) {
    console.error('Error setings firebase foreground message listener.', error);
    yield put(onExceptionCaptured(error));
    return false;
  }
}

/**
 * This function is called when the wallet is initialized with success.
 */
export function* onAppInitialization() {
  yield take(types.START_WALLET_SUCCESS);

  // If the channel is not created, we should not continue.
  const isChannelCreated = yield call(createChannelIfNotExists);
  if (!isChannelCreated) {
    console.debug('Halting push notification initialization because the channel was not created.');
    return;
  }

  // If the device is not registered on FCM, we should not continue.
  const isDeviceRegistered = yield call(confirmDeviceRegistrationOnFirebase);
  if (!isDeviceRegistered) {
    console.debug('Halting push notification initialization because the device is not registered on FCM.');
    return;
  }

  const deviceId = yield call(getDeviceId);
  // const deviceId = yield call(getDeviceId);
  if (!deviceId) {
    console.debug('Halting push notification initialization because the device id is null.');
    yield put(onExceptionCaptured(new Error('Device id is null')));
    return;
  }

  const isForegroundListernerInstalled = yield call(installForegroundListener);
  if (!isForegroundListernerInstalled) {
    console.debug('Halting push notification initialization because the foreground listener was not installed.');
    return;
  }

  const persistedDeviceId = STORE.getItem(pushNotificationKey.deviceId);
  // If the deviceId is different from the persisted one, we should update it.
  // The first time the perisistedDeviceId will be null, and the deviceId will be
  // the one returned by getDeviceId, which gets the deviceId from FCM.
  if (deviceId && persistedDeviceId !== deviceId) {
    STORE.setItem(pushNotificationKey.deviceId, deviceId);
    yield put(pushUpdateDeviceId({ deviceId }));
  }

  const getSettingsOrFallback = () => {
    const settings = STORE.getItem(pushNotificationKey.settings);
    if (!settings) {
      return { enabled: false, showAmountEnabled: false };
    }
    return settings;
  };

  const {
    enabled,
    showAmountEnabled
  } = getSettingsOrFallback();
  const enabledAt = STORE.getItem(pushNotificationKey.enabledAt);

  // Initialize the pushNotification state on the redux store
  yield put(pushInit({
    deviceId,
    settings: {
      enabled,
      showAmountEnabled,
    },
    enabledAt,
  }));

  // Check if the last registration call was made more then a week ago
  if (enabledAt) {
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
 * Checks if the device has authorization to receive push notifications.
 * @returns {boolean} true if has authorization to receive push notifications, false otherwise.
 */
const hasPostNotificationAuthorization = async () => {
  const status = await messaging().hasPermission();
  return status === messaging.AuthorizationStatus.AUTHORIZED
      || status === messaging.AuthorizationStatus.PROVISIONAL;
};

/**
 * Opens the app settings screen where the user can enable the notification settings.
 */
const openAppSettings = async () => {
  if (Platform.OS === 'android') {
    Linking.openSettings();
  }
};

/**
 * This function is responsible for registering the device on the wallet-service in the event
 * of renewing the registration.
 */
export function* registration({ payload: { enabled, showAmountEnabled, deviceId } }) {
  const hasAuthorization = yield call(hasPostNotificationAuthorization);
  if (!hasAuthorization) {
    yield call(openAppSettings);
    yield put(pushRegisterFailed());
    return;
  }

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
      enablePush: !!enabled,
      enableShowAmounts: !!showAmountEnabled,
    });

    if (success) {
      const enabledAt = Date.now();
      STORE.setItem(pushNotificationKey.enabledAt, enabledAt);

      const payload = {
        enabled: !!enabled,
        showAmountEnabled: !!showAmountEnabled,
        enabledAt,
      };
      yield put(pushRegisterSuccess(payload));
    } else {
      // NOTE: theoretically, this should never happen
      // because when the client call fails, it throws an error
      yield put(pushRegisterFailed());
    }
  } catch (error) {
    console.error('Error registering device in wallet-service.', error);
    yield put(pushRegisterFailed());
  }
}

/**
 * This function is responsible for updating the store with the new push notification settings.
 */
export function* updateStore() {
  const { enabled, showAmountEnabled } = yield select(
    (state) => getPushNotificationSettings(state.pushNotification),
  );
  STORE.setItem(pushNotificationKey.settings, { enabled, showAmountEnabled });
}

/**
 * This function is responsible for save the state of opt-in dismissed.
 */
export function* dismissOptInQuestion() {
  yield STORE.setItem(pushNotificationKey.optInDismissed, true);
}

/**
 * Check if the app was opened by a push notification on press action.
 * If so, it will load the tx detail modal.
 */
export function* checkOpenPushNotification() {
  const notificationError = STORE.getItem(pushNotificationKey.notificationError);
  if (notificationError) {
    STORE.removeItem(pushNotificationKey.notificationError);
    yield put(onExceptionCaptured(new Error(notificationError)));
    return;
  }

  try {
    const notificationData = STORE.getItem(pushNotificationKey.notificationData);
    // Check if the app was opened by a push notification on press action
    if (notificationData) {
      STORE.removeItem(pushNotificationKey.notificationData);
      // Wait for the wallet to be loaded
      yield take(types.START_WALLET_SUCCESS);
      yield put(pushTxDetailsRequested({ txId: notificationData.txId }));
    }
  } catch (error) {
    console.error('Error checking if app was opened by a push notification.', error);
    yield put(onExceptionCaptured(error));
  }
}

/**
 * This function retrieves the tx details from the wallet history.
 * @param {Object} wallet the current wallet
 * @param {string} txId the tx id
 * @returns {Promise<{
 *  isTxFound: boolean,
 *  txId: string,
 *  tx: { txId: string, timestamp: number, voided: boolean },
 *  tokens: { uid: string, name: string, symbol: string, balance: number, isRegistered: boolean }[]
 * }>} the tx details
 * @example
 * {
 *   isTxFound: true,
 *   txId: '000021e7addbb94a8e43d7f1237d556d47efc4d34800c5923ed3a75bf5a2886e',
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
  try {
    const txTokensBalance = await wallet.getTxById(txId);
    const [tx] = txTokensBalance;
    const txDetails = {
      isTxFound: true,
      txId,
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
  } catch (error) {
    if (error.message === `Transaction ${txId} not found`) {
      return { isTxFound: false, txId };
    }
    throw error;
  }
};

/**
 * This function is responsible for load the tx details.
 * @param {{ payload: { txId: string }}} action
 */
export function* loadTxDetails(action) {
  const { txId } = action.payload;
  try {
    const wallet = yield select((state) => state.wallet);
    const txDetails = yield call(getTxDetails, wallet, txId);
    yield put(pushTxDetailsSuccess(txDetails));
  } catch (error) {
    console.error('Error loading transaction details.', error);
    yield put(onExceptionCaptured(error));
  }
}

/**
 * Unregister the device from firebase and delete the token.
 * This clean up invalidates the token that is being used
 * and the device will not receive any push notification.
 */
const cleanToken = async () => {
  await messaging().unregisterDeviceForRemoteMessages();
  await messaging().deleteToken();
};

/**
 * This function is responsible for reset the push notification.
 */
export function* resetPushNotification() {
  try {
    // Unregister the device from FCM
    yield call(cleanToken);
  } catch (error) {
    console.error('Error clening token from firebase.', error);
    yield put(onExceptionCaptured(error));
  }

  // Clean the store
  yield STORE.removeItem(pushNotificationKey.enabledAt);
  yield STORE.removeItem(pushNotificationKey.settings);
  yield STORE.removeItem(pushNotificationKey.deviceId);
  // Reset the state
  yield put(pushReset());
  yield fork(onAppInitialization);
}

export function* saga() {
  yield all([
    fork(onAppInitialization),
    takeEvery(types.PUSH_WALLET_LOAD_REQUESTED, loadWallet),
    takeEvery(types.PUSH_REGISTRATION_REQUESTED, registration),
    takeEvery(types.RESET_WALLET, resetPushNotification),
    takeLatest(types.PUSH_DISMISS_OPT_IN_QUESTION, dismissOptInQuestion),
    takeEvery(types.START_WALLET_REQUESTED, checkOpenPushNotification),
    takeEvery(types.PUSH_REGISTER_SUCCESS, updateStore),
    takeEvery(types.PUSH_TX_DETAILS_REQUESTED, loadTxDetails),
  ]);
}
