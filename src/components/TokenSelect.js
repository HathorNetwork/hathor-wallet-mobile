/**
 * Copyright (c) Hathor Labs and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import React from 'react';
import {
  Image, StyleSheet, View, Text, TouchableHighlight,
} from 'react-native';
import { get } from 'lodash';
import { FontAwesomeIcon } from '@fortawesome/react-native-fontawesome';
import { faCircleExclamation } from '@fortawesome/free-solid-svg-icons';
import { t } from 'ttag';
import { bigIntCoercibleSchema } from '@hathor/wallet-lib/lib/utils/bigint';

import chevronRight from '../assets/icons/chevron-right.png';
import Spinner from './Spinner';
import { renderValue, isTokenNFT } from '../utils';
import { TOKEN_DOWNLOAD_STATUS } from '../sagas/tokens';
import { COLORS } from '../styles/themes';
import { HathorFlatList } from './HathorFlatList';

// Declare BigInt for ESLint
/* global BigInt */

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
 * @param {boolean} props.renderArrow
 * @param {function} props.onItemPress
 */
const TokenSelect = (props) => {
  const tokens = Object.values(props.tokens);
  const renderItem = ({ item }) => {
    const symbolWrapperStyle = [styles.symbolWrapper];
    const symbolTextStyle = [styles.text, styles.leftText, styles.symbolText];
    if (props.selectedToken && props.selectedToken.uid === item.uid) {
      symbolWrapperStyle.push(styles.symbolWrapperSelected);
      symbolTextStyle.push(styles.symbolTextSelected);
    }

    const balance = get(props.tokensBalance, `${item.uid}.data.available`, 0);
    const tokenState = get(props.tokensBalance, `${item.uid}.status`, 'loading');

    return (
      <TouchableHighlight
        onPress={() => { props.onItemPress(item); }}
        underlayColor={COLORS.primaryOpacity30}
      >
        <View style={styles.itemWrapper}>
          <View style={styles.itemLeftWrapper}>
            <View style={symbolWrapperStyle}>
              <Text style={symbolTextStyle}>{item.symbol}</Text>
            </View>
            <Text style={[styles.text, styles.leftText]}>{item.name}</Text>
          </View>
          <View style={styles.itemLeftWrapper}>
            <Text style={[styles.text, styles.rightText]}>
              {tokenState === TOKEN_DOWNLOAD_STATUS.READY && (
                renderValue(
                  bigIntCoercibleSchema.parse(balance),
                  isTokenNFT(item.uid, props.tokenMetadata)
                )
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

              {' '}

              {item.symbol}
            </Text>
            {props.renderArrow
              && <Image style={{ marginLeft: 8 }} source={chevronRight} width={24} height={24} />}
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
    justifyContent: 'space-between',
  },
  itemLeftWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  symbolWrapper: {
    padding: 4,
    backgroundColor: COLORS.lowContrastDetail,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
    borderRadius: 4,
  },
  text: {
    lineHeight: 20,
  },
  rightText: {
    fontSize: 16,
  },
  leftText: {
    fontSize: 14,
  },
  symbolText: {
    fontWeight: 'bold',
  },
  symbolTextSelected: {
    color: COLORS.backgroundColor,
  },
  symbolWrapperSelected: {
    backgroundColor: COLORS.primary,
  },
});

export default TokenSelect;
