import React from 'react';
import {
  Dimensions, Share, StyleSheet, View,
} from 'react-native';

import QRCode from 'react-native-qrcode-svg';

import hathorLib from '@hathor/wallet-lib';
import SimpleButton from './SimpleButton';
import CopyClipboard from './CopyClipboard';

class ReceiveMyAddress extends React.Component {
  constructor(props) {
    super(props);

    /**
     * address {string} Wallet address
     */
    this.state = {
      address: '',
    };

    this.willFocusEvent = null;
  }

  componentDidMount() {
    const { navigation } = this.props;
    this.willFocusEvent = navigation.addListener('willFocus', () => {
      this.updateAddress();
    });
  }

  componentWillUnmount() {
    this.willFocusEvent.remove();
  }

  updateAddress = () => {
    this.setState({ address: hathorLib.wallet.getAddressToUse() }, () => {
      this.props.onAddressUpdate(this.state.address);
    });
  }

  shareAddress = () => {
    Share.share({
      message: `Here is my address: ${this.state.address}`,
    });
  }

  render() {
    if (!this.state.address) return null;

    // This is used to set the width of the address wrapper view
    // For some reason I was not being able to set as 100%, so I had to use this
    const { height, width } = Dimensions.get('window');

    const addressWrapperStyle = StyleSheet.create({
      style: {
        padding: 16,
        borderBottomWidth: 1.5,
        borderTopWidth: 1.5,
        borderColor: '#e5e5ea',
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        width: width - 32,
      },
    });

    return (
      <View style={styles.wrapper}>
        <View style={styles.qrcodeWrapper}>
          <QRCode value={`hathor:${this.state.address}`} size={height < 650 ? 160 : 250} />
        </View>
        <View style={addressWrapperStyle.style}>
          <CopyClipboard
            text={this.state.address}
            textStyle={{ fontSize: height < 650 ? 11 : 13 }}
          />
        </View>
        <View style={{ flexDirection: 'row' }}>
          <SimpleButton
            title='New address'
            onPress={this.updateAddress}
            containerStyle={[styles.buttonContainer, styles.leftButtonBorder]}
          />
          <SimpleButton
            onPress={this.shareAddress}
            title='Share'
            color='#000'
            containerStyle={styles.buttonContainer}
          />
        </View>
      </View>
    );
  }
}

const styles = StyleSheet.create({
  wrapper: {
    flex: 1,
    alignItems: 'center',
    marginHorizontal: 16,
    marginTop: 32,
    borderWidth: 1.5,
    borderColor: '#e5e5ea',
    borderRadius: 8,
    marginBottom: 32,
  },
  qrcodeWrapper: {
    padding: 24,
    flex: 1,
  },
  buttonContainer: {
    flex: 1,
    alignSelf: 'stretch',
    alignItems: 'center',
    paddingVertical: 16,
  },
  leftButtonBorder: {
    borderRightWidth: 1.5,
    borderColor: '#eee',
  },
});

export default ReceiveMyAddress;
