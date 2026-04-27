/**
 * Copyright (c) Hathor Labs and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import React from 'react';
import { Text, View } from 'react-native';
import { t } from 'ttag';
import HathorHeader from '../components/HathorHeader';
import NewHathorButton from '../components/NewHathorButton';
import baseStyle from '../styles/init';

/**
 * Web3Auth Recovery Share setup screen.
 * Mandatory before wallet creation — user must set up a recovery method.
 *
 * TODO: Integrate with Web3Auth MFA recovery share APIs.
 * For now this is a pass-through that navigates to ChoosePinScreen.
 */
export default class Web3AuthRecoveryScreen extends React.Component {
  style = ({ ...baseStyle });

  render() {
    return (
      <View style={{ flex: 1 }}>
        <HathorHeader
          withLogo
          onBackPress={() => this.props.navigation.goBack()}
        />
        <View style={this.style.container}>
          <Text style={this.style.title}>{t`Set up recovery`}</Text>
          <Text style={this.style.text}>
            {t`To protect your wallet, you need to set up a recovery method. This ensures you can access your funds even if you lose this device.`}
          </Text>
          <View style={this.style.buttonView}>
            <NewHathorButton
              onPress={() => {
                this.props.navigation.navigate('ChoosePinScreen', this.props.route.params);
              }}
              title={t`Continue`}
            />
          </View>
        </View>
      </View>
    );
  }
}
