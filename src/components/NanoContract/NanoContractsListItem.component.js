import React from 'react';
import { TouchableHighlight, StyleSheet, View, Text, Image } from 'react-native';

import chevronRight from '../../assets/icons/chevron-right.png';
import { COLORS } from '../../styles/themes';
import { getShortContent, getShortHash } from '../../utils';
import { NanoContractIcon } from './NanoContractIcon.svg.component';

/**
 * Renders each item of Nano Contract List.
 *
 * @param {Object} ncItem
 * @property {Object} ncItem.item registered Nano Contract data
 * @property {number} ncItem.index position in the list
 */
export const NanoContractsListItem = ({ item, index, onPress }) => (
  <Wrapper index={index} onPress={onPress}>
    <Icon />
    <ContentWrapper nc={item} />
    <ArrowLeft />
  </Wrapper>
);

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
    <Text style={[styles.text]}>{nc.blueprintName}</Text>
    <Text style={[styles.text, styles.property]}>Registered Address</Text>
    <Text style={[styles.text, styles.padding0]}>{getShortContent(nc.address, 7)}</Text>
  </View>
);

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
