import React from 'react';
import { Text, StyleSheet, View } from 'react-native';

import NumPad from './NumPad';

class PinInput extends React.Component {
  static defaultProps = {
    color: 'black',
  };

  getMarker = (index, isFilled) => {
    const markerStyle = [styles.marker, { borderColor: this.props.color }];
    if (isFilled) {
      markerStyle.push({ backgroundColor: this.props.color });
    }
    return (
      <View key={index} style={markerStyle} />
    );
  }

  getMarkers = (qty, total) => {
    const v = [];
    for (let i = 0; i < total; i += 1) {
      v.push(this.getMarker(i, i < qty));
    }
    return v;
  }

  render() {
    const { value, maxLength } = this.props;

    return (
      <View style={styles.container}>
        <View style={{ alignItems: 'center' }}>
          <View style={styles.markers}>
            {this.getMarkers(value.length, maxLength)}
          </View>
          <Text style={styles.error}>
            {this.props.error}
          </Text>
        </View>
        <NumPad onChangeText={this.props.onChangeText} value={value} />
      </View>
    );
  }
}

const styles = StyleSheet.create({
  markers: {
    flexDirection: 'row',
    justifyContent: 'center',
  },
  marker: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 1,
    margin: 8,
  },
  error: {
    color: '#DE3535',
    marginTop: 8,
    height: 18,
  },
  container: {
    flex: 1,
    width: '100%',
    justifyContent: 'space-between',
  },
});

export default PinInput;
