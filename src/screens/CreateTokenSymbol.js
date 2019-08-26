/**
 * Copyright (c) Hathor Labs and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import React from 'react';
import { KeyboardAvoidingView, SafeAreaView, Text, View } from 'react-native';

import HathorHeader from '../components/HathorHeader';
import InfoBox from '../components/InfoBox';
import NewHathorButton from '../components/NewHathorButton';
import OfflineBar from '../components/OfflineBar';
import SimpleInput from '../components/SimpleInput';
import { getKeyboardAvoidingViewTopDistance, Italic } from '../utils';


/**
 * This screen expect the following parameters on the navigation:
 * name {string} token name
 */
class CreateTokenSymbol extends React.Component {
  /**
   * symbol {string} token symbol
   */
  state = {
    symbol: null,
  }

  onSymbolChange = (text) => {
    // limit to 5 chars
    if (text.length > 5) return;
    this.setState({ symbol: text });
  }

  onButtonPress = () => {
    const name = this.props.navigation.getParam('name');
    this.props.navigation.navigate('CreateTokenAmount', { name, symbol: this.state.symbol });
  }

  isButtonDisabled = () => {
    if (!this.state.symbol) {
      return true;
    }

    if (this.state.symbol.length < 2) {
      return true;
    }

    return false;
  }

  render() {
    return (
      <SafeAreaView style={{ flex: 1 }}>
        <HathorHeader
          title='CREATE TOKEN'
          onBackPress={() => this.props.navigation.goBack()}
        />
        <KeyboardAvoidingView behavior='padding' style={{ flex: 1 }} keyboardVerticalOffset={getKeyboardAvoidingViewTopDistance()}>
          <View style={{ flex: 1, padding: 16, justifyContent: 'space-between' }}>
            <SimpleInput
              label='Token symbol'
              autoFocus
              autoCapitalize='characters'
              subtitle='Maximum of 5 characters'
              onChangeText={this.onSymbolChange}
              value={this.state.symbol}
            />
            <View>
              <InfoBox
                items={[
                  <Text>
                    This is a smaller version of the token name. Symbols can{' '}
                    have between 2 and 5 characters.
                  </Text>,
                  <Italic>E.g. HTR</Italic>
                ]}
              />
              <NewHathorButton
                title='Next'
                disabled={this.isButtonDisabled()}
                onPress={this.onButtonPress}
              />
            </View>
          </View>
          <OfflineBar style={{ position: 'relative' }} />
        </KeyboardAvoidingView>
      </SafeAreaView>
    );
  }
}

export default CreateTokenSymbol;
