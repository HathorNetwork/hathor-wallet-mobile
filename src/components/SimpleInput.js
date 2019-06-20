import React from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';

import InputLabel from './InputLabel';

const SimpleInput = props => {
  const renderInput = () => {
    return (
      <View style={[styles.inputContainer, props.textInputStyle]}>
        <TextInput
          {...props}
          style={styles.input}
          keyboardAppearance='dark'
          autoCapitalize='none'
          autoCorrect={false}
          spellCheck={false}
          autoCompleteType='off'
          underlineColorAndroid='transparent'
        />
      </View>
    )
  }

  const renderText = () => {
    return <Text selectable={true} style={styles.text}>{props.value}</Text>;
  }

  return (
    <View style={props.containerStyle}>
      {props.label && 
        <InputLabel style={[styles.label, props.inputStyle]}>
          {props.label}
        </InputLabel>
      }
      {/* If input is not editable, render only Text so we can select
        * it. If we used TextInput with editable=false, we would not
        * be able to select the text
        */}
      {props.editable === false ? renderText() : renderInput()}
      <Text style={styles.error}>{props.error}</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  inputContainer: {
    borderBottomWidth: 1,
    borderColor: '#eee',
    paddingBottom: 8,
  },
  input: {
    lineHeight: 16,
    padding: 0,
    fontSize: 14,
  },
  text: {
    color: 'black',
    fontSize: 14
  },
  label: {
    marginBottom: 12,
  },
  error: {
    marginTop: 8,
    fontSize: 12,
    //TODO define better color. Maybe also change underline color to red?
    color: 'red',
  },
});

export default SimpleInput;
