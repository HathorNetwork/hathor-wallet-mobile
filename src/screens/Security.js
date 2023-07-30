/**
 * Copyright (c) Hathor Labs and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import React from 'react';
import {
  StyleSheet,
  View,
  Switch,
} from 'react-native';
import { connect } from 'react-redux';
import { t } from 'ttag';

import HathorHeader from '../components/HathorHeader';
import baseStyle from '../styles/init';
import {
  isBiometryEnabled, setBiometryEnabled, getSupportedBiometry,
} from '../utils';
import { HathorList, ListItem, ListMenu } from '../components/HathorList';
import { lockScreen } from '../actions';
import { LIGHT_BG_COLOR } from '../constants';

const mapDispatchToProps = (dispatch) => ({
  lockScreen: () => dispatch(lockScreen()),
});

export class Security extends React.Component {
  style = ({ ...baseStyle,
    ...StyleSheet.create({
      view: {
        padding: 16,
        justifyContent: 'space-between',
      },
      logo: {
        height: 30,
        width: 170,
      },
      logoView: {
        marginTop: 16,
        marginBottom: 16,
      },
    }) });

  constructor(props) {
    super(props);
    /**
     * supportedBiometry {str} Type of biometry supported
     */
    this.supportedBiometry = getSupportedBiometry();

    /**
     * biometryEnabled {boolean} If user enabled biometry. If no biometry support, always false
     */
    this.state = {
      biometryEnabled: this.supportedBiometry && isBiometryEnabled(),
    };
  }

  onBiometrySwitchChange = (value) => {
    this.setState({ biometryEnabled: value });
    setBiometryEnabled(value);
  }

  onLockWallet = () => {
    this.props.lockScreen();
  }

  render() {
    const switchDisabled = !this.supportedBiometry;
    const biometryText = (switchDisabled ? t`No biometry supported` : t`Use ${this.supportedBiometry}`);
    return (
      <View style={{ flex: 1, backgroundColor: LIGHT_BG_COLOR }}>
        <HathorHeader
          title={t`SECURITY`}
          onBackPress={() => this.props.navigation.goBack()}
        />
        <HathorList>
          <ListItem
            title={biometryText}
            // if no biometry is supported, use default ListItem color (grey),
            // so it looks disabled. Else, color is black, as other items
            titleStyle={!switchDisabled ? { color: 'black' } : null}
            text={(
              <Switch
                onValueChange={this.onBiometrySwitchChange}
                value={this.state.biometryEnabled}
                disabled={switchDisabled}
              />
            )}
            isFirst
          />
          <ListMenu
            title={t`Change PIN`}
            onPress={() => this.props.navigation.navigate('ChangePin')}
          />
          <ListMenu
            title={t`Lock wallet`}
            onPress={this.onLockWallet}
            isLast
          />
        </HathorList>
      </View>
    );
  }
}

export default connect(null, mapDispatchToProps)(Security);
