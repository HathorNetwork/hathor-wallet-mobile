/**
 * Copyright (c) Hathor Labs and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import React, { useState } from 'react';
import { KeyboardAvoidingView, View } from 'react-native';
import { t } from 'ttag';
import { Network } from '@hathor/wallet-lib';
import { useSelector } from 'react-redux';
import { useNavigation, useRoute } from '@react-navigation/native';

import NewHathorButton from '../components/NewHathorButton';
import SimpleInput from '../components/SimpleInput';
import HathorHeader from '../components/HathorHeader';
import { getKeyboardAvoidingViewTopDistance, validateAddress } from '../utils';
import OfflineBar from '../components/OfflineBar';

export const SendAddressInput = () => {
  const route = useRoute();
  const navigation = useNavigation();
  /**
   * address {string} send tokens to this address
   * error {string} address validation error
   */
  const [formModel, setFormModel] = useState({
    // we can optionally receive a string to fill out the address
    // input (for eg, user scanned QR code)
    address: route.params?.address ?? null,
    // TODO this is probably temporary. We don't have the UI for error message yet.
    error: null,
  });
  const network = useSelector((state) => new Network(state.networkSettings.network));

  const onAddressChange = (text) => {
    setFormModel({ address: text, error: null });
  }

  const onButtonPress = () => {
    const validation = validateAddress(formModel.address, network);
    if (validation.isValid) {
      navigation.navigate('SendAmountInput', { address: formModel.address });
    } else {
      setFormModel({ error: validation.message });
    }
  }

  return (
    <View style={{ flex: 1 }}>
      <HathorHeader
        withBorder
        title={t`SEND`}
        onBackPress={() => navigation.goBack()}
      />
      <KeyboardAvoidingView behavior='padding' style={{ flex: 1 }} keyboardVerticalOffset={getKeyboardAvoidingViewTopDistance()}>
        <View style={{ flex: 1, padding: 16, justifyContent: 'space-between' }}>
          <SimpleInput
            label={t`Address to send`}
            autoFocus
            onChangeText={onAddressChange}
            error={formModel.error}
            value={formModel.address}
          />
          <NewHathorButton
            title={t`Next`}
            disabled={!formModel.address}
            onPress={onButtonPress}
          />
        </View>
        <OfflineBar style={{ position: 'relative' }} />
      </KeyboardAvoidingView>
    </View>
  );
}

export default SendAddressInput;
