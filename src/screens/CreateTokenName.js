/**
 * Copyright (c) Hathor Labs and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import React from 'react';
import { KeyboardAvoidingView, SafeAreaView, View } from 'react-native';

import NewHathorButton from '../components/NewHathorButton';
import SimpleInput from '../components/SimpleInput';
import HathorHeader from '../components/HathorHeader';
import { getKeyboardAvoidingViewTopDistance } from '../utils';
import OfflineBar from '../components/OfflineBar';


class CreateTokenName extends React.Component {
  /**
   * name {string} token name
   */
  state = {
    name: null,
  }

  onNameChange = (text) => {
    this.setState({ name: text });
  }

  onButtonPress = () => {
    this.props.navigation.navigate('CreateTokenSymbol', { name: this.state.name });
  }

  render() {
    return (
      <SafeAreaView style={{ flex: 1 }}>
        <HathorHeader
          title='CREATE TOKEN'
          onBackPress={() => this.props.navigation.pop()}
        />
        <KeyboardAvoidingView behavior='padding' style={{ flex: 1 }} keyboardVerticalOffset={getKeyboardAvoidingViewTopDistance()}>
          <View style={{ flex: 1, padding: 16, justifyContent: 'space-between' }}>
            <SimpleInput
              label='Token Name'
              autoFocus
              onChangeText={this.onNameChange}
              value={this.state.name}
            />
            <NewHathorButton
              title='Next'
              disabled={!this.state.name}
              onPress={this.onButtonPress}
            />
          </View>
          <OfflineBar style={{ position: 'relative' }} />
        </KeyboardAvoidingView>
      </SafeAreaView>
    );
  }
}

export default CreateTokenName;
