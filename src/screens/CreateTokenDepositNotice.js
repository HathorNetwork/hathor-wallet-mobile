/**
 * Copyright (c) Hathor Labs and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import React from 'react';
import {
  SafeAreaView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import hathorLib from '@hathor/wallet-lib';
import NewHathorButton from '../components/NewHathorButton';
import HathorHeader from '../components/HathorHeader';
import baseStyle from '../styles/init';
import { Link } from '../utils';


class CreateTokenDepositNotice extends React.Component {
  style = Object.assign({}, baseStyle, StyleSheet.create({
    container: {
      flex: 1,
      justifyContent: 'space-between',
      padding: 16,
    },
  }));

  render() {
    return (
      <SafeAreaView style={{ flex: 1 }}>
        <HathorHeader
          onBackPress={() => this.props.navigation.dismiss()}
        />
        <View style={this.style.container}>
          <View>
            <Text style={this.style.text}>
              When creating new tokens, a{' '}
              <Text style={this.style.link}>
                deposit of {hathorLib.tokens.getDepositPercentage() * 100}%{' '}
              </Text>
              in HTR is required - e.g. if you create 1000 NewCoins, 10 HTR are needed as deposit.
            </Text>
            <Text style={this.style.text}>
              If these tokens are later melted, the HTR deposit will be returned. Read more about it{' '}
              <Link href='https://gitlab.com/HathorNetwork/rfcs/blob/master/text/0011-token-deposit.md'>here</Link>
              .
            </Text>
          </View>
          <View style={this.style.buttonView}>
            <NewHathorButton
              onPress={() => this.props.navigation.navigate('CreateTokenName')}
              title='I understand'
            />
          </View>
        </View>
      </SafeAreaView>
    );
  }
}

export default CreateTokenDepositNotice;
