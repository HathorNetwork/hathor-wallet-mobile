/**
 * Copyright (c) Hathor Labs and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useDispatch, useSelector } from 'react-redux';
import { t } from 'ttag';
import {
  lockScreen,
  multichainConnectSettingChanged,
  multichainLoadRequested,
  resetOnLockScreen,
} from '../../actions';
import { NEXT_STATUS } from '../../multichain/state';
import { STORE } from '../../store';
import { COLORS } from '../../styles/themes';
import SimpleButton from '../SimpleButton';
import Spinner from '../Spinner';

/**
 * How long the spinner shows, with the same status, before Disconnect side chain shows under it.
 */
export const LOAD_EXIT_AFTER_MS = 30000;

/**
 * What the app shows while it waits for Hathor Next, with the side chain connected: the app opens
 * only once both chains have loaded. If Hathor Next fails, there is no opening the app on one
 * chain while the side chain stays connected. The ways on are Try again, Disconnect side chain
 * (the app then opens on Hathor Network alone, as before the side chain was turned on) and Reset
 * wallet, the wallet's own error screen's last resort. Settings is out of reach here, and a
 * backend that stays down would otherwise keep the wallet shut at every start.
 *
 * Try again needs the Hathor Next keys. They are derived at unlock where the multichain flag is
 * on, so they are missing when that failed, or when the unlock was on a network whose flag was
 * off and the wallet then switched to one with a side chain. Without them the button is Unlock: a
 * passkey wallet's runs the passkey ceremony, and a seed wallet's locks the app, whose PIN derives
 * them and loads Hathor Next again.
 *
 * While it loads, the spinner shows alone. A load ends, in Hathor Next or in its failure; should
 * the spinner still show after LOAD_EXIT_AFTER_MS, Disconnect side chain shows under it too, so
 * this screen never keeps the wallet shut with no way on.
 */
export function MultichainLoadScreen() {
  const dispatch = useDispatch();
  const status = useSelector((state) => state.multichain.next.status);
  const error = useSelector((state) => state.multichain.next.error);
  const keysReady = useSelector((state) => state.multichain.next.keysReady);
  // The status shown for LOAD_EXIT_AFTER_MS: another status starts the wait again.
  const [waitedOn, setWaitedOn] = useState(null);

  useEffect(() => {
    const timer = setTimeout(() => setWaitedOn(status), LOAD_EXIT_AFTER_MS);
    return () => {
      clearTimeout(timer);
      // A status left forgets its wait: coming back to it waits the whole time again.
      setWaitedOn(null);
    };
  }, [status]);

  const tryAgain = () => {
    if (!keysReady && !STORE.isPasskeyWallet()) {
      dispatch(lockScreen());
      return;
    }
    dispatch(multichainLoadRequested());
  };

  const disconnect = () => {
    dispatch(multichainConnectSettingChanged(false));
  };

  // As the wallet's own error screen does: the lock screen shows the reset, and its back button
  // returns here.
  const reset = () => {
    dispatch(resetOnLockScreen());
    dispatch(lockScreen());
  };

  if (status === NEXT_STATUS.FAILED) {
    return (
      <View style={styles.wrapper}>
        <Text style={styles.error}>{error}</Text>
        <SimpleButton
          containerStyle={styles.button}
          textStyle={styles.buttonText}
          onPress={tryAgain}
          title={keysReady ? t`Try again` : t`Unlock`}
        />
        <SimpleButton
          containerStyle={styles.button}
          textStyle={styles.buttonText}
          onPress={disconnect}
          title={t`Disconnect side chain`}
        />
        <View style={styles.reset}>
          <SimpleButton
            textStyle={styles.buttonText}
            onPress={reset}
            title={t`Reset wallet`}
          />
        </View>
      </View>
    );
  }

  return (
    <View style={styles.wrapper}>
      <Spinner size={48} animating />
      <Text style={styles.loading}>{t`Loading Hathor Next…`}</Text>
      {waitedOn === status && (
        <SimpleButton
          containerStyle={styles.exit}
          textStyle={styles.buttonText}
          onPress={disconnect}
          title={t`Disconnect side chain`}
        />
      )}
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
  exit: {
    marginTop: 32,
  },
  reset: {
    position: 'absolute',
    bottom: 48,
  },
  buttonText: {
    fontSize: 18,
  },
});
