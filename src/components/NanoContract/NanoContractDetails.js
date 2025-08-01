/**
 * Copyright (c) Hathor Labs and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { useNavigation } from '@react-navigation/native';
import React, { useCallback, useEffect, useState } from 'react';
import {
  StyleSheet,
  View,
  Image,
} from 'react-native';
import { useDispatch, useSelector } from 'react-redux';
import { t } from 'ttag';
import { NanoContractDetailsHeader } from './NanoContractDetailsHeader';
import { NanoContractTransactionsListItem } from './NanoContractTransactionsListItem';
import { COLORS } from '../../styles/themes';
import { nanoContractAddressChangeRequest, nanoContractHistoryRequest } from '../../actions';
import { HathorFlatList } from '../HathorFlatList';
import Spinner from '../Spinner';
import errorIcon from '../../assets/images/icErrorBig.png';
import SimpleButton from '../SimpleButton';
import { FeedbackContent } from '../FeedbackContent';
import NewHathorButton from '../NewHathorButton';

/**
 * Retrieves Nano Contract details from Redux.
 *
 * @param {string} ncId Nano Contract ID
 *
 * @returns {{
 *   txHistory: Object[];
 *   isLoading: boolean;
 *   error: string;
 * }}
 */
const getNanoContractDetails = (ncId) => (state) => {
  /* Without this default the app breaks after the current Nano Contract unregistration.
   * By having a default value the app can render the component normally after unregistration
   * and let it step aside while coming back to Dashboard screen. This transition happens
   * quickly, therefore the user will not have time to see the default state.
   */
  const defaultMeta = { isLoading: false, error: null };
  const txHistory = state.nanoContract.history[ncId] || [];
  const { isLoading, error } = state.nanoContract.historyMeta[ncId] || defaultMeta;
  return {
    txHistory,
    isLoading,
    error,
  };
}

/**
 * It presents a list of transactions from selected Nano Contract.
 *
 * @param {Object} props
 * @param {Object} props.nc Nano Contract data
 * @param {string} props.nc.ncId Nano Contract ID
 * @param {string} props.nc.address Default caller address for Nano Contract interaction
 */
export const NanoContractDetails = ({ nc }) => {
  const dispatch = useDispatch();
  const navigation = useNavigation();

  const {
    txHistory,
    isLoading,
    error,
  } = useSelector(getNanoContractDetails(nc.ncId));
  const [ncAddress, changeNcAddress] = useState(nc.address);

  const onAddressChange = (newAddress) => {
    changeNcAddress(newAddress);
    dispatch(nanoContractAddressChangeRequest({ newAddress, ncId: nc.ncId }));
  }

  const navigatesToNanoContractTransaction = (tx) => {
    navigation.navigate('NanoContractTransactionScreen', { tx });
  };

  // This effect runs only once when the component is first built.
  useEffect(() => {
    if (txHistory.length === 0) {
      /* The first time we load the Nano Contract details its transaction history is empty.
       * The second time it is garanteed that its transaction history is not empty,
       * because a Nano Contract must have at least the 'initialize' transaction to exists.
       * For the first transaction history load we don't need to specify the `after` param,
       * it will be set during the load.
       */
      dispatch(nanoContractHistoryRequest({ ncId: nc.ncId }));
    } else {
      // Fetch new transactions when there are some transactions in the history.
      dispatch(nanoContractHistoryRequest({ ncId: nc.ncId, before: txHistory[0].txId }));
    }
  }, []);

  /**
   * Triggered when a user makes the pull gesture on the transaction history content.
   */
  const handleNewerTransactions = () => {
    dispatch(nanoContractHistoryRequest({ ncId: nc.ncId, before: txHistory[0].txId }));
  };

  /* If an error happens on loading transactions history, an error feedback
   * content must be presented to the user, and must have precedence over
   * all other content.
   */
  const hasError = () => error != null;
  const isEmpty = () => txHistory.length === 0 && !hasError();
  const notEmpty = () => !isEmpty() && !hasError();

  return (
    <Wrapper>
      <NanoContractDetailsHeader
        nc={nc}
        address={ncAddress}
        onAddressChange={onAddressChange}
      />
      {isLoading && (
        <Spinner style={styles.center} size={14} animating />
      )}
      {hasError()
        && (<ErrorLoadingTransaction ncId={nc.ncId} error={error} />)}
      {isEmpty()
        && (<NoNanoContractTransaction />)}
      {notEmpty()
        && (
          <HathorFlatList
            data={txHistory}
            renderItem={({ item }) => (
              <NanoContractTransactionsListItem
                item={item}
                onPress={() => navigatesToNanoContractTransaction(item)}
              />
            )}
            keyExtractor={(item) => item.txId}
            refreshing={isLoading}
            // Enables the pull gesture to get newer transactions
            onRefresh={handleNewerTransactions}
            // Enables a button to load more of older transactions until the end
            // By reaching the end, the button ceases to render
            ListFooterComponent={<LoadMoreButton lastTx={txHistory.slice(-1,).pop()} />}
            extraData={[isLoading, error]}
          />
        )}
    </Wrapper>
  );
};

/**
 * It shows a button to 'Load More' transactions after the last one.
 * It hides the button when the last transaction is the initialize.
 *
 * @param {Object} prop Properties object
 * @param {{
 *   ncId: string;
 *   txId: string;
 * }} prop.lastTx A transaction item from transaction history
 */
const LoadMoreButton = ({ lastTx }) => {
  const dispatch = useDispatch();
  const isInitializeTx = lastTx.ncMethod === 'initialize';

  /**
   * This handling will dispatch an action to request for
   * older transactions after a txId.
   */
  const handleLoadMore = useCallback(() => {
    dispatch(nanoContractHistoryRequest({
      ncId: lastTx.ncId,
      after: lastTx.txId,
    }));
  }, [dispatch, lastTx]);

  return !isInitializeTx && (
    <NewHathorButton
      title={t`Load More`}
      onPress={handleLoadMore}
      discrete
      wrapperStyle={{
        marginTop: 16,
      }}
    />
  )
};

/**
 * @param {Object} props
 * @param {Object?} props.children Either a react component or a react element
 */
const Wrapper = ({ children }) => (
  <View style={styles.wrapper}>
    {children}
  </View>
);

/**
 * Renders a feedback for the lack of transactions.
 */
export const NoNanoContractTransaction = () => (
  <FeedbackContent
    title={t`Loading`}
    message={t`Loading Nano Contract transactions.`}
  />
);

/**
 * Renders an error feedback for when the history load request goes wrong,
 * and provides a call to action to try fetch the history again.
 *
 * @param {Object} props
 * @param {string} props.ncId Nano Contract ID
 * @param {string} props.error
 */
export const ErrorLoadingTransaction = ({ ncId, error }) => (
  <FeedbackContent
    title={t`Nano Contract Transactions Error`}
    message={error}
    icon={<Image source={errorIcon} style={{ height: 36, width: 36 }} resizeMode='contain' />}
    action={<TryAgain ncId={ncId} />}
  />
);

/**
 * Renders a call to action to request history loading again.
 *
 * @param {Object} props
 * @param {string} props.ncId Nano Contract ID
 */
export const TryAgain = ({ ncId }) => {
  const dispatch = useDispatch();
  const fetchTransactionsHistory = () => {
    dispatch(nanoContractHistoryRequest({ ncId, after: null }));
  };

  return (
    <SimpleButton
      title={t`Try again`}
      onPress={fetchTransactionsHistory}
    />
  );
};

const styles = StyleSheet.create({
  wrapper: {
    flex: 1,
    justifyContent: 'flex-start',
    alignSelf: 'stretch',
    backgroundColor: COLORS.lowContrastDetail, // Defines an outer area on the main list content
  },
  center: {
    alignSelf: 'center',
  },
});
