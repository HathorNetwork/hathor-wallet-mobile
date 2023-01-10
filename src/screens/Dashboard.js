/**
 * Copyright (c) Hathor Labs and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import React from 'react';
import { View } from 'react-native';
import { connect } from 'react-redux';
import { t } from 'ttag';
import { get } from 'lodash';

import AskForPushNotification from '../components/AskForPushNotification';
import HathorHeader from '../components/HathorHeader';
import TokenSelect from '../components/TokenSelect';
import SimpleButton from '../components/SimpleButton';
import OfflineBar from '../components/OfflineBar';
import { tokenFetchBalanceRequested, updateSelectedToken } from '../actions';


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
    const ManualInfoButton = () => (
      <SimpleButton
        title={t`Register token`}
        onPress={() => this.props.navigation.navigate('RegisterToken')}
      />
    );

    const Header = () => (
      <HathorHeader
        title={t`TOKENS`}
        rightElement={<ManualInfoButton />}
      />
    );

    return (
      <View style={{ flex: 1 }}>
        <AskForPushNotification navigation={this.props.navigation} />
        <TokenSelect
          header={<Header />}
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

export default connect(mapStateToProps, mapDispatchToProps)(Dashboard);
