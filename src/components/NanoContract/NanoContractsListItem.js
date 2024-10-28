/**
 * Copyright (c) Hathor Labs and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import React from 'react';
import { TouchableHighlight, StyleSheet, View, Text, Image } from 'react-native';
import { t } from 'ttag';

import chevronRight from '../../assets/icons/chevron-right.png';
import { COLORS } from '../../styles/themes';
import { getShortHash } from '../../utils';
import { NanoContractIcon } from '../Icons/NanoContract.icon';

/**
 * It renders an item of Nano Contracts list.
 *
 * @param {Object} props
 * @param {Object} props.item Registered Nano Contract data
 * @param {() => {}} props.onPress Callback function called on press
 */
export const NanoContractsListItem = ({ item, onPress }) => (
  <Wrapper onPress={onPress}>
    <Icon />
    <NanoContractSummary nc={item} />
    <ArrowRight />
  </Wrapper>
);

const Wrapper = ({ onPress, children }) => (
  <TouchableHighlight
    onPress={onPress}
    underlayColor={COLORS.primaryOpacity30}
  >
    <View style={styles.wrapper}>{children}</View>
  </TouchableHighlight>
);

const Icon = () => (
  <View style={styles.icon}>
    <NanoContractIcon type='fill' color={COLORS.white} />
  </View>
);

/**
 * It presents summarized Nano Contract information.
 *
 * @param {Object} props
 * @param {Object} props.nc Registered Nano Contract data
 * @param {string} props.nc.ncId
 * @param {string} props.nc.blueprintName
 */
const NanoContractSummary = ({ nc }) => (
  <View style={styles.contentWrapper}>
    <Text style={[styles.text, styles.property]}>{t`Nano Contract ID`}</Text>
    <Text style={[styles.text]}>{getShortHash(nc.ncId, 7)}</Text>
    <Text style={[styles.text, styles.property]}>{t`Blueprint Name`}</Text>
    <Text style={[styles.text, styles.padding0]}>{nc.blueprintName}</Text>
  </View>
);

const ArrowRight = () => (
  <View>
    <Image source={chevronRight} width={24} height={24} />
  </View>
);

const styles = StyleSheet.create({
  wrapper: {
    paddingVertical: 16,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
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
    alignSelf: 'flex-start',
  },
  text: {
    fontSize: 14,
    lineHeight: 20,
    paddingBottom: 6,
    color: COLORS.textLabel,
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
