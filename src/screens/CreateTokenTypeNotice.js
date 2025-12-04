/**
 * Copyright (c) Hathor Labs and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import React from 'react';
import {
  StyleSheet,
  Text,
  View,
  Image,
} from 'react-native';
import { t } from 'ttag';
import { connect } from 'react-redux';

import NewHathorButton from '../components/NewHathorButton';
import HathorHeader from '../components/HathorHeader';
import baseStyle from '../styles/init';
import { Link, str2jsx } from '../utils';
import { TOKEN_DEPOSIT_URL } from '../constants';
import infoCircle from '../assets/icons/info-circle.png'
import { COLORS } from '../styles/themes';

const mapStateToProps = (state) => ({
  wallet: state.wallet,
});

class CreateTokenTypeNotice extends React.Component {
  style = ({ ...baseStyle,
    ...StyleSheet.create({
      container: {
        flex: 1,
        justifyContent: 'space-between',
        padding: 16,
      },
      typeInfoContainer: {
        backgroundColor: "#F7F7F7",
      },
      typeInfoHeader: {
        marginBottom: 16,
        color: COLORS.primary,
      },
      typeInfoFooter: {
        marginTop: 16,
        color: "#57606A",
      },
    }) });

  render() {
    const depositPercentage = this.props.wallet.storage.getTokenDepositPercentage() * 100;
    return (
      <View style={{ flex: 1 }}>
        <HathorHeader
          title={t`CREATE TOKEN`}
          onBackPress={() => this.props.navigation.pop()}
        />
        <View style={this.style.container}>
          <View>
            <Text style={this.style.text}>
              {t`Choose how your tokens will behave for future transactions.`}
            </Text>

            <View style={this.style.typeInfoContainer}>
              <Text style={this.style.typeInfoHeader}>Deposit Token:</Text>
              <Text style={this.style.typeInfo}>Requires a 1% HTR deposit.</Text>
              <Text style={this.style.typeInfo}>No network fees in future transfers.</Text>
              <Text style={this.style.typeInfo}>Refundable if token is burned.</Text>
              <Text style={this.style.typeInfoFooter}>Recommended for frequent use.</Text>
            </View>

            <View style={this.style.typeInfoContainer}>
              <Text style={this.style.typeInfoHeader}>Fee Token:</Text>
              <Text style={this.style.typeInfo}>No deposit required.</Text>
              <Text style={this.style.typeInfo}>A small fee applies to every transfer.</Text>
              <Text style={this.style.typeInfoFooter}>Recommended for occasional use.</Text>
            </View>

            <View>
              <Image source={infoCircle} style={{ margin: 8 }} />
              <Text style={this.style.text}>
                {str2jsx(
                  t`Once selected, the token type cannot be changed later. |link:Learn more about deposits and fees here|`,
                  { link: (x, i) => <Link key={i} href={TOKEN_DEPOSIT_URL}>{x}</Link> }
                )}
              </Text>
            </View>
          </View>
          <View style={this.style.buttonView}>
            <NewHathorButton
              onPress={() => this.props.navigation.navigate('CreateTokenName', { tokenInfoVersion: 1 })}
              title={t`DEPOSIT TOKEN`}
            />
            <NewHathorButton
              onPress={() => this.props.navigation.navigate('CreateTokenName', { tokenInfoVersion: 2 })}
              title={t`FEE TOKEN`}
            />
          </View>
        </View>
      </View>
    );
  }
}

export default connect(mapStateToProps)(CreateTokenTypeNotice);
