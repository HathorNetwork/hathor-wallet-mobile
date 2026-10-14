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
import { constants as hathorLibConstants } from '@hathor/wallet-lib';

import { ShieldPadlockIcon } from './Icons/ShieldPadlock.icon';
import { EyeOffSlashIcon } from './Icons/EyeOffSlash.icon';
import { EyeIcon } from './Icons/Eye.icon';
import { COLORS } from '../styles/themes';
import { getDisplayAmountFormat, renderValue } from '../utils';
import { PRIVACY_MODE } from '../constants';

const {
  FEE_PER_AMOUNT_SHIELDED_OUTPUT,
  FEE_PER_FULL_SHIELDED_OUTPUT,
} = hathorLibConstants;

/**
 * What the card's copy describes: the privacy of one send (PER_SEND), or the default privacy
 * mode of new sends (DEFAULT), which the privacy settings keep.
 */
export const PRIVACY_MODE_CARD_VARIANT = {
  PER_SEND: 'per-send',
  DEFAULT: 'default',
};

/**
 * The privacy modes, most private first: each mode's icon, title and description, and the
 * privacy fee each of its outputs pays (null for Public, whose outputs pay none).
 *
 * @param {string} [variant] One of PRIVACY_MODE_CARD_VARIANT, PER_SEND by default. The DEFAULT
 *   descriptions say that the mode applies to all new transactions.
 * @returns {{ mode: string, Icon: Function, title: string, description: string,
 *   feePerOutput: bigint|null }[]}
 */
export function getPrivacyModeDetails(variant = PRIVACY_MODE_CARD_VARIANT.PER_SEND) {
  const isDefault = variant === PRIVACY_MODE_CARD_VARIANT.DEFAULT;
  return [
    {
      mode: PRIVACY_MODE.PRIVATE,
      Icon: ShieldPadlockIcon,
      title: t`Private`,
      description: isDefault
        ? t`Token and amount hidden on all new transactions`
        : t`Token and amount hidden`,
      feePerOutput: FEE_PER_FULL_SHIELDED_OUTPUT,
    },
    {
      mode: PRIVACY_MODE.HIDE_AMOUNT,
      Icon: EyeOffSlashIcon,
      title: t`Hide amount`,
      description: isDefault
        ? t`Token visible, amount hidden on all new transactions`
        : t`Token visible, amount hidden`,
      feePerOutput: FEE_PER_AMOUNT_SHIELDED_OUTPUT,
    },
    {
      mode: PRIVACY_MODE.PUBLIC,
      Icon: EyeIcon,
      title: t`Public`,
      description: isDefault
        ? t`Token and amount visible on all new transactions`
        : t`Token and amount visible`,
      feePerOutput: null,
    },
  ];
}

/**
 * The details of one privacy mode, as getPrivacyModeDetails gives them.
 *
 * @param {string} mode One of PRIVACY_MODE
 * @returns {Object|undefined}
 */
export function getPrivacyModeDetail(mode) {
  return getPrivacyModeDetails().find((detail) => detail.mode === mode);
}

/**
 * The privacy modes a send can pick, one row each, with a switch for the selected one. Each row
 * shows the privacy fee, in HTR, that each output of the mode pays.
 *
 * @param {Object} props
 * @param {string} props.selectedMode One of PRIVACY_MODE
 * @param {function(string): void} props.onSelect Called with the mode the user switches on
 * @param {string} [props.variant] One of PRIVACY_MODE_CARD_VARIANT: the copy of one send's
 *   privacy, by default, or of the default privacy mode
 */
const PrivacyModeCard = ({
  selectedMode,
  onSelect,
  variant = PRIVACY_MODE_CARD_VARIANT.PER_SEND,
}) => {
  const decimalPlaces = useSelector((state) => state.serverInfo?.decimal_places);
  const amountFormat = useSelector(getDisplayAmountFormat);

  const feeLabel = (feePerOutput) => {
    if (feePerOutput === null) {
      return t`No privacy fees`;
    }
    const fee = renderValue(feePerOutput, false, decimalPlaces, amountFormat);
    return t`Fee: ${fee} HTR per output`;
  };

  const rows = getPrivacyModeDetails(variant);

  return (
    <View style={styles.card}>
      {rows.map((row, idx) => (
        <View
          key={row.mode}
          style={[styles.row, idx < rows.length - 1 && styles.rowBorder]}
        >
          <View style={styles.rowLeft}>
            {/* The icon stays black; only the switch shows the selection. */}
            <row.Icon size={32} color={COLORS.textColor} />
            <View style={styles.rowText}>
              <Text style={styles.rowLabel}>{row.title}</Text>
              <Text style={styles.rowDescription}>{row.description}</Text>
              <View style={styles.feePill}>
                <Text style={styles.feeLabel}>{feeLabel(row.feePerOutput)}</Text>
              </View>
            </View>
          </View>
          <Switch
            value={row.mode === selectedMode}
            onValueChange={() => onSelect(row.mode)}
            // One tone darker than the card, so the off track shows without splitting the thumb.
            trackColor={{ false: '#DCDCDC', true: COLORS.primary }}
            style={styles.switch}
          />
        </View>
      ))}
    </View>
  );
};

const styles = StyleSheet.create({
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
  // The switch renders at the OS size; scaled down, it leaves the row's text more room.
  switch: {
    transform: [{ scaleX: 0.85 }, { scaleY: 0.85 }],
    marginLeft: 8,
  },
});

export default PrivacyModeCard;
