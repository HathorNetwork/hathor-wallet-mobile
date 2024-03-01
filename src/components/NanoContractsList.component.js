import React from 'react';
import { TouchableHighlight,FlatList, StyleSheet, View, Text, Image } from 'react-native';
import { t } from 'ttag';

import { getShortContent, getShortHash } from '../utils';
import chevronRight from '../assets/icons/chevron-right.png';
import { formatNanoContractRegistryEntry } from "../sagas/nanoContract";
import HathorHeader from "./HathorHeader";
import { COLORS } from "../styles/themes";
import { NanoContractIcon } from './NanoContractIcon.svg.component';
import { useNavigation } from '@react-navigation/native';
import SimpleButton from './SimpleButton';

const fixtureNanoContractData = [
  {
    address: 'HTeZeYTCv7cZ8u7pBGHkWsPwhZAuoq5j3V',
    ncId: '00c30fc8a1b9a326a766ab0351faf3635297d316fd039a0eda01734d9de40185',
    blueprintId: '0025dadebe337a79006f181c05e4799ce98639aedfbd26335806790bdea4b1d4',
    blueprintName: 'Swap',
  },
];

export const NanoContractsList = ({}) => {
  const navigation = useNavigation();
  const navigatesToNanoContractTransactions = () => {
    navigation.navigate('NanoContractTransactions');
  };
  return (
    <Wrapper>
      <Header />
      <ListWrapper>
        <FlatList
          data={fixtureNanoContractData}
          renderItem={({item, index}) => (
            <NcItem
              item={item}
              index={index}
              onPress={navigatesToNanoContractTransactions}
            />)}
          keyExtractor={(nc) => formatNanoContractRegistryEntry(nc.address, nc.ncId)}
        />
      </ListWrapper>
    </Wrapper>
  );
};


const Wrapper = ({ children }) => (
  <View style={[styles.wrapper]}>
    {children}
  </View>
);

const Header = () => (
  <HathorHeader>
    <HathorHeader.Left>
      <Text style={[styles.headerTitle]}>{t`Nano Contracts`}</Text>
    </HathorHeader.Left>
    <HathorHeader.Right>
      <RegisterNanoContract />
    </HathorHeader.Right>
  </HathorHeader>
);

const RegisterNanoContract = () => {
  const navigation = useNavigation();
  const navigatesToRegisterNanoContract = () => {
    navigation.navigate('RegisterNanoContract');
  };

  return (
    <SimpleButton
      title={t`Register new`}
      onPress={navigatesToRegisterNanoContract}
    />
  );
};

const ListWrapper = ({ children }) => (
  <View style={[styles.listWrapper]}>
    {children}
  </View>
);

/**
 * Renders each item of Nano Contract List.
 *
 * @param {Object} ncItem 
 * @property {Object} ncItem.item registered Nano Contract data
 * @property {number} ncItem.index position in the list
 */
const NcItem = ({ item, index, onPress }) => {
  return (
    <NcItemWrapper index={index} onPress={onPress}>
      <NcItemIcon />
      <NcItemContentWrapper nc={item} />
      <NcArrowLeft />
    </NcItemWrapper>
  );
};

const NcItemWrapper = ({ index, onPress, children }) => {
  const isFirstItem = index === 0;
  return (
    <TouchableHighlight
      style={[isFirstItem && styles.ncFirstItem]}
      onPress={onPress}
      underlayColor={COLORS.primaryOpacity30}
    >
      <View style={styles.ncWrapper}>{children}</View>
    </TouchableHighlight>
  );
};

const NcItemIcon = () => (
  <View style={styles.ncIcon}>
    <NanoContractIcon />
  </View>
);

/**
 * Renders item core content.
 *
 * @param {Object} ncItem
 * @property {Obeject} ncItem.nc registered Nano Contract data
 */
const NcItemContentWrapper = ({ nc }) => {
  return (
    <View style={styles.ncContentWrapper}>
      <Text style={[styles.ncText, styles.ncProperty]}>{'Nano Contract ID'}</Text>
      <Text style={[styles.ncText]}>{getShortHash(nc.ncId, 7)}</Text>
      <Text style={[styles.ncText, styles.ncProperty]}>{'Blueprint Name'}</Text>
      <Text style={[styles.ncText]}>{nc.blueprintName}</Text>
      <Text style={[styles.ncText, styles.ncProperty]}>{'Registered Address'}</Text>
      <Text style={[styles.ncText, styles.ncPadding0]}>{getShortContent(nc.address, 7)}</Text>
    </View>
  );
};

const NcArrowLeft = () => (
  <View>
    <Image source={chevronRight} width={24} height={24} />
  </View>
);

const styles = StyleSheet.create({
  wrapper: {
    flex: 1,
    alignItems: 'center',
    backgroundColor: COLORS.lowContrastDetail, // Defines an outer area on the main list content
  },
  listWrapper: {
    alignSelf: 'stretch',
    flex: 1,
    marginTop: 16,
    backgroundColor: COLORS.backgroundColor,
    marginHorizontal: 16,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    shadowOffset: { height: 2, width: 0 },
    shadowRadius: 4,
    shadowColor: COLORS.textColor,
    shadowOpacity: 0.08,
  },
  headerTitle: {
    fontSize: 24,
    lineHeight: 24,
    fontWeight: 'bold',
  },
  ncWrapper: {
    paddingVertical: 24,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
    borderColor: COLORS.borderColor,
  },
  ncFirstItem: {
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
  },
  ncContentWrapper: {
    maxWidth: '80%',
    flexDirection: 'column',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginRight: 'auto',
    paddingHorizontal: 16,
  },
  ncIcon: {
    paddingVertical: 6,
    paddingHorizontal: 8,
    backgroundColor: COLORS.primary,
    alignSelf: 'flex-start',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 8,
  },
  ncText: {
    fontSize: 14,
    lineHeight: 20,
    paddingBottom: 6,
    color: 'hsla(0, 0%, 38%, 1)',
  },
  ncProperty: {
    paddingBottom: 4,
    fontWeight: 'bold',
    color: 'black',
  },
  ncPadding0: {
    paddingBottom: 0,
  },
});
