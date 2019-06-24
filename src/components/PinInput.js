import React from 'react';
import { Platform, Text, StyleSheet, TextInput, View } from 'react-native';

class PinInput extends React.Component {
  static defaultProps = {
    color: 'black',
  };

  inputRef = React.createRef();

  style = StyleSheet.create({
    view: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignSelf: 'stretch',
    },
    textInput: {
      position: 'absolute',
      top: -999,
      left: -999,
      color: 'red',
      backgroundColor: 'red',
    },
    marker: {
      width: 24,
      height: 24,
      borderRadius: 12,
      borderWidth: 1,
      margin: 8,
    },
  });

  getMarker(index, isFilled) {
    const style = [this.style.marker, {borderColor: this.props.color}];
    if (isFilled) {
      style.push({backgroundColor: this.props.color});
    }
    return (
      <View key={index} style={style}></View>
    );
  }

  getMarkers(qty, total) {
    v = [];
    for (let i=0; i<total; i++) {
      v.push(this.getMarker(i, i < qty));
    }
    return v;
  }

  onBlur = () => {
    if (this.refs.textInput && this.props.editable) {
      this.focus();
    }
  }

  focus = () => {
    this.inputRef.current.focus();
  }

  render() {
    const value = this.props.value;
    const maxLength = this.props.maxLength;
    const returnKeyType = (Platform.OS === 'ios' ? 'default' : 'none');
    // TextInput cannot receive color props
    const { color, ...textInputProps } = this.props;
    return (
      <View style={this.props.style}>
        <View style={this.style.view}>
          {this.getMarkers(value.length, maxLength)}
        </View>
        <TextInput
          style={this.style.textInput}
          keyboardType='number-pad'
          secureTextEntry={true}
          keyboardAppearance='dark'
          returnKeyType={returnKeyType}
          onBlur={this.onBlur}
          ref={this.inputRef}
          {...textInputProps}
        />
      </View>
    );
  }
}

export default PinInput;
