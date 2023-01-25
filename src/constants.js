/**
 * Copyright (c) Hathor Labs and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

// Workaround to prevent error when using locale in android
import 'intl';
import 'intl/locale-data/jsonp/en';

// This workaround was in App.js before
// however this redux file is loaded before and we need the hathorLib here
import hathorLib from '@hathor/wallet-lib';
import AsyncStorageStore from './store';
import {
  _IS_MULTI_TOKEN as IS_MULTI_TOKEN,
  _DEFAULT_TOKEN as DEFAULT_TOKEN,
  _PRIMARY_COLOR as PRIMARY_COLOR,
  _SENTRY_DSN as SENTRY_DSN,
} from './config';

export const STORE = new AsyncStorageStore();
// The storage is needed in the whole wallet, not only when we have a wallet object.
// Because of that we need to have a global store in the lib
// (we have some keys that are used in the wallet, e.g. 'loaded').
// We should do a refactor later to remove this dependency
hathorLib.storage.setStore(STORE);

/**
 * This is the environment stage that will be used to load the unleash feature flags.
 */
export const STAGE = 'dev-testnet';

/**
 * this is the network name that will be used to load the wallet on the wallet-service,
 * it is first hardcoded in the `startWallet` saga function, @see src\sagas\wallet.js.
 */
export const NETWORK = 'testnet';

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
export const UNLEASH_POLLING_INTERVAL = 5; // seconds
export const unleashStorageKey = {
  ignoreWalletServiceFlag: 'featureFlags:ignoreWalletServiceFlag',
};

/**
 * Quantity of token metadata to download concurrently
 */
export const METADATA_CONCURRENT_DOWNLOAD = 5;


// Wallet service URLs
// export const WALLET_SERVICE_MAINNET_BASE_URL = 'https://wallet-service.hathor.network/';
// export const WALLET_SERVICE_MAINNET_BASE_WS_URL = 'wss://ws.wallet-service.hathor.network/';

// dev-testnet?
export const WALLET_SERVICE_MAINNET_BASE_URL = 'https://dev.wallet-service.testnet.hathor.network/';
export const WALLET_SERVICE_MAINNET_BASE_WS_URL = 'wss://ws.dev.wallet-service.testnet.hathor.network/';

/**
 * Push notification constants
 */
export const pushNotificationKey = {
  deviceId: 'pushNotification:deviceId',
  settings: 'pushNotification:settings',
  hasBeenEnabled: 'pushNotification:hasBeenEnabled',
  enabledAt: 'pushNotification:enabledAt',
  optInDismissed: 'pushNotification:optInDismissed',
  notificationData: 'pushNotification:notificationData',
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
 * this is the channel id for the transaction notification
 */
export const TRANSACTION_CHANNEL_ID = 'transaction';
