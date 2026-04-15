/**
 * Copyright (c) Hathor Labs and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import React, { useState } from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import { useSelector } from 'react-redux';
import { COLORS } from '../styles/themes';
import { buildIconUrl } from '../sagas/tokenIcons';

import htrIcon from '../assets/tokens/htr.png';
import husdcIcon from '../assets/tokens/husdc.png';

// Bundled icons shipped with the app. Keyed by mainnet/testnet uid so the same
// physical asset is reused on both networks.
const BUNDLED_ICONS = {
  // Native HTR (same uid on every network).
  '00': htrIcon,
  // hUSDC mainnet
  '00003b17e8d656e4612926d5d2c5a4d5b3e4536e6bebc61c76cb71a65b81986f': husdcIcon,
  // hUSDC testnet
  '00000000901832d8f4987030eeed4bb578448e0c05e67dbd121dc917d3989477': husdcIcon,
};

/**
 * Circular token icon.
 *
 * Resolution order:
 *   1. Bundled asset (HTR / hUSDC).
 *   2. Remote icon listed in the manifest for the current network.
 *   3. Fallback: solid black circle with the token's symbol centered.
 */
const TokenAvatar = ({ uid, symbol, size = 40 }) => {
  const [remoteFailed, setRemoteFailed] = useState(false);
  const { manifest, network } = useSelector((state) => state.tokenIcons);

  const dim = { width: size, height: size, borderRadius: size / 2 };
  const bundled = BUNDLED_ICONS[uid];

  if (bundled) {
    return <Image source={bundled} style={[styles.image, dim]} />;
  }

  const filename = manifest?.[uid];
  if (filename && network && !remoteFailed) {
    return (
      <Image
        source={{ uri: buildIconUrl(network, filename) }}
        style={[styles.image, dim]}
        onError={() => setRemoteFailed(true)}
      />
    );
  }

  // Fallback: black circle with the symbol (first 4 chars, so long symbols still fit).
  const label = (symbol || '').slice(0, 4);
  return (
    <View style={[styles.fallback, dim]}>
      <Text style={[styles.fallbackText, { fontSize: Math.max(10, size * 0.3) }]}>
        {label}
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  image: {
    resizeMode: 'cover',
    backgroundColor: COLORS.lowContrastDetail,
  },
  fallback: {
    backgroundColor: COLORS.textColorShadowLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fallbackText: {
    color: COLORS.backgroundColor,
    fontWeight: 'bold',
  },
});

export default TokenAvatar;
