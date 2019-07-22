import React from 'react';
import { KeyboardAvoidingView, SafeAreaView, View } from 'react-native';

import NewHathorButton from '../components/NewHathorButton';
import SimpleInput from '../components/SimpleInput';
import HathorHeader from '../components/HathorHeader';
import { getKeyboardAvoidingViewTopDistance } from '../utils';
import OfflineBar from '../components/OfflineBar';


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
            <NewHathorButton
              title='Next'
              disabled={!this.state.symbol}
              onPress={this.onButtonPress}
            />
          </View>
          <OfflineBar style={{ position: 'relative' }} />
        </KeyboardAvoidingView>
      </SafeAreaView>
    );
  }
}

export default CreateTokenSymbol;
