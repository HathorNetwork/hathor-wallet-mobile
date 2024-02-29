/**
 * Copyright (c) Hathor Labs and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import React from 'react';
import { StyleSheet, View } from 'react-native';
import { useDispatch, useSelector } from 'react-redux';
import { t } from 'ttag';
import { get } from 'lodash';

import AskForPushNotification from '../components/AskForPushNotification';
import HathorHeader from '../components/HathorHeader';
import TokenSelect from '../components/TokenSelect';
import SimpleButton from '../components/SimpleButton';
import OfflineBar from '../components/OfflineBar';
import { TwoOptionsToggle } from '../components/TwoOptionsToggle.component';
import { tokenFetchBalanceRequested, updateSelectedToken } from '../actions';
import ShowPushNotificationTxDetails from '../components/ShowPushNotificationTxDetails';
import AskForPushNotificationRefresh from '../components/AskForPushNotificationRefresh';
import { COLORS } from '../styles/themes';
import { useNavigation } from '@react-navigation/native';
import { TOKEN_DOWNLOAD_STATUS } from '../sagas/tokens';

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
const getTokensBalanceStatus = (tokensBalance, token) => {
  return get(tokensBalance, `${token.uid}.status`, TOKEN_DOWNLOAD_STATUS.LOADING)
};

/**
 * @param {string} status the current status from tokens balance loading process.
 * @returns {boolean} `true` if loading, `false` otherwise.
 */
const isTokensBalanceLoading = (status) => {
  return status === TOKEN_DOWNLOAD_STATUS.LOADING;
};

/**
 * @param {string} status the current status from tokens balance loading process.
 * @returns {boolean} `true` if failed, `false` otherwise.
 */
const isTokensBalanceFailed = (status) => {
  return status === TOKEN_DOWNLOAD_STATUS.FAILED;
};

export default Dashboard = () => {
  const {
    tokens,
    tokensBalance,
    selectedToken,
    tokensMetadata,
  } = useSelector(getTokensState);
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

  return (
    <Wrapper>
      <ShowPushNotificationTxDetails navigation={navigation} />
      <AskForPushNotification navigation={navigation} />
      <AskForPushNotificationRefresh />
      <DashBoardHeader>
        <TwoOptionsToggle
          options={{
            first: { value: 'Tokens', onTap: () => null },
            second: { value: 'Nano Contracts', onTap: () => null }
          }}
          defaultOption={'first'}
        />
      </DashBoardHeader>
      <TokenSelect
        header={<TokensHeader />}
        renderArrow
        onItemPress={onTokenPress}
        selectedToken={selectedToken}
        tokens={tokens}
        tokensBalance={tokensBalance}
        tokenMetadata={tokensMetadata}
      />
      <OfflineBar />
    </Wrapper>
  );
}

const Wrapper = ({ children }) => (
  <View style={style.wrapper}>
    {children}
  </View>
);

const DashBoardHeader = ({ children }) => (
  <View style={[style.headerWrapper]}>
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
  <HathorHeader
    title={t`TOKENS`}
    rightElement={<RegisterToken />}
  />
);

const style = StyleSheet.create({
  wrapper: {
    flex: 1,
  },
  headerWrapper: {
    display: 'flex',
    flexDirection: 'row',
    justifyContent: 'center',
    backgroundColor: COLORS.lowContrastDetail,
  },
});

