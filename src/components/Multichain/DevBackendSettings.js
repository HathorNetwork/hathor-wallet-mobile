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
import { createBackendApi } from '../../multichain/next/backendApi';
import { selectDevBackend } from '../../multichain/gating';
import { COLORS } from '../../styles/themes';

const HEX_64 = /^[0-9a-f]{64}$/;

/**
 * Whether a backend's GET /v1/config is one this app can run on.
 *
 * @param {Object} pins
 * @returns {boolean}
 */
export function isUsableBackendConfig(pins) {
  const next = pins?.next;
  return Boolean(next)
    && Number.isSafeInteger(next.network_id)
    && HEX_64.test(next.native_token ?? '')
    && HEX_64.test(next.service_view_pub ?? '')
    && next.wire_format === 'v2'
    && Number.isSafeInteger(next.genesis_ms)
    && Number.isSafeInteger(next.epoch_ms);
}

const shortHex = (hex) => `${hex.slice(0, 8)}…${hex.slice(-8)}`;

/**
 * The Hathor Next backend for local testing: while one is set, Hathor Next runs on it instead of
 * the simulated client, on every network but mainnet. Its values come from the backend itself,
 * which is only right for a backend the tester runs.
 */
export function DevBackendSettings() {
  const dispatch = useDispatch();
  const devBackend = useSelector(selectDevBackend);
  const [url, setUrl] = useState('');
  const [error, setError] = useState(null);
  const [checking, setChecking] = useState(false);

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
      dispatch(multichainDevBackendSet({ url: trimmed, pins }));
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
          {t`Hathor Next runs on this backend on every network but mainnet. Its keys never leave this device: the backend only gets public keys and signatures.`}
        </Text>
        <NewHathorButton
          secondary
          title={t`Stop using this backend`}
          onPress={() => dispatch(multichainDevBackendSet(null))}
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
        {t`Runs Hathor Next on a backend you run, instead of the simulated one. After you set it, Hathor Next loads again and asks for your PIN or passkey.`}
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
