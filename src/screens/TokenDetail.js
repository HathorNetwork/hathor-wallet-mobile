import React from 'react';
import {
  Alert, SafeAreaView, StyleSheet, Text, View,
} from 'react-native';
import { connect } from 'react-redux';
import QRCode from 'react-native-qrcode-svg';
import hathorLib from '@hathor/wallet-lib';
import { setTokens } from '../actions';
import { getTokenLabel } from '../utils';

import HathorHeader from '../components/HathorHeader';
import SimpleButton from '../components/SimpleButton';


/**
 * selectedToken {Object} Select token config {name, symbol, uid}
 */
const mapStateToProps = state => ({
  selectedToken: state.selectedToken,
});


class TokenDetail extends React.Component {
  unregisterClicked = () => {
    Alert.alert(
      'Unregister token',
      `Are you sure you want to unregister ${getTokenLabel(this.props.selectedToken)}?`,
      [
        { text: 'Yes', onPress: this.unregisterConfirmed },
        { text: 'No', style: 'cancel' },
      ],
    );
  }

  unregisterConfirmed = () => {
    // Preventing unregistering HTR token, even if the user gets on this screen because of an error
    if (this.props.selectedToken.uid === hathorLib.constants.HATHOR_TOKEN_CONFIG.uid) {
      return;
    }

    const tokens = hathorLib.tokens.unregisterToken(this.props.selectedToken.uid);
    this.props.dispatch(setTokens(tokens));
    this.props.navigation.goBack();
  }

  render() {
    const configString = hathorLib.tokens.getConfigurationString(this.props.selectedToken.uid, this.props.selectedToken.name, this.props.selectedToken.symbol);

    const renderHeaderRightElement = () => (
      <SimpleButton
        title="Unregister"
        onPress={this.unregisterClicked}
      />
    );

    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: '#F7F7F7' }}>
        <HathorHeader
          title="TOKEN DETAIL"
          onBackPress={() => this.props.navigation.goBack()}
          wrapperStyle={{ borderBottomWidth: 0 }}
          rightElement={renderHeaderRightElement()}
        />
        <View style={styles.contentWrapper}>
          <View style={styles.tokenWrapper}>
            <Text style={{ fontSize: 18, lineHeight: 22, fontWeight: 'bold' }}>{getTokenLabel(this.props.selectedToken)}</Text>
          </View>
          <View style={styles.qrcodeWrapper}>
            <QRCode
              value={configString}
              size={200}
            />
          </View>
          <View style={styles.configStringWrapper}>
            <Text style={{ fontSize: 14 }} selectable>{configString}</Text>
          </View>
        </View>
      </SafeAreaView>
    );
  }
}

const styles = StyleSheet.create({
  wrapper: {
    flex: 1,
    backgroundColor: '#f7f7f7',
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'stretch',
  },
  contentWrapper: {
    backgroundColor: 'white',
    alignItems: 'center',
    justifyContent: 'flex-start',
    marginHorizontal: 16,
    marginTop: 16,
    borderRadius: 8,
    shadowOffset: { height: 2, width: 0 },
    shadowRadius: 4,
    shadowColor: 'black',
    shadowOpacity: 0.08,
  },
  tokenWrapper: {
    marginTop: 24,
    alignItems: 'center',
  },
  qrcodeWrapper: {
    paddingVertical: 16,
    alignSelf: 'stretch',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderColor: '#e5e5ea',
  },
  configStringWrapper: {
    margin: 16,
    borderRadius: 8,
    alignSelf: 'stretch',
  },
});


export default connect(mapStateToProps)(TokenDetail);
