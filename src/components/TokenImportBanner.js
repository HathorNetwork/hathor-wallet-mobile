/**
 * Copyright (c) Hathor Labs and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import React from 'react';
import {
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigation } from '@react-navigation/native';
import { t } from 'ttag';
import { CircleInfoIcon } from './Icons/CircleInfo.icon';
import { tokenImportDismissBanner } from '../actions';
import { COLORS } from '../styles/themes';

const BANNER_BG = '#daf1ff';
const INFO_ICON_COLOR = '#4a90d9';

/**
 * Banner displayed on the Dashboard when unregistered tokens are detected.
 * Tapping "Import tokens" navigates to ImportTokensScreen.
 * Tapping the X dismiss button hides the banner.
 *
 * Reads from Redux state `state.tokenImport`:
 * - `unregisteredTokens` (object): map of token uid -> token data
 * - `bannerDismissed` (boolean): whether user has dismissed the banner
 */
export default function TokenImportBanner() {
  const dispatch = useDispatch();
  const navigation = useNavigation();
  const { unregisteredTokens, bannerDismissed } = useSelector(
    (state) => state.tokenImport,
  );

  const tokenCount = Object.keys(unregisteredTokens).length;

  if (bannerDismissed || tokenCount === 0) {
    return null;
  }

  const handleDismiss = () => {
    dispatch(tokenImportDismissBanner());
  };

  const handleImport = () => {
    navigation.navigate('ImportTokensScreen');
  };

  return (
    <View style={styles.container}>
      <View style={styles.iconContainer}>
        <CircleInfoIcon size={20} color={INFO_ICON_COLOR} />
      </View>
      <View style={styles.content}>
        <View style={styles.titleRow}>
          <Text style={styles.title}>{t`New tokens`}</Text>
          <TouchableOpacity
            onPress={handleDismiss}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            accessibilityLabel={t`Dismiss`}
            accessibilityRole='button'
          >
            <Text style={styles.closeIcon}>{'\u2715'}</Text>
          </TouchableOpacity>
        </View>
        <Text style={styles.description}>
          {t`We found tokens linked to your address that are not yet in your wallet.`}
          {' '}
          <Text
            style={styles.importLink}
            onPress={handleImport}
            accessibilityRole='link'
          >
            {t`Import tokens`}
          </Text>
          .
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: BANNER_BG,
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 8,
    marginHorizontal: 16,
    marginTop: 8,
    gap: 8,
  },
  iconContainer: {
    width: 20,
    height: 20,
    marginTop: 2,
  },
  content: {
    flex: 1,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  title: {
    fontSize: 12,
    fontWeight: '600',
    lineHeight: 20,
    color: COLORS.black,
  },
  closeIcon: {
    fontSize: 12,
    lineHeight: 16,
    color: COLORS.black,
  },
  description: {
    fontSize: 12,
    lineHeight: 20,
    color: COLORS.black,
  },
  importLink: {
    fontSize: 12,
    lineHeight: 20,
    fontWeight: '700',
    color: COLORS.primary,
    textDecorationLine: 'underline',
  },
});
