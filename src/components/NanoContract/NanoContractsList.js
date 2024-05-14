/**
 * Copyright (c) Hathor Labs and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import React from 'react';
import { StyleSheet, View, Text } from 'react-native';
import { t } from 'ttag';
import { useNavigation } from '@react-navigation/native';

import { useSelector } from 'react-redux';
import { COLORS } from '../../styles/themes';
import HathorHeader from '../HathorHeader';
import { HathorFlatList } from '../HathorFlatList';
import { NoNanoContracts } from './NoNanoContracts';
import { RegisterNanoContract } from './RegisterNewNanoContractButton';
import { NanoContractsListItem } from './NanoContractsListItem';

/**
 * It selects the list of registered Nano Contracts.
 *
 * @param {Object} state Redux root state
 * @returns {Object} Array of registered Nano Contract with basic information
 */
const getRegisteredNanoContracts = (state) => {
  const { registered } = state.nanoContract;
  return Object.values(registered);
}

/**
 * It presents a list of Nano Contracts or an empty content.
 */
export const NanoContractsList = () => {
  const registeredNanoContracts = useSelector(getRegisteredNanoContracts);
  const navigation = useNavigation();

  const navigatesToNanoContractTransactions = (nc) => {
    navigation.navigate('NanoContractTransactionsScreen', { nc });
  };
  const isEmpty = () => registeredNanoContracts.length === 0;
  const notEmpty = () => !isEmpty();

  return (
    <Wrapper>
      <Header />
      {isEmpty()
        && <ListWrapper><NoNanoContracts /></ListWrapper>}
      {notEmpty()
        && (
          <HathorFlatList
            data={registeredNanoContracts}
            renderItem={({ item }) => (
              <NanoContractsListItem
                item={item}
                onPress={() => navigatesToNanoContractTransactions(item)}
              />
            )}
            keyExtractor={(nc) => nc.ncId}
          />
        )}
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
    justifyContent: 'flex-start',
    alignItems: 'center',
    backgroundColor: COLORS.lowContrastDetail, // Defines an outer area on the main list content
  },
  listWrapper: {
    flex: 1,
    justifyContent: 'center',
    alignSelf: 'stretch',
    marginTop: 16,
    marginBottom: 45,
    backgroundColor: COLORS.backgroundColor,
    marginHorizontal: 16,
    borderRadius: 16,
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
