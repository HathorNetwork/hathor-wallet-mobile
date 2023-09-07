import {
  HathorWalletServiceWallet,
  PushNotification as pushLib,
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
  takeLatest,
  debounce,
} from 'redux-saga/effects';
import messaging from '@react-native-firebase/messaging';
import notifee from '@notifee/react-native';
import { Linking, Platform } from 'react-native';
import { t } from 'ttag';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  types,
  pushRegisterSuccess,
  pushRegisterFailed,
  pushUpdateDeviceId,
  pushRegistrationRequested,
  pushLoadWalletRequested,
  pushLoadWalletSuccess,
  pushLoadWalletFailed,
  pushSetState,
  pushAskOptInQuestion,
  pushReset,
  initPushNotification,
  onExceptionCaptured,
  pushTxDetailsRequested,
  pushTxDetailsSuccess,
  pushAskRegistrationRefreshQuestion,
} from '../actions';
import {
  pushNotificationKey,
  WALLET_SERVICE_MAINNET_BASE_WS_URL,
  WALLET_SERVICE_MAINNET_BASE_URL,
  NETWORK,
  PUSH_CHANNEL_TRANSACTION,
  PUSH_ACTION,
} from '../constants';
import { getPushNotificationSettings } from '../utils';
import { STORE } from '../store';
import { isUnlockScreen, showPinScreenForResult } from './helpers';
import { messageHandler } from '../workers/pushNotificationHandler';
import { WALLET_STATUS } from './wallet';

const TRANSACTION_CHANNEL_NAME = t`Transaction`;
const PUSH_ACTION_TITLE = t`Open`;

/**
 * Creates the categories for the push notification on iOS.
 * The categories are used to define the actions that the user can take
 * when receiving a notification.
 * @returns {boolean} true if the category was created, false otherwise
 */
function* createCategoryIfNotExists() {
  if (Platform.OS !== 'ios') {
    return true;
  }

  try {
    yield call(notifee.setNotificationCategories, [
      {
        id: PUSH_CHANNEL_TRANSACTION,
        actions: [
          {
            id: PUSH_ACTION.NEW_TRANSACTION,
            title: PUSH_ACTION_TITLE,
            // It requires unlocking the device to open the app
            authenticationRequired: true,
            // It causes the the app to open in the foreground
            foreground: true,
          },
        ],
      }
    ]);
    return true;
  } catch (error) {
    console.error('Error creating categories for push notification on iOS.', error);
    yield put(onExceptionCaptured(error));
    return false;
  }
}

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
    console.error('Error creating channel for push notification on Android.', error);
    yield put(onExceptionCaptured(error));
    return false;
  }
}

/**
 * Register the device to receive remote messages from FCM.
 * @param {boolean} showErrorModal if should show error modal in case the device is not registered
 *
 * @returns {boolean} true if the device is registered on the FCM, false otherwise
 */
function* confirmDeviceRegistrationOnFirebase(showErrorModal = true) {
  try {
    // Make sure deviceId is registered on the FCM
    if (!messaging().isDeviceRegisteredForRemoteMessages) {
      console.debug('Device not registered on FCM. Registering device on FCM...');
      yield call(messaging().registerDeviceForRemoteMessages);
    }
    return true;
  } catch (error) {
    console.error('Error confirming the device is registered on firebase.', error);
    if (showErrorModal) {
      yield put(onExceptionCaptured(error));
    }
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
    try {
      await messageHandler(message, true);
    } catch (error) {
      dispatch(onExceptionCaptured(error));
    }
  };

  try {
    // Add listeners for push notifications on foreground
    messaging().onMessage(onForegroundMessage);
    isForegroundListenerInstalled = true;
    return true;
  } catch (error) {
    console.error('Error setings firebase foreground message listener.', error);
    yield put(onExceptionCaptured(error));
    isForegroundListenerInstalled = false;
    return false;
  }
}

/**
 * This function is called when the wallet is initialized with success.
 */
export function* init() {
  // If push notification feature flag is disabled, we should not initialize it.
  const isPushNotificationAvailable = yield select((state) => state.pushNotification.available);
  if (!isPushNotificationAvailable) {
    console.debug('Halting push notification initialization because the feature flag is disabled.');
    return;
  }

  // If the channel is not created, we should not continue.
  // We also continue if the OS is iOS because we don't need to create the channel.
  const isChannelCreated = yield call(createChannelIfNotExists);
  if (!isChannelCreated) {
    console.debug('Halting push notification initialization because the channel was not created on Android.');
    return;
  }

  // If the category is not created, we should not continue.
  // We also continue if the OS is Android because we don't need to create the category.
  const isCategoryCreated = yield call(createCategoryIfNotExists);
  if (!isCategoryCreated) {
    console.debug('Halting push notification initialization because the category was not created on iOS.');
    return;
  }

  // If the device is not registered on FCM, we should not continue.
  const isDeviceRegistered = yield call(confirmDeviceRegistrationOnFirebase);
  if (!isDeviceRegistered) {
    console.debug('Halting push notification initialization because the device is not registered on FCM.');
    return;
  }

  const deviceId = yield call(getDeviceId);
  if (!deviceId) {
    console.debug('Halting push notification initialization because the device id is null.');
    yield put(onExceptionCaptured(new Error('Device id is null')));
    return;
  }

  const isListenerInstalled = yield call(installForegroundListener);
  if (!isListenerInstalled) {
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
  yield put(pushSetState({
    deviceId,
    settings: {
      enabled,
      showAmountEnabled,
    },
    enabledAt,
  }));

  // Check if the last registration call was made more then a week ago
  if (enabled && enabledAt) {
    const timeSinceLastRegistration = moment().diff(enabledAt, 'weeks');
    // Update the registration, as per Firebase's recommendation
    if (timeSinceLastRegistration > 1) {
      // If the user is using the wallet service, we can skip asking for refresh
      const useWalletService = yield select((state) => state.useWalletService);
      if (useWalletService) {
        // If wallet not ready, wait
        const walletStartState = yield select((state) => state.walletStartState);
        if (walletStartState !== WALLET_STATUS.READY) {
          yield take(types.WALLET_STATE_READY);
        }
        yield put(pushRegistrationRequested({
          enabled,
          showAmountEnabled,
          deviceId,
        }));
      } else {
        yield put(pushAskRegistrationRefreshQuestion());
      }
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
 * It is responsible for persisting the PushNotification.available value,
 * so we can use it when the app is in any state.
 * @param {{ payload: boolean }} action - contains the value of the use(PushNotification)
 */
export function* setAvailablePushNotification(action) {
  const available = action.payload;
  yield call(AsyncStorage.setItem, pushNotificationKey.available, available.toString());
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
    const seed = yield STORE.getWalletWords(pin);
    walletService = new HathorWalletServiceWallet({
      seed,
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
  let status = await messaging().hasPermission();
  if (status === messaging.AuthorizationStatus.BLOCKED) {
    console.debug('Device not authorized to send push notification and blocked to ask permission.');
    return false;
  }

  if (status === messaging.AuthorizationStatus.NOT_DETERMINED) {
    console.debug('Device clean. Asking for permission to send push notification.');
    status = await messaging().requestPermission();
  }

  console.debug('Device permission status: ', status);
  return status === messaging.AuthorizationStatus.AUTHORIZED
      || status === messaging.AuthorizationStatus.PROVISIONAL;
};

/**
 * Opens the app settings screen where the user can enable the notification settings.
 */
const openAppSettings = async () => {
  Linking.openSettings();
};

/**
 * This function is responsible for registering the device on the wallet-service in the event
 * of renewing the registration.
 */
export function* registration({ payload: { enabled, showAmountEnabled, deviceId } }) {
  const hasAuthorization = yield call(hasPostNotificationAuthorization);
  if (!hasAuthorization) {
    console.debug('Application is not authorized to send push notification. Asking for permission or opening settings...');

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
      const enabledAt = enabled ? Date.now() : 0;
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
    console.debug('Error while handling push notification on background: ', notificationError);
    STORE.removeItem(pushNotificationKey.notificationError);
    yield put(onExceptionCaptured(new Error(notificationError)));
    return;
  }

  try {
    const notificationData = STORE.getItem(pushNotificationKey.notificationData);
    // Check if the app was opened by a push notification on press action
    if (notificationData) {
      console.debug('App opened by push notification on press action.');
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
  // Tx not found triggers the retry modal for tx details
  const buildTxDetailsNotFound = () => ({ isTxFound: false, txId });
  const buildTxDetailsFound = async (tx, txTokens) => ({
    isTxFound: true,
    txId,
    tx: {
      txId: tx.txId,
      timestamp: tx.timestamp,
      voided: tx.voided,
    },
    tokens: await Promise.all(txTokens.map(async (each) => ({
      uid: each.tokenId,
      name: each.tokenName,
      symbol: each.tokenSymbol,
      balance: each.balance,
      isRegistered: await wallet.storage.isTokenRegistered(each.tokenId),
    }))),
  });

  try {
    const result = await wallet.getTxById(txId);
    // Success false is very unlikely to happen,
    // therefore making the user retry is ok
    if (!result.success) {
      return buildTxDetailsNotFound();
    }
    const [tx] = result.txTokens;
    return buildTxDetailsFound(tx, result.txTokens);
  } catch (error) {
    if (error.message === `Transaction ${txId} not found`
        || error.message === `Transaction ${txId} does not have any balance for this wallet`) {
      return buildTxDetailsNotFound();
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
  const isLocked = yield select((state) => state.lockScreen);
  if (isLocked) {
    const { resetWallet } = yield race({
      // Wait for the unlock screen to be dismissed, and wallet to be loaded
      unlockWallet: all([take(isUnlockScreen), take(types.START_WALLET_SUCCESS)]),
      resetWallet: take(types.RESET_WALLET)
    });
    if (resetWallet) {
      console.debug('Halting loadTxDetails.');
      return;
    }
    console.debug('Continuing loadTxDetails after unlock screen.');
  }

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
 * Deletes the token in the FCM, and invalidates any notification sent to it.
 *
 * This is a strong enforcement that a notification will not be delivered
 * after a reset, even if the device is registered in the FCM or in the APNS.
 */
const cleanToken = async () => {
  await messaging().deleteToken();
};

/**
 * This function is responsible for reset the push notification.
 */
export function* resetPushNotification() {
  // If we don't have the device registered in the FCM, we shouldn't reset push notification
  const isDeviceRegistered = yield call(confirmDeviceRegistrationOnFirebase, false);
  if (!isDeviceRegistered) {
    console.log('Reset wallet but device is not registered on FCM.');
    return;
  }

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
  yield put(initPushNotification());
  console.log('Push notification reset successfully');
}

export function* saga() {
  yield all([
    debounce(500, [[types.START_WALLET_SUCCESS, types.INIT_PUSH_NOTIFICATION]], init),
    takeLatest(types.SET_AVAILABLE_PUSH_NOTIFICATION, setAvailablePushNotification),
    takeEvery(types.PUSH_WALLET_LOAD_REQUESTED, loadWallet),
    takeEvery(types.PUSH_REGISTRATION_REQUESTED, registration),
    takeEvery(types.RESET_WALLET, resetPushNotification),
    takeLatest(types.PUSH_DISMISS_OPT_IN_QUESTION, dismissOptInQuestion),
    takeEvery(types.START_WALLET_REQUESTED, checkOpenPushNotification),
    takeEvery(types.PUSH_REGISTER_SUCCESS, updateStore),
    takeEvery(types.PUSH_TX_DETAILS_REQUESTED, loadTxDetails),
  ]);
}
