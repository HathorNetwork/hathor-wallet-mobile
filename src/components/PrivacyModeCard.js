/**
 * Copyright (c) Hathor Labs and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import React from 'react';
import { StyleSheet, Switch, Text, View } from 'react-native';
import { t } from 'ttag';
import { useSelector } from 'react-redux';
import hathorLib from '@hathor/wallet-lib';

import { ShieldPadlockIcon } from './Icons/ShieldPadlock.icon';
import { EyeOffSlashIcon } from './Icons/EyeOffSlash.icon';
import { EyeIcon } from './Icons/Eye.icon';
import { COLORS } from '../styles/themes';
import { renderValue } from '../utils';
import { PRIVACY_MODE } from '../constants';

const FEE_PER_AS_OUTPUT = hathorLib.constants.FEE_PER_AMOUNT_SHIELDED_OUTPUT;
const FEE_PER_FS_OUTPUT = hathorLib.constants.FEE_PER_FULL_SHIELDED_OUTPUT;

/**
 * Build the three privacy-mode rows. Two variants share the same icons
 * + labels but use different supporting copy:
 *   - 'per-tx'   ("Token and amount hidden", short — used by the per-tx
 *                privacy modal that overrides for the current send only)
 *   - 'default'  ("Token and amount hidden on all new transactions" —
 *                used by the Privacy Settings screen where the choice
 *                becomes the user's persistent default)
 */
const buildOptions = (variant, decimalPlaces) => {
  const isDefault = variant === 'default';
  return [
    {
      key: PRIVACY_MODE.PRIVATE,
      label: t`Private`,
      description: isDefault
        ? t`Token and amount hidden on all new transactions`
        : t`Token and amount hidden`,
      feeLabel: t`Fee: ${renderValue(FEE_PER_FS_OUTPUT, false, decimalPlaces)} HTR per output`,
      Icon: ShieldPadlockIcon,
    },
    {
      key: PRIVACY_MODE.HIDE_AMOUNT,
      label: t`Hide amount`,
      description: isDefault
        ? t`Token visible, amount hidden on all new transactions`
        : t`Token visible, amount hidden`,
      feeLabel: t`Fee: ${renderValue(FEE_PER_AS_OUTPUT, false, decimalPlaces)} HTR per output`,
      Icon: EyeOffSlashIcon,
    },
    {
      key: PRIVACY_MODE.PUBLIC,
      label: t`Public`,
      description: isDefault
        ? t`Token and amount visible on all new transactions`
        : t`Token and amount visible`,
      feeLabel: t`No privacy fees`,
      Icon: EyeIcon,
    },
  ];
};

/**
 * Three-row card used by the Transaction Privacy modal (per-tx
 * override) and the Privacy Settings screen (persistent default).
 * Renders the three privacy modes with the figma styling: bg
 * #FAFAFA, radius 16, padding 16/16/12/16, gap 16, fee pill bg
 * #F2F3F5 + radius 4, icons in black, toggle scaled to 85%.
 *
 * @param {object} props
 * @param {string} props.selectedMode — currently selected key
 * @param {function} props.onSelect — called with the new key when the
 *   user toggles a row; parent controls state
 * @param {'per-tx'|'default'} props.variant — copy variant; defaults
 *   to 'per-tx'
 */
const PrivacyModeCard = ({ selectedMode, onSelect, variant = 'per-tx' }) => {
  const decimalPlaces = useSelector((state) => state.serverInfo?.decimal_places);
  const options = buildOptions(variant, decimalPlaces);

  return (
    <View style={styles.card}>
      {options.map((opt, idx) => {
        const isActive = opt.key === selectedMode;
        return (
          <View
            key={opt.key}
            style={[styles.row, idx < options.length - 1 && styles.rowBorder]}
          >
            <View style={styles.rowLeft}>
              {/* Icon stays black; only the toggle reflects state. */}
              <opt.Icon size={32} color={COLORS.textColor} />
              <View style={styles.rowText}>
                <Text style={styles.rowLabel}>{opt.label}</Text>
                <Text style={styles.rowDescription}>{opt.description}</Text>
                <View style={styles.feePill}>
                  <Text style={styles.feeLabel}>{opt.feeLabel}</Text>
                </View>
              </View>
            </View>
            <Switch
              value={isActive}
              onValueChange={() => onSelect(opt.key)}
              trackColor={{ false: COLORS.borderColor, true: COLORS.primary }}
              style={styles.switch}
            />
          </View>
        );
      })}
    </View>
  );
};

const styles = StyleSheet.create({
  // Card values match the figma layout panel:
  //   bg #FAFAFA, radius 16, padding 16/16/12/16 (T/R/B/L), gap 16.
  card: {
    backgroundColor: '#FAFAFA',
    borderRadius: 16,
    paddingTop: 16,
    paddingRight: 16,
    paddingBottom: 12,
    paddingLeft: 16,
    gap: 16,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  rowBorder: {
    paddingBottom: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: COLORS.borderColor,
  },
  rowLeft: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  rowText: {
    flex: 1,
  },
  rowLabel: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.textColor,
  },
  rowDescription: {
    fontSize: 13,
    color: COLORS.textColorShadow,
    marginTop: 4,
  },
  // Fee pill: figma radius 4, bg #F2F3F5.
  feePill: {
    alignSelf: 'flex-start',
    marginTop: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
    backgroundColor: '#F2F3F5',
    borderRadius: 4,
  },
  feeLabel: {
    fontSize: 12,
    color: COLORS.textColor,
  },
  // RN <Switch> renders at OS-default size (~50px iOS); scale down so
  // it sits closer to the figma proportions and leaves more
  // horizontal room for the row's text content.
  switch: {
    transform: [{ scaleX: 0.85 }, { scaleY: 0.85 }],
    marginLeft: 8,
  },
});

export default PrivacyModeCard;
