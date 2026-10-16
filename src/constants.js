/**
 * Copyright (c) Hathor Labs and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

// Workaround to prevent error when using locale in android
import 'intl';
import 'intl/locale-data/jsonp/en';
import { Platform } from 'react-native';

import {
  _IS_MULTI_TOKEN as IS_MULTI_TOKEN,
  _DEFAULT_TOKEN as DEFAULT_TOKEN,
  _PRIMARY_COLOR as PRIMARY_COLOR,
  _SENTRY_DSN as SENTRY_DSN,
} from './config';

/**
 * Whether Text may shrink its font to fit (adjustsFontSizeToFit). Only on iOS: on Android (React
 * Native 0.77, New Architecture) the shrink compounds on every layout pass and ignores
 * minimumFontScale, so the text ends up far smaller than it needs to be. There it stays on one
 * line and is truncated instead, or shrinks with FitText.
 */
export const SHRINK_TEXT_TO_FIT = Platform.OS === 'ios';

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
 * URL with more information about token fees
 */
export const TOKEN_FEES_URL = 'https://github.com/HathorNetwork/rfcs/blob/master/text/0045-transaction_fee_minting.md'
/**
 * URL for the Terms of Service
 */
export const TERMS_OF_SERVICE_URL = 'https://hathor.network/terms-and-conditions/';

/**
 * URL for the Privacy Policy
 */
export const PRIVACY_POLICY_URL = 'https://hathor.network/privacy-policy/';

/**
 * Deep link URL scheme for the app (e.g., hathorwallet://reown)
 */
export const DEEP_LINK_SCHEME = 'hathorwallet';

/**
 * Deep link types for routing
 */
export const DEEP_LINK_TYPE = {
  NAVIGATE: 'navigate',
  WALLETCONNECT: 'walletconnect',
};

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
 * Wallet address modes.
 */
export const ADDRESS_MODE = {
  SINGLE: 'single',
  MULTI: 'multi',
};

// Address mode is namespaced per network so a preference on one network does
// not leak into another (e.g. mainnet has the rollout flag on, testnet does not).
// The 'wallet:' prefix means STORE.clearItems(true) sweeps it on resetWallet.
const ADDRESS_MODE_KEY_PREFIX = 'wallet:address_mode:';
export const addressModeKey = (network) => `${ADDRESS_MODE_KEY_PREFIX}${network}`;

/**
 * What a send hides:
 * - PUBLIC: nothing, the amount and the token are visible;
 * - HIDE_AMOUNT: the amount (an amount-shielded output);
 * - PRIVATE: the amount and the token (a fully shielded output).
 *
 * A default mode can be stored as a user preference, so keep these values stable.
 */
export const PRIVACY_MODE = {
  PUBLIC: 'public',
  HIDE_AMOUNT: 'hide_amount',
  PRIVATE: 'private',
};

/**
 * The privacy mode a send starts in, until the user saves another default in Settings, under
 * Privacy.
 */
export const DEFAULT_PRIVACY_MODE = PRIVACY_MODE.PUBLIC;

/**
 * Amount display format (wallet-wide, network-independent).
 */
export const AMOUNT_FORMAT = {
  EXPANDED: 'expanded',
  COMPRESSED: 'compressed',
};

export const AMOUNT_FORMAT_DEFAULT = AMOUNT_FORMAT.EXPANDED;

// 'wallet:' prefix: STORE.clearItems(true) sweeps it on resetWallet, so it resets to Expanded.
export const AMOUNT_FORMAT_KEY = 'wallet:amount_format';

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
export const TOKEN_SWAP_FEATURE_TOGGLE = 'token-swap.rollout';
export const FBT_FEATURE_TOGGLE = 'fee-based-tokens.rollout';
export const SINGLE_ADDRESS_FEATURE_TOGGLE = 'single-address-mobile.rollout';
export const PASSKEY_ONBOARDING_FEATURE_TOGGLE = 'passkey-onboarding.rollout';
export const AMOUNT_FORMAT_FEATURE_TOGGLE = 'amount-format-mobile.rollout';
/**
 * Shows the shielded outputs UI. It is off by default: the Unleash proxy leaves out the flags it
 * doesn't enable, so a flag it doesn't return reads as off, and Unleash turns it on only where it
 * targets it, such as the `testnet-shielded-outputs` network. The UI's own gates also keep the
 * shielded UI to the shielded testnet. It doesn't decide where the shielded crypto provider is
 * registered: on the shielded testnet it is registered either way.
 */
export const SHIELDED_OUTPUTS_FEATURE_TOGGLE = 'shielded-outputs.rollout';
/**
 * Shows the Shielded Testnet preset in Network Settings, and nothing else. It is separate from
 * SHIELDED_OUTPUTS_FEATURE_TOGGLE because the app reads flags with the network it is on: a flag
 * targeted at the shielded testnet is off on the networks the user switches from, so it can't
 * also show the way there. Off by default, like every flag Unleash doesn't return.
 */
export const SHIELDED_NETWORK_PRESET_FEATURE_TOGGLE = 'shielded-outputs-network.rollout';

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
  [TOKEN_SWAP_FEATURE_TOGGLE]: false,
  [FBT_FEATURE_TOGGLE]: false,
  [SINGLE_ADDRESS_FEATURE_TOGGLE]: false,
  [PASSKEY_ONBOARDING_FEATURE_TOGGLE]: false,
  [AMOUNT_FORMAT_FEATURE_TOGGLE]: false,
  [SHIELDED_OUTPUTS_FEATURE_TOGGLE]: false,
  [SHIELDED_NETWORK_PRESET_FEATURE_TOGGLE]: false,
};

/**
 * Passkey (PRF) onboarding config (passkey PRF secret -> BIP39 seed).
 *
 * PASSKEY_RP_ID MUST be a domain Hathor controls with the Associated Domains entitlement
 * (`webcredentials:<PASSKEY_RP_ID>`), a hosted
 * https://<PASSKEY_RP_ID>/.well-known/apple-app-site-association and a hosted
 * https://<PASSKEY_RP_ID>/.well-known/assetlinks.json — otherwise passkey create/get fail on device.
 *
 * It is PERMANENT, like the PRF salt: a passkey belongs to one RP ID, so changing it leaves every
 * existing passkey wallet unreachable. It is the web wallet's domain so that the web wallet can
 * open the same passkey wallets; for the same reason, every site under this domain can ask for
 * the passkey, so nothing outside Hathor's control may be hosted under it.
 */
export const PASSKEY_RP_ID = 'wallet.hathor.network';
export const PASSKEY_RP_NAME = 'Hathor Wallet';

// Project id configured in https://walletconnect.com
export const REOWN_PROJECT_ID = '8264fff563181da658ce64ee80e80458';

// Timeout for Reown requests (5 minutes to match WalletConnect server default)
export const REOWN_REQUEST_TIMEOUT = 5 * 60 * 1000;

export const STAGE_DEV_PRIVNET = 'dev-privnet';
export const STAGE_TESTNET = 'testnet';
export const NETWORK_TESTNET = 'testnet';
export const FULL_NETWORK_TESTNET = 'testnet';
export const WALLET_SERVICE_TESTNET_BASE_URL = 'https://wallet-service.testnet.hathor.network/';
export const WALLET_SERVICE_TESTNET_BASE_WS_URL = 'wss://ws.wallet-service.testnet.hathor.network/';
export const NODE_SERVER_TESTNET_URL = 'https://node1.testnet.hathor.network/v1a/';
export const EXPLORER_TESTNET_URL = 'https://explorer.testnet.hathor.network/';
export const EXPLORER_SERVICE_TESTNET_URL = 'https://explorer-service.testnet.hathor.network/';
export const TX_MINING_SERVICE_TESTNET_URL = 'https://txmining.testnet.hathor.network/';

export const PRE_SETTINGS_TESTNET = {
  stage: STAGE_TESTNET,
  network: NETWORK_TESTNET,
  fullNetwork: FULL_NETWORK_TESTNET,
  walletServiceUrl: WALLET_SERVICE_TESTNET_BASE_URL,
  walletServiceWsUrl: WALLET_SERVICE_TESTNET_BASE_WS_URL,
  nodeUrl: NODE_SERVER_TESTNET_URL,
  explorerUrl: EXPLORER_TESTNET_URL,
  explorerServiceUrl: EXPLORER_SERVICE_TESTNET_URL,
  txMiningServiceUrl: TX_MINING_SERVICE_TESTNET_URL,
};

export const FULL_NETWORK_MAINNET = 'mainnet';
export const NODE_SERVER_MAINNET_URL = 'https://mobile.wallet.hathor.network/v1a/';
export const EXPLORER_MAINNET_URL = 'https://explorer.hathor.network/';
export const EXPLORER_SERVICE_MAINNET_URL = 'https://explorer-service.hathor.network/';
export const TX_MINING_SERVICE_MAINNET_URL = 'https://txmining.mainnet.hathor.network/';

export const PRE_SETTINGS_MAINNET = {
  stage: STAGE,
  network: NETWORK_MAINNET,
  fullNetwork: FULL_NETWORK_MAINNET,
  walletServiceUrl: WALLET_SERVICE_MAINNET_BASE_URL,
  walletServiceWsUrl: WALLET_SERVICE_MAINNET_BASE_WS_URL,
  nodeUrl: NODE_SERVER_MAINNET_URL,
  explorerUrl: EXPLORER_MAINNET_URL,
  explorerServiceUrl: EXPLORER_SERVICE_MAINNET_URL,
  txMiningServiceUrl: TX_MINING_SERVICE_MAINNET_URL,
};

/**
 * The shielded testnet: a testnet whose nodes report the network name
 * 'testnet-shielded-outputs'. It shares its genesis with the public testnet, so the network name
 * is what tells them apart. Its wallet-service has shielded support: a seed wallet that starts on
 * it registers its shielded keys there.
 */
export const STAGE_SHIELDED_TESTNET = 'testnet';
export const NETWORK_SHIELDED_TESTNET = 'testnet';
export const FULL_NETWORK_SHIELDED_TESTNET = 'testnet-shielded-outputs';
export const NODE_SERVER_SHIELDED_TESTNET_URL = 'https://node1.shielded-outputs.testnet.hathor.network/v1a/';
export const EXPLORER_SHIELDED_TESTNET_URL = 'https://explorer.shielded-outputs.testnet.hathor.network/';
export const EXPLORER_SERVICE_SHIELDED_TESTNET_URL = 'https://explorer-service.shielded-outputs.testnet.hathor.network/';
export const TX_MINING_SERVICE_SHIELDED_TESTNET_URL = 'https://txmining.shielded-outputs.testnet.hathor.network/';
export const WALLET_SERVICE_SHIELDED_TESTNET_BASE_URL = 'https://wallet-service.shielded-outputs.testnet.hathor.network/';
export const WALLET_SERVICE_SHIELDED_TESTNET_BASE_WS_URL = 'wss://ws.wallet-service.shielded-outputs.testnet.hathor.network/';

export const PRE_SETTINGS_SHIELDED_TESTNET = {
  stage: STAGE_SHIELDED_TESTNET,
  network: NETWORK_SHIELDED_TESTNET,
  fullNetwork: FULL_NETWORK_SHIELDED_TESTNET,
  walletServiceUrl: WALLET_SERVICE_SHIELDED_TESTNET_BASE_URL,
  walletServiceWsUrl: WALLET_SERVICE_SHIELDED_TESTNET_BASE_WS_URL,
  nodeUrl: NODE_SERVER_SHIELDED_TESTNET_URL,
  explorerUrl: EXPLORER_SHIELDED_TESTNET_URL,
  explorerServiceUrl: EXPLORER_SERVICE_SHIELDED_TESTNET_URL,
  txMiningServiceUrl: TX_MINING_SERVICE_SHIELDED_TESTNET_URL,
};

/**
 * Network settings key collection to be used with the app
 * storage.
 */
export const networkSettingsKeyMap = {
  networkSettings: 'networkSettings:networkSettings'
};

/** Storage key for the cached token icon URLs. */
export const TOKEN_ICONS_CACHE_KEY = 'tokenIcons:cache';

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

export const TOKEN_SWAP_ALLOWED_TOKEN_STATUS = {
  ...BASE_STATUS,
};

export const TOKEN_SWAP_QUOTE_STATUS = {
  ...BASE_STATUS,
};

export const TOKEN_SWAP_STATUS = {
  ...BASE_STATUS,
};

/**
 * States used by the token import modal (status of the user-initiated import flow).
 * Lives in constants (not in the modal component) so the reducer can transition
 * importStatus without depending on a UI module.
 */
export const TOKEN_IMPORT_MODAL_STATE = {
  IDLE: 'idle',
  IMPORTING: 'importing',
  SUCCESS: 'success',
  ERROR: 'error',
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

/**
 * Accepted slippage (in %) when swapping tokens.
 */
export const TOKEN_SWAP_SLIPPAGE = 0.5;

/**
 * Where the shielded crypto provider of the running wallet stands:
 * - UNREGISTERED: no provider was registered, as on every network but the shielded testnet and
 *   for passkey wallets without shielded keys;
 * - READY: it passed its self-test and was registered before start();
 * - FAILED: it failed to load or failed its self-test, so the wallet runs transparent-only.
 */
export const SHIELDED_PROVIDER_STATUS = {
  UNREGISTERED: 'unregistered',
  READY: 'ready',
  FAILED: 'failed',
};

/**
 * What asks to unlock the shielded view key of the running wallet with a PIN entry, or a passkey
 * ceremony: the lock screen, the user from a locked private balance, or a private send.
 */
export const SHIELDED_UNLOCK_SOURCE = {
  LOCK_SCREEN: 'lock-screen',
  USER: 'user',
  SEND: 'send',
};

/**
 * How long a sensitive copy, such as a privacy key or the unblinding values of a tx, stays in the
 * clipboard, in milliseconds.
 */
export const SENSITIVE_CLIPBOARD_CLEAR_MS = 60 * 1000;

/**
 * How long a sensitive copy's button says that it copied, in milliseconds: far less than the
 * clipboard keeps the copy.
 */
export const SENSITIVE_COPY_FEEDBACK_MS = 1500;

/**
 * The explorers that read the unblinding values of a tx from the #unblind= fragment of its link:
 * only the shielded testnet's explorer has the parser.
 */
export const UNBLIND_EXPLORER_URLS = [EXPLORER_SHIELDED_TESTNET_URL];
