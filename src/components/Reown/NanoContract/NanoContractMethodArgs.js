/**
 * Copyright (c) Hathor Labs and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import React, { useMemo } from 'react';
import {
  StyleSheet,
  View,
  Text,
} from 'react-native';
import { useSelector } from 'react-redux';
import { t } from 'ttag';
import { get } from 'lodash';
import { Network } from '@hathor/wallet-lib';
import { COLORS } from '../../../styles/themes';
import { commonStyles } from '../theme';
import { DEFAULT_TOKEN, NANOCONTRACT_BLUEPRINTINFO_STATUS as STATUS } from '../../../constants';
import { FeedbackContent } from '../../FeedbackContent';
import Spinner from '../../Spinner';
import { getTimestampFormat, parseScriptData, renderValue } from '../../../utils';
import { SignedDataDisplay } from './SignedDataDisplay';

/**
 * Get method info from registered blueprint data.
 *
 * @param {{
 *   data: Object;
 * }} blueprint The blueprint info object
 * @param {string} method The method name to get info from blueprint public methods
 *
 * @returns {Object}
 */
function getMethodInfoFromBlueprint(blueprint, method) {
  return get(blueprint.data, `public_methods.${method}`, null);
}

/**
 * Get the fallback entries for the method arguments.
 *
 * @param {string[]} args A list of argument value
 *
 * @returns {[argName: string, value: string][]}
 *
 * @example
 * getFallbackArgEntries([...argValues])
 * >>> [['Position 0', 'abc'], ['Position 1', '00'], ['Position 2', 123]]
 */
function getFallbackArgEntries(args) {
  return args.map((arg, idx) => [t`Position ${idx}`, arg]);
}

/**
 * It renders a list of method arguments for when the Nano Contract executes.
 *
 * @param {Object} props
 * @param {string} props.blueprintId ID of blueprint.
 * @param {string} props.method Method's name.
 * @param {string[]} props.ncArgs A list of method's argument.
 */
export const NanoContractMethodArgs = ({ blueprintId, method, ncArgs }) => {
  if (!ncArgs || ncArgs.length <= 0) {
    return null;
  }

  const network = useSelector((state) => new Network(state.networkSettings.network));
  const tokens = useSelector((state) => state.tokens);

  const blueprintInfo = useSelector((state) => state.nanoContract.blueprint[blueprintId]);
  // It results a in a list of entries like:
  // >>>[
  // >>>  ['oracle_script', 'abc', 'TxOutputScript'],
  // >>>  ['token_uid', '00', 'TokenUid'],
  // >>>  ['date_last_bet', 123, 'Timestamp']
  // >>>]
  // or a fallback like:
  // >>> [['Position 0', 'abc'], ['Position 1', '00'], ['Position 2', 123]]
  const argEntries = useMemo(() => {
    if (blueprintInfo == null || blueprintInfo.status === STATUS.LOADING) {
      return [];
    }

    const methodInfo = getMethodInfoFromBlueprint(blueprintInfo, method);
    if (methodInfo) {
      return ncArgs.map((arg, idx) => [methodInfo.args[idx].name, arg, methodInfo.args[idx].type]);
    }

    // Still render a fallback
    return getFallbackArgEntries(ncArgs);
  }, [method, ncArgs, blueprintInfo]);

  // Empty while downloading the bleuprint details
  const isEmpty = argEntries.length === 0;
  const notEmpty = !isEmpty;

  return (
    <View>
      <View>
        <Text style={commonStyles.sectionTitle}>{t`Arguments`}</Text>
      </View>
      {isEmpty /* This is a redundancy to the general loading */
        && (
          <FeedbackContent
            message={t`Loading arguments.`}
            icon={<Spinner size={48} animating />}
            offmargin
          />
        )}
      {notEmpty
        && (
          <View style={[commonStyles.card]}>
            <View style={[commonStyles.cardStack]}>
              {argEntries.map(([argName, argValue, argType]) => (
                <View
                  key={argName}
                  style={commonStyles.cardStackItem}
                >
                  <View style={styles.argPosition}>
                    <Text style={styles.argPositionText}>{argName}</Text>
                  </View>
                  <View style={styles.argValue}>
                    <ArgValueRenderer
                      type={argType}
                      value={argValue}
                      network={network}
                      tokens={tokens}
                    />
                  </View>
                </View>
              ))}
            </View>
          </View>
        )}
    </View>
  )
};

/**
 * Component responsible to render the appropriate format for the value
 * taking in consideration the type.
 *
 * Remarks
 * The values received here when derived from 'byte' type like
 * 'TxOutputScript', 'TokenUid' and 'VertexId' are already in their
 * hexadecimal format.
 *
 * Values of type 'Address', which also derives from 'byte' are
 * in base58 format.
 *
 * Values of type 'SignedData[Result]' arrives here in presentation
 * format.
 *
 * @param {Object} props
 * @param {string} props.type An argument type
 * @param {string} props.value An argument value
 * @param {Object} props.network A network object
 * @param {Object} props.tokens A map of registered tokens
 */
const ArgValueRenderer = ({ type, value, network, tokens }) => {
  // Handle SignedData types with custom component
  if (type && type.startsWith('SignedData')) {
    return <SignedDataDisplay value={value} />;
  }

  // For all other types, render as text with proper styling
  let displayValue = value;

  if (type === 'Amount') {
    displayValue = renderValue(value);
  } else if (type === 'Timestamp') {
    displayValue = getTimestampFormat(value);
  } else if (type === 'TxOutputScript') {
    const parsedScript = parseScriptData(value, network);
    if (parsedScript && parsedScript.getType() === 'data') {
      displayValue = parsedScript.data;
    } else if (parsedScript) {
      displayValue = parsedScript.address.base58;
    }
  } else if (type === 'TokenUid') {
    if (value === DEFAULT_TOKEN.uid) {
      displayValue = DEFAULT_TOKEN.symbol;
    } else if (value in tokens) {
      displayValue = tokens[value].symbol;
    }
  }

  return (
    <Text style={styles.argValueText}>
      {displayValue}
    </Text>
  );
};

const styles = StyleSheet.create({
  argPosition: {
    flexShrink: 10,
    width: '30%',
    paddingRight: 8,
  },
  argPositionText: [
    commonStyles.text,
    commonStyles.bold,
    {
      fontSize: 14,
      color: COLORS.textColorShadow,
    }
  ],
  argValue: {
    flex: 1,
    maxWidth: '70%',
    backgroundColor: 'hsla(0, 0%, 96%, 1)',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 6,
  },
  argValueText: {
    fontSize: 14,
    lineHeight: 20,
    color: COLORS.textColor,
    fontFamily: 'monospace',
  },
});
