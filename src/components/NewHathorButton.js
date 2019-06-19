import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

const NewHathorButton = props => {
  const wrapperViewStyle = [style.wrapper];
  const textStyle = [style.text];
  if (props.disabled) {
    wrapperViewStyle.push(style.wrapperDisabled);
    textStyle.push(style.textDisabled);
  }

  if (props.secondary && !props.disabled) {
    wrapperViewStyle.push(style.wrapperSecondary);
    textStyle.push(style.textSecondary);
  }

  return (
    <View style={[...wrapperViewStyle, props.wrapperStyle, props.style]}>
      <TouchableOpacity onPress={props.onPress} style={style.touchable} disabled={props.disabled}>
        <Text style={[...textStyle, props.textStyle]}>{props.title}</Text>
      </TouchableOpacity>
    </View>
  )
}

const style = StyleSheet.create({
  wrapper: {
    height: 48,
    borderRadius: 8,
    backgroundColor: '#000',
    alignSelf: 'stretch',
  },
  wrapperDisabled: {
    backgroundColor: 'rgba(0, 0, 0, 0.1)'
  },
  wrapperSecondary: {
    backgroundColor: '#fff',
    borderColor: '#000',
    borderWidth: 1.5,
  },
  touchable: {
    padding: 16,
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: {
    fontWeight: 'bold',
    fontSize: 14,
    textTransform: 'uppercase',
    color: '#fff',
    textAlign: 'center',
  },
  textSecondary: {
    color: '#000',
  },
  textDisabled: {
    color: 'rgba(0,0,0,0.5)',
  }
});

export default NewHathorButton;
