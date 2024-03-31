import React from 'react';
import { FlatList, StyleSheet, View, Text } from 'react-native';
import { t } from 'ttag';
import { useNavigation } from '@react-navigation/native';

import { useSelector } from 'react-redux';
import { COLORS } from '../../styles/themes';
import HathorHeader from '../HathorHeader';
import { NoNanoContracts } from './NoNanoContracts.component';
import { RegisterNanoContract } from './RegisterNewNanoContractButton.component';
import { NanoContractsListItem } from './NanoContractsListItem.component';

/**
 * @param {Object} state Redux root state
 * @returns {Object} Array of registered Nano Contract with basic information
 */
const getRegisteredNanoContracts = (state) => {
  const { registeredContracts } = state.nanoContract;
  return Object.values(registeredContracts);
}

export const NanoContractsList = () => {
  const registeredNanoContracts = useSelector(getRegisteredNanoContracts);
  const navigation = useNavigation();

  const navigatesToNanoContractTransactions = () => {
    navigation.navigate('NanoContractTransactions');
  };
  const isEmpty = () => registeredNanoContracts.length === 0;

  return (
    <Wrapper>
      <Header />
      <ListWrapper>
        {isEmpty()
          && <NoNanoContracts />}
        {/* FlatList doesn't render when data is empty.
          * That's why we don't need a conditional rendering here. */}
        <FlatList
          data={registeredNanoContracts}
          renderItem={({ item, index }) => (
            <NanoContractsListItem
              item={item}
              index={index}
              onPress={navigatesToNanoContractTransactions}
            />
          )}
          keyExtractor={(nc) => nc.ncId}
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
