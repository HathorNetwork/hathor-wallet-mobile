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
  SafeAreaView,
  Text,
  View,
} from 'react-native';
import OfflineBar from '../components/OfflineBar';
import Logo from '../components/Logo';
import { HathorList, ListItem, ListMenu } from '../components/HathorList';
import { IS_MULTI_TOKEN, PRIMARY_COLOR } from '../constants';
import { getLightBackground } from '../utils';
import CopyClipboard from '../components/CopyClipboard';
import baseStyle from '../styles/init';

/**
 * selectedToken {Object} Select token config {name, symbol, uid}
 * server {str} URL of server this wallet is connected to
 */
const mapStateToProps = (state) => {
  const server = state.useWalletService
    ? state.wallet.storage.config.getWalletServiceBaseUrl()
    : state.wallet.storage.config.getServerUrl();

  return {
    selectedToken: state.selectedToken,
    isOnline: state.isOnline,
    network: state.serverInfo.network,
    uniqueDeviceId: state.uniqueDeviceId,
    server,
    isPushNotificationAvailable: state.pushNotification.available,
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
      backgroundColor: baseStyle.title.backgroundColor,
    },
    logo: {
      height: 22,
      width: 100,
    },
  });

  render() {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: baseStyle.container.backgroundColor }}>
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
            {this.props.isPushNotificationAvailable
              && (
              <ListMenu
                title={t`Push Notification`}
                onPress={() => this.props.navigation.navigate('PushNotification')}
              />
              )
            }
            {IS_MULTI_TOKEN
              && (
                <ListMenu
                  title={t`Create a new token`}
                  onPress={() => this.props.navigation.navigate('CreateTokenStack')}
                />
              )
            }
            {IS_MULTI_TOKEN
              && (
                <ListMenu
                  title={t`Register a token`}
                  onPress={() => this.props.navigation.navigate('RegisterToken')}
                />
              )
            }
            <ListMenu
              title={t`Reset wallet`}
              onPress={() => this.props.navigation.navigate('ResetWallet')}
            />
            <ListMenu
              title={t`About`}
              onPress={() => this.props.navigation.navigate('About')}
            />
            <ListItem
              text={(
                <View style={{ flex: 1 }}>
                  <Text style={{ marginBottom: 8, color: 'rgba(0, 0, 0, 0.5)', fontSize: 12 }}>
                    {t`Unique app identifier`}
                  </Text>

                  <CopyClipboard
                    text={this.props.uniqueDeviceId}
                    textStyle={{ fontSize: 12 }}
                  />
                </View>
              )}
            />
          </HathorList>
        </ScrollView>
        <OfflineBar />
      </SafeAreaView>
    );
  }
}

export default connect(mapStateToProps)(Settings);
