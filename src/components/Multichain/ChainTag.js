/**
 * Copyright (c) Hathor Labs and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { CHAIN, CHAIN_NAME, NEXT_COLORS } from '../../multichain/chains';
import { COLORS } from '../../styles/themes';
import { HathorNextMark } from '../Icons/HathorNextMark.icon';

/**
 * A chain's name as a small tag: Hathor Next with its mark and colors, Hathor Network in the
 * primary color. It says which chain an address, a balance or a view belongs to.
 *
 * @param {Object} props
 * @param {string} [props.chain] One of CHAIN; Hathor Next by default
 * @param {Object} [props.style]
 */
export const ChainTag = ({ chain = CHAIN.HATHOR_NEXT, style }) => {
  const isNext = chain === CHAIN.HATHOR_NEXT;
  return (
    <View
      style={[styles.tag, isNext ? styles.nextTag : styles.hathorTag, style]}
      accessibilityRole='text'
    >
      {isNext ? <HathorNextMark size={12} /> : <View style={styles.hathorDot} />}
      <Text style={[styles.text, isNext ? styles.nextText : styles.hathorText]}>
        {CHAIN_NAME[chain]}
      </Text>
    </View>
  );
};

/**
 * A chain's mark, and its name if asked: what a row shows in a list of both chains. Hathor Next's
 * four bars, or Hathor Network's dot.
 *
 * @param {Object} props
 * @param {string} props.chain One of CHAIN
 * @param {boolean} [props.withName]
 * @param {Object} [props.style]
 */
export const ChainMark = ({ chain, withName = false, style }) => {
  const isNext = chain === CHAIN.HATHOR_NEXT;
  return (
    <View style={[styles.mark, style]} accessibilityLabel={CHAIN_NAME[chain]}>
      {isNext ? <HathorNextMark size={10} /> : <View style={styles.markDot} />}
      {withName && (
        <Text style={[styles.markText, isNext ? styles.nextText : styles.hathorText]}>
          {CHAIN_NAME[chain]}
        </Text>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  tag: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    borderRadius: 999,
    paddingVertical: 3,
    paddingHorizontal: 8,
  },
  nextTag: {
    backgroundColor: NEXT_COLORS.accentSoft,
  },
  hathorTag: {
    backgroundColor: COLORS.primaryOpacity10,
  },
  hathorDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: COLORS.primary,
  },
  text: {
    marginLeft: 5,
    fontSize: 12,
    fontWeight: 'bold',
  },
  nextText: {
    color: NEXT_COLORS.accentText,
  },
  hathorText: {
    color: COLORS.primary,
  },
  mark: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  markDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: COLORS.primary,
  },
  markText: {
    marginLeft: 4,
    fontSize: 12,
    lineHeight: 16,
  },
});
