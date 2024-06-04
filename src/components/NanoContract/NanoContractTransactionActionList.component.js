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
import { NanoContractTransactionActionListItem } from './NanoContractTransactionActionListItem.component';
import { HathorFlatList } from '../HathorFlatList';
import { FeedbackContent } from '../FeedbackContent';

/**
 * It presents a list of actions of a transaction.
 *
 * @param {Object} props
 * @param {Object} props.tx Transaction data
 */
export const NanoContractTransactionActionList = ({ tx }) => {
  const wallet = useSelector((state) => state.wallet);
  const [actions, setActions] = useState([]);

  useEffect(() => {
    // TODO: implement fetchActions to get actions of a transaction
    const fetchActions = async () => {
      // TODO: getActions must be implemented in the lib
      const actions = await getActions(tx, wallet);
      setActions(actions);
    };
    fetchActions();
  }, []);

  const isEmpty = () => actions.length === 0;
  const notEmpty = () => !isEmpty();

  return (
    <Wrapper>
      {isEmpty()
        && (<NoTokenBalance />)}
      {notEmpty()
        && (
          <HathorFlatList
            data={actions}
            renderItem={({ item, index }) => (
              <NanoContractTransactionActionListItem
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
