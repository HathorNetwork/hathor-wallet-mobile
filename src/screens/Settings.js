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
  Text,
  View,
} from 'react-native';
import OfflineBar from '../components/OfflineBar';
import Logo from '../components/Logo';
import { HathorList, ListItem, ListMenu } from '../components/HathorList';
import {
  IS_MULTI_TOKEN,
  NETWORK_SETTINGS_FEATURE_TOGGLE,
  WALLET_CONNECT_FEATURE_TOGGLE,
} from '../constants';
import CopyClipboard from '../components/CopyClipboard';
import { COLORS } from '../styles/themes';
import { NetworkSettingsFlowNav } from './NetworkSettings';

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
    walletConnectEnabled: state.featureToggles[WALLET_CONNECT_FEATURE_TOGGLE],
    networkSettingsEnabled: state.featureToggles[NETWORK_SETTINGS_FEATURE_TOGGLE],
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
      backgroundColor: COLORS.primaryOpacity10,
      margin: 8,
      padding: 8,
      borderRadius: 8,
      alignItems: 'center',
    },
    networkText: {
      color: COLORS.primary,
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
      <View style={{ flex: 1, backgroundColor: COLORS.lowContrastDetail }}>
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

          <HathorList title={t`General Settings`}>
            <ListItem
              text={(
                <View style={{ flex: 1 }}>
                  <Text style={{ marginBottom: 8, color: COLORS.textColorShadow, fontSize: 12 }}>{t`Connected to`}</Text>
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
              )}
            {IS_MULTI_TOKEN
              && (
                <ListMenu
                  title={t`Create a new token`}
                  onPress={() => this.props.navigation.navigate('CreateTokenStack')}
                />
              )}
            {IS_MULTI_TOKEN
              && (
                <ListMenu
                  title={t`Register a token`}
                  onPress={() => this.props.navigation.navigate('RegisterToken')}
                />
              )}
            {this.props.walletConnectEnabled
              && (
                <ListMenu
                  title='Wallet Connect'
                  onPress={() => this.props.navigation.navigate('WalletConnectList')}
                />
              )}
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
                  <Text style={{ marginBottom: 8, color: COLORS.textColorShadow, fontSize: 12 }}>
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

          {this.props.networkSettingsEnabled
            && (
              <HathorList title={t`Developer Settings`}>
                <ListMenu
                  title={t`Network Settings`}
                  onPress={() => this.props.navigation.navigate(NetworkSettingsFlowNav)}
                />
              </HathorList>
            )}

        </ScrollView>
        <OfflineBar />
      </View>
    );
  }
}

export default connect(mapStateToProps)(Settings);
