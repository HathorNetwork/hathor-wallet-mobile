/**
 * Copyright (c) Hathor Labs and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import React from 'react';
import { KeyboardAvoidingView, SafeAreaView, View, Clipboard } from 'react-native';
import { t } from 'ttag';

import NewHathorButton from '../components/NewHathorButton';
import SimpleInput from '../components/SimpleInput';
import SimpleButton from '../components/SimpleButton';
import HathorHeader from '../components/HathorHeader';
import { getKeyboardAvoidingViewTopDistance, validateAddress } from '../utils';
import OfflineBar from '../components/OfflineBar';
import pasteIcon from '../assets/icons/paste.png';


class SendAddressInput extends React.Component {
  /**
   * address {string} send tokens to this address
   * error {string} address validation error
   */
  constructor(props) {
    super(props);
    this.state = {
      // we can optionally receive a string to fill out the address
      // input (for eg, user scanned QR code)
      address: this.props.navigation.getParam('address', null),
      // TODO this is probably temporary. We don't have the UI for error message yet.
      error: null,
    };
  }

  onAddressChange = (text) => {
    this.setState({ address: text, error: null });
  }

  onPasteAddress = async () => {
    let pasteText = await Clipboard.getString();
    if (this.state.address.length === 0) {
      this.state.address = '';
    }
    pasteText = this.state.address + pasteText;
    this.setState({ address: pasteText, error: null });
  }

  onButtonPress = () => {
    const validation = validateAddress(this.state.address);
    if (validation.isValid) {
      this.props.navigation.navigate('SendAmountInput', { address: this.state.address });
    } else {
      this.setState({ error: validation.message });
    }
  }

  render() {
    return (
      <SafeAreaView style={{ flex: 1 }}>
        <HathorHeader
          withBorder
          title={t`SEND`}
          onBackPress={() => this.props.navigation.goBack()}
        />
        <KeyboardAvoidingView behavior='padding' style={{ flex: 1 }} keyboardVerticalOffset={getKeyboardAvoidingViewTopDistance()}>
          <View style={{ flex: 1, padding: 16, justifyContent: 'space-between' }}>
            <View style={{ flexDirection: 'row', padding: 16, width: '100%' }}>
              <SimpleInput
                label={t`Address to send`}
                autoFocus
                onChangeText={this.onAddressChange}
                error={this.state.error}
                value={this.state.address}
                containerStyle={{ flex: 1 }}
              />
              <SimpleButton
                icon={pasteIcon}
                onPress={this.onPasteAddress}
              />
            </View>
            <NewHathorButton
              title={t`Next`}
              disabled={!this.state.address}
              onPress={this.onButtonPress}
            />
          </View>
          <OfflineBar style={{ position: 'relative' }} />
        </KeyboardAvoidingView>
      </SafeAreaView>
    );
  }
}

export default SendAddressInput;
