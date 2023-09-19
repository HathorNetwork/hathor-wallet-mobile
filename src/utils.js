/**
 * Copyright (c) Hathor Labs and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import hathorLib from '@hathor/wallet-lib';
import * as Keychain from 'react-native-keychain';
import React from 'react';
import { t } from 'ttag';
import { Linking, Platform, Text } from 'react-native';
import { getStatusBarHeight } from 'react-native-status-bar-height';
import baseStyle from './styles/init';
import { PRIMARY_COLOR, HEADER_HEIGHT, KEYCHAIN_USER, networkObj } from './constants';
import { STORE } from './store';
import { TxHistory } from './models';

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
 * Get amount text value and transform in its integer value
 *
 * "10" => 1000
 * "10.00" => 1000
 * "10,01" => 1001
 * "1000" => 100000
 * "1000.00" => 100000
 */
export const getIntegerAmount = (value) => {
  const parsedValue = parseFloat(value.replace(',', '.'));
  return Math.round(parsedValue * (10 ** hathorLib.constants.DECIMAL_PLACES));
};

export const getAmountParsed = (text) => {
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
    if (parts[1].length > hathorLib.constants.DECIMAL_PLACES) {
      return `${parts[0]}${separator}${parts[1].slice(0, 2)}`;
    }
  }

  return parts.join(separator);
};

export const getTokenLabel = (token) => `${token.name} (${token.symbol})`;

export const setSupportedBiometry = (type) => {
  STORE.setItem('mobile:supportedBiometry', type);
};

export const getSupportedBiometry = () => STORE.getItem('mobile:supportedBiometry');

export const setBiometryEnabled = (value) => {
  STORE.setItem('mobile:isBiometryEnabled', value);
};

export const isBiometryEnabled = () => STORE.getItem('mobile:isBiometryEnabled') || false;

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
   *
   * @return {Object} boolean indicating if address is valid and possibly an error message
   */
export const validateAddress = (address) => {
  try {
    const addressObj = new hathorLib.Address(address, { network: networkObj });
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
    ? statusBarHeight + HEADER_HEIGHT
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
  return `${PRIMARY_COLOR}${hex}`;
};

/**
 * Render value to integer or decimal
 *
 * @params {number} amount Amount to render
 * @params {boolean} isInteger If it's an integer or decimal
 *
 * @return {string} rendered value
 */
export const renderValue = (amount, isInteger) => {
  if (isInteger) {
    return hathorLib.numberUtils.prettyIntegerValue(amount);
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
 * @return {boolean} Wether the change password was successful
 */
export const changePin = async (wallet, oldPin, newPin) => {
  const isPinValid = await wallet.checkPinAndPassword(oldPin, oldPin);
  if (!isPinValid) {
    return false;
  }

  try {
    // All of these are checked above so it should not fail
    await wallet.storage.changePin(oldPin, newPin);
    // Will throw if the access data does not have the seed.
    await wallet.storage.changePassword(oldPin, newPin);
  } catch (err) {
    return false;
  }

  setKeychainPin(newPin);
  return true;
};

/**
 * Map history element to expected TxHistory model object
 *
 * element {Object} Tx history element with {txId, timestamp, balance, voided?}
 * token {string} Token uid
 */
export const mapTokenHistory = (element, token) => {
  const data = {
    txId: element.txId,
    timestamp: element.timestamp,
    balance: element.balance,
    // in wallet service this comes as 0/1 and in the full node comes with true/false
    isVoided: Boolean(element.voided),
    tokenUid: token
  };
  return new TxHistory(data);
};

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
