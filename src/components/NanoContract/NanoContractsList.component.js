import React from 'react';
import { FlatList, StyleSheet, View, Text } from 'react-native';
import { t } from 'ttag';
import { useNavigation } from '@react-navigation/native';

import { COLORS } from "../../styles/themes";
import { formatNanoContractRegistryEntry } from "../../sagas/nanoContract";
import HathorHeader from "../HathorHeader";
import { NoNanoContracts } from './NoNanoContracts.component';
import { RegisterNanoContract } from './RegisterNewNanoContractButton.component';
import { NanoContractsListItem } from './NanoContractsListItem.component';

const fixtureNanoContractData = [
  {
    address: 'HTeZeYTCv7cZ8u7pBGHkWsPwhZAuoq5j3V',
    ncId: '00c30fc8a1b9a326a766ab0351faf3635297d316fd039a0eda01734d9de40185',
    blueprintId: '0025dadebe337a79006f181c05e4799ce98639aedfbd26335806790bdea4b1d4',
    blueprintName: 'Swap',
  },
];

const fixtureEmptyList = [];

export const NanoContractsList = ({}) => {
  const navigation = useNavigation();
  const navigatesToNanoContractTransactions = () => {
    navigation.navigate('NanoContractTransactions');
  };
  const isEmpty = () => fixtureNanoContractData.length === 0;

  return (
    <Wrapper>
      <Header />
      <ListWrapper>
        {isEmpty() &&
          <NoNanoContracts />}
        {/* FlatList doesn't render when data is empty.
          * That's why we don't need a conditional rendering here. */}
        <FlatList
          data={fixtureNanoContractData}
          renderItem={({item, index}) => (
            <NanoContractsListItem
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

const ListWrapper = ({ children }) => (
  <View style={[styles.listWrapper]}>
    {children}
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
});
