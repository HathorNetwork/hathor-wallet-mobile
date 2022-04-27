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

import DeviceInfo from 'react-native-device-info';

import chevronRight from '../assets/icons/chevron-right.png';
import { PRIMARY_COLOR } from '../constants';
import { getLightBackground, renderValue, isTokenNFT } from '../utils';


/*
This method is a workaround the `getInset` from
https://github.com/react-navigation/react-native-safe-area-view/blob/v0.14.6/index.js#L348-L371
The method was deprecated since it does not cover newer models.

To cover all models we should migrate to react-native-safe-area-context on the whole app
*/
const getInsets = () => {
  if (Platform.OS === 'android' || Platform.OS === 'web' || Platform.OS === 'windows') {
    return [0, 0];
  }

  const model = DeviceInfo.getModel();
  // The values are taken from the list at
  // https://github.com/react-native-device-info/react-native-device-info/blob/master/ios/RNDeviceInfo/RNDeviceInfo.m#L181-L296
  if (model.startsWith('iPhone X')) {
    // This covers IPhone X, XS, XS Max, XR
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

    const balance = item.uid in props.tokensBalance
      ? props.tokensBalance[item.uid].available : 0;

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
              {renderValue(balance, isTokenNFT(item.uid, props.tokenMetadata))}
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
