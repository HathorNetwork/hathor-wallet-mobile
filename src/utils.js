/**
 * Copyright (c) Hathor Labs and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import hathorLib from '@hathor/wallet-lib';
import { bigIntCoercibleSchema } from '@hathor/wallet-lib/lib/utils/bigint';
import CryptoJS from 'crypto-js';
import * as Keychain from 'react-native-keychain';
import React from 'react';
import { isEmpty, get } from 'lodash';
import { t } from 'ttag';
import { Linking, Platform, Text } from 'react-native';
import { getStatusBarHeight } from 'react-native-status-bar-height';
import moment from 'moment';
import baseStyle from './styles/init';
import { KEYCHAIN_USER, NETWORK_MAINNET, NANO_CONTRACT_FEATURE_TOGGLE, SAFE_BIOMETRY_MODE_FEATURE_TOGGLE } from './constants';
import { STORE, IS_BIOMETRY_ENABLED_KEY, IS_OLD_BIOMETRY_ENABLED_KEY, SUPPORTED_BIOMETRY_KEY, SAFE_BIOMETRY_FEATURE_FLAG_KEY, FEATURE_TOGGLES_LAST_KNOWN_VALUES_KEY } from './store';
import { TxHistory } from './models';
import { COLORS, STYLE } from './styles/themes';
import { logger } from './logger';

const log = logger('utils');

export const Strong = (props) => <Text style={[{ fontWeight: 'bold' }, props.style]}>{props.children}</Text>;

export const Italic = (props) => <Text style={[{ fontStyle: 'italic' }, props.style]}>{props.children}</Text>;

export const Link = (props) => (
  <Text style={baseStyle.link} onPress={() => Linking.openURL(props.href)}>
    {props.children}
  </Text>
);

export const getShortHash = (hash, length = 4) => (
  `${hash.substring(0, length)}...${hash.substring(64 - length, 64)}`
);

/**
 * It short any string content without length bound.
 * @param {string} content Content to be sliced in two parts
 * @param {string} length Size of the substrigs in both sides of `...`
 *
 * @example
 * getShortContent('00c30fc8a1b9a326a766ab0351faf3635297d316fd039a0eda01734d9de40185', 3)
 * // output: '00c...185'
 */
export const getShortContent = (content, length = 4) => (
  `${content.substring(0, length)}...${content.substring(content.length - length, content.length)}`
);

/**
 * Get amount text value and transform it into its integer value as BigInt
 *
 * "10" => 1000n
 * "10.00" => 1000n
 * "10,01" => 1001n
 * "1000" => 100000n
 * "1000.00" => 100000n
 *
 * @param {string} value - The amount as a string
 * @param {number} decimalPlaces - Number of decimal places
 * @return {BigInt} The integer value as a BigInt
 * @throws {Error} When the input value cannot be parsed to a BigInt
 */
export const getIntegerAmount = (value, decimalPlaces) => {
  let finalDecimalPlaces = decimalPlaces;
  if (decimalPlaces == null) { // matches null and undefined
    console.warn('Decimal places is null in getIntegerAmount! Please check if there is something wrong in serverInfo. Defaulting to 2.');
    finalDecimalPlaces = 2;
  }

  // Remove any whitespace and standardize decimal separator
  const cleanValue = value.trim().replace(',', '.');

  // Split into integer and decimal parts
  const [integerPart, decimalPart = ''] = cleanValue.split('.');

  // Pad decimal part with zeros if needed
  const paddedDecimal = (decimalPart + '0'.repeat(finalDecimalPlaces)).slice(0, finalDecimalPlaces);

  // Combine string parts without decimal point
  const fullNumberStr = integerPart + paddedDecimal;

  // Convert to BigInt
  return bigIntCoercibleSchema.parse(fullNumberStr);
};

export const getAmountParsed = (text, decimalPlaces) => {
  let finalDecimalPlaces = decimalPlaces;
  if (decimalPlaces == null) { // matches null and undefined
    console.warn('Decimal places is null in getAmountParsed! Please check if there is something wrong in serverInfo. Defaulting to 2.');
    finalDecimalPlaces = 2;
  }

  let parts = [];
  let separator = '';
  if (text.indexOf('.') > -1) {
    parts = text.split('.');
    separator = '.';
  } else if (text.indexOf(',') > -1) {
    parts = text.split(',');
    separator = ',';
  } else {
    parts = [text];
  }

  // In case the user typed more than one separator
  parts = parts.slice(0, 2);

  if (parts[1]) {
    if (parts[1].length > decimalPlaces) {
      return `${parts[0]}${separator}${parts[1].slice(0, finalDecimalPlaces)}`;
    }
  }

  return parts.join(separator);
};

export const getTokenLabel = (token) => `${token.name} (${token.symbol})`;

/**
 * Migrate the biometry configuration state if needed.
 *
 * @param {string} currentPassword - The password returned from the system keychain.
 * @return {Promise<string>} The actual pin/password for the application.
 */
export async function biometricsMigration(currentPassword) {
  const storeSafeBiometryFeature = !!STORE.getItem(SAFE_BIOMETRY_FEATURE_FLAG_KEY);
  const unleashToggles = STORE.getItem(FEATURE_TOGGLES_LAST_KNOWN_VALUES_KEY) ?? {};
  const unleashSafeBiometryFeature = !!unleashToggles[SAFE_BIOMETRY_MODE_FEATURE_TOGGLE];

  if (storeSafeBiometryFeature === unleashSafeBiometryFeature) {
    // No migration is required since the store and unleash flags are the same
    return currentPassword;
  }

  STORE.setItem(SAFE_BIOMETRY_FEATURE_FLAG_KEY, unleashSafeBiometryFeature);
  // The safe biometry feature flag has changed, we need to check if a migration is required.

  if (unleashSafeBiometryFeature) {
    // Unleash flag is enabling safe biometry
    // if we have the old mode active a migration is required.
    // else we can ignore migration since the user is not using biometry.
    const oldBiometryActive = STORE.getItem(IS_OLD_BIOMETRY_ENABLED_KEY);
    if (oldBiometryActive) {
      // currentPassword is the pin, we need to generate a new random password
      // and encrypt the pin.
      const password = generateRandomPassword();
      const storage = STORE.getStorage();
      await changePinOnAccessData(storage, currentPassword, password);
      STORE.enableSafeBiometry(currentPassword, password);
      STORE.removeItem(IS_OLD_BIOMETRY_ENABLED_KEY);

      return password;
    }
  } else {
    // Unleash flag is disabling safe biometry
    // if we have safe mode active a migration is required.
    // else we can ignore migration since the use is not using biometry.
    const safeBiometryActive = STORE.getItem(IS_BIOMETRY_ENABLED_KEY);
    // eslint-disable-next-line no-lonely-if
    if (safeBiometryActive) {
      // currentPassword is the random password, we need to decrypt the pin and
      // toggle the old biometry key
      const pin = STORE.disableSafeBiometry(currentPassword);
      const storage = STORE.getStorage();
      await changePinOnAccessData(storage, currentPassword, pin);
      STORE.removeItem(IS_BIOMETRY_ENABLED_KEY);
      STORE.setItem(IS_OLD_BIOMETRY_ENABLED_KEY, true);

      return pin;
    }
  }

  return currentPassword;
}

/**
 * Generate a 32 byte random password encoded in hex
 * @returns {string}
 */
export function generateRandomPassword() {
  const seed = CryptoJS.lib.WordArray.random(32).toString();
  return CryptoJS.PBKDF2(seed, seed, { iterations: 10000 }).toString();
}

export const setSupportedBiometry = (type) => {
  STORE.setItem(SUPPORTED_BIOMETRY_KEY, type);
};

export const getSupportedBiometry = () => STORE.getItem(SUPPORTED_BIOMETRY_KEY);

/**
 * Old biometry mode does not require aditional data to be activated
 * @deprecated
 *
 * @param {bool} value
 */
export const setBiometryEnabled = (value) => {
  STORE.setItem(IS_OLD_BIOMETRY_ENABLED_KEY, value);
};

export const isBiometryEnabled = () => {
  const oldBiometry = STORE.getItem(IS_OLD_BIOMETRY_ENABLED_KEY);
  const safeBiometry = STORE.getItem(IS_BIOMETRY_ENABLED_KEY);
  return oldBiometry || safeBiometry || false;
}

/**
 * Convert a string into a JSX. It receives a text and a map of functions. The text
 * must be marked with |x| blocks. Each block will be used to call one of the functions.
 *
 * The content of the blocks must be in the following format: `|key:content|`. The key
 * will be used select which function will be called.
 *
 * The functions will receive two parameters: `content` and `i`. The `i` is a unique value and
 * must be used for prop `key` to avoid warnings.
 *
 * For example: `str2jsx('This is |f1:an example| with |f2:two calls|.', {f1: fn1, f2: fn2})`
 * The return will be `['This is ', fn1('an example', 1), ' with ', fn2(two calls, 3), '.']`.
 *
 * It is useful for i18n to convert texts that will be translated into jsx elements.
 */
export const str2jsx = (text, fnMap) => {
  const parts = text.split('|');
  if (parts.length % 2 === 0) {
    throw new Error(`invalid string: ${text}`);
  }
  const ret = [];
  for (let i = 0; i < parts.length; i += 1) {
    if (i % 2 === 0) {
      ret.push(parts[i]);
    } else {
      const part = parts[i];
      const index = part.indexOf(':');
      let result;
      if (index >= 0) {
        const key = part.substring(0, index);
        const content = part.substring(index + 1);
        const fn = fnMap[key];
        result = fn(content, i);
      } else {
        result = part;
      }
      ret.push(result);
    }
  }
  return ret;
};

/**
   * Validates an address
   *
   * @param {string} address Address in base58
   * @param {Object} network Instance of Network object from the wallet-lib
   *
   * @return {Object} boolean indicating if address is valid and possibly an error message
   */
export const validateAddress = (address, network) => {
  try {
    const addressObj = new hathorLib.Address(address, { network });
    addressObj.validateAddress();
    return { isValid: true };
  } catch (e) {
    if (e instanceof TypeError) {
      return { isValid: false, message: e.message };
    }
    return { isValid: false, message: t`Invalid address` };
  }
};

/**
   * Parse the QR code for a payment request (or just an address)
   *
   * @param {string} data The QR code data
   *
   * @return {Object} {isValid, error} or {isValid, address, amount, token}
   */
export const parseQRCode = (data) => {
  let qrcode;
  let hathorAddress;
  try {
    qrcode = JSON.parse(data);
    // make sure hathorAddress is not null or undefined
    hathorAddress = qrcode.address || '';
  } catch (error) {
    // if it's not json, maybe it's just the address from wallet ("hathor:{address}")
    hathorAddress = data;
  }

  const { isValid, error, address } = extractAddress(hathorAddress);
  if (!isValid) {
    return { isValid, error };
  }

  if (!qrcode) {
    // just the address (no token or amount)
    return {
      isValid: true,
      address,
    };
  }
  // complete qr code
  const { token, amount } = qrcode;
  if (token && !amount) {
    return {
      isValid: false,
      error: 'Payment request must have an amount',
    };
  } if (amount && !token) {
    return {
      isValid: false,
      error: 'Payment request must contain token data',
    };
  }
  return {
    isValid: true,
    address,
    token,
    amount,
  };
};

/**
 * Extract a wallet address from a plain text string.
 *
 * @example
 * 'hathor:<address>' -> { isValid: true, address }
 *
 * @example
 * '<address>' -> { isValid: true, address }
 *
 * @param {string} plainText containing wallet address.
 *
 * @return {{ isValid: boolean, error?: string, address?: string }}
 * represent the extracted address be it valid or invalid.
 */
function extractAddress(plainText) {
  const HATHOR_PREFIX = 'hathor';
  const failedResult = {
    isValid: false,
    error: 'This QR code does not contain a Hathor address or payment request.',
  };
  const sucessResult = {
    isValid: true,
  };

  const segments = plainText.split(':');
  const { 0: firstSegment, 1: secondSegment, length: sizeOfSegments } = segments;

  if (sizeOfSegments > 2) {
    return { ...failedResult };
  }

  if (sizeOfSegments === 2 && firstSegment !== HATHOR_PREFIX) {
    return { ...failedResult };
  }

  if (secondSegment) return { ...sucessResult, address: secondSegment };
  return { ...sucessResult, address: firstSegment };
}

/**
 * Get the distance to be set on the topDistance when using a KeyboardAvoidingView
 * This does not work for all screens, it depends on how your component is created
 *
 * @return {number} The top distance
 */
export const getKeyboardAvoidingViewTopDistance = () => {
  const statusBarHeight = getStatusBarHeight();
  const calculatedHeight = (Platform.OS === 'ios')
    ? statusBarHeight + STYLE.headerHeight
    : statusBarHeight;

  return calculatedHeight;
};

/**
 * Light primary color used as background in some cases (varies depending on the opacity)
 *
 * We use the format #rrggbbaa
 */
export const getLightBackground = (alpha) => {
  const hex = `0${Math.round(255 * alpha).toString(16).toUpperCase()}`.substr(-2);
  return `${COLORS.primary}${hex}`;
};

/**
 * Render value in a formatted way for display
 *
 * @param {bigint} amount The token amount as BigInt
 * @param {boolean} isInteger Whether the token is an NFT or regular token
 * @return {string} Formatted value for display
 */
export const renderValue = (amount, isInteger) => {
  if (isInteger) {
    return hathorLib.numberUtils.prettyValue(amount, 0);
  }

  return hathorLib.numberUtils.prettyValue(amount);
};

/**
 * Render value to integer or decimal
 *
 * @params {string} uid Token uid
 * @params {Object} metadatas Object with tokens metadata
 *
 * @return {boolean} If token is marked as NFT in metadata
 */
export const isTokenNFT = (uid, metadatas) => (
  uid in metadatas && metadatas[uid].nft
);

/**
 * Set the pin on the keychain so the user can use biometry
 * @params {string} pin
 */
export const setKeychainPin = (pin) => {
  Keychain.setGenericPassword(KEYCHAIN_USER, pin, {
    accessControl: Keychain.ACCESS_CONTROL.BIOMETRY_ANY,
    acessible: Keychain.ACCESSIBLE.WHEN_UNLOCKED_THIS_DEVICE_ONLY
  });
};

/**
 * @param {HathorWallet} wallet
 * @param {string} oldPin
 * @param {string} newPin
 *
 * @return {Promise<boolean>} Wether the change password was successful
 */
export const changePin = async (wallet, oldPin, newPin) => (
  changePinOnAccessData(wallet.storage, oldPin, newPin)
);

/**
 * @param {hathorLib.Storage} storage
 * @param {string} oldPin
 * @param {string} newPin
 *
 * @return {Promise<boolean>} Wether the change password was successful
 */
export async function changePinOnAccessData(storage, oldPin, newPin) {
  // Run checkPin and checkPassword
  // pinValid will be true if both return true, false otherwise.
  const pinValid = (await Promise.all([
    storage.checkPin(oldPin),
    storage.checkPassword(oldPin),
  ])).every((x) => x);

  if (!pinValid) {
    return false;
  }

  try {
    // All of these are checked above so it should not fail
    await storage.changePin(oldPin, newPin);
    // Will throw if the access data does not have the seed.
    await storage.changePassword(oldPin, newPin);
  } catch (err) {
    return false;
  }

  setKeychainPin(newPin);
  return true;
}

/**
 * Curry function that maps a raw history element to an expected TxHistory model object.
 *
 * @param {string} tokenUid - Token uid
 *
 * @returns {(rawTxHistory: Object) => TxHistory} A function that maps a raw
 * transaction history element to a TxHistory object
 */
export const mapToTxHistory = (tokenUid) => (rawTxHistory) => (
  TxHistory.from(rawTxHistory, tokenUid)
);

/**
 * Select the push notification settings from redux state
 * @param {{
 *  enabled: boolean,
 *  showAmountEnabled: boolean
 * }} pushNotification pushNotification object from redux
 * @returns the push notification settings object
 */
export const getPushNotificationSettings = (pushNotification) => {
  const { enabled, showAmountEnabled } = pushNotification;
  return {
    enabled,
    showAmountEnabled
  };
};

/**
 * Creates a new URL by combining the specified URLs
 *
 * @param {string} baseURL The base URL
 * @param {string} relativeURL The relative URL
 * @returns {string} The combined URL
 */
export function combineURLs(baseURL, relativeURL) {
  return relativeURL
    ? `${baseURL.replace(/\/+$/, '')}/${relativeURL.replace(/^\/+/, '')}`
    : baseURL;
}

/**
 * Determine if Push Notification feature can be shown to users.
 *
 * @param {Object} redux state
 *
 * @returns {Boolean} true if available, false otherwise.
 */
export const isPushNotificationAvailableForUser = (state) => (
  state.pushNotification.available
  // On iOS a simulator can't register a device token on APNS
  && state.pushNotification.deviceRegistered
  // TODO: We should drop this condition when we add support other networks
  // XXX: We don't have support in this app to generate device tokens
  // to the FCM testnet app. Currently we embbed only the mainnet
  // configuration file during the build.
  && state.networkSettings.network === NETWORK_MAINNET
  // If Wallet Service URLs are empty it makes impossible to use the
  // Wallet Service API to register the device's token.
  && !isEmpty(state.networkSettings.walletServiceUrl)
);

/**
 * Verifies if all critical built-in object prototypes are frozen, indicating a secure
 * ECMAScript (SES) environment. This check ensures that the execution context remains
 * immutable by preventing modifications to built-in prototypes, a common target for
 * tampering in JavaScript environments.
 *
 * By freezing prototypes, SES aims to prevent malicious or accidental interference
 * that could compromise application integrity or lead to security vulnerabilities.
 *
 * @returns {boolean} Returns true if all specified built-in prototypes are frozen
 * indicating a secure and immutable execution environment. Returns false if any
 * prototype is not frozen, suggesting potential security risks.
 */
export const verifySesEnabled = () => {
  const prototypes = [
    Array.prototype,
    ArrayBuffer.prototype,
    Boolean.prototype,
    Date.prototype,
    Error.prototype,
    Function.prototype,
    Map.prototype,
    Number.prototype,
    Object.prototype,
    RegExp.prototype,
    Set.prototype,
    String.prototype,
    Symbol.prototype,
    WeakMap.prototype,
    WeakSet.prototype,
    Float32Array.prototype,
    Float64Array.prototype,
    Int8Array.prototype,
    Int16Array.prototype,
    Int32Array.prototype,
    Uint8Array.prototype,
    Uint8ClampedArray.prototype,
    Uint16Array.prototype,
    Uint32Array.prototype,
  ];

  // Early exit in the best case scenario
  const arePrototypesFrozen = prototypes.every(Object.isFrozen);
  if (arePrototypesFrozen) {
    return true;
  }

  // If the result is not positive, open the possibility for debugging
  if (__DEV__) {
    const nonFrozenPrototypes = [];
    prototypes.forEach((prototype) => {
      if (!Object.isFrozen(prototype)) {
        nonFrozenPrototypes.push(prototype.constructor.name);
      }
    });
    console.log(`The following prototypes are not frozen:`, nonFrozenPrototypes);
  }
  return false;
};

/*
 * Get Nano Contract feature toggle state from redux.
 *
 * @param {Object} state Redux store state
 *
 * @returns {boolean} the Nano Contract feature toggle state.
 */
export const getNanoContractFeatureToggle = (state) => (
  state.featureToggles[NANO_CONTRACT_FEATURE_TOGGLE]
);

/*
 * Checks if nano contracts should be enabled
 *
 * Nano contracts should only be enabled if both the feature flag
 * and the server info flag are enabled
 *
 * @param {Object} state Redux store state
 *
 * @returns {boolean} Whether Nano Contracts should be enabled
 */
export const isNanoContractsEnabled = (state) => (
  getNanoContractFeatureToggle(state)
  && get(state.serverInfo, 'nano_contracts_enabled', false)
);

/**
 * Get timestamp in specific format.
 *
 * @param {number} timestamp
 *
 * @returns {string} formatted timestamp
 */
export const getTimestampFormat = (timestamp) => moment.unix(timestamp).format(t`DD MMM YYYY [•] HH:mm`)

/**
 * Extract all the items of an async iterator/generator.
 *
 * @returns {Promise<unknown[]>} A promise of an array of unkown object.
 * @async
 */
export const consumeAsyncIterator = async (asyncIterator) => {
  const list = [];
  for (; ;) {
    /* eslint-disable no-await-in-loop */
    const objYielded = await asyncIterator.next();
    const { value, done } = objYielded;

    if (done) {
      break;
    }

    list.push(value);
  }
  return [...list];
};

/**
 * Return all addresses of the wallet with info of each of them.
 *
 * @param {Object} wallet
 *
 * @returns {Promise<{
 *   address: string;
 *   index: number;
 *   transactions: number;
 * }[]>} a list of addres info.
 *
 * @throws {Error} either wallet not ready or other http request error if using wallet service.
 * @async
 */
export const getAllAddresses = async (wallet) => {
  const iterator = await wallet.getAllAddresses();
  return consumeAsyncIterator(iterator);
}

/**
 * Return the first wallet's address.
 *
 * @param {Object} wallet
 *
 * @returns {Promise<string>}
 * @throws {Error} either wallet not ready or other http request error if using wallet service.
 * @async
 */
export const getFirstAddress = async (wallet) => wallet.getAddressAtIndex(0);

/**
 * Verifies if the invalidModel of the form has an error message.
 */
export function hasError(invalidModel) {
  return Object
    .values({ ...invalidModel })
    .reduce((_hasError, currValue) => _hasError || !isEmpty(currValue), false);
}

/**
 * Parses a script data to return an instance of script type.
 *
 * @example
 * parseScriptData('P2PKH or P2SH script', networkObj);
 * >>> { address, timelock }
 *
 * @example
 * parseScriptData('Data script', networkObj);
 * >>> { data }
 *
 * @param {string} scriptData A script in its hexadecimal format
 * @param {Object} network A network object
 *
 * @return {P2PKH | P2SH | ScriptData | null} Parsed script object
 */
export const parseScriptData = (scriptData, network) => {
  try {
    const script = hathorLib.bufferUtils.hexToBuffer(scriptData);
    return hathorLib.scriptsUtils.parseScript(script, network);
  } catch (error) {
    log.error('Error parsing script data.', error);
    // Avoid throwing exception when we can't parse the script no matter the reason
    return null;
  }
}

/**
 * Split a list in a list of groups defined by group size.
 *
 * @param {[]} list An array object.
 * @param {number} groupSize The size of a group, which determines the final number of groups.
 *
 * @returns {[][]} Returns an array of grouped itens in array.
 *
 * @example
 * splitInGroups(['a','b'], 1);
 * // outputs: [['a'], ['b']]
 */
export function splitInGroups(list, groupSize) {
  if (groupSize === 0) {
    return list;
  }

  const groups = [];
  for (let i = 0; i < list.length; i += groupSize) {
    groups.push(list.slice(i, i + groupSize));
  }
  return groups;
}
