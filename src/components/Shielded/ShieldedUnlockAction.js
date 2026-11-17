/**
 * Copyright (c) Hathor Labs and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import React from 'react';
import {
  ActivityIndicator, StyleSheet, Text, View,
} from 'react-native';
import { useDispatch, useSelector } from 'react-redux';
import { t } from 'ttag';

import SimpleButton from '../SimpleButton';
import { shieldedViewUnlockRequested } from '../../actions';
import { SHIELDED_UNLOCK_SOURCE } from '../../constants';
import {
  SHIELDED_UNLOCK_PROGRESS,
  isShieldedUnlockInProgress,
  selectShieldedUnlock,
} from '../../shielded/unlockState';
import { COLORS } from '../../styles/themes';
import { STORE } from '../../store';

/**
 * Unlocks a locked private balance: it asks for the PIN, and the shielded saga unlocks the
 * wallet's scan key with it. While an unlock or a retry decodes the private outputs, it shows a
 * spinner instead, and it says when the last unlock failed. The PIN goes from the PIN screen's
 * callback to the request's payload, never to the navigation params or the redux state. A
 * passkey wallet has no PIN: the request goes without one, and the saga runs a passkey ceremony,
 * whose failure can say why (e.g. a passkey that opens another wallet).
 *
 * @param {Object} props
 * @param {{ navigate: Function }} props.navigation Opens the PIN screen
 */
export default function ShieldedUnlockAction({ navigation }) {
  const dispatch = useDispatch();
  const unlock = useSelector(selectShieldedUnlock);

  if (isShieldedUnlockInProgress(unlock)) {
    return (
      <View style={styles.wrapper}>
        <ActivityIndicator size='small' color={COLORS.primary} />
      </View>
    );
  }

  const askForPin = () => {
    if (STORE.isPasskeyWallet()) {
      dispatch(shieldedViewUnlockRequested({ source: SHIELDED_UNLOCK_SOURCE.USER }));
      return;
    }
    navigation.navigate('PinScreen', {
      cb: (pinCode) => dispatch(shieldedViewUnlockRequested({
        pinCode,
        source: SHIELDED_UNLOCK_SOURCE.USER,
      })),
      canCancel: true,
      screenText: t`Enter your 6-digit pin to unlock your private balance`,
      biometryText: t`Unlock private balance`,
    });
  };

  return (
    <View style={styles.wrapper}>
      {unlock.status === SHIELDED_UNLOCK_PROGRESS.FAILED && (
        <Text style={styles.failed}>
          {unlock.message ?? t`Could not unlock your private balance.`}
        </Text>
      )}
      <SimpleButton
        title={t`Unlock private balance`}
        textStyle={styles.action}
        onPress={askForPin}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 48,
  },
  failed: {
    fontSize: 12,
    lineHeight: 16,
    textAlign: 'center',
    color: COLORS.errorTextColor,
  },
  action: {
    fontWeight: 'bold',
  },
});
