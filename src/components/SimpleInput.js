import React from 'react';
import {
  StyleSheet, Text, TextInput, View,
} from 'react-native';

import InputLabel from './InputLabel';

const SimpleInput = (props) => {
  const getInputField = () => (
    <TextInput
      {...props}
      style={styles.input}
      keyboardAppearance="dark"
      autoCapitalize="none"
      autoCorrect={false}
      spellCheck={false}
      autoCompleteType="off"
      underlineColorAndroid="transparent"
    />
  );

  const renderInput = () => (
    <View style={[styles.inputContainer, props.textInputStyle]}>
      { props.input || getInputField() }
    </View>
  );

  const renderText = () => <Text selectable style={styles.text}>{props.value}</Text>;

  const renderError = () => {
    if (props.error) {
      return <Text style={styles.error}>{props.error}</Text>;
    }

    return null;
  };

  return (
    <View style={props.containerStyle}>
      {props.label
        && (
        <InputLabel style={[styles.label, props.inputStyle]}>
          {props.label}
        </InputLabel>
        )
      }
      {/* If input is not editable, render only Text so we can select
        * it. If we used TextInput with editable=false, we would not
        * be able to select the text
        */}
      {props.editable === false ? renderText() : renderInput()}
      {renderError()}
    </View>
  );
};

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
    fontSize: 14,
  },
  label: {
    marginBottom: 12,
  },
  error: {
    marginTop: 8,
    fontSize: 12,
    // TODO define better color. Maybe also change underline color to red?
    color: 'red',
  },
});

export default SimpleInput;
