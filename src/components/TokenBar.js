import React from 'react';
import { Platform, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { connect } from 'react-redux';
import RNPickerSelect from 'react-native-picker-select';
import { getTokenLabel } from '../utils';


class TokenBar extends React.Component {
  /**
   * chosenValue {string} value selected on picker (in iOS this value changes while changing the picker value, before clicking Done)
   * selected {string} selected token, after Done in both iOS and android
   * label {string} string to show on bar element
   */
  state = {
    chosenValue: '', // We need to store this because in iOS we change the value while selecting
    selected: '',
    label: '',
  }

  componentDidMount() {
    this.updateSelectedToken(this.props.defaultSelected);
  }

  getChosenToken = () => {
    return this.props.tokens.find((token) => token.uid === this.state.chosenValue);
  }

  updateLabel = () => {
    const chosenToken = this.getChosenToken();
    if (chosenToken) {
      this.setState({ label: this.props.shortLabel ? chosenToken.symbol : getTokenLabel(chosenToken) })
    }
  }

  updateSelectedToken = (value) => {
    this.setState({ chosenValue: value, selected: value }, () => {
      this.updateLabel();
    });
  }

  tokenChanged = () => {
    // If we are selecting the same of the last selection we don't need to do anything
    if (this.state.selected === this.state.chosenValue) {
      return;
    }

    this.setState({ selected: this.state.chosenValue }, () => {
      this.updateLabel();
    });

    const chosenToken = this.getChosenToken();
    this.props.onChange(chosenToken);
  }

  valueChanged = (value) => {
    this.setState({ chosenValue: value }, () => {
      if (Platform.OS === 'android') {
        // On iOS we only change the token when clicking the 'Done' button
        this.tokenChanged();
      }
    });
  }

  dismissModal = () => {
    // This is executed only in iOS when the picker modal closes
    // In case we have changed the value but didn't click the 'Done' button, we change the value back
    if (this.state.selected !== this.state.chosenValue) {
      this.setState({ chosenValue: this.state.selected });
    }
  }

  render() {
    let inputPadding = 0;

    if (this.props.icon) {
      inputPadding = 30;
    }

    const pickerSelectStyles = StyleSheet.create({
      inputPicker: {
        display: 'none'
      },
      input: {
        fontSize: 16,
        fontWeight: 'bold',
        paddingRight: inputPadding, // to ensure the text is never behind the icon
        color: 'black',
      },
      doneButton: {
        color: '#0273a0',
      },
      iconContainer: {
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        height: '100%',
      }
    });

    const style = StyleSheet.create({
      wrapper: {
        paddingHorizontal: this.props.shortLabel ? 0 : 16,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        height: 44,
        flexDirection: 'row',
        width: '100%'
      },
    });

    const tokens = this.props.tokens.map((token) => {
      return {
        label: this.props.shortLabel ? token.symbol : getTokenLabel(token),
        value: token.uid,
        ...token
      }
    });

    const renderPicker = () => {
      if (tokens.length === 0) return null;

      return (
        <RNPickerSelect
          placeholder={{}}
          ref={(el) => this.pickerElement = el}
          useNativeAndroidPickerStyle={false}
          value={this.state.chosenValue}
          onValueChange={this.valueChanged}
          modalProps={{ animationType: 'slide' }}
          doneText='Change'
          style={{
            inputIOS: pickerSelectStyles.inputPicker,
            inputAndroid: pickerSelectStyles.input,
            viewContainer: this.props.containerStyle,
            iconContainer: pickerSelectStyles.iconContainer,
            done: pickerSelectStyles.doneButton,
            inputIOSContainer: this.props.inputContainer ? this.props.inputContainer : null
          }}
          onDonePress={this.tokenChanged}
          items={tokens}
          Icon={() => {
            return this.props.icon ? this.props.icon : null;
          }}
          modalProps={
            {
              onDismiss: this.dismissModal,
              animationType: 'slide'
            }
          }
        />
      )
    }

    return (
      <View style={style.wrapper}>
        <View style={[{display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'row' }, this.props.wrapperStyle]}>
          <Text onPress={() => this.pickerElement.togglePicker()} style={[pickerSelectStyles.input, {display: Platform.OS === 'ios' ? 'flex' : 'none'}]}>{this.state.label}</Text>
          {renderPicker()}
        </View>
      </View>
    )
  }
}


export default TokenBar;