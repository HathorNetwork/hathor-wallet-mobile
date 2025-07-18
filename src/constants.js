/**
 * Copyright (c) Hathor Labs and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

// Workaround to prevent error when using locale in android
import 'intl';
import 'intl/locale-data/jsonp/en';

import {
  _IS_MULTI_TOKEN as IS_MULTI_TOKEN,
  _DEFAULT_TOKEN as DEFAULT_TOKEN,
  _PRIMARY_COLOR as PRIMARY_COLOR,
  _SENTRY_DSN as SENTRY_DSN,
} from './config';

/**
 * This is the environment stage that will be used to load the unleash feature flags.
 */
export const STAGE = 'mainnet';

/**
 * this is the network name that will be used to load the wallet on the wallet-service,
 * it is first hardcoded in the `startWallet` saga function, @see src\sagas\wallet.js.
 */
export const NETWORK_MAINNET = 'mainnet';

/**
 * Default tokens for the wallet (to start on redux).
 * @constant
 * @type{{
 *   [uid: string]: {
 *     uid: string;
 *     name: string;
 *     symbol: string;
 *   }
 * }}
 */
export const INITIAL_TOKENS = {
  [DEFAULT_TOKEN.uid]: DEFAULT_TOKEN
};

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
 * The feature toggle configured in Unleash.
 *
 * You should configure the new feature toggle default value
 * at @see {@link FEATURE_TOGGLE_DEFAULTS}.
 */

export const WALLET_SERVICE_FEATURE_TOGGLE = 'wallet-service-mobile.rollout';
export const PUSH_NOTIFICATION_FEATURE_TOGGLE = 'push-notification.rollout';
export const REOWN_FEATURE_TOGGLE = 'reown.rollout';
export const NETWORK_SETTINGS_FEATURE_TOGGLE = 'network-settings.rollout';
export const NANO_CONTRACT_FEATURE_TOGGLE = 'nano-contract.rollout';
export const SAFE_BIOMETRY_MODE_FEATURE_TOGGLE = 'safe-biometry-mode.rollout'
export const SES_FEATURE_TOGGLE = 'ses-mobile.rollout';

/**
 * Default feature toggle values.
 *
 * This mapping constant is used in the featureToggle saga
 * initialization.
 *
 * Configure here the default value of new feature toggle.
 */
export const FEATURE_TOGGLE_DEFAULTS = {
  [WALLET_SERVICE_FEATURE_TOGGLE]: false,
  [PUSH_NOTIFICATION_FEATURE_TOGGLE]: false,
  [REOWN_FEATURE_TOGGLE]: false,
  [NETWORK_SETTINGS_FEATURE_TOGGLE]: false,
  [NANO_CONTRACT_FEATURE_TOGGLE]: false,
  [SAFE_BIOMETRY_MODE_FEATURE_TOGGLE]: false,
};

// Project id configured in https://walletconnect.com
export const REOWN_PROJECT_ID = '8264fff563181da658ce64ee80e80458';

export const STAGE_DEV_PRIVNET = 'dev-privnet';
export const STAGE_TESTNET = 'testnet';
export const NETWORK_TESTNET = 'testnet';
export const WALLET_SERVICE_TESTNET_BASE_URL = 'https://wallet-service.testnet.hathor.network/';
export const WALLET_SERVICE_TESTNET_BASE_WS_URL = 'wss://ws.wallet-service.testnet.hathor.network/';
export const NODE_SERVER_TESTNET_URL = 'https://node1.testnet.hathor.network/v1a/';
export const EXPLORER_TESTNET_URL = 'https://explorer.testnet.hathor.network/';
export const EXPLORER_SERVICE_TESTNET_URL = 'https://explorer-service.testnet.hathor.network/';
export const TX_MINING_SERVICE_TESTNET_URL = 'https://txmining.testnet.hathor.network/';

// Nano testnet settings:
export const NETWORK_NANO_TESTNET = 'testnet';
export const NODE_SERVER_NANO_TESTNET_URL = 'https://node1.bravo.nano-testnet.hathor.network/v1a/';
export const EXPLORER_NANO_TESTNET_URL = 'https://explorer.bravo.nano-testnet.hathor.network/';
export const TX_MINING_SERVICE_NANO_TESTNET_URL = 'https://txmining.bravo.nano-testnet.hathor.network/';

export const PRE_SETTINGS_NANO_TESTNET = {
  stage: STAGE_TESTNET,
  network: NETWORK_NANO_TESTNET,
  nodeUrl: NODE_SERVER_NANO_TESTNET_URL,
  explorerUrl: EXPLORER_NANO_TESTNET_URL,
  explorerServiceUrl: EXPLORER_SERVICE_TESTNET_URL,
  txMiningServiceUrl: TX_MINING_SERVICE_NANO_TESTNET_URL,
};

export const PRE_SETTINGS_TESTNET = {
  stage: STAGE_TESTNET,
  network: NETWORK_TESTNET,
  walletServiceUrl: WALLET_SERVICE_TESTNET_BASE_URL,
  walletServiceWsUrl: WALLET_SERVICE_TESTNET_BASE_WS_URL,
  nodeUrl: NODE_SERVER_TESTNET_URL,
  explorerUrl: EXPLORER_TESTNET_URL,
  explorerServiceUrl: EXPLORER_SERVICE_TESTNET_URL,
  txMiningServiceUrl: TX_MINING_SERVICE_TESTNET_URL,
};

export const NODE_SERVER_MAINNET_URL = 'https://mobile.wallet.hathor.network/v1a/';
export const EXPLORER_MAINNET_URL = 'https://explorer.hathor.network/';
export const EXPLORER_SERVICE_MAINNET_URL = 'https://explorer-service.hathor.network/';
export const TX_MINING_SERVICE_MAINNET_URL = 'https://txmining.mainnet.hathor.network/';

export const PRE_SETTINGS_MAINNET = {
  stage: STAGE,
  network: NETWORK_MAINNET,
  walletServiceUrl: WALLET_SERVICE_MAINNET_BASE_URL,
  walletServiceWsUrl: WALLET_SERVICE_MAINNET_BASE_WS_URL,
  nodeUrl: NODE_SERVER_MAINNET_URL,
  explorerUrl: EXPLORER_MAINNET_URL,
  explorerServiceUrl: EXPLORER_SERVICE_MAINNET_URL,
  txMiningServiceUrl: TX_MINING_SERVICE_MAINNET_URL,
};

/**
 * Network settings key collection to be used with the app
 * storage.
 */
export const networkSettingsKeyMap = {
  networkSettings: 'networkSettings:networkSettings'
};

export const BASE_STATUS = {
  READY: 'ready',
  FAILED: 'failed',
  LOADING: 'loading',
  SUCCESSFUL: 'successful',
};

export const NETWORKSETTINGS_STATUS = {
  ...BASE_STATUS,
  WAITING: 'waiting',
};

export const REOWN_CREATE_TOKEN_STATUS = {
  ...BASE_STATUS,
};

export const REOWN_SEND_TX_STATUS = {
  ...BASE_STATUS,
};

export const NANOCONTRACT_REGISTER_STATUS = {
  ...BASE_STATUS,
};

export const REOWN_NEW_NANOCONTRACT_TX_STATUS = {
  ...BASE_STATUS,
};

export const REOWN_CREATE_NANO_CONTRACT_CREATE_TOKEN_TX_STATUS = {
  ...BASE_STATUS,
};

export const NANOCONTRACT_BLUEPRINTINFO_STATUS = {
  ...BASE_STATUS,
};

/**
 * Timeout in miliseconds to call wallet-service.
 */
export const WALLET_SERVICE_REQUEST_TIMEOUT = 3000;

/**
 * Timeout in miliseconds to call a general http request.
 */
export const HTTP_REQUEST_TIMEOUT = 3000;

/**
 * Any network that is not mainnet or testnet should be a privatenet.
 */
export const NETWORK_PRIVATENET = 'privatenet';

/**
 * The following constants are used on a progressive retry mechanism.
 * @see `src/sagas/helper.js@progressiveRetryRequest`
 */
export const MAX_RETRIES = 8;
export const INITIAL_RETRY_LATENCY = 300; // ms
export const LATENCY_MULTIPLIER = 30; // multiplier per iteration

/**
 * Timeout for await wallet load in the context of tx details loading.
 * It awaits 5 minutes.
 */
export const TX_DETAILS_TIMEOUT = 5 * 60 * 1000; // 5 minutes

/**
 * Nano Contract's transaction history list size.
 */
export const NANO_CONTRACT_TX_HISTORY_SIZE = 20;
/**
 * Nano Contract documentation URL.
 */
export const NANO_CONTRACT_INFO_URL = 'https://docs.hathor.network/explanations/features/nano-contracts/';

/**
 * Nano Contract Action Enum
 */
export const NANO_CONTRACT_ACTION = {
  withdrawal: 'withdrawal',
  deposit: 'deposit',
};

export const NODE_RATE_LIMIT_CONF = {
  thin_wallet_token: {
    perSecond: 3,
    burst: 10,
    delay: 3,
  }
};

// This key is read during the react-native initialization (read the patch in
// patches/react-native+0.77.2.patch), to decide whether to activate SES (secure
// ecmascript)
export const SHOULD_ENABLE_SES_STORAGE_KEY = 'should-enable-ses';
