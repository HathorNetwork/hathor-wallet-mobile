/**
 * Copyright (c) Hathor Labs and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { bufferUtils, helpersUtils } from '@hathor/wallet-lib';
import { getAddressFromPubkey } from '@hathor/wallet-lib/lib/utils/address';
import { parseP2PKH } from '@hathor/wallet-lib/lib/utils/scripts';
import React from 'react';
import {
  StyleSheet,
  View,
  Text,
} from 'react-native';
import { useSelector } from 'react-redux';
import { t } from 'ttag';
import { COLORS } from '../../../styles/themes';
import { commonStyles } from '../theme';

/*
  initialize(self, ctx: Context, oracle_script: TxOutputScript, token_uid: TokenUid, date_last_bet: Timestamp)
  bet(self, ctx: Context, address: Address, score: str)
  set_result(self, ctx: Context, result: SignedData[Result])
  withdraw(self, ctx: Context)
*/

function formatDate(date) {
  const month = date.getMonth() + 1; // getMonth() is zero-based
  const day = date.getDate();
  const hours = date.getHours();
  const minutes = date.getMinutes();

  const formattedMonth = month < 10 ? `0${month}` : month;
  const formattedDay = day < 10 ? `0${day}` : day;

  const formattedHours = hours < 10 ? `0${hours}` : hours;
  const formattedMinutes = minutes < 10 ? `0${minutes}` : minutes;

  const formattedYear = date.getFullYear();

  return `${formattedMonth}/${formattedDay}/${formattedYear}, ${formattedHours}:${formattedMinutes}`;
}

function getInitializeArgs(pos) {
  switch (pos) {
    case 0:
      return 'Oracle';
    case 1:
      return 'Token';
    case 2:
      return 'Last bet';
    default:
      return pos;
  }
}

function getBetArgs(pos) {
  switch (pos) {
    case 0:
      return 'Address';
    case 1:
      return 'Score';
    default:
      return pos;
  }
}

function getSetResultArgs(pos) {
  switch (pos) {
    case 0:
      return 'Result';
    default:
      return pos;
  }
}

function getWithdrawArgs(pos) {
  switch (pos) {
    default:
      return pos;
  }
}

function getArgName(method, pos) {
  switch (method) {
    case 'initialize':
      return getInitializeArgs(pos);
    case 'bet':
      return getBetArgs(pos);
    case 'set_result':
      return getSetResultArgs(pos);
    case 'withdraw':
      return getWithdrawArgs(pos);
    default:
      return pos;
  }
}

function getBetValue(pos, value, wallet) {
  switch (pos) {
    case 0:
      return helpersUtils.encodeAddress(
        bufferUtils.hexToBuffer(value).slice(1, 21),
        wallet.getNetworkObject(),
      ).base58;
    default:
      return value;
  }
}

function getInitializeValue(pos, value, wallet) {
  try {
    switch (pos) {
      case 0:
        return parseP2PKH(bufferUtils.hexToBuffer(value), wallet.getNetworkObject()).address.base58;
      case 2:
        return formatDate(new Date(value * 1000));
      default:
        return value;
    }
  } catch (e) {
    return value;
  }
}

function getSetResultValue(pos, value, wallet) {
  try {
    switch (pos) {
      case 0: {
        const [_signed, result, _type] = value.split(',');
        return result;
      } default:
        return value;
    }
  } catch (e) {
    console.log('Error: ', e);
    return value;
  }
}

function getArgValue(method, pos, value, wallet) {
  try {
    switch (method) {
      case 'bet':
        return getBetValue(pos, value, wallet);
      case 'initialize':
        return getInitializeValue(pos, value, wallet);
      case 'set_result':
        return getSetResultValue(pos, value, wallet);
      default:
        return value;
    }
  } catch (e) {
    return value;
  }
}

/**
 * It renders a list of method arguments for when the Nano Contract executes.
 *
 * @param {Object} props
 * @param {string[]} props.ncArgs A list of method's argument.
 */
export const NanoContractMethodArgs = ({ method, ncArgs }) => {
  if (!ncArgs || ncArgs.length <= 0) {
    return null;
  }

  const wallet = useSelector((state) => state.wallet);

  return (
    <View>
      <View>
        <Text style={commonStyles.sectionTitle}>{t`Argument List`}</Text>
      </View>
      <View style={[commonStyles.card]}>
        <View style={[commonStyles.cardStack]}>
          {ncArgs.map((argValue, index) => (
            <View key={`${argValue}:${Date.now().toString()}`} style={commonStyles.cardStackItem}>
              <View style={styles.argPosition}>
                <Text style={styles.argPositionText}>{t`${getArgName(method, index)}`}</Text>
              </View>
              <View style={styles.argValue}>
                <Text style={styles.argValueText}>
                  {getArgValue(method, index, argValue, wallet)}
                </Text>
              </View>
            </View>
          ))}
        </View>
      </View>
    </View>
  )
};

const styles = StyleSheet.create({
  argPosition: {
    flexShrink: 10,
    width: '30%',
    paddingRight: 8,
  },
  argPositionText: [
    commonStyles.text,
    commonStyles.bold
  ],
  argValue: {
    maxWidth: '70%',
    backgroundColor: 'hsla(0, 0%, 96%, 1)',
    paddingVertical: 2,
    paddingHorizontal: 8,
    borderRadius: 4,
  },
  argValueText: {
    fontSize: 12,
    lineHeight: 16,
    color: COLORS.black,
  },
});
