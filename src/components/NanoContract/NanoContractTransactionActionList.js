/**
 * Copyright (c) Hathor Labs and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { StyleSheet, View } from 'react-native';
import { useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { t } from 'ttag';
import { COLORS } from '../../styles/themes';
import { NanoContractTransactionActionListItem } from './NanoContractTransactionActionListItem';
import { HathorFlatList } from '../HathorFlatList';
import { FeedbackContent } from '../FeedbackContent';
import { unregisteredTokensDownloadRequest } from '../../actions';
import { DEFAULT_TOKEN } from '../../constants';

/**
 * It presents a list of actions of a transaction.
 *
 * @param {Object} props
 * @param {Object} props.tx Transaction data
 */
export const NanoContractTransactionActionList = ({ tx }) => {
  const dispatch = useDispatch();
  const knownTokens = useSelector((state) => ({ ...state.tokens, ...state.unregisteredTokens }));
  
  const isEmpty = () => tx.actions.length === 0;
  const notEmpty = () => !isEmpty();
  
  // Request token data for unknown tokens
  useEffect(() => {
    const unknownTokensUid = [];
    const actionTokensUid = tx.actions?.map((each) => each.uid) || [];
    actionTokensUid.forEach((uid) => {
      if (uid !== DEFAULT_TOKEN.uid && !(uid in knownTokens)) {
        unknownTokensUid.push(uid);
      }
    });

    if (unknownTokensUid.length > 0) {
      dispatch(unregisteredTokensDownloadRequest({ uids: unknownTokensUid }));
    }
  }, [tx.actions, knownTokens, dispatch]);

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
