import React from 'react';
import { Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

const SimpleButton = props => {
  const renderTitle = () => {
    if (props.title) {
      return <Text style={[styles.text, props.textStyle]}>{props.title}</Text>
    }

    return null;
  }

  const renderIcon = () => {
    if (props.icon) {
      return (
        <View style={[styles.icon, props.iconStyle]}>
          <Image source={props.icon} />
        </View>
      )
    }

    return null;
  }

  return (
    <TouchableOpacity onPress={props.onPress} style={[styles.container, props.ContainerStyle]}>
      {renderTitle()}
      {renderIcon()}
    </TouchableOpacity>
  )
}

const styles = StyleSheet.create({
  container: {
    justifyContent: 'center',
  },
  text: {
    fontSize: 14,
    color: '#E30052',
  },
  icon: {
    justifyContent: 'center',
    alignItems: 'center',
    width: 24,
    height: 24,
  },
});

export default SimpleButton;
