/**
 * Copyright (c) Hathor Labs and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import React from 'react';
import { StyleSheet, View } from 'react-native';
import { connect } from 'react-redux';
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

/**
 * tokens {Array} array with all added tokens on this wallet
 * tokensBalance {Object} dict with balance for each token
 * selectedToken {Object} token currently selected by the user
 * tokenMetadata {Object} metadata of tokens
 */
const mapStateToProps = (state) => ({
  tokens: state.tokens,
  tokensBalance: state.tokensBalance,
  tokensHistory: state.tokensHistory,
  selectedToken: state.selectedToken,
  tokenMetadata: state.tokenMetadata,
  tokenLoadingState: state.tokenLoadingState,
});

const mapDispatchToProps = (dispatch) => ({
  updateSelectedToken: (token) => dispatch(updateSelectedToken(token)),
  getBalance: (token) => dispatch(tokenFetchBalanceRequested(token)),
});

class Dashboard extends React.Component {
  static navigatorStyle = { tabBarVisible: false }

  onItemPress = (item) => {
    // Check if the token balance is already loaded
    const tokenBalanceStatus = get(this.props.tokensBalance, `${item.uid}.status`, 'loading');

    if (tokenBalanceStatus === 'loading') {
      return;
    }

    if (tokenBalanceStatus === 'failed') {
      // If the token balance status is failed, we should try again
      this.props.getBalance(item.uid);
      return;
    }

    this.props.updateSelectedToken(item);
    this.props.navigation.navigate('MainScreen');
  }

  render() {
    return (
      <View style={{ flex: 1 }}>
        <ShowPushNotificationTxDetails navigation={this.props.navigation} />
        <AskForPushNotification navigation={this.props.navigation} />
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
          onItemPress={this.onItemPress}
          selectedToken={this.props.selectedToken}
          tokens={this.props.tokens}
          tokensBalance={this.props.tokensBalance}
          tokenMetadata={this.props.tokenMetadata}
        />
        <OfflineBar />
      </View>
    );
  }
}

const DashBoardHeader = ({ children }) => (
  <View style={[styleDashboardHeader.wrapper]}>
    {children}
  </View>
);

const styleDashboardHeader = StyleSheet.create({
  wrapper: {
    display: 'flex',
    flexDirection: 'row',
    justifyContent: 'center',
    backgroundColor: COLORS.lowContrastDetail,
  },
});

const RegisterToken = () => (
  <SimpleButton
    title={t`Register token`}
    onPress={() => this.props.navigation.navigate('RegisterToken')}
  />
);

const TokensHeader = () => (
  <HathorHeader
    title={t`TOKENS`}
    rightElement={<RegisterToken />}
  />
);

export default connect(mapStateToProps, mapDispatchToProps)(Dashboard);
