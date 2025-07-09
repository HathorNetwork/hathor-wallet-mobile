/**
 * Copyright (c) Hathor Labs and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { StyleSheet, View } from 'react-native';
import { t } from 'ttag';
import { COLORS } from '../../styles/themes';
import { NanoContractTransactionActionListItem } from './NanoContractTransactionActionListItem';
import { HathorFlatList } from '../HathorFlatList';
import { FeedbackContent } from '../FeedbackContent';
import { useNanoContractTokens } from '../../hooks/useNanoContractTokens';

/**
 * It presents a list of actions of a transaction.
 *
 * @param {Object} props
 * @param {Object} props.tx Transaction data
 */
export const NanoContractTransactionActionList = ({ tx }) => {
  // Use shared token manager to handle token requests
  useNanoContractTokens(tx.actions);

  const isEmpty = () => tx.actions.length === 0;
  const notEmpty = () => !isEmpty();

  return (
    <Wrapper>
      {isEmpty()
        && (<NoActions />)}
      {notEmpty()
        && (
          <HathorFlatList
            data={tx.actions}
            renderItem={({ item }) => (
              <NanoContractTransactionActionListItem
                item={item}
                txMetadata={tx.tokenMetadata || {}}
              />
            )}
          />
        )}
    </Wrapper>
  );
};

const NoActions = () => (
  <FeedbackContent
    title={t`No Actions`}
    message={t`See full transaction details on Public Explorer.`}
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
