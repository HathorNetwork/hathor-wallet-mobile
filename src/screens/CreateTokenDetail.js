import React from 'react';
import { SafeAreaView } from 'react-native';
import { connect } from 'react-redux';

import HathorHeader from '../components/HathorHeader';
import TokenDetails from '../components/TokenDetails';
import SimpleButton from '../components/SimpleButton';


/**
 * selectedToken {Object} Select token config {name, symbol, uid}
 */
const mapStateToProps = state => ({
  selectedToken: state.selectedToken,
});

class CreateTokenDetail extends React.Component {
  unregisterClicked = () => {
    this.props.navigation.navigate('UnregisterToken');
  }

  render() {
    const CancelButton = () => (
      <SimpleButton
        icon={require('../assets/icons/icCloseActive.png')}
        onPress={() => this.props.navigation.navigate('Dashboard')}
      />
    );

    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: '#F7F7F7' }}>
        <HathorHeader
          title='TOKEN DETAILS'
          wrapperStyle={{ borderBottomWidth: 0 }}
          rightElement={<CancelButton />}
        />
        <TokenDetails
          token={this.props.selectedToken}
          contentStyle={{ marginHorizontal: 16, marginTop: 16 }}
        />
      </SafeAreaView>
    );
  }
}

export default connect(mapStateToProps)(CreateTokenDetail);
