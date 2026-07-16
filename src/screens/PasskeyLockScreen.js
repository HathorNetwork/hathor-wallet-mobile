/**
 * Copyright (c) Hathor Labs and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import React, { useEffect, useRef, useState } from 'react';
import { Text, View } from 'react-native';
import { useDispatch, useSelector } from 'react-redux';
import { t } from 'ttag';

import SimpleButton from '../components/SimpleButton';
import NewHathorButton from '../components/NewHathorButton';
import Logo from '../components/Logo';
import Spinner from '../components/Spinner';
import {
  resetOnLockScreen,
  startWalletRequested,
  unlockScreen,
} from '../actions';
import { COLORS } from '../styles/themes';
import { STORE } from '../store';
import baseStyle from '../styles/init';
import { PasskeyCancelledError, verifyPasskeyForUnlock } from '../passkey/passkeySigner';
import { sanitizePasskeyLabel } from '../passkey/passkeyService';

/**
 * Lock screen for passkey (PIN-less, xpub-only) wallets — the counterpart of PinScreen's
 * lock-screen mode. There is no PIN and no stored secret: unlocking runs a passkey ceremony,
 * re-derives the xpub in memory and compares it to the stored one. Verification failure is
 * never fatal — the user can always retry or fall back to resetting the wallet.
 */
const PasskeyLockScreen = () => {
  const dispatch = useDispatch();
  const wallet = useSelector((state) => state.wallet);
  const [verifying, setVerifying] = useState(false);
  const [error, setError] = useState(null);
  // Ceremony must fire exactly once on mount even if the component re-renders (the OS shows
  // a single credential sheet; a duplicate call would fail or stack sheets).
  const startedRef = useRef(false);

  // Labels persisted from old-format credentials may be decode garbage; never show those.
  const passkeyLabel = sanitizePasskeyLabel(STORE.getWalletMeta()?.passkeyLabel);

  const unlock = async () => {
    if (verifying) {
      return;
    }
    setVerifying(true);
    setError(null);
    try {
      await verifyPasskeyForUnlock();
      if (!wallet) {
        // App boot (or wallet stopped): start the xpub-only wallet. The saga re-reads the
        // persisted walletMeta; no secret travels through redux.
        dispatch(startWalletRequested({ walletType: 'passkey' }));
      }
      dispatch(unlockScreen());
    } catch (e) {
      setError(e instanceof PasskeyCancelledError ? t`Unlock cancelled.` : e.message);
      setVerifying(false);
    }
  };

  useEffect(() => {
    if (!startedRef.current) {
      startedRef.current = true;
      unlock();
    }
  }, []);

  return (
    <View
      style={{
        flex: 1,
        alignItems: 'center',
        paddingHorizontal: 16, // Padding ensures a homogeneous background color
        backgroundColor: baseStyle.container.backgroundColor,
        justifyContent: 'space-between',
      }}
    >
      <View
        style={{
          flex: 0.1,
          marginVertical: 16,
          alignItems: 'center',
          height: 21,
          width: 120,
        }}
      >
        <Logo style={{ height: 21, width: 120 }} />
      </View>
      <View
        style={{
          flex: 2,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Text style={{ marginBottom: 8 }}>
          {passkeyLabel
            ? t`Unlock with the passkey "${passkeyLabel}"`
            : t`Unlock with your passkey`}
        </Text>
        {verifying ? (
          <Spinner size={48} animating />
        ) : (
          <>
            {error && (
              <Text
                style={{
                  color: COLORS.errorTextColor ?? COLORS.errorBgColor,
                  textAlign: 'center',
                  marginBottom: 16,
                  paddingHorizontal: 16,
                }}
              >
                {error}
              </Text>
            )}
            <NewHathorButton
              onPress={unlock}
              title={t`Unlock`}
              style={{ marginTop: 8, minWidth: 200 }}
            />
          </>
        )}
      </View>
      <View
        style={{
          flex: 0.2,
          alignItems: 'flex-end',
          justifyContent: 'flex-end',
        }}
      >
        <SimpleButton
          onPress={() => dispatch(resetOnLockScreen())}
          title={t`Reset wallet`}
          textStyle={{
            textAlign: 'center',
            textTransform: 'uppercase',
            color: COLORS.textColorShadow,
            letterSpacing: 1,
            padding: 4,
          }}
          containerStyle={{ marginTop: 16, marginBottom: 32 }}
        />
      </View>
    </View>
  );
};

export default PasskeyLockScreen;
