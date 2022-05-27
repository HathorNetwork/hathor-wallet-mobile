/**
 * Copyright (c) Hathor Labs and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import hathorLib from '@hathor/wallet-lib';
import * as Keychain from 'react-native-keychain';
import CryptoJS from 'crypto-js';
import React from 'react';
import { t } from 'ttag';
import { Linking, Platform, Text } from 'react-native';
import { getStatusBarHeight } from 'react-native-status-bar-height';
import baseStyle from './styles/init';
import { PRIMARY_COLOR, KEYCHAIN_USER } from './constants';

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
  hathorLib.storage.setItem('mobile:supportedBiometry', type);
};

export const getSupportedBiometry = () => hathorLib.storage.getItem('mobile:supportedBiometry');

export const setBiometryEnabled = (value) => {
  hathorLib.storage.setItem('mobile:isBiometryEnabled', value);
};

export const isBiometryEnabled = () => hathorLib.storage.getItem('mobile:isBiometryEnabled') || false;

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
    const addressBytes = hathorLib.transaction.decodeAddress(address);
    hathorLib.transaction.validateAddress(address, addressBytes);
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
  const addressParts = hathorAddress.split(':');
  if (addressParts[0] !== 'hathor' || addressParts.length !== 2) {
    return {
      isValid: false,
      error: 'This QR code does not contain a Hathor address or payment request.',
    };
  } if (!qrcode) {
    // just the address (no token or amount)
    const address = addressParts[1];
    return {
      isValid: true,
      address,
    };
  }
  // complete qr code
  const address = addressParts[1];
  const { token } = qrcode;
  const { amount } = qrcode;
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
 * Get the distance to be set on the topDistance when using a KeyboardAvoidingView
 * This does not work for all screens, it depends on how your component is created
 *
 * @return {number} The top distance
 */
export const getKeyboardAvoidingViewTopDistance = () => {
  if (Platform.OS === 'android') {
    return getStatusBarHeight();
  }
  return 0;
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
 * Get the words saved in storage from the user PIN
 *
 * @params {string} pin User PIN to get encrypted words
 *
 * @return {string} Wallet seed
 */
export const getWalletWords = (pin) => (
  hathorLib.wallet.getWalletWords(pin)
);

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
    return hathorLib.helpersUtils.prettyIntegerValue(amount);
  }

  return hathorLib.helpersUtils.prettyValue(amount);
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
 * @params {string} data - Encrypted data to decrypt
 * @params {number} begin - Start of sequence to guess
 * @params {number} end - End of sequence to guess
 */
const guessPartial = (data, begin, end) => {
  const decrypt = (_data, pin) => CryptoJS
    .AES
    .decrypt(_data, pin)
    .toString(CryptoJS.enc.Utf8);

  let pinFound = -1;
  for (let i = begin; i <= end; i += 1) {
    const pin = `${i}`.padStart(6, '0');

    try {
      // decrypted is a string with a space-delimited list of words
      const decrypted = decrypt(data, pin);

      // the biggest word on the BIP39 word list in english has 8 characters
      // so the max possible length for the word list is (8 * 24 + 23)
      if (decrypted.length > 215) continue;
      // the smallest word has 3 characters
      if (decrypted.length < 95) continue;

      if (hathorLib.wallet.wordsValid(decrypted)) {
        pinFound = pin;
        break;
      }
    } catch (e) {
      // decrypt failed, ignoring
    }
  }

  if (pinFound !== -1) {
    return [true, pinFound];
  }

  return [false, ''];
};

/**
 * @params {string} data - Encrypted data to decrypt
 * @params {number} begin - Start of sequence to guess
 * @params {number} step - Step size to schedule `guessPin`
 * @params {Function} progressCb - Callback called on progress
 * @params {Function} successCb - Callback called on success
 * @params {Function} errorCb - Callback called on failure
 */
function guessScheduler(data, begin, step, progressCb, successCb, errorCb) {
  const LIMIT = 999999;
  let end = begin + step;
  if (end > LIMIT) {
    end = LIMIT;
  }

  const [success, pin] = guessPartial(data, begin, end);

  if (!success) {
    const newBegin = end + 1;

    if (newBegin > LIMIT) {
      return errorCb('Reached limit');
    }

    // update progress
    progressCb(Math.floor((newBegin / LIMIT) * 100));

    return setTimeout(() => guessScheduler(
      data,
      newBegin,
      step,
      progressCb,
      successCb,
      errorCb,
    ), 0);
  }

  return successCb(pin);
}

/**
 * @return {[boolean, string]} Tuple <success:boolean, pin:string> with the result
 *
 * @params {Object} accessData - The encrypted data from storage
 * @params {Function} progressCb - A callback that will be called on progress
 */
export const guessPin = async (accessData, progressCb) => {
  const data = accessData.words;

  return new Promise((resolve, reject) => {
    guessScheduler(data, 0, 1000, progressCb, (pin) => {
      resolve([true, pin]);
    }, (error) => {
      resolve([false, '']);
    });
  });
};

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
 * @params {string} oldPin
 * @params {string} newPin
 *
 * @return {boolean} Wether the change password was successful
 */
export const changePin = (oldPin, newPin) => {
  const success = hathorLib.wallet.changePinAndPassword({
    oldPin,
    newPin,
    oldPassword: oldPin,
    newPassword: newPin,
  });
  if (success) {
    setKeychainPin(newPin);
  }
  return success;
};
