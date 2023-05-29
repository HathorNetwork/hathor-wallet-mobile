/**
 * Copyright (c) Hathor Labs and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

// Workaround to prevent error when using locale in android
import 'intl';
import 'intl/locale-data/jsonp/en';

import { Network } from '@hathor/wallet-lib';
import { STORE } from './store';
import {
  _IS_MULTI_TOKEN as IS_MULTI_TOKEN,
  _DEFAULT_TOKEN as DEFAULT_TOKEN,
  _PRIMARY_COLOR as PRIMARY_COLOR,
  _SENTRY_DSN as SENTRY_DSN,
} from './config';

// Re-export store object.
export { STORE };

/**
 * This is the environment stage that will be used to load the unleash feature flags.
 */
export const STAGE = 'mainnet';

/**
 * this is the network name that will be used to load the wallet on the wallet-service,
 * it is first hardcoded in the `startWallet` saga function, @see src\sagas\wallet.js.
 */
export const NETWORK = 'mainnet';

/**
 * This is the hathor-lib network instance for NETWORK_NAME.
 * This is meant to be easier to use with methods that expect a network object
 * instead of a network name.
 * @type {Network}
 */
export const networkObj = new Network(NETWORK);

/**
 * Default tokens for the wallet (to start on redux)
 */
export const INITIAL_TOKENS = [DEFAULT_TOKEN];

/**
 * Wallet will lock if app goes to background for more than LOCK_TIMEOUT seconds
 */
export const LOCK_TIMEOUT = 30000; // 30s

/**
 * Username set in keychain. We don't use it currently, but a value needs to be set
 */
export const KEYCHAIN_USER = 'hathor-keychain';

/**
 * URL with more information about token deposit
 */
export const TOKEN_DEPOSIT_URL = 'https://github.com/HathorNetwork/rfcs/blob/master/text/0011-token-deposit.md';

/**
 * URL for the Terms of Service
 */
export const TERMS_OF_SERVICE_URL = 'https://hathor.network/terms-and-conditions/';

/**
 * URL for the Privacy Policy
 */
export const PRIVACY_POLICY_URL = 'https://hathor.network/privacy-policy/';

/**
 * Re-export variables from config.js.
 */
export { IS_MULTI_TOKEN, DEFAULT_TOKEN, PRIMARY_COLOR, SENTRY_DSN };

/**
 * Minimum job estimation to show to the user in seconds when mining a tx
 */
export const MIN_JOB_ESTIMATION = 1;

/**
 * Size of the PIN
 */
export const PIN_SIZE = 6;

/**
 * Unleash constants
 */
export const UNLEASH_URL = 'https://unleash-proxy.b7e6a7f52ee9fefaf0c53e300cfcb014.hathor.network/proxy';
export const UNLEASH_CLIENT_KEY = 'wKNhpEXKa39aTRgIjcNsO4Im618bRGTq';
export const UNLEASH_POLLING_INTERVAL = 15 * 1000; // 15s
export const unleashStorageKey = {
  ignoreWalletServiceFlag: 'featureFlags:ignoreWalletServiceFlag',
};

/**
 * Quantity of token metadata to download concurrently
 */
export const METADATA_CONCURRENT_DOWNLOAD = 5;


// Wallet service URLs
export const WALLET_SERVICE_MAINNET_BASE_URL = 'https://wallet-service.hathor.network/';
export const WALLET_SERVICE_MAINNET_BASE_WS_URL = 'wss://ws.wallet-service.hathor.network/';

/**
 * Push notification storage keys.
 */
export const pushNotificationKey = {
  deviceId: 'pushNotification:deviceId',
  settings: 'pushNotification:settings',
  hasBeenEnabled: 'pushNotification:hasBeenEnabled',
  enabledAt: 'pushNotification:enabledAt',
  optInDismissed: 'pushNotification:optInDismissed',
  notificationData: 'pushNotification:notificationData',
  available: 'pushNotification:available',
  notificationError: 'pushNotification:notificationError',
};
/**
 * this is the message key for localization of new transaction when show amount is enabled
 */
export const NEW_TRANSACTION_RECEIVED_DESCRIPTION_SHOW_AMOUNTS_ENABLED = 'new_transaction_received_description_with_tokens';
/**
 * this is the message key for localization of new transaction when show amount is disabled
 */
export const NEW_TRANSACTION_RECEIVED_DESCRIPTION_SHOW_AMOUNTS_DISABLED = 'new_transaction_received_description_without_tokens';
/**
 * this is the message key for localization of new transaction title
 */
export const NEW_TRANSACTION_RECEIVED_TITLE = 'new_transaction_received_title';
/**
 * this is the channel/category id for the transaction notification
 */
export const PUSH_CHANNEL_TRANSACTION = 'transaction';
/**
 * All possible states for the push notification API.
 * It is used to show the loading screen while the API is loading,
 * or to show the error screen if the API fails,
 * or to show the push notification settings options if the API is ready.
 */
export const PUSH_API_STATUS = {
  READY: 'ready',
  FAILED: 'failed',
  LOADING: 'loading',
};
/**
 * Holds the push notification action ids available in for notification interaction.
 */
export const PUSH_ACTION = {
  /** Represents a click in the new-transaction notification. */
  NEW_TRANSACTION: 'new-transaction',
};

/**
 * The feature toggle configured in Unleash
 */
export const WALLET_SERVICE_FEATURE_TOGGLE = 'wallet-service-mobile.rollout';
export const PUSH_NOTIFICATION_FEATURE_TOGGLE = 'push-notification.rollout';

export const FEATURE_TOGGLE_DEFAULTS = {
  [WALLET_SERVICE_FEATURE_TOGGLE]: false,
  [PUSH_NOTIFICATION_FEATURE_TOGGLE]: false,
};
