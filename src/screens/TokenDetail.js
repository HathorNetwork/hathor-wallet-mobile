import React from 'react';
import {
  SafeAreaView, Share, StyleSheet, Text, View,
} from 'react-native';
import { connect } from 'react-redux';
import QRCode from 'react-native-qrcode-svg';
import hathorLib from '@hathor/wallet-lib';
import { getTokenLabel } from '../utils';

import HathorHeader from '../components/HathorHeader';
import SimpleButton from '../components/SimpleButton';
import CopyClipboard from '../components/CopyClipboard';


/**
 * selectedToken {Object} Select token config {name, symbol, uid}
 */
const mapStateToProps = state => ({
  selectedToken: state.selectedToken,
});


class TokenDetail extends React.Component {
  unregisterClicked = () => {
    this.props.navigation.navigate('UnregisterToken');
  }

  getConfigString = () => hathorLib.tokens.getConfigurationString(this.props.selectedToken.uid, this.props.selectedToken.name, this.props.selectedToken.symbol)

  shareClicked = () => {
    const configString = this.getConfigString();
    Share.share({
      message: `Here is the configuration string of token ${getTokenLabel(this.props.selectedToken)}: ${configString}`,
    });
  }

  render() {
    const configString = this.getConfigString();

    const renderHeaderRightElement = () => (
      <SimpleButton
        title="Unregister"
        onPress={this.unregisterClicked}
      />
    );

    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: '#F7F7F7' }}>
        <HathorHeader
          title="TOKEN DETAILS"
          onBackPress={() => this.props.navigation.goBack()}
          wrapperStyle={{ borderBottomWidth: 0 }}
          rightElement={renderHeaderRightElement()}
        />
        <View style={styles.contentWrapper}>
          <View style={styles.tokenWrapper}>
            <Text style={{ fontSize: 14, lineHeight: 17, fontWeight: 'bold' }}>{getTokenLabel(this.props.selectedToken)}</Text>
          </View>
          <View style={styles.qrcodeWrapper}>
            <QRCode
              value={configString}
              size={200}
            />
          </View>
          <View style={styles.configStringWrapper}>
            <CopyClipboard
              text={configString}
              textStyle={{ fontSize: 14, color: 'rgba(0, 0, 0, 0.5)' }}
            />
          </View>
          <View style={styles.buttonWrapper}>
            <SimpleButton
              title="Share"
              onPress={this.shareClicked}
              color="#000"
              containerStyle={styles.simpleButtonContainer}
            />
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
    marginVertical: 24,
    alignItems: 'center',
  },
  qrcodeWrapper: {
    alignSelf: 'stretch',
    alignItems: 'center',
  },
  configStringWrapper: {
    padding: 24,
    alignSelf: 'stretch',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderColor: '#eee',
  },
  buttonWrapper: {
    borderRadius: 8,
    alignSelf: 'stretch',
    alignItems: 'center',
  },
  simpleButtonContainer: {
    paddingVertical: 24,
    alignSelf: 'stretch',
    alignItems: 'center',
  },
});


export default connect(mapStateToProps)(TokenDetail);
