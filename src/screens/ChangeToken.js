/**
 * Copyright (c) Hathor Labs and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import React from 'react';
import { connect } from 'react-redux';

import HathorHeader from '../components/HathorHeader';
import TokenSelect from '../components/TokenSelect';


/**
 * tokens {Array} Array of token configs registered on this wallet
 * tokensBalance {Object} Object with the balance of each token {uid: {available, locked}}
 * tokenMetadata {Object} metadata of tokens
 */
const mapStateToProps = (state) => ({
  tokens: state.tokens,
  tokensBalance: state.tokensBalance,
  tokenMetadata: state.tokenMetadata,
});

class ChangeToken extends React.Component {
  constructor(props) {
    super(props);

    // Selected token
    this.token = props.navigation.getParam('token', null);

    // Callback on token press
    this.onPressCallback = props.navigation.getParam('onItemPress', null);
  }

  onItemPress = (item) => {
    if (this.onPressCallback) {
      this.onPressCallback(item);
    }

    this.props.navigation.goBack();
  }

  render() {
    const Header = (props) => (
      <HathorHeader
        title='TOKENS'
        onBackPress={() => this.props.navigation.goBack()}
      />
    );

    return (
      <TokenSelect
        header=<Header />
        onItemPress={this.onItemPress}
        selectedToken={this.token}
        tokens={this.props.tokens}
        tokensBalance={this.props.tokensBalance}
        tokenMetadata={this.props.tokenMetadata}
      />
    );
  }
}

export default connect(mapStateToProps)(ChangeToken);
