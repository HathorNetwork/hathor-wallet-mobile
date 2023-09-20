/**
 * Copyright (c) Hathor Labs and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import React from 'react';
import {
  Image, Text, StyleSheet, TouchableHighlight, View,
} from 'react-native';
import PropTypes from 'prop-types';

import backspace from '../assets/icons/backspace.png';
import { COLORS } from '../styles/themes';

const keysLayout = [
  [[1, ''], [2, 'ABC'], [3, 'DEF']],
  [[4, 'GHI'], [5, 'JKL'], [6, 'MNO']],
  [[7, 'PQRS'], [8, 'TUV'], [9, 'WXYZ']],
  [[null, null], [0, null], [-1, null]],
];

class NumPad extends React.Component {
  onPress = (number) => {
    if (number === null) return;
    let text;
    if (number === -1) {
      // backspace was pressed
      text = this.props.value.slice(0, -1);
    } else {
      text = this.props.value + number.toString();
    }
    this.props.onChangeText(text);
  }

  render() {
    const renderRow = (rowIndex) => (
      <View key={rowIndex} style={style.row}>
        {keysLayout[rowIndex].map((value, index) => {
          const number = value[0];
          let chars = value[1];
          if (chars !== null) {
            chars = chars.split('').join(' ');
          }
          return (
            <NumPadButton
              onPress={() => this.onPress(number)}
              key={number}
              number={number}
              chars={chars}
            />
          );
        })}
      </View>
    );

    const rows = [];
    for (let i = 0; i < keysLayout.length; i += 1) {
      rows.push(renderRow(i));
    }

    return (
      <View>
        {rows}
      </View>
    );
  }
}

NumPad.propTypes = {
  // The string typed on the numpad so far
  value: PropTypes.string.isRequired,

  // The function to execute when a button is pressed
  onChangeText: PropTypes.func.isRequired,
};

const NumPadButton = (props) => {
  // left bottom button is invisible, so should not have any background when clicked
  const underlayColor = (props.number !== null ? COLORS.textColorShadowLighter : 'transparent');
  return (
    <TouchableHighlight
      style={style.buttonStyle}
      onPress={props.onPress}
      underlayColor={underlayColor}
      activeOpacity={1}
    >
      <View style={{ alignItems: 'center' }}>
        {props.number === -1
          ? <Image source={backspace} />
          : <Text style={style.numberStyle}>{props.number}</Text>}
        {(props.chars !== null) && <Text style={style.charStyle}>{props.chars}</Text>}
      </View>
    </TouchableHighlight>
  );
};

NumPadButton.propTypes = {
  // The number to display on the button. It might be null for the
  // left bottom button (which is empty)
  number: PropTypes.number,

  // String to display under the number. It might be null for the buttons on the last row
  chars: PropTypes.string,

  // The function to execute when a button is pressed
  onPress: PropTypes.func.isRequired,
};

const style = StyleSheet.create({
  row: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  buttonStyle: {
    justifyContent: 'center',
    height: 56,
    width: '33%',
    marginVertical: 2,
  },
  numberStyle: {
    fontSize: 25,
    lineHeight: 28,
  },
  charStyle: {
    fontSize: 10,
    lineHeight: 12,
  },
});

export default NumPad;
