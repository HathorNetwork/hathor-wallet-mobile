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
import { COLORS } from '../../../styles/themes';
import { commonStyles } from '../theme';
import { NANOCONTRACT_BLUEPRINTINFO_STATUS as STATUS } from '../../../constants';
import { FeedbackContent } from '../../FeedbackContent';
import Spinner from '../../Spinner';

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

  const blueprintInfo = useSelector((state) => state.nanoContract.blueprint[blueprintId]);
  // It results a in a list of entries like:
  // >>> [['oracle_script', 'abc'], ['token_uid', '00'], ['date_last_bet', 123]]
  // or a fallback like:
  // >>> [['Position 0', 'abc'], ['Position 1', '00'], ['Position 2', 123]]
  const argEntries = useMemo(() => {
    if (blueprintInfo == null || blueprintInfo.status === STATUS.LOADING) {
      return [];
    }

    const methodInfo = getMethodInfoFromBlueprint(blueprintInfo, method);
    if (methodInfo) {
      return ncArgs.map((arg, idx) => [methodInfo.args[idx].name, arg]);
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
              {argEntries.map(([argName, argValue]) => (
                <View
                  key={argName}
                  style={commonStyles.cardStackItem}
                >
                  <View style={styles.argPosition}>
                    <Text style={styles.argPositionText}>{argName}</Text>
                  </View>
                  <View style={styles.argValue}>
                    <Text style={styles.argValueText}>{argValue}</Text>
                  </View>
                </View>
              ))}
            </View>
          </View>
        )}
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
