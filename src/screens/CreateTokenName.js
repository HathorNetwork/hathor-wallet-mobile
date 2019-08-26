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
            <View>
              <InfoBox
                items={[
                  <Text>Token name should be the full name of the new token you are creating</Text>,
                  <Italic>E.g. Hathor</Italic>
                ]}
              />
              <NewHathorButton
                title='Next'
                disabled={!this.state.name}
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

export default CreateTokenName;
