/**
 * Copyright (c) Hathor Labs and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import React from 'react';
import { SafeAreaView, View } from 'react-native';
import { t } from 'ttag';

import HathorHeader from '../components/HathorHeader';
import QRCodeReader from '../components/QRCodeReader';
import SimpleButton from '../components/SimpleButton';


class RegisterToken extends React.Component {
  constructor(props) {
    super(props);

    this.QRCodeReader = null;
  }

  onSuccess = (e) => {
    this.props.navigation.navigate('RegisterTokenManual', { configurationString: e.data });
  }

  render() {
    const renderHeaderRightElement = () => (
      <SimpleButton
        // translator: Used when the QR Code Scanner is opened, and user will manually
        // enter the information.
        title={t`Manual info`}
        onPress={() => this.props.navigation.navigate('RegisterTokenManual')}
      />
    );

    return (
      <View style={{
        flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#f7f7f7', alignSelf: 'stretch',
      }}
      >
        <SafeAreaView style={{
          flex: 1, justifyContent: 'center', alignItems: 'center', alignSelf: 'stretch',
        }}
        >
          <HathorHeader
            title={t`REGISTER TOKEN`}
            onBackPress={() => this.props.navigation.pop()}
            rightElement={renderHeaderRightElement()}
          />
          <View style={{
            flex: 1, justifyContent: 'center', alignItems: 'center', margin: 16, alignSelf: 'stretch',
          }}
          >
            <QRCodeReader
              ref={(el) => { this.QRCodeReader = el; }}
              onSuccess={this.onSuccess}
              bottomText={t`Scan the token QR code`}
              {...this.props}
            />
          </View>
        </SafeAreaView>
      </View>
    );
  }
}

export default RegisterToken;
