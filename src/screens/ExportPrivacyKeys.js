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
  View,
} from 'react-native';
import { useSelector } from 'react-redux';
import { t } from 'ttag';

import HathorHeader from '../components/HathorHeader';
import NewHathorButton from '../components/NewHathorButton';
import SimpleButton from '../components/SimpleButton';
import ShieldedUnlockAction from '../components/Shielded/ShieldedUnlockAction';
import { COLORS } from '../styles/themes';
import { SENSITIVE_COPY_FEEDBACK_MS } from '../constants';
import { isShieldedAvailable, selectShieldedCapability } from '../shielded/gating';
import { closeScreen } from '../utils/navigation';
import { copySensitive } from '../utils/sensitiveClipboard';

/**
 * Where the export stands: the warning, with the action that starts the export; the keys being
 * read; the keys shown; or a read that failed, with the action again.
 */
const STAGE = {
  WARNING: 'warning',
  READING: 'reading',
  KEYS: 'keys',
  FAILED: 'failed',
};

const SPEND_KEY = 'spend';
const SCAN_KEY = 'scan';

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
 * Whether the wallet holds its private outputs locked, and a PIN can unlock them: any cause but a
 * stored scan key that doesn't decrypt to a valid one.
 *
 * @param {Object|null} capability The wallet's IShieldedCapability
 * @returns {boolean}
 */
function canUnlockWithPin(capability) {
  return capability?.level === 'watch' && capability.cause !== 'corrupt-key';
}

/**
 * The first and the last 8 characters of a key, enough to tell it from another.
 *
 * @param {string} key
 * @returns {string}
 */
function maskKey(key) {
  return `${key.slice(0, 8)}…${key.slice(-8)}`;
}

/**
 * One exported key: its name, what it gives, its masked value, and Copy. The full value is never
 * rendered: Copy puts it in the clipboard, which clears itself.
 */
const KeyCard = ({
  label,
  description,
  value,
  copied,
  onCopy,
}) => (
  <View style={styles.keyCard}>
    <Text style={styles.keyLabel}>{label}</Text>
    <Text style={styles.keyDescription}>{description}</Text>
    <View style={styles.keyValueBox}>
      <Text style={styles.keyValue} numberOfLines={1}>{maskKey(value)}</Text>
    </View>
    <View style={styles.keyActions}>
      {copied && (
        <Text style={styles.copied}>{t`Copied. The clipboard clears in one minute.`}</Text>
      )}
      <SimpleButton title={t`Copy`} onPress={onCopy} textStyle={styles.copyText} />
    </View>
  </View>
);

/**
 * Exports the wallet's privacy keys for an auditor: the spend xpub (m/44'/280'/2'/0), which finds
 * the private outputs the wallet receives, and the scan xpriv (m/44'/280'/1'/0), which reads
 * their amounts and tokens. Together they give read access to every private output the wallet
 * receives, its change included, which can't be revoked; they can't spend.
 *
 * The warning comes first. Its action opens the PIN screen, whose callback reads the keys with the
 * PIN: the PIN never travels in the navigation params, and the keys live in this screen's state
 * only, never in redux, a log or the navigation params. The wallet must decode its private outputs
 * right before the scan key is decrypted; a locked wallet is asked to unlock first.
 *
 * The keys show masked. Copy goes through the clipboard that clears itself, and a note says so for
 * a few seconds. The keys hide while the app isn't active, out of iOS's app-switcher snapshot
 * (Android takes its recents thumbnail first, where they can show masked), and are dropped on
 * blur, when the lock screen comes up and on unmount. A failure shows a fixed text, never the
 * error's message, and logs nothing.
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
  const screenLocked = useSelector((state) => state.lockScreen);

  const [stage, setStage] = useState(STAGE.WARNING);
  const [keys, setKeys] = useState(null);
  // The key the user copied last, which says for a few seconds that the clipboard clears.
  const [copied, setCopied] = useState(null);
  // The screen opens from a tap, so the app is active then.
  const [appActive, setAppActive] = useState(true);

  const mounted = useRef(true);
  // Each read and each drop of the keys starts a generation: a read that ends in another
  // generation than its own is dropped.
  const generation = useRef(0);
  // The timer that takes the note of the last copy down.
  const copiedTimer = useRef(null);

  const dropKeys = () => {
    generation.current += 1;
    clearTimeout(copiedTimer.current);
    setKeys(null);
    setCopied(null);
    setStage(STAGE.WARNING);
  };

  useEffect(() => () => {
    mounted.current = false;
    generation.current += 1;
    clearTimeout(copiedTimer.current);
  }, []);

  // Opening the PIN screen blurs this one too, before the keys are read: that drops nothing.
  useEffect(() => navigation.addListener('blur', dropKeys), [navigation]);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextState) => {
      setAppActive(nextState === 'active');
    });
    return () => subscription.remove();
  }, []);

  useEffect(() => {
    if (screenLocked) {
      dropKeys();
    }
  }, [screenLocked]);

  useEffect(() => {
    if (!available) {
      closeScreen(navigation, route.key);
    }
  }, [available, navigation, route.key]);

  /**
   * The PIN screen's callback: it reads the keys with the PIN, or the password safe biometry
   * reads from the keychain, which also decrypts the scan key.
   *
   * @param {string} pinCode
   */
  const readKeys = async (pinCode) => {
    if (!mounted.current) {
      // The screen went away while the PIN screen was up: nothing is decrypted.
      return;
    }
    generation.current += 1;
    const readGeneration = generation.current;
    const isCurrent = () => mounted.current && generation.current === readGeneration;

    setStage(STAGE.READING);
    try {
      const current = await wallet.getShieldedCapability();
      if (!isCurrent()) {
        return;
      }
      if (!decodesPrivateOutputs(current)) {
        setStage(STAGE.FAILED);
        return;
      }
      const [spendXpub, scanXpriv] = await Promise.all([
        wallet.storage.getSpendXPubKey(),
        wallet.storage.getScanXPrivKey(pinCode),
      ]);
      if (!isCurrent()) {
        return;
      }
      if (!spendXpub || !scanXpriv) {
        setStage(STAGE.FAILED);
        return;
      }
      setKeys({ spendXpub, scanXpriv });
      setStage(STAGE.KEYS);
    } catch (e) {
      // Neither the message, which may quote what failed, nor the error is shown or logged.
      if (isCurrent()) {
        setStage(STAGE.FAILED);
      }
    }
  };

  const askForPin = () => {
    navigation.navigate('PinScreen', {
      cb: readKeys,
      canCancel: true,
      screenText: t`Enter your 6-digit pin to export the privacy keys`,
      biometryText: t`Export privacy keys`,
    });
  };

  const copy = (which, value) => {
    copySensitive(value);
    setCopied(which);
    clearTimeout(copiedTimer.current);
    copiedTimer.current = setTimeout(() => setCopied(null), SENSITIVE_COPY_FEEDBACK_MS);
  };

  const renderAction = () => {
    if (decodesPrivateOutputs(capability)) {
      return <NewHathorButton title={t`I understand, export the keys`} onPress={askForPin} />;
    }
    if (canUnlockWithPin(capability)) {
      return (
        <View>
          <Text style={styles.note}>
            {t`Unlock your private balance to export the privacy keys.`}
          </Text>
          <ShieldedUnlockAction navigation={navigation} />
        </View>
      );
    }
    return (
      <Text style={styles.note}>{t`Private transfers are not available for this wallet.`}</Text>
    );
  };

  const showsKeys = stage === STAGE.KEYS && keys !== null;

  return (
    <View style={styles.screen}>
      <HathorHeader
        title={t`EXPORT PRIVACY KEYS`}
        onBackPress={() => navigation.goBack()}
      />
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.warningCard}>
          <Text style={styles.warningTitle}>{t`Read this before you export`}</Text>
          <Text style={styles.warningBody}>
            {t`These keys give read access to every private output this wallet receives, its change included: whoever holds them sees the amount and the token of each one.`}
          </Text>
          <Text style={styles.warningBody}>
            {t`This access can't be revoked. To end it, move your funds to a new wallet.`}
          </Text>
          <Text style={styles.warningBody}>
            {t`The keys can't spend: they don't move funds or sign transactions.`}
          </Text>
          <Text style={styles.warningBody}>
            {t`Share them only with an auditor you trust, over a secure channel. The auditor needs a tool that reads Hathor's private outputs.`}
          </Text>
        </View>

        {stage === STAGE.READING && (
          <View style={styles.reading}>
            <ActivityIndicator size='small' color={COLORS.primary} />
            <Text style={styles.readingText}>{t`Reading the keys…`}</Text>
          </View>
        )}

        {stage === STAGE.FAILED && (
          <Text style={styles.error}>{t`The privacy keys could not be read.`}</Text>
        )}

        {showsKeys && appActive && (
          <>
            <KeyCard
              label={t`Spend public key (xpub)`}
              description={t`Path m/44'/280'/2'/0. It finds the private outputs this wallet receives.`}
              value={keys.spendXpub}
              copied={copied === SPEND_KEY}
              onCopy={() => copy(SPEND_KEY, keys.spendXpub)}
            />
            <KeyCard
              label={t`Scan private key (xpriv)`}
              description={t`Path m/44'/280'/1'/0. It reads the amount and the token of each private output this wallet receives. It never signs.`}
              value={keys.scanXpriv}
              copied={copied === SCAN_KEY}
              onCopy={() => copy(SCAN_KEY, keys.scanXpriv)}
            />
          </>
        )}

        {stage !== STAGE.READING && !showsKeys && renderAction()}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: COLORS.backgroundColor,
  },
  content: {
    paddingHorizontal: 16,
    paddingTop: 24,
    paddingBottom: 32,
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
  },
  warningBody: {
    fontSize: 13,
    lineHeight: 18,
    color: '#5D3A00',
    marginTop: 8,
  },
  reading: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
  },
  readingText: {
    marginLeft: 12,
    fontSize: 13,
    color: COLORS.textColorShadow,
  },
  error: {
    fontSize: 13,
    lineHeight: 18,
    color: COLORS.errorTextColor,
    marginBottom: 16,
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
    lineHeight: 16,
    color: COLORS.textColorShadow,
    marginTop: 6,
  },
  keyValueBox: {
    backgroundColor: '#F2F3F5',
    borderRadius: 6,
    padding: 12,
    marginTop: 12,
  },
  keyValue: {
    fontFamily: Platform.select({ ios: 'Menlo', default: 'monospace' }),
    fontSize: 12,
    color: COLORS.textColor,
  },
  keyActions: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    marginTop: 12,
    gap: 16,
  },
  copied: {
    flex: 1,
    fontSize: 12,
    color: COLORS.textColorShadow,
  },
  copyText: {
    fontWeight: 'bold',
  },
});
