import React from 'react';
import {
  StyleSheet,
  SafeAreaView,
  Text,
  View,
  Switch,
} from 'react-native';

import * as Keychain from 'react-native-keychain';
import hathorLib from '@hathor/wallet-lib';
import HathorHeader from '../components/HathorHeader';
import NewHathorButton from '../components/NewHathorButton';
import baseStyle from '../styles/init';
import { Strong } from '../utils';


export class ResetWallet extends React.Component {
  style = Object.assign({}, baseStyle, StyleSheet.create({
    switchView: {
      flexDirection: 'row',
    },
    switchText: {
      paddingLeft: 16,
      fontSize: 14,
      lineHeight: 18,
      flex: 1,
    },
  }));

  /**
   * switchValue {bool}
   *   Indicates whether user wants to reset his/her wallet. It enables the Reset Wallet button.
   * */
  state = {
    switchValue: false,
  };

  constructor(props) {
    super(props);
    this.onBackPress = this.props.navigation.getParam('onBackPress', this.props.navigation.goBack);
  }

  toggleSwitch = (value) => {
    this.setState({ switchValue: value });
  }

  onPressResetWallet = async () => {
    // TODO we don't need to save server data
    const server = hathorLib.storage.getItem('wallet:server');

    hathorLib.wallet.unsubscribeAllAddresses();
    hathorLib.WebSocketHandler.endConnection();
    hathorLib.storage.clear();

    // TODO make sure asyncStorage is clear when doing this. Maybe temporarily use setTimeout?
    hathorLib.storage.setItem('wallet:server', server);
    await Keychain.resetGenericPassword();
    this.props.navigation.navigate('Init');
  }

  render() {
    return (
      <SafeAreaView style={{ flex: 1 }}>
        <HathorHeader
          title="RESET WALLET"
          onBackPress={() => this.onBackPress()}
          wrapperStyle={{ borderBottomWidth: 0 }}
        />
        <View style={this.style.container}>
          <Text style={this.style.title}>Are you sure?</Text>
          <Text style={this.style.text}>
            If you reset your wallet, <Strong>all data will be deleted</Strong>, and you will{' '}
            <Strong>lose access to your tokens</Strong>. To recover access to your tokens, you will
            {' '}need to import your seed words again.
          </Text>
          <View style={this.style.switchView}>
            <Switch
              onValueChange={this.toggleSwitch}
              trackColor={{ true: '#E30052' }}
              value={this.state.switchValue}
            />
            <Text style={this.style.switchText}>
              I want to reset my wallet, and I acknowledge that
              <Strong>all data will be wiped out</Strong>.
            </Text>
          </View>
          <View style={this.style.buttonView}>
            <NewHathorButton
              secondary
              color="#E30052"
              disabled={!this.state.switchValue}
              onPress={this.onPressResetWallet}
              title="Reset Wallet"
            />
          </View>
        </View>
      </SafeAreaView>
    );
  }
}

export default ResetWallet;
