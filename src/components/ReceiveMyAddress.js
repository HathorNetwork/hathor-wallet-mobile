import React from 'react';
import { Dimensions, Share, StyleSheet, Text, View } from 'react-native';

import QRCode from 'react-native-qrcode-svg';

import NewHathorButton from '../components/NewHathorButton';
import hathorLib from '@hathor/wallet-lib';


class ReceiveMyAddress extends React.Component {
  constructor(props) {
    super(props);

    /**
     * address {string} Wallet address
     */
    this.state = {address: ""};

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
    })
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
      }
    });

    return (
      <View style={styles.wrapper}>
        <View style={styles.qrcodeWrapper}>
          <QRCode value={`hathor:${this.state.address}`} size={height < 650 ? 160 : 250} />
        </View>
        <View style={addressWrapperStyle.style}>
          <Text style={{ fontSize: height < 650 ? 11 : 13 }} selectable={true}>{this.state.address}</Text>
        </View>
        <View style={{ flexDirection: 'row' }}>
          <NewHathorButton
            title="New address"
            onPress={this.updateAddress}
            wrapperStyle={{ flex: 1, borderRightWidth: 1.5, borderColor: '#e5e5ea', backgroundColor: 'transparent' }}
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
    )
  }
}

const styles = StyleSheet.create({
  wrapper: {
    flex: 1,
    alignItems: "center",
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
  }
});

export default ReceiveMyAddress;
