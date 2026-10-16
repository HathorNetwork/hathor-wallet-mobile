/**
 * Copyright (c) Hathor Labs and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  AppState,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSelector } from 'react-redux';
import { t } from 'ttag';

import HathorHeader from '../components/HathorHeader';
import ShieldedUnlockAction from '../components/Shielded/ShieldedUnlockAction';
import { COLORS } from '../styles/themes';
import { SENSITIVE_COPY_FEEDBACK_MS } from '../constants';
import {
  isShieldedAvailable,
  isUnlockableLock,
  selectShieldedCapability,
} from '../shielded/gating';
import { getWalletShieldedCapability } from '../shielded/capability';
import { STORE } from '../store';
import { PasskeyCancelledError, withPasskeyWords } from '../passkey/passkeySigner';
import { derivePasskeyShieldedKeys } from '../passkey/shieldedKeys';
import { closeScreen } from '../utils/navigation';
import { copySensitive } from '../utils/sensitiveClipboard';

/**
 * Where the export stands: waiting for the PIN, reading the keys, showing them, or failed with
 * an error text.
 */
const STAGE = {
  WAITING: 'waiting',
  READING: 'reading',
  KEYS: 'keys',
  FAILED: 'failed',
};

// The capability reason of a wallet whose record has no shielded keys.
const NO_SHIELDED_KEYS_REASON = 'no-shielded-keys';

/**
 * Whether the wallet decodes its private outputs: its scan key was checked against its shielded
 * xpub when the wallet unlocked it.
 *
 * @param {Object|null} capability The wallet's IShieldedCapability
 * @returns {boolean}
 */
function decodesPrivateOutputs(capability) {
  return capability?.level === 'view' || capability?.level === 'full';
}

/**
 * What the export says of a wallet whose record has no shielded keys.
 *
 * @returns {string}
 */
const noShieldedKeysText = () => t`This wallet has no shielded keys. They are only present on wallets created after the shielded outputs feature was enabled.`;

/**
 * What the export says of a wallet whose private outputs a PIN or a passkey can unlock.
 *
 * @returns {string}
 */
const unlockFirstText = () => t`Unlock your private balance to export the privacy keys.`;

/**
 * Why a wallet that doesn't decode its private outputs, and no unlock fixes, can't export the keys.
 *
 * @param {Object|null} capability The wallet's IShieldedCapability
 * @returns {string}
 */
function unavailableText(capability) {
  if (capability?.reason === NO_SHIELDED_KEYS_REASON) {
    return noShieldedKeysText();
  }
  return t`Private transfers are not available for this wallet.`;
}

/**
 * Why a wallet that doesn't decode its private outputs can't export the keys: a PIN or a passkey
 * unlocks them first, or nothing does.
 *
 * @param {Object|null} capability The wallet's IShieldedCapability
 * @returns {string}
 */
function blockedText(capability) {
  return isUnlockableLock(capability) ? unlockFirstText() : unavailableText(capability);
}

/**
 * The first 12 and the last 8 characters of a key, enough to check it against what the auditor
 * expects.
 *
 * @param {string} key
 * @returns {string}
 */
function maskKey(key) {
  return `${key.slice(0, 12)}…${key.slice(-8)}`;
}

/**
 * One exported key: its name, what it gives, its value, masked until "Show full key" reveals it,
 * and Copy, which copies the full value through the clipboard that clears itself, whatever shows.
 * The value's text is selectable too, as it shows; a copy of the selection doesn't clear itself.
 */
const KeyCard = ({ label, description, value }) => {
  const [revealed, setRevealed] = useState(false);
  const [copied, setCopied] = useState(false);
  // The timer that takes Copied down.
  const copiedTimer = useRef(null);

  useEffect(() => () => clearTimeout(copiedTimer.current), []);

  const onCopy = () => {
    copySensitive(value);
    setCopied(true);
    clearTimeout(copiedTimer.current);
    copiedTimer.current = setTimeout(() => setCopied(false), SENSITIVE_COPY_FEEDBACK_MS);
  };

  return (
    <View style={styles.keyCard}>
      <Text style={styles.keyLabel}>{label}</Text>
      <Text style={styles.keyDescription}>{description}</Text>

      <View style={styles.keyValueBox}>
        <Text
          style={styles.keyValue}
          selectable
          numberOfLines={revealed ? undefined : 1}
        >
          {revealed ? value : maskKey(value)}
        </Text>
      </View>

      <View style={styles.keyActions}>
        <TouchableOpacity onPress={() => setRevealed((prev) => !prev)}>
          <Text style={styles.keyActionText}>
            {revealed ? t`Hide` : t`Show full key`}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={onCopy}>
          <Text style={styles.keyActionText}>
            {copied ? t`Copied` : t`Copy`}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

/**
 * Exports the wallet's privacy keys for an auditor: the spend xpub (m/44'/280'/2'/0), which finds
 * the private outputs the wallet receives, and the scan xpriv (m/44'/280'/1'/0), which decrypts
 * their amounts and tokens. They can't spend.
 *
 * The PIN comes first: as soon as the screen opens on a wallet that decodes its private outputs,
 * it opens the PIN screen, whose callback reads the keys with the PIN. The PIN never travels in
 * the navigation params, and the keys live in this screen's state only, never in redux, a log or
 * the navigation params. When the PIN screen closes without the PIN (Cancel, Android's back, a
 * failed biometry), the export closes too, back to the privacy settings. The wallet must decode
 * its private outputs right before the scan key is decrypted; a locked wallet is asked to unlock
 * first, and the PIN comes once it is unlocked. A passkey wallet has no PIN: a passkey ceremony
 * takes its place and derives the keys, and a dismissed ceremony closes the export too.
 *
 * The keys show masked, and "Show full key" reveals one. Copy goes through the clipboard that
 * clears itself, and the keys' text is selectable. The keys hide while the app isn't active, out
 * of iOS's app-switcher snapshot; Android takes its recents thumbnail before the app reports it,
 * so the thumbnail can show them. A read that fails shows the error's message, and logs nothing.
 * A wallet that no longer decodes its private outputs when the PIN comes says why, as the screen
 * does when it opens.
 *
 * The privacy settings open it, where the shielded UI is available. When it no longer is, the
 * screen closes with the screens above it, such as its PIN screen, whose callback then never runs.
 *
 * @param {Object} props
 * @param {Object} props.navigation React Navigation's navigation object
 * @param {Object} props.route React Navigation's route of the screen
 */
export default function ExportPrivacyKeys({ navigation, route }) {
  const wallet = useSelector((state) => state.wallet);
  const available = useSelector(isShieldedAvailable);
  const capability = useSelector(selectShieldedCapability);

  const [stage, setStage] = useState(STAGE.WAITING);
  const [keys, setKeys] = useState(null);
  const [error, setError] = useState(null);
  // The screen opens from a tap, so the app is active then.
  const [appActive, setAppActive] = useState(true);

  const mounted = useRef(true);
  // Whether the export asked for the PIN and still waits for it.
  const awaitingPin = useRef(false);

  const decodes = decodesPrivateOutputs(capability);

  useEffect(() => () => {
    mounted.current = false;
  }, []);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextState) => {
      setAppActive(nextState === 'active');
    });
    return () => subscription.remove();
  }, []);

  useEffect(() => {
    if (!available) {
      closeScreen(navigation, route.key);
    }
  }, [available, navigation, route.key]);

  // The PIN screen's callback runs before the export is focused again, so the export on top of
  // its stack while the PIN is still awaited means the PIN screen closed without it. The focus of
  // the export's opening comes with the PIN screen already over it.
  useEffect(() => navigation.addListener('focus', () => {
    const state = navigation.getState();
    const onTop = state.routes[state.index]?.key === route.key;
    if (awaitingPin.current && onTop) {
      awaitingPin.current = false;
      closeScreen(navigation, route.key);
    }
  }), [navigation, route.key]);

  const fail = (text) => {
    setError(text);
    setStage(STAGE.FAILED);
  };

  /**
   * The PIN screen's callback: it reads the keys with the PIN, or the password safe biometry
   * reads from the keychain, which also decrypts the scan key.
   *
   * @param {string} pinCode
   */
  const readKeys = async (pinCode) => {
    // Before any state update, which can focus the export again.
    awaitingPin.current = false;
    if (!mounted.current) {
      // The screen went away while the PIN screen was up: nothing is decrypted.
      return;
    }
    setStage(STAGE.READING);
    try {
      if (!wallet?.storage) {
        fail(t`Wallet not ready`);
        return;
      }
      const current = await getWalletShieldedCapability(wallet);
      if (!mounted.current) {
        return;
      }
      if (!decodesPrivateOutputs(current)) {
        fail(blockedText(current));
        return;
      }
      const [spendXpub, scanXpriv] = await Promise.all([
        wallet.storage.getSpendXPubKey(),
        wallet.storage.getScanXPrivKey(pinCode),
      ]);
      if (!mounted.current) {
        return;
      }
      if (!spendXpub) {
        fail(noShieldedKeysText());
        return;
      }
      setKeys({ spendXpub, scanXpriv });
      setStage(STAGE.KEYS);
    } catch (e) {
      // The error isn't logged.
      if (mounted.current) {
        fail(e instanceof Error ? e.message : String(e));
      }
    }
  };

  /**
   * The passkey wallet's counterpart of the PIN entry: one passkey ceremony, which derives the
   * keys from the wallet's root once the passkey is checked against the wallet. A dismissed
   * ceremony closes the export, as a dismissed PIN screen does.
   */
  const readPasskeyKeys = async () => {
    setStage(STAGE.READING);
    try {
      const derived = await withPasskeyWords(async (words) => derivePasskeyShieldedKeys(words));
      if (!mounted.current) {
        return;
      }
      if (!derived) {
        fail(noShieldedKeysText());
        return;
      }
      setKeys({
        spendXpub: derived.shieldedXpubs.spendXpubkey,
        scanXpriv: derived.scanXPrivKey,
      });
      setStage(STAGE.KEYS);
    } catch (e) {
      if (!mounted.current) {
        return;
      }
      if (e instanceof PasskeyCancelledError) {
        closeScreen(navigation, route.key);
        return;
      }
      // The error isn't logged.
      fail(e instanceof Error ? e.message : String(e));
    }
  };

  // The PIN first, once, as soon as the wallet decodes its private outputs: when the screen
  // opens, or once a locked wallet is unlocked. A passkey wallet runs its ceremony instead.
  useEffect(() => {
    if (!available || !decodes || stage !== STAGE.WAITING || awaitingPin.current) {
      return;
    }
    if (STORE.isPasskeyWallet()) {
      readPasskeyKeys();
      return;
    }
    awaitingPin.current = true;
    navigation.navigate('PinScreen', {
      cb: readKeys,
      canCancel: true,
      screenText: t`Enter your 6-digit PIN to export the audit keys`,
    });
  }, [available, decodes, stage]);

  const renderBlocked = () => {
    if (decodes || stage !== STAGE.WAITING) {
      return null;
    }
    if (isUnlockableLock(capability)) {
      return (
        <View>
          <Text style={styles.note}>{unlockFirstText()}</Text>
          <ShieldedUnlockAction navigation={navigation} />
        </View>
      );
    }
    return (
      <View style={styles.errorCard}>
        <Text style={styles.errorText}>{unavailableText(capability)}</Text>
      </View>
    );
  };

  const showsKeys = stage === STAGE.KEYS && keys !== null;

  return (
    <View style={styles.screen}>
      <HathorHeader
        title={t`EXPORT PRIVACY KEYS`}
        onBackPress={() => navigation.goBack()}
      />
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps='handled'
      >
        <View style={styles.warningCard}>
          <Text style={styles.warningTitle}>{t`Read this before sharing`}</Text>
          <Text style={styles.warningBody}>
            {t`These two keys give an auditor read-only access to every shielded output your wallet receives — they can identify every incoming shielded transaction and decrypt the amount and token of each one.`}
          </Text>
          <Text style={styles.warningBody}>
            {t`They do NOT allow spending. Whoever holds them cannot move your funds, sign transactions on your behalf, or access transparent (non-shielded) balances.`}
          </Text>
          <Text style={styles.warningBody}>
            {t`Treat them like any other private wallet data. Share them only with auditors you trust, and over a secure channel.`}
          </Text>
        </View>

        {stage === STAGE.READING && (
          <View style={styles.loadingBlock}>
            <ActivityIndicator size='small' color={COLORS.primary} />
            <Text style={styles.loadingText}>{t`Deriving keys…`}</Text>
          </View>
        )}

        {stage === STAGE.FAILED && (
          <View style={styles.errorCard}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}

        {showsKeys && appActive && (
          <>
            <KeyCard
              label={t`Spend public key (xpub)`}
              description={
                t`Path m/44'/280'/2'/0. Lets the auditor derive every receiving spend-side address and find your incoming shielded outputs on-chain.`
              }
              value={keys.spendXpub}
            />
            {Boolean(keys.scanXpriv) && (
              <KeyCard
                label={t`Scan private key (htpr)`}
                description={
                  t`Path m/44'/280'/1'/0. Lets the auditor decrypt the value and token of every shielded output your wallet receives. Used only for ECDH; never for signing.`
                }
                value={keys.scanXpriv}
              />
            )}
          </>
        )}

        {renderBlocked()}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: COLORS.backgroundColor,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 24,
    paddingBottom: 24,
  },
  warningCard: {
    backgroundColor: '#FFF3E0',
    borderRadius: 12,
    padding: 16,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: '#FFCC80',
  },
  warningTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#8B5500',
    marginBottom: 8,
  },
  warningBody: {
    fontSize: 13,
    color: '#5D3A00',
    marginTop: 8,
    lineHeight: 18,
  },
  loadingBlock: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
  },
  loadingText: {
    marginLeft: 12,
    color: COLORS.textColorShadow,
    fontSize: 13,
  },
  errorCard: {
    backgroundColor: '#FFEBEE',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#EF9A9A',
    marginBottom: 16,
  },
  errorText: {
    fontSize: 13,
    color: '#B71C1C',
    lineHeight: 18,
  },
  note: {
    fontSize: 13,
    lineHeight: 18,
    textAlign: 'center',
    color: COLORS.textColorShadow,
  },
  keyCard: {
    backgroundColor: '#FAFAFA',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  keyLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.textColor,
  },
  keyDescription: {
    fontSize: 12,
    color: COLORS.textColorShadow,
    marginTop: 6,
    lineHeight: 16,
  },
  keyValueBox: {
    backgroundColor: '#F2F3F5',
    borderRadius: 6,
    padding: 12,
    marginTop: 12,
  },
  keyValue: {
    // Menlo is iOS's monospace font; Android's is 'monospace'.
    fontFamily: Platform.select({ ios: 'Menlo', default: 'monospace' }),
    fontSize: 12,
    color: COLORS.textColor,
  },
  keyActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: 12,
    gap: 24,
  },
  keyActionText: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.primary,
  },
});
