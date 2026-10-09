/**
 * Copyright (c) Hathor Labs and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useDispatch, useSelector } from 'react-redux';
import { msgid, ngettext, t } from 'ttag';

import SimpleButton from '../SimpleButton';
import ShieldedUnlockAction from './ShieldedUnlockAction';
import { ShieldPadlockIcon } from '../Icons/ShieldPadlock.icon';
import { EyeIcon } from '../Icons/Eye.icon';
import { shieldedReprocessRequested } from '../../actions';
import { splitAvailableBalance } from '../../shielded/balance';
import { isShieldedUnlockInProgress, selectShieldedUnlock } from '../../shielded/unlockState';
import { renderHomeValue } from '../../utils';
import { COLORS } from '../../styles/themes';

/**
 * The capability levels at which the wallet has a shielded chain, so its private balance means
 * something: it watches its shielded addresses ('watch'), or decodes what they receive.
 */
const SPLIT_LEVELS = ['watch', 'view', 'full'];

/**
 * The lock cause of a stored scan key that no PIN can unlock.
 */
const CORRUPT_KEY_CAUSE = 'corrupt-key';

/**
 * The available balance of a token, split into its private and public parts, which add up to
 * it. Under it, what the shielded capability says about the private part:
 * - locked (level 'watch'): how many private outputs are locked, a count over the whole wallet,
 *   and the action that unlocks them, unless no PIN can unlock the scan key;
 * - outputs the wallet failed to read: a retry;
 * - a history the wallet couldn't load in full: a note.
 * While an unlock or a retry runs, a spinner stands in for the actions.
 *
 * It renders nothing until the private part is known, or when it couldn't be read.
 *
 * @param {Object} props
 * @param {bigint} props.available The token's available balance
 * @param {bigint|null|undefined} props.privateAvailable Its private part
 * @param {Object|null} props.capability The wallet's IShieldedCapability
 * @param {boolean} props.isNFT
 * @param {number} props.decimalPlaces
 * @param {string} props.amountFormat
 * @param {{ navigate: Function }} props.navigation Opens the PIN screen of the unlock
 */
export default function ShieldedBalanceSplit({
  available,
  privateAvailable,
  capability,
  isNFT,
  decimalPlaces,
  amountFormat,
  navigation,
}) {
  const dispatch = useDispatch();
  const unlock = useSelector(selectShieldedUnlock);

  if (typeof privateAvailable !== 'bigint' || !SPLIT_LEVELS.includes(capability?.level)) {
    return null;
  }

  const split = splitAvailableBalance(available, privateAvailable);
  const privateStr = renderHomeValue(split.privateAvailable, isNFT, decimalPlaces, amountFormat);
  const publicStr = renderHomeValue(split.publicAvailable, isNFT, decimalPlaces, amountFormat);

  const locked = capability.level === 'watch';
  const unlockable = locked && capability.cause !== CORRUPT_KEY_CAUSE;
  const count = locked ? capability.undecoded.locked : 0;
  const unreadable = capability.undecoded.error > 0;
  const inProgress = isShieldedUnlockInProgress(unlock);

  const renderAction = () => {
    if (unlockable || inProgress) {
      return <ShieldedUnlockAction navigation={navigation} />;
    }
    if (unreadable) {
      return (
        <SimpleButton
          title={t`Retry`}
          textStyle={styles.action}
          onPress={() => dispatch(shieldedReprocessRequested())}
        />
      );
    }
    return null;
  };

  return (
    <View style={styles.wrapper}>
      <View style={styles.splitRow}>
        <View style={styles.splitItem}>
          <ShieldPadlockIcon size={24} color={COLORS.textColor} />
          <Text style={styles.splitValue}>{privateStr}</Text>
          <Text style={styles.splitLabel}>{t`Private`}</Text>
        </View>
        <View style={styles.splitItem}>
          <EyeIcon size={24} color={COLORS.textColor} />
          <Text style={styles.splitValue}>{publicStr}</Text>
          <Text style={styles.splitLabel}>{t`Public`}</Text>
        </View>
      </View>
      {count > 0 && (
        <Text style={styles.hint}>
          {ngettext(
            msgid`${count} private output is locked`,
            `${count} private outputs are locked`,
            count,
          )}
        </Text>
      )}
      {locked && !unlockable && (
        <Text style={styles.hint}>{t`Private transfers are not available for this wallet.`}</Text>
      )}
      {unreadable && (
        <Text style={styles.hint}>{t`Some private funds could not be read.`}</Text>
      )}
      {!capability.historyComplete && (
        <Text style={styles.hint}>{t`Your private balance may be incomplete.`}</Text>
      )}
      {renderAction()}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    alignItems: 'center',
  },
  splitRow: {
    flexDirection: 'row',
    // Each icon, value and label group wraps onto its own row when the values are too wide to
    // fit side by side.
    flexWrap: 'wrap',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 24,
    gap: 16,
  },
  splitItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  splitValue: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.textColor,
  },
  splitLabel: {
    fontSize: 16,
    color: COLORS.textColorShadow,
  },
  hint: {
    marginTop: 8,
    fontSize: 12,
    lineHeight: 16,
    textAlign: 'center',
    color: COLORS.textColorShadow,
  },
  action: {
    fontWeight: 'bold',
  },
});
