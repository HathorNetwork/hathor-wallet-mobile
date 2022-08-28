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

import HathorHeader from '../components/HathorHeader';
import TokenSelect from '../components/TokenSelect';
import SimpleButton from '../components/SimpleButton';
import OfflineBar from '../components/OfflineBar';
import { updateSelectedToken, fetchTokenRequested} from '../actions';


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
  fetchToken: (token) => dispatch(fetchTokenRequested(token.uid)),
});

class Dashboard extends React.Component {
  static navigatorStyle = { tabBarVisible: false }

  onItemPress = (item) => {
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
        <TokenSelect
          header={<Header />}
          renderArrow
          onItemPress={this.onItemPress}
          selectedToken={this.props.selectedToken}
          tokens={this.props.tokens}
          tokensLoadingState={this.props.tokenLoadingState}
          tokensBalance={this.props.tokensBalance}
          tokenMetadata={this.props.tokenMetadata}
        />
        <OfflineBar />
      </View>
    );
  }
}

export default connect(mapStateToProps, mapDispatchToProps)(Dashboard);
