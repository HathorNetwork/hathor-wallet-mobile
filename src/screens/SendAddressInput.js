import React from 'react';
import { KeyboardAvoidingView, SafeAreaView, View } from 'react-native';

import NewHathorButton from '../components/NewHathorButton';
import SimpleInput from '../components/SimpleInput';
import HathorHeader from '../components/HathorHeader';
import { getKeyboardAvoidingViewTopDistance, validateAddress } from '../utils';
import OfflineBar from '../components/OfflineBar';

import hathorLib from '@hathor/wallet-lib';


class SendAddressInput extends React.Component {
  /**
   * address {string} send tokens to this address
   * error {string} address validation error
   */
  constructor(props) {
    super(props);
    this.state = {
      // we can optionally receive a string to fill out the address input (for eg, user scanned QR code)
      address: this.props.navigation.getParam('address', null),
      //TODO this is probably temporary. We don't have the UI for error message yet.
      error: null,
    };
  }

  onAddressChange = (text) => {
    this.setState({ address: text, error: null });
  }

  onButtonPress = () => {
    const validation = validateAddress(this.state.address);
    if (validation.isValid) {
      this.props.navigation.navigate('SendAmountInput', {address: this.state.address});
    } else {
      this.setState({ error: validation.message });
    }
  }

  render() {
    return (
      <SafeAreaView style={{ flex: 1 }}>
        <HathorHeader
          title="SEND" 
          onBackPress={() => this.props.navigation.goBack()}
        />
        <KeyboardAvoidingView behavior='padding' style={{ flex: 1 }} keyboardVerticalOffset={getKeyboardAvoidingViewTopDistance()}>
          <View style={{ flex: 1, padding: 16, justifyContent: 'space-between' }}>
            <SimpleInput
              label='Address to send'
              autoFocus={true}
              onChangeText={this.onAddressChange}
              error={this.state.error}
              value={this.state.address}
            />
            <NewHathorButton
              title="Next"
              disabled={this.state.address ? false : true}
              onPress={this.onButtonPress}
            />
          </View>
          <OfflineBar style={{position: 'relative'}} />
        </KeyboardAvoidingView>
      </SafeAreaView>
    );
  }
}

export default SendAddressInput;
