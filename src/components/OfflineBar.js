import React from 'react';
import { StyleSheet, Keyboard, View, Text } from 'react-native';
import { connect } from 'react-redux';
import { getStatusBarHeight } from 'react-native-status-bar-height';

/**
 * isOnline {bool} Indicates whether the wallet is connected.
 **/
const mapStateToProps = (state) => ({
  isOnline: state.isOnline,
})

class OfflineBar extends React.Component {
  style = StyleSheet.create({
    view: {
      backgroundColor: '#DE3535',
      position: 'absolute',
      left: 0,
      padding: 5,
      width: '100%',
      justifyContent: 'center',
      alignItems: 'center',
      height: 24,
    },
    text: {
      fontSize: 14,
      fontWeight: 'bold',
      color: 'white',
    },
  });

  render() {
    if (this.props.isOnline) {
      return null;
    }
    const style = [this.style.view];
    if (this.props.position === 'top') {
      style.push({top: getStatusBarHeight()});
    } else {
      style.push({bottom: 0});
    }
    return (
      <View style={[...style, this.props.style]}>
        <Text style={this.style.text}>No internet connection</Text>
      </View>
    );
  }
};

export default connect(mapStateToProps)(OfflineBar)
