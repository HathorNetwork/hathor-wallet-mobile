/**
 * Copyright (c) Hathor Labs and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Clipboard,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSelector } from 'react-redux';
import { t } from 'ttag';

import HathorHeader from '../components/HathorHeader';
import { useNavigation, useParams } from '../hooks/navigation';
import { COLORS } from '../styles/themes';

/**
 * Show a key string with a partial mask by default; tap "Show" to
 * reveal in full. The full string is also accessible via the copy
 * button regardless of the reveal state, since the typical user flow
 * is to copy the key into an audit tool, not to read it on screen.
 *
 * Mask preserves a short prefix + suffix so the user can sanity-check
 * the key matches what their auditor expects without seeing the
 * middle. Copying always copies the full key.
 */
const KeyCard = ({ label, description, value }) => {
  const [revealed, setRevealed] = useState(false);
  const [copied, setCopied] = useState(false);

  const masked = value
    ? `${value.slice(0, 12)}…${value.slice(-8)}`
    : '';

  const onCopy = () => {
    Clipboard.setString(value);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
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
          {revealed ? value : masked}
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
 * Export the wallet's audit credentials:
 *
 *   - Spend account xpub at `m/44'/280'/2'/0` (read-only): lets an
 *     auditor enumerate every spend-side P2PKH address this wallet
 *     can receive shielded outputs at, and therefore find every
 *     incoming shielded UTXO on-chain. CANNOT sign transactions.
 *
 *   - Scan account xpriv at `m/44'/280'/1'/0`: lets an auditor run
 *     ECDH against each output's `ephemeral_pubkey` and rewind the
 *     range proof, recovering value / blinding factor / token /
 *     asset blinding factor. NEVER used to sign transactions —
 *     account 1 is read-only by construction.
 *
 * The two together let an auditor find AND decrypt every shielded
 * output sent to this wallet, while granting zero spending authority
 * over either shielded UTXOs (need account 2 xpriv, not exposed) or
 * transparent funds (need account 0 xpriv, not exposed).
 *
 * Transparent transactions are NOT covered by these keys; if the
 * audit needs them too, the legacy account 0 xpub can be added in a
 * follow-up.
 *
 * The PIN-gated derivation lives in `src/wallet/storage` (wallet-lib):
 * `getSpendXPubKey()` and `getScanXPrivKey(pin)`.
 */
const ExportPrivacyKeys = () => {
  const navigation = useNavigation();
  const wallet = useSelector((state) => state.wallet);
  // The PIN is passed in by the PinScreen callback that brought us
  // here. We read it once on mount, derive both keys, and let it fall
  // out of memory when this screen unmounts (route params get
  // garbage-collected with the popped frame).
  const params = useParams();
  const pin = params?.pin ?? null;

  const [keys, setKeys] = useState({ spendXpub: null, scanXpriv: null });
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const derive = async () => {
      try {
        if (!wallet?.storage) {
          throw new Error(t`Wallet not ready`);
        }
        if (!pin) {
          throw new Error(t`Missing PIN; please re-enter from the previous screen.`);
        }
        const [spendXpub, scanXpriv] = await Promise.all([
          wallet.storage.getSpendXPubKey(),
          wallet.storage.getScanXPrivKey(pin),
        ]);
        if (cancelled) return;
        if (!spendXpub) {
          throw new Error(
            t`This wallet has no shielded keys. They are only present on wallets created after the shielded outputs feature was enabled.`
          );
        }
        setKeys({ spendXpub, scanXpriv });
      } catch (e) {
        if (cancelled) return;
        setError(e instanceof Error ? e.message : String(e));
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    derive();
    return () => {
      cancelled = true;
    };
  }, [wallet, pin]);

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

        {loading && (
          <View style={styles.loadingBlock}>
            <ActivityIndicator size='small' color={COLORS.primary} />
            <Text style={styles.loadingText}>{t`Deriving keys…`}</Text>
          </View>
        )}

        {error && (
          <View style={styles.errorCard}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}

        {!loading && !error && keys.spendXpub && (
          <KeyCard
            label={t`Spend public key (xpub)`}
            description={
              t`Path m/44'/280'/2'/0. Lets the auditor derive every receiving spend-side address and find your incoming shielded outputs on-chain.`
            }
            value={keys.spendXpub}
          />
        )}

        {!loading && !error && keys.scanXpriv && (
          <KeyCard
            label={t`Scan private key (xpriv)`}
            description={
              t`Path m/44'/280'/1'/0. Lets the auditor decrypt the value and token of every shielded output your wallet receives. Used only for ECDH; never for signing.`
            }
            value={keys.scanXpriv}
          />
        )}
      </ScrollView>
    </View>
  );
};

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
    fontFamily: 'Menlo',
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

export default ExportPrivacyKeys;
