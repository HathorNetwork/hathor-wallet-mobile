import React from 'react';
import { KeyboardAvoidingView, SafeAreaView, View } from 'react-native';
import { getStatusBarHeight } from 'react-native-status-bar-height';

import NewHathorButton from '../components/NewHathorButton';
import AmountTextInput from '../components/AmountTextInput';
import InputLabel from '../components/InputLabel';
import HathorHeader from '../components/HathorHeader';
import { getIntegerAmount } from '../utils';
import OfflineBar from '../components/OfflineBar';


/**
 * This screen expect the following parameters on the navigation:
 * name {string} token name
 * symbol {string} token symbol
 */
class CreateTokenAmount extends React.Component {
  /**
   * amount {string} amount of tokens to create
   */
  state = {
    amount: '',
  };

  constructor(props) {
    super(props);
    this.inputRef = React.createRef();
    this.willFocusEvent = null;
    this.name = this.props.navigation.getParam('name');
  }

  componentDidMount() {
    this.willFocusEvent = this.props.navigation.addListener('willFocus', () => {
      this.focusInput();
    });
  }

  componentWillUnmount() {
    this.willFocusEvent.remove();
  }

  focusInput = () => {
    if (this.inputRef.current) {
      this.inputRef.current.focus();
    }
  }

  onAmountChange = (text) => {
    this.setState({ amount: text });
  }

  onButtonPress = () => {
    const amount = getIntegerAmount(this.state.amount);
    const name = this.props.navigation.getParam('name');
    const symbol = this.props.navigation.getParam('symbol');
    this.props.navigation.navigate('CreateTokenConfirm', { name, symbol, amount });
  }

  isButtonDisabled = () => {
    if (this.state.amount === '') {
      return true;
    }
    if (getIntegerAmount(this.state.amount) === 0) {
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
        <KeyboardAvoidingView behavior='padding' style={{ flex: 1 }} keyboardVerticalOffset={getStatusBarHeight()}>
          <View style={{ flex: 1, padding: 16, justifyContent: 'space-between' }}>
            <View style={{ marginTop: 40 }}>
              <InputLabel style={{ textAlign: 'center', marginBottom: 16 }}>
                {`Amount of ${this.name}`}
              </InputLabel>
              <AmountTextInput
                ref={this.inputRef}
                autoFocus
                onAmountUpdate={this.onAmountChange}
                value={this.state.amount}
              />
            </View>
            <NewHathorButton
              title='Next'
              disabled={this.isButtonDisabled()}
              onPress={this.onButtonPress}
            />
          </View>
          <OfflineBar style={{ position: 'relative' }} />
        </KeyboardAvoidingView>
      </SafeAreaView>
    );
  }
}

export default CreateTokenAmount;
