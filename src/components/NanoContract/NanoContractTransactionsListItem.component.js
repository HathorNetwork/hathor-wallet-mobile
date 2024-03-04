/**
 * Copyright (c) Hathor Labs and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { FontAwesomeIcon } from '@fortawesome/react-native-fontawesome';
import { faWallet, faRegistered, faGrip } from '@fortawesome/free-solid-svg-icons';
import React from 'react';
import { TouchableHighlight,StyleSheet, View, Text, Image } from 'react-native';
import { t } from 'ttag';

import chevronRight from '../../assets/icons/chevron-right.png';
import { COLORS } from "../../styles/themes";
import { getShortHash, getTimestampFormat } from '../../utils';
import { NanoContractIcon } from './NanoContractIcon.svg.component';

const originFlag = {
  mine: t`From registered address`,
  wallet: t`From this wallet`,
  oracle: t`From Nano Contract itself`,
  other: t`From elsewhere`,
};

/**
 * Renders each item of Nano Contract Transactions List.
 *
 * @param {Object} ncItem 
 * @property {Object} ncItem.item registered Nano Contract data
 * @property {number} ncItem.index position in the list
 */
export const NanoContractTransactionsListItem = ({ item, index, onPress }) => {
  return (
    <Wrapper index={index} onPress={onPress}>
      <OriginIcon origin={item.callerOrigin} />
      <ContentWrapper tx={item} />
      <ArrowLeft />
    </Wrapper>
  );
};

const Wrapper = ({ index, onPress, children }) => {
  const isFirstItem = index === 0;
  return (
    <TouchableHighlight
      style={[isFirstItem && styles.firstItem]}
      onPress={onPress}
      underlayColor={COLORS.primaryOpacity30}
    >
      <View style={styles.wrapper}>{children}</View>
    </TouchableHighlight>
  );
};

/**
 * @param {'mine'|'wallet'|'oracle'|'other'} flag
 */
const OriginIcon = ({ origin }) => (
  <View style={[styles.icon]}>
    {origin === 'other' &&
      <FontAwesomeIcon icon={faGrip} size={18} color={'white'} />}
    {origin === 'mine' &&
      <FontAwesomeIcon icon={faRegistered} size={18} color={'white'} />}
    {origin === 'wallet' &&
      <FontAwesomeIcon icon={faWallet} size={18} color={'white'} />}
    {origin === 'oracle' &&
      <NanoContractIcon />}
  </View>
);

/**
 * Renders item core content.
 *
 * @param {Object} ncItem
 * @property {Obeject} ncItem.nc registered Nano Contract data
 */
const ContentWrapper = ({ tx }) => {
  return (
    <View style={styles.contentWrapper}>
      <Text style={[styles.text, styles.property]}>{getShortHash(tx.txId, 7)}</Text>
      <Text style={[styles.text]}>{tx.ncMethod}</Text>
      <Text style={[styles.text]}>{getTimestampFormat(tx.timestamp)}</Text>
      <Text style={[styles.text]}>{originFlag[tx.callerOrigin]}</Text>
    </View>
  );
};

const ArrowLeft = () => (
  <View>
    <Image source={chevronRight} width={24} height={24} />
  </View>
);

const styles = StyleSheet.create({
  wrapper: {
    paddingVertical: 24,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
    borderColor: COLORS.borderColor,
  },
  firstItem: {
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
  },
  contentWrapper: {
    maxWidth: '80%',
    flexDirection: 'column',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginRight: 'auto',
    paddingHorizontal: 16,
  },
  icon: {
    paddingVertical: 6,
    paddingHorizontal: 8,
    alignSelf: 'flex-start',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 8,
    backgroundColor: COLORS.primary,
  },
  text: {
    fontSize: 14,
    lineHeight: 20,
    paddingBottom: 6,
    color: 'hsla(0, 0%, 38%, 1)',
  },
  property: {
    paddingBottom: 4,
    fontWeight: 'bold',
    color: 'black',
  },
  padding0: {
    paddingBottom: 0,
  },
});
