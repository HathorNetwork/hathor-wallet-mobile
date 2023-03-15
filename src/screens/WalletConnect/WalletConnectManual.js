/**
 * Copyright (c) Hathor Labs and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import React from 'react';
import { useDispatch } from 'react-redux';
import {
  KeyboardAvoidingView,
  SafeAreaView,
  View,
} from 'react-native';
import { t } from 'ttag';

import HathorHeader from '../../components/HathorHeader';
import SimpleInput from '../../components/SimpleInput';
import NewHathorButton from '../../components/NewHathorButton';
import { walletConnectQRCodeRead } from '../../actions';
import { getKeyboardAvoidingViewTopDistance } from '../../utils';
import { useState } from 'react';

export default function WalletConnectList({ navigation }) {
  const [errorMessage, setErrorMessage] = useState('');
  const [configString, setConfigString] = useState('');

  const dispatch = useDispatch();

  const onConfigStringChange = () => {};
  const onButtonPress = () => {
    dispatch(walletConnectQRCodeRead(configString));
    navigation.navigate('WalletConnectList');
  };

  return (
    <SafeAreaView style={{ flex: 1 }}>
      <KeyboardAvoidingView behavior='padding' style={{ flex: 1 }} keyboardVerticalOffset={getKeyboardAvoidingViewTopDistance()}>
        <HathorHeader
          withBorder
          title={t`Manual WalletConnect`}
          onBackPress={() => navigation.goBack()}
        />
        <View style={{ flex: 1, padding: 16, justifyContent: 'space-between' }}>
          <View>
            <SimpleInput
              label={t`Wallet Connect URI`}
              autoFocus
              multiline
              onChangeText={setConfigString}
              error={errorMessage}
              value={configString}
              returnKeyType='done'
              enablesReturnKeyAutomatically
              blurOnSubmit
              onSubmitEditing={() => Keyboard.dismiss()}
            />
          </View>
          <NewHathorButton
            title={t`Connect`}
            disabled={configString === '' || errorMessage !== ''}
            onPress={onButtonPress}
          />
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
