/**
 * Copyright (c) Hathor Labs and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import React from 'react';
import { StyleSheet, View, Text } from 'react-native';
import { connect } from 'react-redux';
import { getStatusBarHeight } from 'react-native-status-bar-height';
import { t } from 'ttag';
import { ERROR_BG_COLOR } from '../constants';

/**
 * isOnline {bool} Indicates whether the wallet is connected.
 * */
const mapStateToProps = (state) => ({
  isOnline: state.isOnline,
});

class OfflineBar extends React.Component {
  style = StyleSheet.create({
    view: {
      backgroundColor: ERROR_BG_COLOR,
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
      style.push({ top: getStatusBarHeight() });
    } else {
      style.push({ bottom: 0 });
    }
    return (
      <View style={[...style, this.props.style]}>
        <Text style={this.style.text}>{t`No internet connection`}</Text>
      </View>
    );
  }
}

export default connect(mapStateToProps)(OfflineBar);
