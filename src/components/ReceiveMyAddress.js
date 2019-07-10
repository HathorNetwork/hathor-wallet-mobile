import React from 'react';
import {
  Clipboard, Dimensions, Share, StyleSheet, Text, View,
} from 'react-native';

import QRCode from 'react-native-qrcode-svg';

import hathorLib from '@hathor/wallet-lib';
import NewHathorButton from './NewHathorButton';

class ReceiveMyAddress extends React.Component {
  constructor(props) {
    super(props);

    /**
     * address {string} Wallet address
     * copying {boolean} If is copying address (if should show copied feedback)
     */
    this.state = {
      address: '',
      copying: false,
    };

    this.willFocusEvent = null;
  }

  componentDidMount() {
    const { navigation } = this.props;
    this.willFocusEvent = navigation.addListener('willFocus', () => {
      this.updateAddress();
    });
  }

  updateAddress = () => {
    this.setState({ address: hathorLib.wallet.getAddressToUse() }, () => {
      this.props.onAddressUpdate(this.state.address);
    });
  }

  componentWillUnmount() {
    this.willFocusEvent.remove();
  }

  shareAddress = () => {
    Share.share({
      message: `Here is my address: ${this.state.address}`,
    });
  }

  textCopy = () => {
    Clipboard.setString(this.state.address);
    this.setState({ copying: true }, () => {
      setTimeout(() => this.setState({ copying: false }), 1500);
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

    const renderAddressText = () => {
      if (this.state.copying) {
        return <Text style={{ fontSize: 13, color: '#E30052' }}>Copied to clipboard!</Text>
      } else {
        return <Text onPress={this.textCopy} onLongPress={this.textCopy} style={{ fontSize: height < 650 ? 11 : 13 }}>{this.state.address}</Text>
      }
    }

    return (
      <View style={styles.wrapper}>
        <View style={styles.qrcodeWrapper}>
          <QRCode value={`hathor:${this.state.address}`} size={height < 650 ? 160 : 250} />
        </View>
        <View style={addressWrapperStyle.style}>
          {renderAddressText()}
        </View>
        <View style={{ flexDirection: 'row' }}>
          <NewHathorButton
            title="New address"
            onPress={this.updateAddress}
            wrapperStyle={{
              flex: 1, borderRadius: 0, borderRightWidth: 1.5, borderColor: '#e5e5ea', backgroundColor: 'transparent',
            }}
            textStyle={{ color: '#0273a0' }}
          />
          <NewHathorButton
            wrapperStyle={{ flex: 1, backgroundColor: 'transparent' }}
            onPress={this.shareAddress}
            title="Share"
            textStyle={{ color: '#0273a0' }}
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
});

export default ReceiveMyAddress;
