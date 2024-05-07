import React from 'react';
import { TouchableHighlight, StyleSheet, View, Text, Image } from 'react-native';

import chevronRight from '../../assets/icons/chevron-right.png';
import { COLORS } from '../../styles/themes';
import { getShortHash } from '../../utils';
import { NanoContractIcon } from './NanoContractIcon.icon';

/**
 * Renders each item of Nano Contract List.
 *
 * @param {Object} ncItem
 * @property {Object} ncItem.item registered Nano Contract data
 * @property {number} ncItem.index position in the list
 */
export const NanoContractsListItem = ({ item, onPress }) => (
  <Wrapper onPress={onPress}>
    <Icon />
    <ContentWrapper nc={item} />
    <ArrowLeft />
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
    <NanoContractIcon />
  </View>
);

/**
 * Renders item core content.
 *
 * @param {Object} ncItem
 * @property {Obeject} ncItem.nc registered Nano Contract data
 */
const ContentWrapper = ({ nc }) => (
  <View style={styles.contentWrapper}>
    <Text style={[styles.text, styles.property]}>Nano Contract ID</Text>
    <Text style={[styles.text]}>{getShortHash(nc.ncId, 7)}</Text>
    <Text style={[styles.text, styles.property]}>Blueprint Name</Text>
    <Text style={[styles.text, styles.padding0]}>{nc.blueprintName}</Text>
  </View>
);

const ArrowLeft = () => (
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
    paddingVertical: 6,
    paddingHorizontal: 8,
    backgroundColor: COLORS.primary,
    alignSelf: 'flex-start',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 8,
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
