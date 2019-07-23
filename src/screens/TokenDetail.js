/**
 * Copyright (c) Hathor Labs and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import React from 'react';
import { SafeAreaView } from 'react-native';
import { connect } from 'react-redux';

import HathorHeader from '../components/HathorHeader';
import SimpleButton from '../components/SimpleButton';
import TokenDetails from '../components/TokenDetails';


/**
 * selectedToken {Object} Select token config {name, symbol, uid}
 */
const mapStateToProps = (state) => ({
  selectedToken: state.selectedToken,
});

class TokenDetail extends React.Component {
  unregisterClicked = () => {
    this.props.navigation.navigate('UnregisterToken');
  }

  render() {
    const renderHeaderRightElement = () => (
      <SimpleButton
        title='Unregister'
        onPress={this.unregisterClicked}
      />
    );

    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: '#F7F7F7' }}>
        <HathorHeader
          title='TOKEN DETAILS'
          onBackPress={() => this.props.navigation.goBack()}
          rightElement={renderHeaderRightElement()}
        />
        <TokenDetails
          token={this.props.selectedToken}
          contentStyle={{ marginHorizontal: 16, marginTop: 16 }}
        />
      </SafeAreaView>
    );
  }
}


export default connect(mapStateToProps)(TokenDetail);
