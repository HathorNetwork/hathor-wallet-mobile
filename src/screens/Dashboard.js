/**
 * Copyright (c) Hathor Labs and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import React, { useState } from 'react';
import { StyleSheet, View, Text, Button } from 'react-native';
import { useDispatch, useSelector } from 'react-redux';
import { t } from 'ttag';
import { get } from 'lodash';
import { useNavigation } from '@react-navigation/native';

import AskForPushNotification from '../components/AskForPushNotification';
import HathorHeader from '../components/HathorHeader';
import TokenSelect from '../components/TokenSelect';
import SimpleButton from '../components/SimpleButton';
import OfflineBar from '../components/OfflineBar';
import { TwoOptionsToggle } from '../components/TwoOptionsToggle';
import { tokenFetchBalanceRequested, updateSelectedToken } from '../actions';
import ShowPushNotificationTxDetails from '../components/ShowPushNotificationTxDetails';
import AskForPushNotificationRefresh from '../components/AskForPushNotificationRefresh';
import { COLORS } from '../styles/themes';
import { TOKEN_DOWNLOAD_STATUS } from '../sagas/tokens';
import { NanoContractsList } from '../components/NanoContract/NanoContractsList';
import { getNanoContractFeatureToggle } from '../utils';
import { Address } from '@hathor/wallet-lib';

/**
 * State filter to retrieve token-related data from root state.
 *
 * @typedef {Object} TokenData
 * @property {string} selectedToken - Current token selected.
 * @property {string[]} tokens - Array containing all the tokens registered on the wallet.
 * @property {{ [uid: string]: Object }} tokensBalance - Map of balance per token.
 * @property {{ [uid: string]: Object }} tokensMetadata - Map of token's metadata per token.
 *
 * @returns {TokenData} Token-related data obtained from the root state.
 */
const getTokensState = (state) => ({
  selectedToken: state.selectedToken,
  tokens: state.tokens,
  tokensBalance: state.tokensBalance,
  tokensMetadata: state.tokenMetadata,
});

// Check if the token balance is already loaded
/**
 * @param {{ [uid: string]: Object }} tokensBalance a map of token's balance per token uid
 * @param {{ uid: string }} token the token data
 * @returns {string} the status of the current tokens balance loading process.
 */
const getTokensBalanceStatus = (tokensBalance, token) => get(tokensBalance, `${token.uid}.status`, TOKEN_DOWNLOAD_STATUS.LOADING);

/**
 * @param {string} status the current status from tokens balance loading process.
 * @returns {boolean} `true` if loading, `false` otherwise.
 */
const isTokensBalanceLoading = (status) => status === TOKEN_DOWNLOAD_STATUS.LOADING;

/**
 * @param {string} status the current status from tokens balance loading process.
 * @returns {boolean} `true` if failed, `false` otherwise.
 */
const isTokensBalanceFailed = (status) => status === TOKEN_DOWNLOAD_STATUS.FAILED;

/**
 * Enum for the list component that can be selected to render on Dashboard.
 * @readonly
 * @enum {string}
 */
const listOption = {
  tokens: 'tokens',
  nanoContracts: 'nanoContracts',
};

/**
 * @param {listOption} currList the list component selected to be rendered.
 * @returns {boolean} `true` if tokens list is selected, `false` otherwise.
 */
const isTokensSelected = (currList) => currList === listOption.tokens;

/**
 * @param {listOption} currList the list component selected to be rendered.
 * @returns {boolean} `true` if nanoContracts list is selected, `false` otherwise.
 */
const isNanoContractsSelected = (currList) => currList === listOption.nanoContracts;

export const Dashboard = () => {
  const {
    tokens,
    tokensBalance,
    selectedToken,
    tokensMetadata,
  } = useSelector(getTokensState);
  const isNanoContractEnabled = useSelector(getNanoContractFeatureToggle);
  const wallet = useSelector((state) => state.wallet);

  const [currList, selectList] = useState(listOption.tokens);
  const navigation = useNavigation();
  const dispatch = useDispatch();

  const onTokenPress = (token) => {
    const status = getTokensBalanceStatus(tokensBalance, token);

    if (isTokensBalanceLoading(status)) {
      return;
    }

    if (isTokensBalanceFailed(status)) {
      // If the token balance status is failed, we should try again
      dispatch(tokenFetchBalanceRequested(token.uid))
      return;
    }

    dispatch(updateSelectedToken(token));
    navigation.navigate('MainScreen');
  }

  const onSendNanoTx = () => {
    dispatch({
      type: 'WC_SESSION_REQUEST',
      payload: {
        id: 3,
        topic: '6514868878fe1dadd648a495692d5ab9d458c7d45876f2c63e1e7274640a53d4',
        jsonrpc: '2.0',
        params: {
          request: {
            method: 'htr_sendNanoContractTx',
            params: {
              push_tx: true,
              network: 'testnet',
              method: 'bet',
              blueprint_id: '3cb032600bdf7db784800e4ea911b10676fa2f67591f82bb62628c234e771595',
              nc_id: '0000076f749170bb0fdc9e84e261774735f6a4f69522aae9e5f92f162110095f',
              actions: [{
                type: 'deposit',
                token: '00',
                amount: 1
              }],
              args: [
                (new Address('WdXfZ6zKa1mQpBAhGQVj9pCuWDqCrG5ZR6', {
                  network: wallet.getNetwork()
                })).decode().toString('hex'),
                '2x0'
              ],
            },
          },
        },
      },
    });
    console.log('Sending nano tx');
  };

  return (
    <Wrapper>
      <Button title='Send Nano Tx' onPress={onSendNanoTx} />
      <ShowPushNotificationTxDetails navigation={navigation} />
      <AskForPushNotification navigation={navigation} />
      <AskForPushNotificationRefresh />
      { // Only show the toggle button when Nano Contract is enabled to the wallet
        isNanoContractEnabled
        && (
          <DashBoardHeader>
            <TwoOptionsToggle
              options={{
                first: { value: t`Tokens`, onTap: () => selectList(listOption.tokens) },
                second: { value: t`Nano Contracts`, onTap: () => selectList(listOption.nanoContracts) }
              }}
              defaultOption='first'
            />
          </DashBoardHeader>
        )
      }
      { // Default behavior is to show tokens list
        isTokensSelected(currList)
        && (
          <TokenSelect
            header={<TokensHeader />}
            renderArrow
            onItemPress={onTokenPress}
            selectedToken={selectedToken}
            tokens={tokens}
            tokensBalance={tokensBalance}
            tokenMetadata={tokensMetadata}
          />
        )
      }
      { // Only show if Nano Contract is enabled in the wallet
        isNanoContractEnabled
        && isNanoContractsSelected(currList)
        && <NanoContractsList />
      }
      <OfflineBar />
    </Wrapper>
  );
}

const Wrapper = ({ children }) => (
  <View style={styles.wrapper}>
    {children}
  </View>
);

const DashBoardHeader = ({ children }) => (
  <View style={[styles.headerWrapper]}>
    {children}
  </View>
);

const RegisterToken = () => {
  const navigation = useNavigation();
  return (
    <SimpleButton
      title={t`Register token`}
      onPress={() => navigation.navigate('RegisterToken')}
    />
  );
};

const TokensHeader = () => (
  <HathorHeader>
    <HathorHeader.Left>
      <Text style={[styles.headerTitle]}>{t`Tokens`}</Text>
    </HathorHeader.Left>
    <HathorHeader.Right>
      <RegisterToken />
    </HathorHeader.Right>
  </HathorHeader>
);

const styles = StyleSheet.create({
  wrapper: {
    flex: 1,
  },
  headerWrapper: {
    display: 'flex',
    flexDirection: 'row',
    justifyContent: 'center',
    backgroundColor: COLORS.lowContrastDetail,
  },
  headerTitle: {
    fontSize: 24,
    lineHeight: 24,
    fontWeight: 'bold',
  },
});

export default Dashboard;
