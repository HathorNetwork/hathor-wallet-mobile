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
import { t } from 'ttag';
import { connect } from 'react-redux';

import NewHathorButton from '../components/NewHathorButton';
import HathorHeader from '../components/HathorHeader';
import baseStyle from '../styles/init';
import { Link, str2jsx } from '../utils';
import { TOKEN_DEPOSIT_URL } from '../constants';

const mapStateToProps = (state) => ({
  wallet: state.wallet,
});

class CreateTokenDepositNotice extends React.Component {
  style = ({ ...baseStyle,
    ...StyleSheet.create({
      container: {
        flex: 1,
        justifyContent: 'space-between',
        padding: 16,
      },
    }) });

  render() {
    const depositPercentage = this.props.wallet.storage.getTokenDepositPercentage() * 100;
    return (
      <SafeAreaView style={{ flex: 1 }}>
        <HathorHeader
          title={t`CREATE TOKEN`}
          onBackPress={() => this.props.navigation.pop()}
        />
        <View style={this.style.container}>
          <View>
            <Text style={this.style.text}>
              {str2jsx(
                t`When creating new tokens, a |fn:deposit of ${depositPercentage}%| in HTR is required - e.g. if you create 1000 NewCoins, 10 HTR are needed as deposit.`,
                { fn: (x, i) => <Text key={i} style={this.style.link}>{x}</Text> }
              )}
            </Text>
            <Text style={this.style.text}>
              {str2jsx(
                t`If these tokens are later melted, the HTR deposit will be returned. Read more about it |link:here|.`,
                { link: (x, i) => <Link key={i} href={TOKEN_DEPOSIT_URL}>{x}</Link> }
              )}
            </Text>
          </View>
          <View style={this.style.buttonView}>
            <NewHathorButton
              onPress={() => this.props.navigation.navigate('CreateTokenName')}
              title={t`I understand`}
            />
          </View>
        </View>
      </SafeAreaView>
    );
  }
}

export default connect(mapStateToProps)(CreateTokenDepositNotice);
