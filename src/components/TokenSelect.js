/**
 * Copyright (c) Hathor Labs and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import React from 'react';
import {
  StyleSheet, View, Text, TouchableHighlight,
} from 'react-native';
import { get } from 'lodash';
import { FontAwesomeIcon } from '@fortawesome/react-native-fontawesome';
import { faCircleExclamation } from '@fortawesome/free-solid-svg-icons';

import Spinner from './Spinner';
import TokenAvatar from './TokenAvatar';
import { renderValue, renderHomeValue, isTokenNFT } from '../utils';
import { TOKEN_DOWNLOAD_STATUS } from '../sagas/tokens';
import { COLORS } from '../styles/themes';
import { HathorFlatList } from './HathorFlatList';

/**
 * @typedef TokenBalance
 * @property {number} data.available
 * @property {string} status
 */

/**
 * @param {Object} props
 * @param {Record<string,TokenBalance>} props.tokensBalance
 * @param {{ uid: string }} props.selectedToken
 * @param {unknown} props.tokenMetadata
 * @param {{ [uid: string]: { uid: string; name: string; symbol: string; }}} props.tokens
 * @param {unknown} props.header
 * @param {function} props.onItemPress
 * @param {boolean} [props.ignoreLoading]
 * @param {boolean} [props.useHomeDisplay] Apply the Home display rules
 *   (magnitude decimal cap + amount-format preference). Off elsewhere, so
 *   token-list reuse (swap, change-token) keeps regular precision.
 * @param {string} [props.amountFormat] AMOUNT_FORMAT for the Home display
 *   (defaults to Expanded; ignored unless useHomeDisplay).
 * @param {number} [props.decimalPlaces] Network decimal places (serverInfo.decimal_places),
 *   used by both display modes.
 */
const TokenSelect = (props) => {
  const tokens = Object.values(props.tokens);
  const renderItem = ({ item }) => {
    const balance = get(props.tokensBalance, `${item.uid}.data.available`, 0);
    const tokenState = get(props.tokensBalance, `${item.uid}.status`, props.ignoreLoading ? 'ready' : 'loading');
    const isNFT = isTokenNFT(item.uid, props.tokenMetadata);
    const balanceLabel = props.useHomeDisplay
      ? renderHomeValue(balance, isNFT, props.decimalPlaces, props.amountFormat)
      : renderValue(balance, isNFT, props.decimalPlaces);

    return (
      <TouchableHighlight
        onPress={() => { props.onItemPress(item); }}
        underlayColor={COLORS.primaryOpacity30}
      >
        <View style={styles.itemWrapper}>
          <TokenAvatar uid={item.uid} symbol={item.symbol} size={40} />
          <View style={styles.itemCenterWrapper}>
            <Text
              style={styles.nameText}
              numberOfLines={1}
              ellipsizeMode='tail'
            >
              {item.name}
            </Text>
          </View>
          <View style={styles.itemRightWrapper}>
            {tokenState === TOKEN_DOWNLOAD_STATUS.READY && (
              <Text style={styles.balanceText}>
                {balanceLabel}
              </Text>
            )}
            {tokenState === TOKEN_DOWNLOAD_STATUS.FAILED && (
              <FontAwesomeIcon
                icon={faCircleExclamation}
                color={COLORS.errorTextShadow}
                style={{ fontSize: 14 }}
              />
            )}
            {tokenState === TOKEN_DOWNLOAD_STATUS.LOADING && (
              <Spinner size={14} animating />
            )}
            {tokenState === TOKEN_DOWNLOAD_STATUS.READY && (
              <Text style={styles.rightSymbolText}>{item.symbol}</Text>
            )}
          </View>
        </View>
      </TouchableHighlight>
    );
  };

  return (
    <View style={styles.wrapper}>
      {props.header}
      <HathorFlatList
        data={tokens}
        // use extraData to make sure list updates (props.tokens might remain the same object)
        extraData={[props.tokensBalance, props.selectedToken.uid]}
        renderItem={renderItem}
        keyExtractor={(item) => item.uid}
        ItemSeparatorComponent={ItemSeparator}
      />
    </View>
  );
};

const ItemSeparator = () => (
  <View style={{ width: '100%', height: 1, backgroundColor: COLORS.borderColor }} />
);

const styles = StyleSheet.create({
  wrapper: {
    flex: 1,
    justifyContent: 'flex-start',
    alignItems: 'center',
    backgroundColor: COLORS.lowContrastDetail, // Defines an outer area on the main list content
  },
  itemWrapper: {
    height: 80,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
  },
  itemCenterWrapper: {
    flex: 1,
    minWidth: 0,
    marginLeft: 12,
    marginRight: 8,
    justifyContent: 'center',
  },
  itemRightWrapper: {
    flexShrink: 0,
    alignItems: 'flex-end',
  },
  nameText: {
    fontSize: 15,
    lineHeight: 20,
    color: COLORS.textColor,
  },
  rightSymbolText: {
    fontSize: 13,
    lineHeight: 18,
    color: COLORS.textColorShadow,
    marginTop: 2,
  },
  balanceText: {
    fontSize: 16,
    lineHeight: 20,
    color: COLORS.textColor,
  },
});

export default TokenSelect;
