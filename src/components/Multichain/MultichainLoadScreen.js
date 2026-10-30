/**
 * Copyright (c) Hathor Labs and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useDispatch, useSelector } from 'react-redux';
import { t } from 'ttag';
import { lockScreen, multichainLoadRequested } from '../../actions';
import { NEXT_STATUS } from '../../multichain/state';
import { STORE } from '../../store';
import { COLORS } from '../../styles/themes';
import SimpleButton from '../SimpleButton';
import Spinner from '../Spinner';

/**
 * What the app shows while it waits for Hathor Next, with the side chain connected: the app opens
 * only once both chains have loaded. If Hathor Next fails, Try again is the only way on: there is
 * no opening the app on one chain.
 *
 * Try again needs the Hathor Next keys. They are derived at unlock, so they are missing only when
 * that failed: a passkey wallet's Try again runs the passkey ceremony, and a seed wallet's locks
 * the app, whose PIN derives them and loads Hathor Next again.
 */
export function MultichainLoadScreen() {
  const dispatch = useDispatch();
  const status = useSelector((state) => state.multichain.next.status);
  const error = useSelector((state) => state.multichain.next.error);
  const keysReady = useSelector((state) => state.multichain.next.keysReady);

  const tryAgain = () => {
    if (!keysReady && !STORE.isPasskeyWallet()) {
      dispatch(lockScreen());
      return;
    }
    dispatch(multichainLoadRequested());
  };

  if (status === NEXT_STATUS.FAILED) {
    return (
      <View style={styles.wrapper}>
        <Text style={styles.error}>{error}</Text>
        <SimpleButton
          containerStyle={styles.button}
          textStyle={styles.buttonText}
          onPress={tryAgain}
          title={t`Try again`}
        />
      </View>
    );
  }

  return (
    <View style={styles.wrapper}>
      <Spinner size={48} animating />
      <Text style={styles.loading}>{t`Loading Hathor Next…`}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  loading: {
    marginTop: 32,
    fontSize: 16,
    lineHeight: 20,
    textAlign: 'center',
    color: COLORS.textColorShadow,
  },
  error: {
    fontSize: 18,
    lineHeight: 22,
    textAlign: 'center',
  },
  button: {
    marginTop: 12,
  },
  buttonText: {
    fontSize: 18,
  },
});
