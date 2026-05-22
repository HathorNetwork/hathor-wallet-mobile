/**
 * Copyright (c) Hathor Labs and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import React from 'react';
import {
  StyleSheet,
  Text,
  View,
  Switch,
} from 'react-native';
import { t } from 'ttag';

import * as Keychain from 'react-native-keychain';
import { connect } from 'react-redux';

import HathorHeader from '../components/HathorHeader';
import NewHathorButton from '../components/NewHathorButton';
import TextFmt from '../components/TextFmt';
import baseStyle from '../styles/init';
import { PRIMARY_COLOR } from '../constants';
import { COLORS } from '../styles/themes';
import { dropResetOnLockScreen, resetWallet } from '../actions';
import { isSingleKeyWallet } from '../selectors';

/**
 * isScreenLocked {bool} check if is in lock screen state
 * isWeb3Auth {bool} check if wallet is web3auth type
 * email {string} web3auth email address
 */
const mapStateToProps = (state) => ({
  isScreenLocked: state.lockScreen,
  isWeb3Auth: isSingleKeyWallet(state),
  email: state.web3authEmail,
});

const mapDispatchToProps = (dispatch) => ({
  resetWallet: () => dispatch(resetWallet()),
  dropResetOnLockScreen: () => dispatch(dropResetOnLockScreen()),
});

class ResetWallet extends React.Component {
  style = ({ ...baseStyle,
    ...StyleSheet.create({
      switchView: {
        flexDirection: 'row',
      },
      switchText: {
        paddingLeft: 16,
        fontSize: 14,
        lineHeight: 18,
        flex: 1,
      },
      accountCard: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 12,
        paddingVertical: 8,
        backgroundColor: COLORS.lowContrastDetail,
        borderRadius: 8,
        marginVertical: 12,
      },
      avatar: {
        width: 26,
        height: 26,
        borderRadius: 13,
        backgroundColor: COLORS.primary,
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 8,
      },
      avatarText: {
        color: COLORS.white,
        fontWeight: '700',
        fontSize: 12,
      },
      accountInfo: {
        flex: 1,
      },
      accountEmail: {
        fontWeight: '700',
        fontSize: 14,
      },
      accountProvider: {
        color: COLORS.midContrastDetail,
        fontSize: 12,
      },
    }) });

  willReset: false;

  /**
   * switchValue {bool}
   *   Indicates whether user wants to reset his/her wallet. It enables the Reset Wallet button.
   * */
  state = {
    switchValue: false,
  };

  constructor(props) {
    super(props);
    if (this.props.isScreenLocked) {
      this.onBackPress = this.props.dropResetOnLockScreen;
    } else {
      this.onBackPress = this.props.route.params?.onBackPress ?? this.props.navigation.goBack;
    }

    this.hideBackButton = false;
    if (this.props.route) {
      this.hideBackButton = this.props.route.params?.hideBackButton ?? false;
    }
  }

  toggleSwitch = (value) => {
    this.setState({ switchValue: value });
  }

  onPressResetWallet = async () => {
    // Setting the flag for the actions that will be performed on unmounting
    this.willReset = true;
    this.props.navigation.reset({
      index: 0,
      routes: [{ name: 'Init' }],
    });
  }

  componentWillUnmount() {
    // The following commands will destroy local storage information that would break the
    // expectations of the screens that are still mounted on the navigation history stack.
    // Executing them only after all the stack is already reset on `onPressResetWallet`
    if (this.willReset) {
      this.props.resetWallet();
      Keychain.resetGenericPassword();
    }
  }

  render() {
    return (
      <View style={{ flex: 1 }}>
        <HathorHeader
          title={t`RESET WALLET`}
          onBackPress={this.hideBackButton ? null : () => this.onBackPress()}
        />
        {this.props.isWeb3Auth ? this.renderWeb3Auth() : this.renderHd()}
      </View>
    );
  }

  renderHd() {
    return (
      <View style={this.style.container}>
        <Text style={this.style.title}>{t`Are you sure?`}</Text>
        <Text style={this.style.text}>
          <TextFmt>
            {t`If you reset your wallet, **all data will be deleted**, and you will **lose access to your tokens**.`}
          </TextFmt>
          {' '}{t`To recover access to your tokens, you will need to import your seed words again.`}
        </Text>
        <View style={this.style.switchView}>
          <Switch
            onValueChange={this.toggleSwitch}
            trackColor={{ true: PRIMARY_COLOR }}
            value={this.state.switchValue}
          />
          <TextFmt style={this.style.switchText}>
            {t`I want to reset my wallet, and I acknowledge that **all data will be wiped out**.`}
          </TextFmt>
        </View>
        <View style={this.style.buttonView}>
          <NewHathorButton
            secondary
            color={PRIMARY_COLOR}
            disabled={!this.state.switchValue}
            onPress={this.onPressResetWallet}
            title={t`Reset Wallet`}
          />
        </View>
      </View>
    );
  }

  renderWeb3Auth() {
    const initial = (this.props.email || '?')[0].toUpperCase();
    return (
      <View style={this.style.container}>
        <Text style={this.style.title}>{t`Sign out of your wallet?`}</Text>
        <Text style={this.style.text}>{t`You're signed in as:`}</Text>
        <View style={this.style.accountCard}>
          <View style={this.style.avatar}>
            <Text style={this.style.avatarText}>{initial}</Text>
          </View>
          <View style={this.style.accountInfo}>
            <Text style={this.style.accountEmail}>{this.props.email}</Text>
            <Text style={this.style.accountProvider}>{t`via Google`}</Text>
          </View>
        </View>
        <Text style={this.style.text}>
          {t`Signing out will disconnect your account and erase local wallet data from this device.`}
        </Text>
        <Text style={this.style.text}>
          <TextFmt>
            {t`You'll be able to sign back in with the same social account to restore access **as long as you still have your recovery factors**.`}
          </TextFmt>
        </Text>
        <View style={this.style.switchView}>
          <Switch
            onValueChange={this.toggleSwitch}
            trackColor={{ true: PRIMARY_COLOR }}
            value={this.state.switchValue}
          />
          <Text style={this.style.switchText}>
            {t`I understand local data will be erased, and I have my recovery factors saved.`}
          </Text>
        </View>
        <View style={this.style.buttonView}>
          <NewHathorButton
            color={PRIMARY_COLOR}
            disabled={!this.state.switchValue}
            onPress={this.onPressResetWallet}
            title={t`Sign out`}
          />
        </View>
      </View>
    );
  }
}

export default connect(mapStateToProps, mapDispatchToProps)(ResetWallet);
