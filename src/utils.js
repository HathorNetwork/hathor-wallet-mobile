/**
 * Copyright (c) Hathor Labs and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import hathorLib from '@hathor/wallet-lib';
import React from 'react';
import { t } from 'ttag';
import { Linking, Platform, Text } from 'react-native';
import { getStatusBarHeight } from 'react-native-status-bar-height';
import baseStyle from './styles/init';
import { PRIMARY_COLOR } from './constants';

export const Strong = (props) => <Text style={[{ fontWeight: 'bold' }, props.style]}>{props.children}</Text>;

export const Italic = (props) => <Text style={[{ fontStyle: 'italic' }, props.style]}>{props.children}</Text>;

export const Link = (props) => (
  <Text style={baseStyle.link} onPress={() => Linking.openURL(props.href)}>
    {props.children}
  </Text>
);

/**
 * Returns the balance for each token in tx, if the input/output belongs to this wallet
 */
export const getMyTxBalance = (tx, myKeys) => {
  const balance = {};
  for (const txout of tx.outputs) {
    if (hathorLib.wallet.isAuthorityOutput(txout)) {
      continue;
    }
    if (txout.decoded && txout.decoded.address
        && myKeys.includes(txout.decoded.address)) {
      if (!balance[txout.token]) {
        balance[txout.token] = 0;
      }
      balance[txout.token] += txout.value;
    }
  }

  for (const txin of tx.inputs) {
    if (hathorLib.wallet.isAuthorityOutput(txin)) {
      continue;
    }
    if (txin.decoded && txin.decoded.address
        && myKeys.includes(txin.decoded.address)) {
      if (!balance[txin.token]) {
        balance[txin.token] = 0;
      }
      balance[txin.token] -= txin.value;
    }
  }

  return balance;
};

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

export const getBalance = (tokenUid) => {
  // TODO should have a method in the lib to get balance by token
  const data = hathorLib.wallet.getWalletData();
  const historyTxs = data.historyTransactions || {};
  const filteredArray = hathorLib.wallet.filterHistoryTransactions(historyTxs, tokenUid, false);
  const balance = hathorLib.wallet.calculateBalance(filteredArray, tokenUid);
  return balance;
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
