/**
 * Copyright (c) Hathor Labs and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import React, { useEffect, useMemo, useState } from 'react';
import { StyleSheet, View, Text } from 'react-native';
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
import QRCodeIcon from '../components/Icons/QRCodeIcon';
import { tokenFetchBalanceRequested, updateSelectedToken } from '../actions';
import AskForPushNotificationRefresh from '../components/AskForPushNotificationRefresh';
import TokenImportBanner from '../components/TokenImportBanner';
import { COLORS } from '../styles/themes';
import { TOKEN_DOWNLOAD_STATUS } from '../sagas/tokens';
import { NanoContractsList } from '../components/NanoContract/NanoContractsList';
import { isNanoContractsEnabled, getDisplayAmountFormat } from '../utils';
import ShowPushNotificationTxDetails from '../components/ShowPushNotificationTxDetails';
import { SimulatedTagIfMock } from '../components/Multichain/SimulatedTag';
import { isSideChainConnected } from '../multichain/gating';
import { useCombinedTokens } from '../multichain/hooks';

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
  const isNanoEnabled = useSelector(isNanoContractsEnabled);
  const amountFormat = useSelector(getDisplayAmountFormat);
  const decimalPlaces = useSelector((state) => state.serverInfo?.decimal_places);
  // With the side chain connected, the list holds both chains' tokens.
  const sideChainConnected = useSelector(isSideChainConnected);
  const combinedTokens = useCombinedTokens();
  const combinedBalances = useMemo(() => Object.fromEntries(combinedTokens.map((row) => [
    row.uid,
    { status: row.status, data: { available: row.available } },
  ])), [combinedTokens]);

  const [currList, selectList] = useState(listOption.tokens);
  const navigation = useNavigation();
  const dispatch = useDispatch();

  const onTokenPress = (item) => {
    // A token only Hathor Next has opens Hathor Next's token screen.
    if (sideChainConnected && item.hathorUid === null) {
      navigation.navigate('NextTokenScreen', { tokenId: item.nextId });
      return;
    }
    const token = sideChainConnected ? tokens[item.hathorUid] : item;
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

  useEffect(() => {
    // User might have changed networks and nano contracts are now disabled,
    // we must change the tab to the tokens tab.
    if (!isNanoEnabled && currList === listOption.nanoContracts) {
      selectList(listOption.tokens);
    }
  }, [isNanoEnabled]);

  return (
    <Wrapper>
      <ShowPushNotificationTxDetails navigation={navigation} />
      <AskForPushNotification navigation={navigation} />
      <AskForPushNotificationRefresh />
      { // Only show the toggle button when Nano Contract is enabled to the wallet
        isNanoEnabled
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
            header={(
              <>
                <TokensHeader isNanoEnabled={isNanoEnabled} showSimulated={sideChainConnected} />
                <TokenImportBanner />
              </>
            )}
            onItemPress={onTokenPress}
            selectedToken={selectedToken}
            tokens={sideChainConnected ? combinedTokens : tokens}
            tokensBalance={sideChainConnected ? combinedBalances : tokensBalance}
            tokenMetadata={tokensMetadata}
            useHomeDisplay
            amountFormat={amountFormat}
            decimalPlaces={decimalPlaces}
          />
        )
      }
      { // Only show if Nano Contract is enabled in the wallet
        isNanoEnabled
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

const DashBoardHeader = ({ children }) => {
  const navigation = useNavigation();
  return (
    <View style={[styles.headerWrapper]}>
      <View style={styles.toggleContainer}>
        {children}
      </View>
      <SimpleButton onPress={() => navigation.navigate('UnifiedQRScanner')} style={{ marginLeft: 16 }}>
        <QRCodeIcon size={24} color={COLORS.primary} />
      </SimpleButton>
    </View>
  );
};

const TokensHeader = ({ isNanoEnabled, showSimulated }) => {
  const navigation = useNavigation();

  return (
    <HathorHeader>
      <HathorHeader.Left>
        <View style={styles.headerTitleRow}>
          <Text style={[styles.headerTitle]}>{t`Tokens`}</Text>
          {showSimulated && <SimulatedTagIfMock style={styles.simulated} />}
        </View>
      </HathorHeader.Left>
      {!isNanoEnabled && (
        <HathorHeader.Right>
          <SimpleButton onPress={() => navigation.navigate('UnifiedQRScanner')} style={{ marginLeft: 16 }}>
            <QRCodeIcon size={24} color={COLORS.primary} />
          </SimpleButton>
        </HathorHeader.Right>
      )}
    </HathorHeader>
  )
};

const styles = StyleSheet.create({
  wrapper: {
    flex: 1,
  },
  headerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  simulated: {
    marginLeft: 8,
  },
  headerWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.lowContrastDetail,
    paddingHorizontal: 16,
    minHeight: 48,
    paddingTop: 8,
  },
  toggleContainer: {
    flex: 1,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    paddingLeft: 8,
  },
  headerTitle: {
    fontSize: 20,
    lineHeight: 24,
    fontWeight: 'bold',
  },
});

export default Dashboard;
