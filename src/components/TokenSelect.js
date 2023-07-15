/**
 * Copyright (c) Hathor Labs and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import React from 'react';
import {
  FlatList, Image, StyleSheet, View, Text, TouchableHighlight,
} from 'react-native';
import { get } from 'lodash';
import { FontAwesomeIcon } from '@fortawesome/react-native-fontawesome';
import { faCircleExclamation } from '@fortawesome/free-solid-svg-icons';

import chevronRight from '../assets/icons/chevron-right.png';
import Spinner from './Spinner';
import { PRIMARY_COLOR } from '../constants';
import { getLightBackground, renderValue, isTokenNFT } from '../utils';
import { TOKEN_DOWNLOAD_STATUS } from '../sagas/tokens';

const TokenSelect = (props) => {
  const renderItem = ({ item, index }) => {
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
        style={index === 0 ? styles.firstItemWrapper : null}
        onPress={() => { props.onItemPress(item); }}
        underlayColor={getLightBackground(0.3)}
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
                renderValue(balance, isTokenNFT(item.uid, props.tokenMetadata))
              )}

              {tokenState === TOKEN_DOWNLOAD_STATUS.FAILED && (
                <FontAwesomeIcon
                  icon={faCircleExclamation}
                  color='rgba(255, 0, 0, 0.7)'
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
      <View style={styles.listWrapper}>
        <FlatList
          data={props.tokens}
          // use extraData to make sure list updates (props.tokens might remain the same object)
          extraData={[props.tokensBalance, props.selectedToken.uid]}
          renderItem={renderItem}
          keyExtractor={(item, index) => item.uid}
        />
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  wrapper: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f7f7f7',
  },
  listWrapper: {
    alignSelf: 'stretch',
    flex: 1,
    marginTop: 16,
    backgroundColor: 'white',
    marginHorizontal: 16,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    shadowOffset: { height: 2, width: 0 },
    shadowRadius: 4,
    shadowColor: 'black',
    shadowOpacity: 0.08,
  },
  itemWrapper: {
    height: 80,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
    borderColor: '#eee',
  },
  firstItemWrapper: {
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
  },
  itemLeftWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  symbolWrapper: {
    padding: 4,
    backgroundColor: '#f7f7f7',
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
    color: 'white',
  },
  symbolWrapperSelected: {
    backgroundColor: PRIMARY_COLOR,
  },
});

export default TokenSelect;
