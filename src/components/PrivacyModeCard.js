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
import { DEFAULT_TOKEN, PRIVACY_MODE } from '../constants';

const {
  FEE_PER_AMOUNT_SHIELDED_OUTPUT,
  FEE_PER_FULL_SHIELDED_OUTPUT,
} = hathorLibConstants;

/**
 * The privacy modes, most private first: each mode's icon, title and description, and the
 * privacy fee each of its outputs pays (null for Public, whose outputs pay none).
 *
 * @returns {{ mode: string, Icon: Function, title: string, description: string,
 *   feePerOutput: bigint|null }[]}
 */
export function getPrivacyModeDetails() {
  return [
    {
      mode: PRIVACY_MODE.PRIVATE,
      Icon: ShieldPadlockIcon,
      title: t`Private`,
      // A fully shielded output hides its token only among the tokens the tx spends, and the
      // fee always spends HTR: an HTR output stays known as HTR.
      description: t`Amount hidden. The token is hidden among the tokens this send spends, but never when it is HTR.`,
      feePerOutput: FEE_PER_FULL_SHIELDED_OUTPUT,
    },
    {
      mode: PRIVACY_MODE.HIDE_AMOUNT,
      Icon: EyeOffSlashIcon,
      title: t`Hide amount`,
      description: t`Token visible, amount hidden`,
      feePerOutput: FEE_PER_AMOUNT_SHIELDED_OUTPUT,
    },
    {
      mode: PRIVACY_MODE.PUBLIC,
      Icon: EyeIcon,
      title: t`Public`,
      description: t`Token and amount visible`,
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

const ALL_MODES = Object.values(PRIVACY_MODE);

/**
 * The privacy modes a send can pick, one row each, with a switch for the selected one. Each row
 * shows the privacy fee of the mode's outputs in the network's native token. A send that spends
 * private funds keeps its change private, so even a Public send can pay a privacy fee.
 *
 * @param {Object} props
 * @param {string} props.selectedMode One of PRIVACY_MODE
 * @param {function(string): void} props.onSelect Called with the mode the user switches on
 * @param {string[]} [props.options] The modes to offer, all of them by default
 */
const PrivacyModeCard = ({ selectedMode, onSelect, options = ALL_MODES }) => {
  const decimalPlaces = useSelector((state) => state.serverInfo?.decimal_places);
  const amountFormat = useSelector(getDisplayAmountFormat);
  const symbol = useSelector(
    (state) => state.serverInfo?.native_token?.symbol ?? DEFAULT_TOKEN.symbol,
  );

  const feeLabel = (feePerOutput) => {
    if (feePerOutput === null) {
      return t`No privacy fee unless the send spends private funds`;
    }
    const fee = renderValue(feePerOutput, false, decimalPlaces, amountFormat);
    return t`Fee: ${fee} ${symbol} per private output`;
  };

  const rows = getPrivacyModeDetails().filter((detail) => options.includes(detail.mode));

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
