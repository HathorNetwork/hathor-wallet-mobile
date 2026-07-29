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
  onExceptionCaptured,
  resetOnLockScreen,
  startWalletRequested,
  unlockScreen,
} from '../actions';
import { COLORS } from '../styles/themes';
import { STORE } from '../store';
import baseStyle from '../styles/init';
import { PasskeyCancelledError, verifyPasskeyForUnlock } from '../passkey/passkeySigner';
import { sanitizePasskeyLabel } from '../passkey/passkeyService';
import { logger } from '../logger';

const log = logger('passkey');

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
  // Synchronous idempotency guard: the mount effect must fire the ceremony at most once even if it
  // is invoked more than once in the same tick (e.g. a Fast Refresh remount). setVerifying is
  // async,
  // so the `verifying` check alone can't cover a same-tick double-fire; the OS shows a single
  // credential sheet and a duplicate call would fail or stack sheets.
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
        // App boot (or wallet stopped): start the xpub-only wallet. The saga derives
        // isPasskeyWallet from the persisted walletMeta; no secret (and no payload flag) via redux.
        dispatch(startWalletRequested());
      }
      dispatch(unlockScreen());
    } catch (e) {
      if (e instanceof PasskeyCancelledError) {
        setError(t`Unlock cancelled.`);
      } else {
        // A non-cancel failure on the only entry point for these wallets: log + report to Sentry
        // (fatal=false — the user can always retry or reset, this isn't a crash), and ALWAYS show
        // text, since a non-Error rejection or empty native message would otherwise
        // leave the error banner blank on an Unlock button that looks like it did nothing.
        log.error('passkey unlock failed', e);
        dispatch(onExceptionCaptured(e, false));
        const code = e?.error ? `[${e.error}] ` : '';
        setError(`${code}${e?.message || t`Could not verify your passkey. Please try again.`}`);
      }
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
