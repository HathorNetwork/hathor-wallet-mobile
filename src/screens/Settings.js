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
import { isEmpty } from 'lodash';
import OfflineBar from '../components/OfflineBar';
import Logo from '../components/Logo';
import { HathorList, ListItem, ListMenu } from '../components/HathorList';
import {
  IS_MULTI_TOKEN,
  NETWORK_SETTINGS_FEATURE_TOGGLE,
  REOWN_FEATURE_TOGGLE,
  SINGLE_ADDRESS_FEATURE_TOGGLE,
} from '../constants';
import CopyClipboard from '../components/CopyClipboard';
import { COLORS } from '../styles/themes';
import { NetworkSettingsFlowNav } from './NetworkSettings';
import { isNanoContractsEnabled, isPushNotificationAvailableForUser } from '../utils';
import { getNetworkSettings } from '../sagas/helpers';

/**
 * selectedToken {Object} Select token config {name, symbol, uid}
 * server {str} URL of server this wallet is connected to
 */
const mapStateToProps = (state) => {
  let server;
  const { walletServiceUrl } = state.networkSettings;
  if (state.useWalletService && !isEmpty(walletServiceUrl)) {
    server = walletServiceUrl;
  }

  if (!server) {
    server = state.networkSettings.nodeUrl;
  }

  return {
    selectedToken: state.selectedToken,
    isOnline: state.isOnline,
    network: getNetworkSettings(state).network,
    uniqueDeviceId: state.uniqueDeviceId,
    server,
    isPushNotificationAvailable: isPushNotificationAvailableForUser(state),
    reownEnabled: state.featureToggles[REOWN_FEATURE_TOGGLE] && isNanoContractsEnabled(state),
    networkSettingsEnabled: state.featureToggles[NETWORK_SETTINGS_FEATURE_TOGGLE],
    singleAddressEnabled: state.featureToggles[SINGLE_ADDRESS_FEATURE_TOGGLE],
    addressMode: state.addressMode,
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

          {/* Section 1: General Settings */}
          <HathorList title={t`General Settings`}>
            {IS_MULTI_TOKEN
              && (
                <ListMenu
                  title={t`Register a token`}
                  onPress={() => this.props.navigation.navigate('RegisterToken')}
                  isFirst
                />
              )}
            {IS_MULTI_TOKEN
              && (
                <ListMenu
                  title={t`Create a new token`}
                  onPress={() => this.props.navigation.navigate('CreateTokenStack')}
                />
              )}
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
            {this.props.reownEnabled
              && (
                <ListMenu
                  title={t`Reown`}
                  onPress={() => this.props.navigation.navigate('ReownList')}
                />
              )}
          </HathorList>

          {/* Section 2: Advanced Settings */}
          <HathorList title={t`Advanced Settings`}>
            {this.props.networkSettingsEnabled
              && (
                <ListMenu
                  title={t`Network Settings`}
                  onPress={() => this.props.navigation.navigate(NetworkSettingsFlowNav)}
                />
              )}
            {this.props.singleAddressEnabled
              && (
                <ListMenu
                  title={t`Address Mode`}
                  onPress={() => this.props.navigation.navigate('AddressMode')}
                />
              )}
            <ListMenu
              title={t`Reset wallet`}
              onPress={() => this.props.navigation.navigate('ResetWallet')}
            />
          </HathorList>

          {/* Section 3: Footer */}
          <HathorList>
            <ListMenu
              title={t`About`}
              onPress={() => this.props.navigation.navigate('About')}
              isFirst
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
              isLast
            />
          </HathorList>

        </ScrollView>
        <OfflineBar />
      </View>
    );
  }
}

export default connect(mapStateToProps)(Settings);
