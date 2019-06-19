import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

const NewHathorButton = props => {
  const wrapperViewStyle = [style.wrapper];
  const textStyle = [style.text];
  if (props.disabled) {
    wrapperViewStyle.push(style.wrapperDisabled);
    textStyle.push(style.textDisabled);
  }

  return (
    <View style={[...wrapperViewStyle, props.wrapperStyle]}>
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
    flexDirection: 'row',
    flex: 1,
  },
  wrapperDisabled: {
    backgroundColor: 'rgba(0,0,0,0.1)'
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
  textDisabled: {
    color: 'rgba(0,0,0,0.5)',
  }
});

export default NewHathorButton;
