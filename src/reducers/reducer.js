/**
 * Copyright (c) Hathor Labs and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import hathorLib from '@hathor/wallet-lib';
import { get } from 'lodash';
import {
  INITIAL_TOKENS,
  DEFAULT_TOKEN,
  PUSH_API_STATUS,
  FEATURE_TOGGLE_DEFAULTS,
  PRE_SETTINGS_MAINNET,
  NETWORKSETTINGS_STATUS,
  NANOCONTRACT_REGISTER_STATUS,
  WALLETCONNECT_NEW_NANOCONTRACT_TX_STATUS
} from '../constants';
import { types } from '../actions';
import { TOKEN_DOWNLOAD_STATUS } from '../sagas/tokens';
import { WALLET_STATUS } from '../sagas/wallet';

/**
 * tokensBalance {Object} stores the balance for each token (Dict[tokenUid: str, {
 *    status: string,
 *    oldStatus: string,
 *    updatedAt: int,
 *    data: {
 *      available: int,
 *      locked: int
 *    }
 * }])
 * loadHistoryStatus {Object} progress on loading tx history {
 *   active {boolean} indicates we're loading the tx history
 *   error {boolean} error loading history
 * }
 * latestInvoice {Object} tracks the latest payment request created {
 *   address {string} address where we're expecting the payment
 *   amount {int} admount to be paid
 *   token {Object} payment should be made in this token
 * }
 * invoicePayment {Object} null if not paid or the tx that settles latestInvoice
 * selectedToken {Object} token currently selected by the user
 * isOnline {bool} Indicates whether the wallet is connected to the fullnode's websocket
 * serverInfo {Object} {
 *   version {str} version of the connected server (e.g., 0.26.0-beta)
 *   network {str} network of the connected server (e.g., mainnet, testnet)
 * }
 * lockScreen {bool} Indicates screen is locked
 *
 * useWalletService {boolean} if should use wallet service facade
 * (feature flag that should be updated from rollout service)
 *
 * tokenMetadata {Object} Metadata of tokens {uid: {metaObject}}
 * metadataLoaded {boolean} If metadata was fully loaded from the explorer service
 *
 * errorHandler {Object} Information on the captured erorr {
 *   showAlert {boolean} Indicates if we need to show the alert dialog
 *   showModal {boolean} Indicates if we need to show the alert modal
 *   errorReported {boolean} Indicates if the user reported the alert to Sentry
 *   isFatal {boolean} Indicates if the error is fatal
 *   error {Error} Error object with the stacktrace, to be sent to Sentry
 * }
 *
 * pushNotification {Object} Information on the push notification {
 *  showOptInQuestion {boolean} Indicates if we need to show the modal to ask the user
 *    if he wants to enable push notification
 *  deviceId {string} device id for push notification
 *  apiStatus {string} status of the push notification api
 *  enabled {boolean} if user has enabled push notification
 *  enabledAt {number} timestamp of when push notification was enabled
 *  showAmountEnabled {boolean} if user has enabled the option to show amount in push notification
 *  txDetails {Object} tx info to show on tx details modal
 *  deviceRegistered {boolean} if device is registered on FCM
 * }
 * lastSharedAddress {string} The current address to use
 * lastSharedIndex {int} The current address index to use
 */
const initialState = {
  /**
   * @type {{
   *  [tokenUid: string]: {
   *    status: TOKEN_DOWNLOAD_STATUS;
   *    oldStatus: string;
   *    updatedAt: number;
   *    data: TxHistory[];
   *  }
   * }} stores the history for each token ()
   */
  tokensHistory: {},
  tokensBalance: {},
  loadHistoryStatus: { active: true, error: false },
  latestInvoice: null,
  invoicePayment: null,
  /**
   * tokens {Object.<string, Object>} Map of tokens added plus initial tokens,
   * @see {@link INITIAL_TOKENS}
   */
  tokens: INITIAL_TOKENS,
  /**
   * selectedToken {{
   *  uid: string;
   *  name; string;
   *  symbol: string
   * }} Token selected to operate with
   * @example
   * {
   *   name: 'YanCoin',
   *   symbol: 'YAN',
   *   uid: '000003a3b261e142d3dfd84970d3a50a93b5bc3a66a3b6ba973956148a3eb824'
   * }
   */
  selectedToken: DEFAULT_TOKEN,
  isOnline: false,
  serverInfo: { version: '', network: '' },
  lockScreen: true,
  resetOnLockScreen: false,
  height: 0,
  errorHandler: {
    showAlert: false,
    showModal: false,
    errorReported: null,
    isFatal: null,
    error: null,
  },
  wallet: null,
  loadedData: { transactions: 0, addresses: 0 },
  useWalletService: false,
  tokenMetadata: {},
  metadataLoaded: false,
  uniqueDeviceId: null,
  isShowingPinScreen: false,
  /**
   * Indicates if the camera for this app is available and granted permission to be used.
   * Will be false either if the device has no camera or the user has blocked its permission.
   * @type {null|boolean} null if uninitialized, boolean after user decision
   */
  isCameraAvailable: null,
  pushNotification: {
    /**
     * available {boolean} if push notification is available based on unleash feature flag
     */
    available: null,
    /**
     * showOptInQuestion {boolean}
     * this is used to show the modal only the first time user opens the app
     * after the modal is dismissed, it will not be shown again
     * until the user clears the app data
     * (this is done to avoid showing the modal to users that have already
     * enabled push notification)
     */
    showOptInQuestion: false,
    /**
     * showRegistrationRefreshQuestion {boolean}
     * this is used to show the action modal to ask the user to refresh
     * the push notification registration to keep receiving notifications.
     */
    showRegistrationRefreshQuestion: false,
    /**
     * deviceId {string} device id for push notification
     */
    deviceId: '',
    /**
     * apiStatus {string} status of the push notification api request
     */
    apiStatus: PUSH_API_STATUS.READY,
    /**
     * enabled {boolean} if user has enabled push notification
     */
    enabled: false,
    /**
     * showAmountEnabled {boolean} if user has enabled the option to show amount
     * of token balance on the push notification
     */
    showAmountEnabled: false,
    /**
     * enabledAt {number} timestamp of when push notification was enabled
     */
    enabledAt: 0,
    /**
     * txDetails {{
     *  tx: {
     *    txId: string,
     *    timestamp: number,
     *    voided: boolean
     *  },
     *  tokens: {
     *    uid: string,
     *    name: string,
     *    symbol: string,
     *    balance: number,
     *    isRegistered: boolean
     *   }[]
     * }} tx info to show on tx details modal
     * @example
     * {
     *   tx: {
     *     txId: '00c30fc8a1b9a326a766ab0351faf3635297d316fd039a0eda01734d9de40185',
     *     timestamp: 1673039453,
     *     voided: false,
     *   },
     *   tokens: [
     *     {
     *       uid: '00',
     *       name: 'Hathor',
     *       symbol: 'HTR',
     *       balance: 200,
     *       isRegistered: true,
     *     },
     *     {
     *       uid: '0025dadebe337a79006f181c05e4799ce98639aedfbd26335806790bdea4b1d4',
     *       name: 'TestNft',
     *       symbol: 'TN1',
     *       balance: 2,
     *       isRegistered: false,
     *     },
     *   ],
     * }
     */
    txDetails: null,
    /**
     * deviceRegistered {boolean} if device is registered on FCM, and APNS when running on iOS.
     */
    deviceRegistered: false,
  },
  walletStartState: WALLET_STATUS.NOT_STARTED,
  lastSharedAddress: null,
  lastSharedIndex: null,
  walletConnect: {
    client: null,
    modal: {
      show: false,
    },
    /**
     * newNanoContractTransaction {{
     *   showModal: boolean;
     *   data: {
     *     nc: {
     *       network: string;
     *       ncId: string;
     *       blueprintId: string;
     *       method: string;
     *       caller: string;
     *       actions: {
     *         type: string;
     *         token: string;
     *         amount: number;
     *         address?: string;
     *       }[];
     *       args: string[];
     *     };
     *     dapp: {
     *       icon: string;
     *       proposer: string;
     *       url: string;
     *       description: string;
     *     };
     *   };
     * }}
     */
    newNanoContractTransaction: {
      status: WALLETCONNECT_NEW_NANOCONTRACT_TX_STATUS.READY,
      showModal: false,
      data: null,
    },
    connectionFailed: false,
    sessions: {},
  },
  unleashClient: null,
  featureTogglesInitialized: false,
  featureToggles: {
    ...FEATURE_TOGGLE_DEFAULTS,
  },
  networkSettings: PRE_SETTINGS_MAINNET,
  networkSettingsInvalid: {},
  networkSettingsStatus: NETWORKSETTINGS_STATUS.READY,
  nanoContract: {
    registerStatus: NANOCONTRACT_REGISTER_STATUS.READY,
    registerFailureMessage: null,
    /**
     * registered {{
     *   [ncId: string]: {
     *     address: string,
     *     ncId: string,
     *     blueprintId: string,
     *     blueprintName: string,
     *   }
     * }} registered Nano Contracts per wallet address with basic information.
     * @example
     * {
     *   '000001342d3c5b858a4d4835baea93fcc683fa615ff5892bd044459621a0340a': {
     *     address: 'HTeZeYTCv7cZ8u7pBGHkWsPwhZAuoq5j3V',
     *     ncId: '000001342d3c5b858a4d4835baea93fcc683fa615ff5892bd044459621a0340a',
     *     blueprintId: '0025dadebe337a79006f181c05e4799ce98639aedfbd26335806790bdea4b1d4',
     *     blueprintName: 'Swap',
     *   },
     * }
     */
    registered: {},
    /**
     * history {{
     *   [ncId: string]: {
     *     txId: string;
     *     timestamp: number;
     *     tokens: string[];
     *     isVoided: boolean;
     *     ncId: string;
     *     ncMethod: string;
     *     blueprintId: string;
     *     caller: string;
     *     isMine: boolean;
     *     balance: {[uid: string]: Object};
     *   }[];
     * }} history of Nano Contracts registered per wallet address.
     * @example
     * {
     *   '000001342d3c5b858a4d4835baea93fcc683fa615ff5892bd044459621a0340a': [
     *     {
     *       txId: '000000203e87e8575f121de16d0eb347bd1473eedd9f46cc76c1bc8d4e5a5fce',
     *       timestamp: 1708356261,
     *       tokens: [
     *         '00000117b0502e9eef9ccbe987af65f153aa899d6eba88d50a6c89e78644713d',
     *         '0000038c49253f86e6792006dd9124e2c50e6487fde3296b7bd637e3e1a497e7'
     *       ],
     *       isVoided: false,
     *       ncId: '000001342d3c5b858a4d4835baea93fcc683fa615ff5892bd044459621a0340a',
     *       ncMethod: 'swap',
     *       blueprintId: '0025dadebe337a79006f181c05e4799ce98639aedfbd26335806790bdea4b1d4';
     *       caller: 'HTeZeYTCv7cZ8u7pBGHkWsPwhZAuoq5j3V',
     *       isMine: true,
     *       balance: {
     *         '00': 300,
     *       },
     *     },
     *   ],
     * }
     */
    history: {},
    /**
     * historyMeta {{
     *   [ncId: string]: {
     *     isLoading: boolean;
     *     error: string;
     *     after: string;
     *   };
     * }} holds the load state for each nano contract, including the after hash
     * from which a new history chunk should be fetched, exclusively.
     * @example
     * {
     *   '000001342d3c5b858a4d4835baea93fcc683fa615ff5892bd044459621a0340a': {
     *     isLoading: false,
     *     after: '000075e15f015dc768065763acd9b563ec002e37182869965ff2c712bed83e1e',
     *   },
     * }
     */
    historyMeta: {},
  },
  /**
   * selectAddressModal {{
   *   addresses: string[];
   *   error?: string;
   * }} it holds all wallet addresses or the error status.
   */
  selectAddressModal: {
    addresses: [],
    error: null,
  },
  /**
   * firstAddress {{
   *   address?: string;
   *   error?: string;
   * }} it holds the first wallet address or the error status.
   */
  firstAddress: {
    address: null,
    error: null,
  },
};

export const reducer = (state = initialState, action) => {
  switch (action.type) {
    case types.NEW_TX:
      return onNewTx(state, action);
    case types.NEW_INVOICE:
      return onNewInvoice(state, action);
    case types.CLEAR_INVOICE:
      return onClearInvoice(state, action);
    case types.RESET_DATA:
      return initialState;
    case types.UPDATE_SELECTED_TOKEN:
      return onUpdateSelectedToken(state, action);
    case types.NEW_TOKEN:
      return onNewToken(state, action);
    case types.SET_TOKENS:
      return onSetTokens(state, action);
    case types.UPDATE_TOKEN_HISTORY:
      return onUpdateTokenHistory(state, action);
    case types.SET_LOAD_HISTORY_STATUS:
      return onSetLoadHistoryStatus(state, action);
    case types.SET_IS_ONLINE:
      return onSetIsOnline(state, action);
    case types.SET_SERVER_INFO:
      return onSetServerInfo(state, action);
    case types.SET_LOCK_SCREEN:
      return onSetLockScreen(state, action);
    case types.SET_RESET_ON_LOCK_SCREEN:
      return onSetResetOnLockScreen(state, action);
    case types.SHOW_ERROR_MODAL:
      return onShowErrorModal(state, action);
    case types.HIDE_ERROR_MODAL:
      return onHideErrorModal(state);
    case types.SET_WALLET:
      return onSetWallet(state, action);
    case types.RESET_WALLET_SUCCESS:
      return onResetWalletSuccess(state);
    case types.RESET_LOADED_DATA:
      return onResetLoadedData(state, action);
    case types.UPDATE_LOADED_DATA:
      return onUpdateLoadedData(state, action);
    case types.SET_USE_WALLET_SERVICE:
      return onSetUseWalletService(state, action);
    case types.TOKENS_FETCH_METADATA_REQUESTED:
      return onTokensFetchMetadataRequested(state);
    case types.TOKEN_METADATA_UPDATED:
      return onTokenMetadataUpdated(state, action);
    case types.TOKEN_METADATA_REMOVED:
      return onTokenMetadataRemoved(state, action);
    case types.TOKEN_METADATA_LOADED:
      return onTokenMetadataLoaded(state, action);
    case types.SET_UNIQUE_DEVICE_ID:
      return onSetUniqueDeviceId(state, action);
    case types.SET_TEMP_PIN:
      return onSetTempPin(state, action);
    case types.PARTIALLY_UPDATE_HISTORY_AND_BALANCE:
      return partiallyUpdateHistoryAndBalance(state, action);
    case types.SET_IS_SHOWING_PIN_SCREEN:
      return onSetIsShowingPinScreen(state, action);
    case types.TOKEN_FETCH_BALANCE_REQUESTED:
      return onTokenFetchBalanceRequested(state, action);
    case types.TOKEN_FETCH_BALANCE_SUCCESS:
      return onTokenFetchBalanceSuccess(state, action);
    case types.TOKEN_FETCH_BALANCE_FAILED:
      return onTokenFetchBalanceFailed(state, action);
    case types.TOKEN_FETCH_HISTORY_REQUESTED:
      return onTokenFetchHistoryRequested(state, action);
    case types.TOKEN_FETCH_HISTORY_SUCCESS:
      return onTokenFetchHistorySuccess(state, action);
    case types.TOKEN_FETCH_HISTORY_FAILED:
      return onTokenFetchHistoryFailed(state, action);
    case types.TOKEN_INVALIDATE_HISTORY:
      return onTokenInvalidateHistory(state, action);
    case types.TOKEN_INVALIDATE_BALANCE:
      return onTokenInvalidateBalance(state, action);
    case types.ON_START_WALLET_LOCK:
      return onStartWalletLock(state);
    case types.START_WALLET_REQUESTED:
      return onStartWalletRequested(state, action);
    case types.START_WALLET_SUCCESS:
      return onStartWalletSuccess(state);
    case types.START_WALLET_FAILED:
      return onStartWalletFailed(state);
    case types.START_WALLET_NOT_STARTED:
      return onStartWalletNotStarted(state);
    case types.SET_CAMERA_AVAILABLE:
      return onSetCameraAvailable(state, action);
    case types.WALLET_BEST_BLOCK_UPDATE:
      return onWalletBestBlockUpdate(state, action);
    case types.SET_AVAILABLE_PUSH_NOTIFICATION:
      return onSetAvailablePushNotification(state, action);
    case types.PUSH_ASK_OPT_IN_QUESTION:
      return onPushAskOptInQuestion(state);
    case types.PUSH_DISMISS_OPT_IN_QUESTION:
      return onPushDismissOptInQuestion(state);
    case types.PUSH_ASK_REGISTRATION_REFRESH_QUESTION:
      return onPushAskRegistrationRefreshQuestion(state);
    case types.PUSH_DISMISS_REGISTRATION_REFRESH_QUESTION:
      return onPushDismissRegistrationRefreshQuestion(state);
    case types.PUSH_SET_STATE:
      return onPushSetState(state, action);
    case types.PUSH_UPDATE_DEVICE_ID:
      return onPushUpdateDeviceId(state, action);
    case types.PUSH_REGISTRATION_REQUESTED:
      return onPushApiLoading(state);
    case types.PUSH_API_READY:
      return onPushApiReady(state);
    case types.PUSH_REGISTER_SUCCESS:
      return onPushRegisterSuccess(state, action);
    case types.PUSH_REGISTER_FAILED:
      return onPushApiFailed(state);
    case types.PUSH_TX_DETAILS_SUCCESS:
      return onTxDetailsSuccess(state, action);
    case types.PUSH_CLEAN_TX_DETAILS:
      return onPushCleanTxDetails(state);
    case types.PUSH_RESET:
      return onPushReset(state);
    case types.PUSH_DEVICE_REGISTERED:
      return onPushDeviceRegistered(state, action);
    case types.EXCEPTION_CAPTURED:
      return onExceptionCaptured(state, action);
    case types.RELOAD_WALLET_REQUESTED:
      return onReloadWalletRequested(state);
    case types.WALLET_RELOADING:
      return onWalletReloading(state);
    case types.SHARED_ADDRESS_UPDATE:
      return onSharedAddressUpdate(state, action);
    case types.SET_UNLEASH_CLIENT:
      return onSetUnleashClient(state, action);
    case types.SET_FEATURE_TOGGLES:
      return onSetFeatureToggles(state, action);
    case types.FEATURE_TOGGLE_INITIALIZED:
      return onFeatureToggleInitialized(state);
    case types.SET_WALLET_CONNECT:
      return onSetWalletConnect(state, action);
    case types.SET_WALLET_CONNECT_MODAL:
      return onSetWalletConnectModal(state, action);
    case types.SET_WALLET_CONNECT_SESSIONS:
      return onSetWalletConnectSessions(state, action);
    case types.WC_SET_CONNECTION_FAILED:
      return onSetWCConnectionFailed(state, action);
    case types.NETWORKSETTINGS_UPDATE_REQUEST:
      return onNetworkSettingsUpdateRequest(state);
    case types.NETWORKSETTINGS_UPDATE_STATE:
      return onNetworkSettingsUpdateState(state, action);
    case types.NETWORKSETTINGS_PERSIST_STORE:
      return onNetworkSettingsPersistStore(state, action);
    case types.NETWORKSETTINGS_UPDATE_WAITING:
      return onNetworkSettingsUpdateWaiting(state);
    case types.NETWORKSETTINGS_UPDATE_SUCCESS:
      return onNetworkSettingsUpdateSuccess(state);
    case types.NETWORKSETTINGS_UPDATE_READY:
      return onNetworkSettingsUpdateReady(state);
    case types.NETWORKSETTINGS_UPDATE_FAILURE:
      return onNetworkSettingsUpdateFailure(state);
    case types.NETWORKSETTINGS_UPDATE_INVALID:
      return onNetworkSettingsUpdateInvalid(state, action);
    case types.NANOCONTRACT_HISTORY_LOADING:
      return onNanoContractHistoryLoading(state, action);
    case types.NANOCONTRACT_HISTORY_FAILURE:
      return onNanoContractHistoryFailure(state, action);
    case types.NANOCONTRACT_HISTORY_SUCCESS:
      return onNanoContractHistorySuccess(state, action);
    case types.NANOCONTRACT_HISTORY_CLEAN:
      return onNanoContractHistoryClean(state, action);
    case types.NANOCONTRACT_UNREGISTER_SUCCESS:
      return onNanoContractUnregisterSuccess(state, action);
    case types.NANOCONTRACT_ADDRESS_CHANGE_REQUEST:
      return onNanoContractAddressChangeRequest(state, action);
    case types.NANOCONTRACT_REGISTER_REQUEST:
      return onNanoContractRegisterRequest(state);
    case types.NANOCONTRACT_REGISTER_FAILURE:
      return onNanoContractRegisterFailure(state, action);
    case types.NANOCONTRACT_REGISTER_SUCCESS:
      return onNanoContractRegisterSuccess(state, action);
    case types.NANOCONTRACT_REGISTER_READY:
      return onNanoContractRegisterReady(state);
    case types.SELECTADDRESS_ADDRESSES_REQUEST:
      return onSelectAddressAddressesRequest(state);
    case types.SELECTADDRESS_ADDRESSES_FAILURE:
      return onSelectAddressAddressesFailure(state, action);
    case types.SELECTADDRESS_ADDRESSES_SUCCESS:
      return onSelectAddressAddressesSuccess(state, action);
    case types.FIRSTADDRESS_REQUEST:
      return onFirstAddressRequest(state);
    case types.FIRSTADDRESS_FAILURE:
      return onFirstAddressFailure(state, action);
    case types.FIRSTADDRESS_SUCCESS:
      return onFirstAddressSuccess(state, action);
    case types.SET_NEW_NANO_CONTRACT_TRANSACTION:
      return onSetNewNanoContractTransaction(state, action);
    case types.WALLETCONNECT_NEW_NANOCONTRACT_STATUS:
      return onSetNewNanoContractTransactionStatus(state, action);
    default:
      return state;
  }
};

const onFeatureToggleInitialized = (state) => ({
  ...state,
  featureTogglesInitialized: true,
});

/**
 * @param {Object} action.payload The key->value object with feature toggles
 */
const onSetFeatureToggles = (state, { payload }) => ({
  ...state,
  featureToggles: payload,
});

/**
 * @param {Object} action.payload The unleash client to store
 */
const onSetUnleashClient = (state, { payload }) => ({
  ...state,
  unleashClient: payload,
});

const onSetServerInfo = (state, action) => ({
  ...state,
  serverInfo: {
    network: action.payload.network,
    version: action.payload.version,
  },
});

const onSetIsOnline = (state, action) => ({
  ...state,
  isOnline: action.payload,
});

const onSetIsShowingPinScreen = (state, action) => ({
  ...state,
  isShowingPinScreen: action.payload,
});

/**
 * Updates the history and balance when a new tx arrives. Also checks
 * if this tx settles an open invoice.
 */
const onNewTx = (state, action) => {
  const { tx } = action.payload;

  // if we have the invoice modal, check if this tx settles it
  let invoicePayment = null;
  if (state.latestInvoice && state.latestInvoice.amount) {
    for (const txout of tx.outputs) {
      // Don't consider authority outputs
      if (hathorLib.transactionUtils.isAuthorityOutput(txout)) {
        continue;
      }

      if (txout.decoded && txout.decoded.address
        && txout.decoded.address === state.latestInvoice.address
        && txout.value === state.latestInvoice.amount
        && txout.token === state.latestInvoice.token.uid) {
        invoicePayment = tx;
        break;
      }
    }
  }

  return {
    ...state,
    invoicePayment: invoicePayment || state.invoicePayment,
  };
};

/**
 * Update token history after fetching more data in pagination
 */
const onUpdateTokenHistory = (state, action) => {
  const { token, newHistory } = action.payload;

  return {
    ...state,
    tokensHistory: {
      ...state.tokensHistory,
      [token]: {
        ...state.tokensHistory[token],
        data: [
          ...get(state.tokensHistory, `${token}.data`, []),
          ...newHistory,
        ]
      }
    },
  };
};

/**
 * Create a new payment request
 */
const onNewInvoice = (state, action) => {
  const { address } = action.payload;
  const { amount } = action.payload;
  const { token } = action.payload;
  return {
    ...state,
    latestInvoice: { address, amount, token },
  };
};

/**
 * When the user leaves the invoice screen, clear the invoice information
 */
const onClearInvoice = (state, action) => ({
  ...state,
  latestInvoice: null,
  invoicePayment: null,
});

/**
 * Switch the selected token
 */
const onUpdateSelectedToken = (state, action) => ({
  ...state,
  selectedToken: action.payload,
});

/**
 * Add a new token to the list of available tokens in this wallet
 * @param {object} state
 * @param {{payload: { uid: string }}} action containing a token data in payload,
 * @see {@link initialState.tokens}
 */
const onNewToken = (state, { payload }) => ({
  ...state,
  tokens: { ...state.tokens, [payload.uid]: { ...payload } },
});

/**
 * Set the list of tokens added in this wallet
 * @param {object} state
 * @param {{ payload }} action containing all registered tokens in payload
 */
const onSetTokens = (state, { payload }) => {
  let { selectedToken } = state;
  if (payload[selectedToken.uid] == null) {
    // We have unregistered this token
    selectedToken = DEFAULT_TOKEN;
  }
  return {
    ...state,
    tokens: { ...payload },
    selectedToken,
  };
};

/**
 * Set loadHistoryStatus
 */
const onSetLoadHistoryStatus = (state, action) => ({
  ...state,
  loadHistoryStatus: action.payload,
});

/**
 * Unlock the wallet
 */
const onSetLockScreen = (state, action) => ({
  ...state,
  lockScreen: action.payload,
});

const onSetResetOnLockScreen = (state, action) => ({
  ...state,
  resetOnLockScreen: action.payload,
});

const onSetTempPin = (state, action) => ({
  ...state,
  tempPin: action.payload,
});

const onSetWallet = (state, action) => ({
  ...state,
  wallet: action.payload,
});

const onSetUniqueDeviceId = (state, action) => ({
  ...state,
  uniqueDeviceId: action.payload,
});

const onSetUseWalletService = (state, action) => ({
  ...state,
  useWalletService: action.payload,
});

const onResetWalletSuccess = (state) => {
  const oldUnleashClient = state.unleashClient;
  const oldFeatureTogglesInitialized = state.featureTogglesInitialized;
  const oldFeatureToggles = state.featureToggles;
  return {
    ...initialState,
    unleashClient: oldUnleashClient,
    featureTogglesInitialized: oldFeatureTogglesInitialized,
    featureToggles: oldFeatureToggles,
  };
};

const onHideErrorModal = (state) => ({
  ...state,
  errorHandler: initialState.errorHandler,
});

const onShowErrorModal = (state, action) => ({
  ...state,
  errorHandler: {
    ...state.errorHandler,
    errorReported: action.payload,
    showAlert: false,
    showModal: true,
  },
});

const onResetLoadedData = (state) => ({
  ...state,
  loadedData: { transactions: 0, addresses: 0 },
});

const onUpdateLoadedData = (state, action) => ({
  ...state,
  loadedData: action.payload,
});

/**
 * Token metadata loaded
 */
const onTokenMetadataLoaded = (state, action) => ({
  ...state,
  metadataLoaded: action.payload,
});

/**
 * Update token metadata status to false, meaning it is loading.
 */
const onTokensFetchMetadataRequested = (state) => ({
  ...state,
  metadataLoaded: false,
});

/**
 * Update token metadata
 */
const onTokenMetadataUpdated = (state, action) => {
  const { data } = action.payload;
  const newMeta = { ...state.tokenMetadata, ...data };

  return {
    ...state,
    metadataLoaded: true,
    tokenMetadata: newMeta,
  };
};

/**
 * Remove token metadata
 */
const onTokenMetadataRemoved = (state, action) => {
  const uid = action.payload;

  const newMeta = { ...state.tokenMetadata };
  if (uid in newMeta) {
    delete newMeta[uid];
  }

  return {
    ...state,
    tokenMetadata: newMeta,
  };
};

export const partiallyUpdateHistoryAndBalance = (state, action) => {
  const { tokensHistory, tokensBalance } = action.payload;

  return {
    ...state,
    tokensHistory: {
      ...state.tokensHistory,
      ...tokensHistory,
    },
    tokensBalance: {
      ...state.tokensBalance,
      ...tokensBalance,
    },
  };
};

/**
 * @param {String} action.tokenId - The tokenId to mark as loading
 */
export const onTokenFetchBalanceRequested = (state, action) => {
  const { tokenId } = action;
  const oldState = get(state.tokensBalance, tokenId, {});

  return {
    ...state,
    tokensBalance: {
      ...state.tokensBalance,
      [tokenId]: {
        ...oldState,
        status: TOKEN_DOWNLOAD_STATUS.LOADING,
        oldStatus: oldState.status,
      },
    },
  };
};

/**
 * @param {String} action.tokenId - The tokenId to mark as success
 * @param {Object} action.data - The token balance information to store on redux
 */
export const onTokenFetchBalanceSuccess = (state, action) => {
  const { tokenId, data } = action;

  return {
    ...state,
    tokensBalance: {
      ...state.tokensBalance,
      [tokenId]: {
        status: TOKEN_DOWNLOAD_STATUS.READY,
        updatedAt: new Date().getTime(),
        data,
      },
    },
  };
};

/**
 * @param {String} action.tokenId - The tokenId to mark as failure
 */
export const onTokenFetchBalanceFailed = (state, action) => {
  const { tokenId } = action;

  return {
    ...state,
    tokensBalance: {
      ...state.tokensBalance,
      [tokenId]: {
        status: TOKEN_DOWNLOAD_STATUS.FAILED,
      },
    },
  };
};

/**
 * @param {Object} state - redux state
 * @param {Object} action - token's history
 * @param {String} action.tokenId - The tokenId to mark as success
 * @param {TxHistory} action.data - The token history information to store on redux
 */
export const onTokenFetchHistorySuccess = (state, action) => {
  const { tokenId, data } = action;

  return {
    ...state,
    tokensHistory: {
      ...state.tokensHistory,
      [tokenId]: {
        status: TOKEN_DOWNLOAD_STATUS.READY,
        updatedAt: new Date().getTime(),
        data,
      },
    },
  };
};

/**
 * @param {String} action.tokenId - The tokenId to mark as failed
 */
export const onTokenFetchHistoryFailed = (state, action) => {
  const { tokenId } = action;

  return {
    ...state,
    tokensHistory: {
      ...state.tokensHistory,
      [tokenId]: {
        status: TOKEN_DOWNLOAD_STATUS.FAILED,
      },
    },
  };
};

/**
 * @param {String} action.tokenId - The tokenId to fetch history
 */
export const onTokenFetchHistoryRequested = (state, action) => {
  const { tokenId } = action;

  const oldState = get(state.tokensHistory, tokenId, {});

  return {
    ...state,
    tokensHistory: {
      ...state.tokensHistory,
      [tokenId]: {
        ...oldState,
        status: TOKEN_DOWNLOAD_STATUS.LOADING,
        oldStatus: oldState.status,
      },
    },
  };
};

export const onStartWalletNotStarted = (state) => ({
  ...state,
  walletStartState: WALLET_STATUS.NOT_STARTED,
});

export const onStartWalletFailed = (state) => ({
  ...state,
  walletStartState: WALLET_STATUS.FAILED,
});

export const onStartWalletLock = (state) => ({
  ...state,
  walletStartState: WALLET_STATUS.NOT_STARTED,
});

/**
 * @param {String} action.words - The wallet's words
 * @param {String} action.pin - The wallet's pinCode
 */
export const onStartWalletRequested = (state, action) => ({
  ...state,
  walletStartState: WALLET_STATUS.LOADING,
});

export const onStartWalletSuccess = (state) => ({
  ...state,
  walletStartState: WALLET_STATUS.READY,
});

/**
 * @param {String} action.tokenId - The tokenId to invalidate
 */
export const onTokenInvalidateBalance = (state, action) => {
  const { tokenId } = action;

  return {
    ...state,
    tokensBalance: {
      ...state.tokensBalance,
      [tokenId]: {
        status: TOKEN_DOWNLOAD_STATUS.INVALIDATED,
      },
    },
  };
};

/**
 * @param {String} action.tokenId - The tokenId to invalidate
 */
export const onTokenInvalidateHistory = (state, action) => {
  const { tokenId } = action;

  return {
    ...state,
    tokensHistory: {
      ...state.tokensHistory,
      [tokenId]: {
        status: TOKEN_DOWNLOAD_STATUS.INVALIDATED,
      },
    },
  };
};

/**
 * @param {Number} action.data Best block height
 */
export const onWalletBestBlockUpdate = (state, action) => {
  const { data } = action;

  return {
    ...state,
    height: data,
  };
};

/**
 * @param {boolean} action.payload True if the app has permission to use the camera
 */
export const onSetCameraAvailable = (state, action) => ({
  ...state,
  isCameraAvailable: action.payload,
});

// Push notification

/**
 * @param {boolean} action - true if unleash enables the push notification feature
 */
export const onSetAvailablePushNotification = (state, action) => ({
  ...state,
  pushNotification: {
    ...state.pushNotification,
    available: action.payload,
  }
});

export const onPushAskOptInQuestion = (state) => ({
  ...state,
  pushNotification: {
    ...state.pushNotification,
    showOptInQuestion: true,
  }
});

export const onPushDismissOptInQuestion = (state) => ({
  ...state,
  pushNotification: {
    ...state.pushNotification,
    showOptInQuestion: false,
  }
});

export const onPushAskRegistrationRefreshQuestion = (state) => ({
  ...state,
  pushNotification: {
    ...state.pushNotification,
    showRegistrationRefreshQuestion: true,
  }
});

export const onPushDismissRegistrationRefreshQuestion = (state) => ({
  ...state,
  pushNotification: {
    ...state.pushNotification,
    showRegistrationRefreshQuestion: false,
  }
});

/**
 * @param {{ deviceId: string, settings: { enabled, showAmountEnabled }, enabledAt: number }} action
 */
export const onPushSetState = (state, action) => {
  const { deviceId, settings, enabledAt } = action.payload;
  return ({
    ...state,
    pushNotification: {
      ...state.pushNotification,
      ...settings,
      deviceId,
      enabledAt,
    },
  });
};

export const onPushUpdateDeviceId = (state, action) => {
  const { deviceId } = action.payload;
  return ({
    ...state,
    pushNotification: {
      ...state.pushNotification,
      deviceId,
    },
  });
};

export const onPushApiLoading = (state) => ({
  ...state,
  pushNotification: {
    ...state.pushNotification,
    apiStatus: PUSH_API_STATUS.LOADING,
  },
});

export const onPushApiReady = (state) => ({
  ...state,
  pushNotification: {
    ...state.pushNotification,
    apiStatus: PUSH_API_STATUS.READY,
  },
});

/**
 * @param {{enabled: boolean, showAmountEnabled: boolean, enabledAt: number }} action
 */
export const onPushRegisterSuccess = (state, action) => {
  const { enabled, showAmountEnabled, enabledAt } = action.data;
  return ({
    ...state,
    pushNotification: {
      ...state.pushNotification,
      apiStatus: PUSH_API_STATUS.READY,
      enabled,
      showAmountEnabled,
      enabledAt,
    },
  });
};

/**
 * @param {Object} state
 * @param {{payload: {enabled: boolean, showAmountEnabled: boolean}}} action
 */
export const onPushUpdateSuccess = (state, { payload: { enabled, showAmountEnabled } }) => ({
  ...state,
  pushNotification: {
    ...state.pushNotification,
    apiStatus: PUSH_API_STATUS.READY,
    enabled,
    showAmountEnabled,
  },
});

export const onPushApiFailed = (state) => ({
  ...state,
  pushNotification: {
    ...state.pushNotification,
    apiStatus: PUSH_API_STATUS.FAILED,
  },
});

/**
 * @param {Object} state
 * @param {{ payload: {
 *   isTxFound: boolean,
 *   txId: string,
 *   tx: {
 *     txId: string,
 *     timestamp: number,
 *     voided: boolean
 *   },
 *   tokens: {
 *     uid: string,
 *     name: string,
 *     symbol: string,
 *     balance: number,
 *     isRegistered: boolean
 *   }[],
 * }}} action
 */
export const onTxDetailsSuccess = (state, action) => {
  const txDetails = action.payload;
  return {
    ...state,
    pushNotification: {
      ...state.pushNotification,
      txDetails,
    },
  };
};

export const onPushCleanTxDetails = (state) => ({
  ...state,
  pushNotification: {
    ...state.pushNotification,
    txDetails: null,
  },
});

export const onPushReset = (state) => ({
  ...state,
  pushNotification: initialState.pushNotification,
});

/**
 * Updates deviceRegistered status to signal if the device is
 * registered on FCM.
 */
export const onPushDeviceRegistered = (state, action) => ({
  ...state,
  pushNotification: {
    ...state.pushNotification,
    deviceRegistered: action.payload
  },
});

/**
 * @param {Boolean} action.payload.error The captured Error object
 * @param {Boolean} action.payload.isFatal Indicates if the error is fatal
 */
export const onExceptionCaptured = (state, { payload }) => {
  const { error, isFatal } = payload;

  return {
    ...state,
    errorHandler: {
      ...state.errorHandler,
      error,
      isFatal,
      showAlert: true,
      showModal: false,
    },
  };
};

/**
 * On wallet reload, tokens data will be reloaded as well.
 */
export const onReloadWalletRequested = (state) => ({
  ...state,
  tokensHistory: initialState.tokensHistory,
  tokensBalance: initialState.tokensBalance,
  loadHistoryStatus: initialState.loadHistoryStatus,
});

const onWalletReloading = (state) => ({
  ...state,
  walletStartState: WALLET_STATUS.LOADING,
});

/**
 * @param {string} action.payload.lastSharedAddress The current address to use
 * @param {int} action.payload.lastSharedIndex The current address index to use
 */
const onSharedAddressUpdate = (state, action) => ({
  ...state,
  lastSharedAddress: action.payload.lastSharedAddress,
  lastSharedIndex: action.payload.lastSharedIndex,
});

/**
 * @param {WalletConnect} action.payload The wallet connect instance
 */
export const onSetWalletConnect = (state, { payload }) => ({
  ...state,
  walletConnect: {
    ...state.walletConnect,
    client: payload,
  }
});

/**
 * @param {Object} action.payload The wallet connect modal options
 */
export const onSetWalletConnectModal = (state, { payload }) => ({
  ...state,
  walletConnect: {
    ...state.walletConnect,
    modal: payload,
  },
});

/**
 * @param {Object} action.payload The wallet connect sessions to store
 */
export const onSetWalletConnectSessions = (state, { payload }) => ({
  ...state,
  walletConnect: {
    ...state.walletConnect,
    sessions: payload,
  },
});

export const onSetWCConnectionFailed = (state, { payload }) => ({
  ...state,
  walletConnect: {
    ...state.walletConnect,
    connectionFailed: payload,
  },
});

/**
 * @param {Object} action.payload The network settings emitted in saga
 * @see updateNetworkSettings
 */
export const onNetworkSettingsUpdateRequest = (state) => ({
  ...state,
  networkSettingsStatus: NETWORKSETTINGS_STATUS.LOADING,
});

/**
 * @param {Object} action.payload The network settings emitted in saga
 * @see networkSettingsUpdateState customNetwork
 */
export const onNetworkSettingsUpdateState = (state, { payload }) => ({
  ...state,
  networkSettings: payload,
});

/**
 * @param {Object} action.payload The network settings emitted in saga
 * @see networkSettingsPersistStore customNetwork
 */
export const onNetworkSettingsPersistStore = (state, { payload }) => ({
  ...state,
  networkSettings: payload,
  networkSettingsStatus: NETWORKSETTINGS_STATUS.LOADING,
});

/**
 * Set `WAITING` state on network settings status.
 */
export const onNetworkSettingsUpdateWaiting = (state) => ({
  ...state,
  networkSettingsStatus: NETWORKSETTINGS_STATUS.WAITING,
});

/**
 * Set `SUCCESSFUL` state on network settings status.
 */
export const onNetworkSettingsUpdateSuccess = (state) => ({
  ...state,
  networkSettingsStatus: NETWORKSETTINGS_STATUS.SUCCESSFUL,
});

/**
 * @param {Object} action.payload The errors from network settings input validation
 * @see updateNetworkSettings
 */
export const onNetworkSettingsUpdateReady = (state) => ({
  ...state,
  networkSettingsStatus: NETWORKSETTINGS_STATUS.READY,
});

/**
 * Set `FAILED` state on network settings status.
 */
export const onNetworkSettingsUpdateFailure = (state) => ({
  ...state,
  networkSettingsStatus: NETWORKSETTINGS_STATUS.FAILED
});

/**
 * @param {Object} action.payload The errors from network settings input validation
 * @see networkSettingsUpdateInvalid errors
 */
export const onNetworkSettingsUpdateInvalid = (state, { payload }) => ({
  ...state,
  networkSettingsInvalid: payload,
  networkSettingsStatus: NETWORKSETTINGS_STATUS.READY,
});

export const onNanoContractRegisterRequest = (state) => ({
  ...state,
  nanoContract: {
    ...state.nanoContract,
    registerStatus: NANOCONTRACT_REGISTER_STATUS.LOADING,
    registerFailureMessage: null,
  },
});

/**
 * @param {Object} state Redux store state
 * @param {Object} action
 * @param {Object} action.payload
 * @param {string} action.payload.error Error message on failure
 */
export const onNanoContractRegisterFailure = (state, { payload: { error } }) => ({
  ...state,
  nanoContract: {
    ...state.nanoContract,
    registerStatus: NANOCONTRACT_REGISTER_STATUS.FAILED,
    registerFailureMessage: error,
  },
});

/**
 * @param {Object} state
 * @param {{
 *   payload: {
 *     entryKey: string;
 *     entryValue: {
 *       address: string;
 *       ncId: string;
 *       blueprintName: string;
 *     };
 *     hasFeedback?: boolean;
 *   }
  * }} action
 */
export const onNanoContractRegisterSuccess = (state, { payload }) => ({
  ...state,
  nanoContract: {
    ...state.nanoContract,
    registerStatus: payload.hasFeedback
      ? NANOCONTRACT_REGISTER_STATUS.SUCCESSFUL
      : NANOCONTRACT_REGISTER_STATUS.READY,
    registered: {
      ...state.nanoContract.registered,
      [payload.entryKey]: payload.entryValue,
    },
    history: {
      ...state.nanoContract.history,
      [payload.entryKey]: [],
    },
    historyMeta: {
      ...state.nanoContract.historyMeta,
      [payload.entryKey]: {
        isLoading: false,
        error: null,
        after: null,
      },
    },
  },
});

export const onNanoContractRegisterReady = (state) => ({
  ...state,
  nanoContract: {
    ...state.nanoContract,
    registerStatus: NANOCONTRACT_REGISTER_STATUS.READY,
    registerFailureMessage: null,
  },
});

/**
 * @param {Object} state
 * @param {{
 *   payload: {
 *     ncId: string,
 *   }
  * }} action
 */
export const onNanoContractUnregisterSuccess = (state, { payload }) => {
  const { ncId } = payload;

  const newRegisteredContracts = { ...state.nanoContract.registered };
  delete newRegisteredContracts[ncId];

  const newContractsHistory = { ...state.nanoContract.history };
  delete newContractsHistory[ncId];

  const newContractsHistoryMeta = { ...state.nanoContract.historyMeta };
  delete newContractsHistoryMeta[ncId];

  return ({
    ...state,
    nanoContract: {
      ...state.nanoContract,
      registered: newRegisteredContracts,
      history: newContractsHistory,
      historyMeta: newContractsHistoryMeta,
    },
  });
};

/**
 * @param {Object} state
 * @param {{
 *   payload: {
 *     ncId: string;
 *   }
 * }} action
 */
export const onNanoContractHistoryLoading = (state, { payload }) => ({
  ...state,
  nanoContract: {
    ...state.nanoContract,
    historyMeta: {
      ...state.nanoContract.historyMeta,
      [payload.ncId]: {
        ...(state.nanoContract.historyMeta[payload.ncId]),
        isLoading: true,
        error: null,
      },
    },
  },
});

/**
 * @param {Object} state
 * @param {{
 *   payload: {
 *     ncId: string;
 *     error: string;
 *   }
 * }} action
 */
export const onNanoContractHistoryFailure = (state, { payload }) => ({
  ...state,
  nanoContract: {
    ...state.nanoContract,
    historyMeta: {
      ...state.nanoContract.historyMeta,
      [payload.ncId]: {
        ...(state.nanoContract.historyMeta[payload.ncId]),
        isLoading: false,
        error: payload.error,
      },
    },
  },
});

/**
 * @param {Object} state
 * @param {{
 *   payload: {
 *     ncId: string;
 *   }
 * }} action
 */
export const onNanoContractHistoryClean = (state, { payload }) => ({
  ...state,
  nanoContract: {
    ...state.nanoContract,
    history: {
      ...state.nanoContract.history,
      [payload.ncId]: [],
    },
    historyMeta: {
      ...state.nanoContract.historyMeta,
      [payload.ncId]: {
        ...(state.nanoContract.historyMeta[payload.ncId]),
        isLoading: false,
        after: null,
        error: null,
      },
    },
  },
});

/**
 * @param {Object} state
 * @param {{
 *   payload: {
 *     ncId: string;
 *     history: Object[];
 *     after: string;
 *   }
 * }} action
 */
export const onNanoContractHistorySuccess = (state, { payload }) => ({
  ...state,
  nanoContract: {
    ...state.nanoContract,
    history: {
      ...state.nanoContract.history,
      [payload.ncId]: [
        ...(state.nanoContract.history[payload.ncId] || []),
        // we are putting at the bottom because we expect an array with descending order.
        ...payload.history,
      ],
    },
    historyMeta: {
      ...state.nanoContract.historyMeta,
      [payload.ncId]: {
        ...(state.nanoContract.historyMeta[payload.ncId]),
        isLoading: false,
        after: payload.after,
        error: null,
      },
    },
  },
});

/**
 * @param {Object} state
 * @param {{
 *   payload: {
 *     ncId: string;
 *     newAddress: string;
 *   }
 * }} action
 */
export const onNanoContractAddressChangeRequest = (state, { payload }) => {
  const newRegisteredNc = {
    ...state.nanoContract.registered[payload.ncId],
    address: payload.newAddress,
  };
  return {
    ...state,
    nanoContract: {
      ...state.nanoContract,
      registered: {
        ...state.nanoContract.registered,
        [payload.ncId]: newRegisteredNc,
      },
    },
  };
};

/**
 * @param {Object} state
 */
export const onSelectAddressAddressesRequest = (state) => ({
  ...state,
  selectAddressModal: initialState.selectAddressModal,
});

/**
 * @param {Object} state
 * @param {{
 *   payload: {
 *     error: string;
 *   }
 * }} action
 */
export const onSelectAddressAddressesFailure = (state, { payload }) => ({
  ...state,
  selectAddressModal: {
    addresses: [],
    error: payload.error,
  },
});

/**
 * @param {Object} state
 * @param {{
 *   payload: {
 *     addresses: string[];
 *   }
 * }} action
 */
export const onSelectAddressAddressesSuccess = (state, { payload }) => ({
  ...state,
  selectAddressModal: {
    addresses: payload.addresses,
    error: null,
  },
});

/**
 * @param {Object} state
 */
export const onFirstAddressRequest = (state) => ({
  ...state,
  firstAddress: initialState.firstAddress,
});

/**
 * @param {Object} state
 * @param {{
 *   payload: {
 *     error: string;
 *   }
 * }} action
 */
export const onFirstAddressFailure = (state, { payload }) => ({
  ...state,
  firstAddress: {
    address: null,
    error: payload.error,
  },
});

/**
 * @param {Object} state
 * @param {{
 *   payload: {
 *     address: string;
 *   }
 * }} action
 */
export const onFirstAddressSuccess = (state, { payload }) => ({
  ...state,
  firstAddress: {
    address: payload.address,
    error: null,
  },
});

/**
 * @param {Object} state
 * @param {{
 *   payload: {
 *     showModal: boolean;
 *     data: {
 *       nc: {
 *         network: string;
 *         ncId: string;
 *         blueprintId: string;
 *         method: string;
 *         caller: string;
 *         actions: {
 *           type: string;
 *           token: string;
 *           amount: number;
 *           address?: string;
 *         }[];
 *         args: string[];
 *       };
 *       dapp: {
 *         icon: string;
 *         proposer: string;
 *         url: string;
 *         description: string;
 *       };
 *     };
 *   };
 * }} action
 */
export const onSetNewNanoContractTransaction = (state, { payload }) => ({
  ...state,
  walletConnect: {
    ...state.walletConnect,
    newNanoContractTransaction: {
      ...payload,
      status: WALLETCONNECT_NEW_NANOCONTRACT_TX_STATUS.READY,
    },
  },
});

export const onSetNewNanoContractTransactionStatus = (state, { payload }) => ({
  ...state,
  walletConnect: {
    ...state.walletConnect,
    newNanoContractTransaction: {
      ...state.walletConnect.newNanoContractTransaction,
      status: payload,
    },
  },
});
