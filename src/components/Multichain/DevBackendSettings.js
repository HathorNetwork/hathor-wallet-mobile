/**
 * Copyright (c) Hathor Labs and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import React, { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useDispatch, useSelector } from 'react-redux';
import { t } from 'ttag';
import NewHathorButton from '../NewHathorButton';
import SimpleInput from '../SimpleInput';
import { multichainDevBackendSet } from '../../actions';
import { useNavigation } from '../../hooks/navigation';
import { impersonatedSideChain } from '../../multichain/chains';
import { createBackendApi } from '../../multichain/next/backendApi';
import { tokenText } from '../../multichain/next/tokenText';
import { isSideChainConnected, selectDevBackend } from '../../multichain/gating';
import { STORE } from '../../store';
import { COLORS } from '../../styles/themes';

const HEX_64 = /^[0-9a-f]{64}$/;
const BASE58_ADDRESS = /^[1-9A-HJ-NP-Za-km-z]{25,35}$/;
/** The wire formats the signer reads (kit/tx.js). */
const SIGNED_FORMATS = ['v2', 'v3'];
/** The amounts' widths a transaction can have: the client holds the backend to the one it gave. */
const AMOUNT_WIDTHS = ['u64', 'u128'];

/**
 * Whether a backend's GET /v1/config is one this app can run on.
 *
 * @param {Object} pins
 * @returns {boolean}
 */
export function isUsableBackendConfig(pins) {
  const next = pins?.next;
  const transfer = pins?.transfer;
  return Boolean(next)
    && Number.isSafeInteger(next.network_id)
    && HEX_64.test(next.native_token ?? '')
    && HEX_64.test(next.service_view_pub ?? '')
    && SIGNED_FORMATS.includes(next.wire_format)
    && Number.isSafeInteger(next.genesis_ms)
    && Number.isSafeInteger(next.epoch_ms)
    && (pins.hathor?.network === undefined || typeof pins.hathor.network === 'string')
    // Its transfer values pick where a burn sends the HTR: checked as the network's own are.
    && (transfer === null || transfer === undefined || (
      BASE58_ADDRESS.test(transfer.transfer_address ?? '')
      && HEX_64.test(transfer.destination_network ?? '')
      && Number.isSafeInteger(transfer.confirmations) && transfer.confirmations >= 0
      && Number.isSafeInteger(transfer.mean_block_ms) && transfer.mean_block_ms > 0
      && (transfer.mint_token === undefined || HEX_64.test(transfer.mint_token))
    ));
}

/**
 * The values of a backend's GET /v1/config the app uses, and nothing else: what is saved, and
 * what the side chain is built from (devBackendSideChain).
 *
 * @param {Object} pins A usable GET /v1/config (isUsableBackendConfig)
 * @returns {Object}
 */
export function usedBackendConfig(pins) {
  const { next, transfer, hathor } = pins;
  return {
    ...(hathor?.network ? { hathor: { network: hathor.network } } : {}),
    next: {
      network_id: next.network_id,
      native_token: next.native_token,
      service_view_pub: next.service_view_pub,
      wire_format: next.wire_format,
      genesis_ms: next.genesis_ms,
      epoch_ms: next.epoch_ms,
      ...(AMOUNT_WIDTHS.includes(next.amount_width) ? { amount_width: next.amount_width } : {}),
      native_token_symbol: tokenText(next.native_token_symbol, 16) ?? undefined,
      native_token_name: tokenText(next.native_token_name, 64) ?? undefined,
    },
    transfer: transfer ? {
      transfer_address: transfer.transfer_address,
      destination_network: transfer.destination_network,
      confirmations: transfer.confirmations,
      mean_block_ms: transfer.mean_block_ms,
      ...(transfer.mint_token ? { mint_token: transfer.mint_token } : {}),
    } : null,
  };
}

const shortHex = (hex) => `${hex.slice(0, 8)}…${hex.slice(-8)}`;

/**
 * The Hathor Next backend for local testing: while one is set, Hathor Next runs on it instead of
 * the network's own side chain, on every network but mainnet. Its values come from the backend
 * itself, which is only right for a backend the tester runs.
 */
export function DevBackendSettings() {
  const dispatch = useDispatch();
  const navigation = useNavigation();
  const devBackend = useSelector(selectDevBackend);
  const connected = useSelector(isSideChainConnected);
  const [url, setUrl] = useState('');
  const [error, setError] = useState(null);
  const [checking, setChecking] = useState(false);

  // Hathor Next loads again on the other backend: a seed wallet's PIN is asked here, before the
  // switch, as "Connect to side chain" does, for keys that aren't in memory. A passkey wallet runs
  // its ceremony once the load starts, only if it needs them.
  const switchTo = (backend) => {
    if (!connected || STORE.isPasskeyWallet()) {
      dispatch(multichainDevBackendSet(backend));
      return;
    }
    navigation.navigate('PinScreen', {
      cb: (pinCode) => dispatch(multichainDevBackendSet(backend, { pinCode })),
      canCancel: true,
      screenText: t`Enter your 6-digit pin to connect to Hathor Next`,
      biometryText: t`Connect to Hathor Next`,
    });
  };

  const useBackend = async () => {
    setError(null);
    setChecking(true);
    try {
      const trimmed = url.trim().replace(/\/+$/, '');
      const pins = await createBackendApi(trimmed).getConfig();
      if (!isUsableBackendConfig(pins)) {
        setError(t`This backend runs a Hathor Next network this app can't use.`);
        return;
      }
      // A backend for testing never passes as a network that holds value: the wallet would sign
      // there, with its real ledger and address.
      if (impersonatedSideChain(pins)) {
        setError(t`This backend gives the values of a Hathor Next network that holds value, so it can't be used for testing.`);
        return;
      }
      switchTo({ url: trimmed, pins: usedBackendConfig(pins) });
    } catch (e) {
      setError(t`Couldn't reach this backend.`);
    } finally {
      setChecking(false);
    }
  };

  if (devBackend) {
    const { next } = devBackend.pins;
    const networkId = next.network_id;
    const nativeToken = shortHex(next.native_token);
    return (
      <View>
        <Text style={styles.label}>{t`Hathor Next backend`}</Text>
        <Text selectable style={styles.value}>{devBackend.url}</Text>
        <Text selectable style={styles.detail}>
          {t`Network ${networkId}, native token ${nativeToken}`}
        </Text>
        <Text style={styles.note}>
          {t`Hathor Next runs on this backend on every network but mainnet. Your keys never leave this device: the backend gets public keys and signatures, and its wallet service sees your payments and their amounts.`}
        </Text>
        <NewHathorButton
          secondary
          title={t`Stop using this backend`}
          onPress={() => switchTo(null)}
        />
      </View>
    );
  }

  return (
    <View>
      <Text style={styles.label}>{t`Hathor Next backend (local testing)`}</Text>
      <SimpleInput
        placeholder='http://192.168.0.10:8930'
        value={url}
        onChangeText={setUrl}
        autoCapitalize='none'
        keyboardType='url'
        error={error}
      />
      <Text style={styles.note}>
        {t`Runs Hathor Next on a backend you run, instead of the network's own. After you set it, Hathor Next loads again on it.`}
      </Text>
      <NewHathorButton
        title={t`Use this backend`}
        disabled={checking || !url.trim()}
        onPress={useBackend}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  label: {
    marginTop: 24,
    marginBottom: 8,
    fontSize: 14,
    fontWeight: 'bold',
    color: COLORS.textColorShadow,
  },
  value: {
    fontSize: 14,
    color: COLORS.textColor,
  },
  detail: {
    marginTop: 4,
    fontSize: 12,
    color: COLORS.textColorShadow,
  },
  note: {
    marginTop: 12,
    marginBottom: 24,
    fontSize: 12,
    lineHeight: 18,
    color: COLORS.textColorShadow,
  },
});
