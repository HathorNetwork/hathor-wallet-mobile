/**
 * Copyright (c) Hathor Labs and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import React, { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useSelector } from 'react-redux';
import { t } from 'ttag';
import { COLORS } from '../../styles/themes';
import { NanoContractTransactionBalanceListItem } from './NanoContractTransactionBalanceListItem.component';
import { HathorFlatList } from '../HathorFlatList';
import { FeedbackContent } from '../FeedbackContent';

/**
 * It presents a list of balance for tokens input and ouput of a transaction.
 *
 * @param {Object} props
 * @param {Object} props.tx Transaction data
 */
export const NanoContractTransactionBalanceList = ({ tx }) => {
  const wallet = useSelector((state) => state.wallet);
  const [tokensBalance, setTokensBalance] = useState([]);

  useEffect(() => {
    const fetchTokensBalance = async () => {
      // TODO: getActions must be implemented in the lib
      const balance = await getActions(tx, wallet);
      setTokensBalance(balance);
    };
    fetchTokensBalance();
  }, []);

  const isEmpty = () => tokensBalance.length === 0;
  const notEmpty = () => !isEmpty();

  return (
    <Wrapper>
      {isEmpty()
        && (<NoTokenBalance />)}
      {notEmpty()
        && (
          <HathorFlatList
            data={tokensBalance}
            renderItem={({ item, index }) => (
              <NanoContractTransactionBalanceListItem
                item={item}
                index={index}
              />
            )}
            keyExtractor={(item) => item.tokenUid}
          />
        )}
    </Wrapper>
  );
};

const NoTokenBalance = () => (
  <FeedbackContent
    title={t`No Tokens Balance`}
    message={t`The transaction doesn't have token deposit or token withdrawal.`}
  />
);

const Wrapper = ({ children }) => (
  <View style={styles.wrapper}>
    {children}
  </View>
);

const styles = StyleSheet.create({
  wrapper: {
    flex: 1,
    alignSelf: 'stretch',
    backgroundColor: COLORS.lowContrastDetail, // Defines an outer area on the main list content
  },
});
