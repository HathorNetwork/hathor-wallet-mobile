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

import { IS_MULTI_TOKEN } from '../constants';
import { isTokenNFT } from '../utils';
import HathorHeader from '../components/HathorHeader';
import SimpleButton from '../components/SimpleButton';
import TokenDetails from '../components/TokenDetails';

/**
 * selectedToken {Object} Select token config {name, symbol, uid}
 * tokenMetadata {Object} metadata of tokens
 */
const mapStateToProps = (state) => ({
  selectedToken: state.selectedToken,
  tokenMetadata: state.tokenMetadata,
});

class TokenDetail extends React.Component {
  unregisterClicked = () => {
    this.props.navigation.navigate('UnregisterToken');
  }

  render() {
    const renderUnregisterButton = () => (
      <SimpleButton
        title={t`Unregister`}
        onPress={this.unregisterClicked}
      />
    );

    const isNFT = isTokenNFT(get(this.props, 'selectedToken.uid'), this.props.tokenMetadata);

    return (
      <View style={{ flex: 1, backgroundColor: '#F7F7F7' }}>
        <HathorHeader
          title={t`TOKEN DETAILS`}
          onBackPress={() => this.props.navigation.goBack()}
          rightElement={IS_MULTI_TOKEN ? renderUnregisterButton() : null}
        />
        <TokenDetails
          token={this.props.selectedToken}
          contentStyle={{ marginHorizontal: 16, marginTop: 16 }}
          isNFT={isNFT}
        />
      </View>
    );
  }
}

export default connect(mapStateToProps)(TokenDetail);
