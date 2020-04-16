/**
 * Copyright (c) Hathor Labs and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import React from 'react';
import { connect } from 'react-redux';
import { t } from 'ttag';
import {
  ScrollView,
  StyleSheet,
  Image,
  SafeAreaView,
  Text,
  View,
} from 'react-native';
import hathorLib from '@hathor/wallet-lib';
import { IS_MULTI_TOKEN } from '../constants';
import OfflineBar from '../components/OfflineBar';
import Logo from '../components/Logo';


import { HathorList, ListItem, ListMenu } from '../components/HathorList';

import { PRIMARY_COLOR, getLightBackground } from '../constants';


/**
 * selectedToken {Object} Select token config {name, symbol, uid}
 * server {str} URL of the full node this wallet is connected to
 */
const mapStateToProps = (state) => {
  const server = hathorLib.storage.getItem('wallet:server');
  return {
    selectedToken: state.selectedToken,
    isOnline: state.isOnline,
    network: state.serverInfo.network,
    server,
  };
};

export class Settings extends React.Component {
  style = StyleSheet.create({
    scrollView: {
      flexGrow: 1,
      alignItems: 'center',
    },
    networkContainerView: {
      marginTop: 24,
      marginBottom: 24,
    },
    networkView: {
      backgroundColor: getLightBackground(0.1),
      margin: 8,
      padding: 8,
      borderRadius: 8,
      alignItems: 'center',
    },
    networkText: {
      color: PRIMARY_COLOR,
      fontSize: 16,
      fontWeight: 'bold',
    },
    logoView: {
      height: 22,
      width: 100,
      marginTop: 16,
      marginBottom: 16,
    },
    logo: {
      height: 22,
      width: 100,
    },
  });

  render() {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: '#F7F7F7' }}>
        <ScrollView contentContainerStyle={this.style.scrollView}>
          <View style={this.style.logoView}>
            <Logo
              style={this.style.logo}
            />
          </View>
          {(this.props.isOnline
            && (
            <View style={this.style.networkContainerView}>
              <Text>{t`You are connected to`}</Text>
              <View style={this.style.networkView}>
                <Text style={this.style.networkText}>{this.props.network}</Text>
              </View>
            </View>
            )
          )}

          <HathorList infinity>
            <ListItem
              text={(
                <View style={{ flex: 1 }}>
                  <Text style={{ marginBottom: 8, color: 'rgba(0, 0, 0, 0.5)', fontSize: 12 }}>{t`Connected to`}</Text>
                  <Text
                    style={{ fontSize: 12 }}
                    adjustsFontSizeToFit
                    minimumFontScale={0.5}
                  >
                    {this.props.server}
                  </Text>
                </View>
)}
              isFirst
            />
            <ListMenu
              title={t`Security`}
              onPress={() => this.props.navigation.navigate('Security')}
            />
            {IS_MULTI_TOKEN &&
              <ListMenu
                title={t`Create a new token`}
                onPress={() => this.props.navigation.navigate('CreateTokenStack')}
              />
            }
            {IS_MULTI_TOKEN &&
              <ListMenu
                title={t`Register a token`}
                onPress={() => this.props.navigation.navigate('RegisterToken')}
              />
            }
            <ListMenu
              title={t`Reset wallet`}
              onPress={() => this.props.navigation.navigate('ResetWallet')}
            />
            <ListMenu
              title={t`About`}
              onPress={() => this.props.navigation.navigate('About')}
            />
          </HathorList>
        </ScrollView>
        <OfflineBar />
      </SafeAreaView>
    );
  }
}

export default connect(mapStateToProps)(Settings);
