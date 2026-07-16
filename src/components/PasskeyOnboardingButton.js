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
import { PASSKEY_ONBOARDING_FEATURE_TOGGLE, PASSKEY_ONBOARDING_LOCAL_ENABLE } from '../constants';
import {
  createWalletWordsFromPasskey,
  signInWalletWordsFromPasskey,
} from '../passkey/passkeyService';
import { derivePasskeyXpub } from '../passkey/passkeySigner';
import { startWalletRequested, unlockScreen } from '../actions';
import { STORE } from '../store';
import NavigationService from '../NavigationService';

/**
 * Experimental passkey onboarding (PoC-1: passkey PRF -> seed).
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
  // Local override wins for testing; otherwise the real Unleash flag gates it.
  const enabled = PASSKEY_ONBOARDING_LOCAL_ENABLE
    || get(featureToggles, PASSKEY_ONBOARDING_FEATURE_TOGGLE, false);
  const [busy, setBusy] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  // 'actions' -> Sign in / Create choice; 'name' -> wallet-name input before creating.
  const [step, setStep] = useState('actions');
  const [walletName, setWalletName] = useState('');
  // iOS: the sheet is a pure View (no native Modal), so grow its bottom padding to keep the name
  // input above the keyboard. Android pans the window instead (windowSoftInputMode="adjustPan").
  const [kbHeight, setKbHeight] = useState(0);

  useEffect(() => {
    if (Platform.OS !== 'ios') return undefined;
    const show = Keyboard.addListener('keyboardWillShow', (e) => setKbHeight(e.endCoordinates.height));
    const hide = Keyboard.addListener('keyboardWillHide', () => setKbHeight(0));
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);

  if (!enabled) return null;

  const openModal = () => {
    setStep('actions');
    setWalletName('');
    setModalVisible(true);
  };

  const run = async (deriveWords) => {
    setBusy(true);
    try {
      const { words, label, credentialId } = await deriveWords();
      // The words exist only in this scope: derive the account xpub, persist it with the
      // wallet metadata, and start the wallet read-only. No PIN, no stored secret.
      const xpub = derivePasskeyXpub(words);
      await STORE.initPasskeyStorage(xpub, {
        passkeyLabel: label || 'Passkey wallet',
        credentialId: credentialId ?? null,
      });
      setModalVisible(false);
      // Same sequence ChoosePinScreen uses: unlock before entering the main stack,
      // then request the wallet start (the saga re-reads the persisted walletMeta).
      dispatch(unlockScreen());
      dispatch(startWalletRequested({ walletType: 'passkey' }));
      NavigationService.resetToMain();
    } catch (e) {
      // react-native-passkey throws a PasskeyError with a `.error` code — surface it so a
      // generic "unknown error" becomes actionable (e.g. BadConfiguration = domain not verified).
      console.warn('[passkey] failed:', e?.error, e?.message, e);
      const code = e?.error ? `[${e.error}] ` : '';
      Alert.alert(t`Passkey unavailable`, `${code}${e?.message ?? String(e)}`);
    } finally {
      setBusy(false);
    }
  };

  const onCreate = () => {
    const name = walletName.trim() || 'Hathor Wallet';
    run(() => createWalletWordsFromPasskey(name));
  };

  const onDismiss = () => {
    if (!busy) setModalVisible(false);
  };

  return (
    <>
      <NewHathorButton
        onPress={openModal}
        title={t`Passkey`}
        style={{ marginBottom: 16 }}
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
