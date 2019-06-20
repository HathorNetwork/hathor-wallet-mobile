import React from 'react';
import {
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

export default class TextField extends React.Component {
  style = StyleSheet.create({
    view: {
      marginTop: 16,
      marginBottom: 16,
    },
    label: {
      fontSize: 12,
      color: 'rgba(0, 0, 0, 0.5)',
      marginTop: 8,
      marginBottom: 8,
    },
    input: {
      fontSize: 16,
      lineHeight: 24,
      borderColor: '#EEEEEE',
      borderBottomWidth: 1,
    },
  });

  getTextInput() {
    return (
      <TextInput
        keyboardAppearance='dark'
        style={this.style.input}
        blurOnSubmit={true}
        returnKeyType="done"
        clearButtonMode="while-editing"
        {...this.props}
      />
    );
  }

  render() {
    return (
      <View style={[ this.style.view, this.props.style ]}>
        <Text style={this.style.label}>{ this.props.label }</Text>
        { this.props.input || this.getTextInput() }
      </View>
    );
  }
}

