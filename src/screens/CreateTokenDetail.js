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
import TokenDetails from '../components/TokenDetails';
import SimpleButton from '../components/SimpleButton';
import closeIcon from '../assets/icons/icCloseActive.png';

/**
 * selectedToken {Object} Select token config {name, symbol, uid}
 */
const mapStateToProps = (state) => ({
  selectedToken: state.selectedToken,
});

class CreateTokenDetail extends React.Component {
  unregisterClicked = () => {
    this.props.navigation.navigate('UnregisterToken');
  }

  render() {
    const CancelButton = () => (
      <SimpleButton
        icon={closeIcon}
        onPress={() => this.props.navigation.navigate('Dashboard')}
      />
    );

    return (
      <View style={{ flex: 1, backgroundColor: '#F7F7F7' }}>
        <HathorHeader
          title={t`TOKEN DETAILS`}
          wrapperStyle={{ borderBottomWidth: 0 }}
          rightElement={<CancelButton />}
        />
        <TokenDetails
          token={this.props.selectedToken}
          contentStyle={{ marginHorizontal: 16, marginTop: 16 }}
        />
      </View>
    );
  }
}

export default connect(mapStateToProps)(CreateTokenDetail);
