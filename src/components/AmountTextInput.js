import React from 'react';
import { StyleSheet, TextInput } from 'react-native';
import { getAmountParsed, getNoDecimalsAmount } from '../utils';

class AmountTextInput extends React.Component {
  constructor(props) {
    super(props);

    this.inputRef = React.createRef();
  }

  focus = () => {
    this.inputRef.current.focus();
  }

  onChangeText = (text) => {
    if (text === '') {
      // Need to handle empty string separately
      this.props.onAmountUpdate(text);
      return;
    }

    const parsedText = getAmountParsed(text);
    const amount = getNoDecimalsAmount(parseFloat(parsedText.replace(',', '.')));
    if (isNaN(amount) || amount < 0) {
      return;
    }

    this.props.onAmountUpdate(parsedText);
  }

  render() {
    const {style: customStyle, ...props} = this.props;
    return (
      <TextInput
        ref={this.inputRef}
        style={[style.input, customStyle]}
        onChangeText={this.onChangeText}
        textAlign='center'
        textAlignVertical='bottom'
        keyboardAppearance='dark'
        keyboardType="numeric"
        placeholder="0.00"
        {...props}
      />
    )
  }
}

const style = StyleSheet.create({
  input: {
    height: 38,
    lineHeight: 38,
    fontSize: 32,
    fontWeight: 'bold',
    paddingVertical: 0
  }
});

export default AmountTextInput;
