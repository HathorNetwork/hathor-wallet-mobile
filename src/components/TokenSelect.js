/**
 * Copyright (c) Hathor Labs and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import React from 'react';
import {
  FlatList, Image, StyleSheet, View, Text, TouchableHighlight, Platform
} from 'react-native';
import { get } from 'lodash';
import { FontAwesomeIcon } from '@fortawesome/react-native-fontawesome';
import { faCircleExclamation } from '@fortawesome/free-solid-svg-icons';

import DeviceInfo from 'react-native-device-info';

import chevronRight from '../assets/icons/chevron-right.png';
import Spinner from './Spinner';
import { PRIMARY_COLOR } from '../constants';
import { getLightBackground, renderValue, isTokenNFT } from '../utils';
import { TOKEN_DOWNLOAD_STATUS } from '../sagas/tokens';


/*
This method is a workaround the `getInset` from
https://github.com/react-navigation/react-native-safe-area-view/blob/v0.14.6/index.js#L348-L371
The method was deprecated since it does not cover newer models.

TODO

To cover all models we should migrate to react-native-safe-area-context on the whole app

This is a temporary patch until we upgrade react-navigation
to use the latest version for the SafeAreaView
*/
const getInsets = () => {
  if (Platform.OS === 'android' || Platform.OS === 'web' || Platform.OS === 'windows') {
    return [0, 0];
  }

  const model = DeviceInfo.getModel();
  const deviceId = DeviceInfo.getDeviceId();

  // This method will return true for devices with new screen format (introduced in iPhone X)
  // this is important to get the best padding top here
  const isNewIphoneScreen = () => {
    // The values are taken from the list at
    // https://github.com/react-native-device-info/react-native-device-info/blob/master/ios/RNDeviceInfo/RNDeviceInfo.m#L181-L296

    if (model === 'iPhone X') {
      return true;
    }

    if (model === 'iPhone SE') {
      return false;
    }

    if (deviceId.startsWith('iPhone')) {
      // Device ids for iphone have the format 'iPhone<number>,<othernumber>'
      // The first number is incremental for each year release
      // iPhone X and iPhone 8 are number 10 but they have different screen (only X has the new one)
      // however we have already taken care of X in the previous condition, so here we consider
      // only numbers >= 11
      // The only exception is iPhone SE, which has model as 'iPhone SE' for all of them,
      // even though they are new releases
      // that's why we handle them before this condition here

      // It's safe to do this here because the string starts with iPhone
      const number = deviceId.split(',')[0].replace('iPhone', '');

      // If number is not a number parseInt(number) will return NaN and the if will return false
      if (parseInt(number, 10) >= 11) {
        return true;
      }
    }

    return false;
  };

  if (isNewIphoneScreen()) {
    return [44, 34];
  }

  if (model.startsWith('IPad Pro')) {
    // This covers all 3 gen of IPad Pro and all 5 screen sizes
    return [24, 20];
  }

  return [20, 0];
};

const [paddingTop, paddingBottom] = getInsets();

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

  // Can't use SafeAreaView because the list view must go until the end of the screen
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
    paddingTop,
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
    paddingBottom,
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
