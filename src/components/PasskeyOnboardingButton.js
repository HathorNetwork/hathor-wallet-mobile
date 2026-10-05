/**
 * Copyright (c) Hathor Labs and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import React, { useEffect, useState } from 'react';
import {
  Alert, Keyboard, Platform, StyleSheet, Text, TextInput, View,
} from 'react-native';
import { t } from 'ttag';
import { useDispatch, useSelector } from 'react-redux';
import { get } from 'lodash';
import NewHathorButton from './NewHathorButton';
import HathorModal from './HathorModal';
import { COLORS } from '../styles/themes';
import { PASSKEY_ONBOARDING_FEATURE_TOGGLE } from '../constants';
import {
  createWalletWordsFromPasskey,
  signInWalletWordsFromPasskey,
  isPasskeyCancel,
  isPasskeySupported,
} from '../passkey/passkeyService';
import { derivePasskeyXpub } from '../passkey/passkeySigner';
import {
  registerOnWalletService,
  shouldRegisterOnWalletService,
} from '../passkey/walletServiceRegistration';
import { startWalletRequested, unlockScreen } from '../actions';
import { STORE } from '../store';
import NavigationService from '../NavigationService';
import { logger } from '../logger';

const log = logger('passkey');

/**
 * Passkey onboarding (passkey PRF -> seed).
 *
 * Renders a single "Passkey" button on the initial screen; tapping it opens a bottom-sheet with the
 * two real actions, so the initial screen stays uncluttered:
 *   - "Sign in with passkey"  -> discoverable assertion; the OS lists existing (iCloud/GPM-synced)
 *                                passkeys to recover the SAME wallet.
 *   - "Create passkey wallet" -> in-modal name input (cross-platform; Alert.prompt is iOS-only),
 *                                then mint a NEW passkey + NEW wallet. The name becomes the
 *                                passkey displayName shown by the OS sign-in picker.
 *
 * Gated by the PASSKEY_ONBOARDING_FEATURE_TOGGLE flag (renders nothing when off). Both actions
 * derive the seed words EPHEMERALLY, persist only the account xpub + passkey label (never the
 * words — passkey wallets are PIN-less and secret-less), and start the wallet directly. Every
 * later operation that needs a private key runs a fresh passkey ceremony instead of a PIN.
 */
const PasskeyOnboardingButton = () => {
  const dispatch = useDispatch();
  const featureToggles = useSelector((state) => state.featureToggles);
  const networkSettings = useSelector((state) => state.networkSettings);
  // Gated by the Unleash feature toggle (off by default).
  const enabled = get(featureToggles, PASSKEY_ONBOARDING_FEATURE_TOGGLE, false);
  const [busy, setBusy] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  // 'actions' -> Sign in / Create choice; 'name' -> wallet-name input before creating.
  const [step, setStep] = useState('actions');
  const [walletName, setWalletName] = useState('');
  // iOS: the sheet is a pure View (no native Modal), so grow its bottom padding to keep the name
  // input above the keyboard. Android pans the window instead (windowSoftInputMode="adjustPan").
  const [kbHeight, setKbHeight] = useState(0);
  // Whether this device can actually produce a passkey PRF secret (iOS 18+, Android API 28+, and a
  // linked native module). Checked only once the flag is on, so app start never touches the native
  // passkey module for users outside the rollout. Unsupported devices never see the button, instead
  // of minting a PRF-less passkey and only then failing.
  const [supported, setSupported] = useState(false);

  useEffect(() => {
    if (!enabled) return undefined;
    let active = true;
    isPasskeySupported().then((ok) => {
      if (active) setSupported(ok);
    });
    return () => {
      active = false;
    };
  }, [enabled]);

  useEffect(() => {
    if (Platform.OS !== 'ios') return undefined;
    const show = Keyboard.addListener('keyboardWillShow', (e) => setKbHeight(e.endCoordinates.height));
    const hide = Keyboard.addListener('keyboardWillHide', () => setKbHeight(0));
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);

  if (!enabled || !supported) return null;

  const openModal = () => {
    setStep('actions');
    setWalletName('');
    setModalVisible(true);
  };

  const run = async (deriveWords) => {
    setBusy(true);
    // Keep ONLY the passkey ceremony + storage inside the try. Everything after the wallet is
    // persisted (navigation/dispatch) must not be reported as "Passkey unavailable" — the wallet
    // WAS created, and a nav failure there is a different problem.
    try {
      const { words, label, credentialId } = await deriveWords();
      // The words exist only in this scope: derive the account xpub, persist it with the
      // wallet metadata, and start the wallet read-only. No PIN, no stored secret.
      const xpub = derivePasskeyXpub(words);
      await STORE.initPasskeyStorage(xpub, {
        // null when the platform didn't return a label: persisting a placeholder would present it
        // as the passkey's real name, making the generic "Unlock with your passkey" unreachable.
        passkeyLabel: label || null,
        credentialId: credentialId ?? null,
      });
      // With the wallet-service flag on, also create the wallet on the wallet-service now, while
      // the words are in scope (no extra prompt), so it can start on that facade. Never blocks
      // onboarding: on failure the wallet starts on the fullnode facade; the next unlock retries.
      if (shouldRegisterOnWalletService(featureToggles, networkSettings)) {
        try {
          await registerOnWalletService(words, networkSettings);
        } catch (registrationError) {
          log.error('Passkey wallet-service registration failed at onboarding', registrationError);
        }
      }
    } catch (e) {
      // Dismissing the OS passkey sheet is a cancel, not a failure — stay silent and let the user
      // retry (the modal stays open). Only real failures raise the alert.
      if (isPasskeyCancel(e)) {
        return;
      }
      // react-native-passkey throws a PasskeyError with a `.error` code — surface it so a
      // generic "unknown error" becomes actionable (e.g. BadConfiguration = domain not verified).
      log.error('passkey onboarding failed', e);
      const nativeCode = e?.code ?? e?.error;
      const code = nativeCode ? `[${nativeCode}] ` : '';
      Alert.alert(t`Passkey unavailable`, `${code}${e?.message ?? String(e)}`);
      return;
    } finally {
      setBusy(false);
    }
    setModalVisible(false);
    // Same sequence ChoosePinScreen uses: unlock before entering the main stack, then request the
    // wallet start. The saga derives isPasskeyWallet from the persisted walletMeta, so no payload.
    dispatch(unlockScreen());
    dispatch(startWalletRequested());
    NavigationService.resetToMain();
  };

  const onCreate = () => {
    const name = walletName.trim() || t`Hathor Wallet`;
    run(() => createWalletWordsFromPasskey(name));
  };

  // BackdropModal animates the sheet OUT before calling onDismiss, so ignoring the call while busy
  // would leave an invisible sheet mounted over the screen. Passing no onDismiss while busy makes a
  // backdrop tap / swipe a true no-op instead (BackdropModal returns early without animating).
  const onDismiss = busy ? undefined : () => setModalVisible(false);

  return (
    <>
      <NewHathorButton
        onPress={openModal}
        title={t`Passkey`}
        secondary
      />
      {modalVisible && (
        <HathorModal onDismiss={onDismiss} viewStyle={{ paddingBottom: 24 + kbHeight }}>
          {step === 'actions' ? (
            <>
              <Text style={styles.title}>{t`Continue with passkey`}</Text>
              <View style={styles.buttons}>
                <NewHathorButton
                  onPress={() => run(signInWalletWordsFromPasskey)}
                  disabled={busy}
                  title={busy ? t`Working…` : t`Sign in with passkey`}
                  style={{ marginBottom: 16 }}
                />
                <NewHathorButton
                  onPress={() => setStep('name')}
                  disabled={busy}
                  title={t`Create passkey wallet`}
                  secondary
                />
              </View>
              {/* We can't reliably detect WHICH manager stores the passkey — the credential is
                  discoverable and users may route passkeys to iCloud Keychain, Google Password
                  Manager, 1Password, a hardware key, etc. — so keep the disclosure generic. */}
              <Text style={styles.syncNote}>
                {t`Your wallet is protected by this passkey. Keep it backed up in your password manager so you don't lose access.`}
              </Text>
            </>
          ) : (
            <>
              <Text style={styles.title}>{t`Name your wallet`}</Text>
              <Text style={styles.subtitle}>
                {t`This name identifies the passkey when you sign in later.`}
              </Text>
              <View style={styles.buttons}>
                <TextInput
                  style={styles.input}
                  value={walletName}
                  onChangeText={setWalletName}
                  placeholder={t`e.g. Savings`}
                  placeholderTextColor={COLORS.midContrastDetail}
                  autoFocus
                  autoCorrect={false}
                  maxLength={40}
                  editable={!busy}
                  onSubmitEditing={onCreate}
                  returnKeyType='done'
                />
                <NewHathorButton
                  onPress={onCreate}
                  disabled={busy}
                  title={busy ? t`Working…` : t`Create`}
                  style={{ marginBottom: 16 }}
                />
                <NewHathorButton
                  onPress={() => setStep('actions')}
                  disabled={busy}
                  title={t`Back`}
                  secondary
                />
              </View>
            </>
          )}
        </HathorModal>
      )}
    </>
  );
};

const styles = StyleSheet.create({
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    color: COLORS.textColor,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    color: COLORS.midContrastDetail,
    marginBottom: 16,
    paddingHorizontal: 24,
    textAlign: 'center',
  },
  syncNote: {
    fontSize: 13,
    color: COLORS.midContrastDetail,
    textAlign: 'center',
    paddingHorizontal: 24,
    marginTop: 16,
  },
  buttons: {
    width: '100%',
    paddingHorizontal: 24,
  },
  input: {
    borderWidth: 1,
    borderColor: COLORS.midContrastDetail,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
    color: COLORS.textColor,
    marginBottom: 16,
  },
});

export default PasskeyOnboardingButton;
