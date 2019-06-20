import React from 'react';
import PropTypes from 'prop-types';
import QRCodeScanner from 'react-native-qrcode-scanner';
import { AppState, Dimensions, StyleSheet, Text, View } from 'react-native';

class QRCodeReader extends React.Component {
  static defaultProps = {
    height: 250,
    width: 250,
  };

  constructor(props) {
    super(props);

    // Ref for the qrcode scanner element
    this.QRCodeElement = null;
    // Will focus event (used to remove event listener on unmount)
    this.willFocusEvent = null;
    // Will blur event (used to remove event listener on unmount)
    this.willBlurEvent = null;

    /**
     * focusedScree {boolean} if this screen is being shown
     * appState {string} state of the app
     * height {number} Height of the view that wraps the qrcode reader
     * width {number} Width of the view that wraps the qrcode reader
     */
    this.state = {
      focusedScreen: false,
      appState: AppState.currentState,
      height: 0,
      width: 0,
    };
  }

  componentDidMount() {
    // We need to focus/unfocus the qrcode scanner, so it does not freezes
    // When the navigation focus on this screen, we set to true
    // When the navigation stops focusing on this screen, we set to false
    // When the app stops being in the active state, we set to false
    // When the app starts being in the active state, we set to true
    const { navigation } = this.props;
    this.willFocusEvent = navigation.addListener('willFocus', () => {
      this.reactivateQrCodeScanner();
      this.setState({ focusedScreen: true, appState: AppState.currentState });
      AppState.addEventListener('change', this._handleAppStateChange);
    });
    this.willBlurEvent = navigation.addListener('willBlur', () => {
      AppState.removeEventListener('change', this._handleAppStateChange);
      this.setState({ focusedScreen: false });
    });
  }

  componentWillUnmount() {
    this.willFocusEvent.remove();
    this.willBlurEvent.remove();
    AppState.removeEventListener('change', this._handleAppStateChange);
  }

  _handleAppStateChange = (nextAppState) => {
    if (this.state.appState === 'active' && nextAppState !== 'active') {
      // It's changing and wont be active anymore
      this.setState({ focusedScreen: false });
    } else if (nextAppState === 'active' && this.state.appState !== 'active') {
      this.setState({ focusedScreen: true });
    }

    this.setState({ appState: nextAppState });
  }

  reactivateQrCodeScanner = () => {
    if (this.QRCodeElement) {
      this.QRCodeElement.reactivate();
    }
  }

  onViewLayout = (e) => {
    const {x, y, width, height} = e.nativeEvent.layout;
    this.setState({ height, width });
  }

  render() {
    if (!this.state.focusedScreen) {
      return null;
    }

    const renderMarker = () => {
      // Workaround to make the center square transparent with the backdrop around
      // We create a view with background transparent with a big border with the backdrop color
      const height = (this.state.height - this.props.height)/2;
      const width = (this.state.width - this.props.width)/2;

      styles = StyleSheet.create({
        wrapper: {
          flex: 1,
          alignItems: 'center',
          justifyContent: 'center',
          alignSelf: 'stretch',
        },
        rectangle: {
          height: this.state.height,
          width: this.state.width,
          borderTopWidth: height,
          borderBottomWidth: height,
          borderLeftWidth: width,
          borderRightWidth: width,
          backgroundColor: 'transparent',
          borderColor: 'rgba(0, 0, 0, 0.7)'
        }
      });
      return (
        <View style={styles.wrapper}>
          <View style={styles.rectangle} />
        </View>
      )
    }

    const renderBottomText = () => {
      return (
        <View style={{ position: 'absolute', bottom: 32 }}>
          <Text style={{ fontSize: 16, fontWeight: 'bold', lineHeight: 19, color: 'white' }}>{this.props.bottomText}</Text>
        </View>
      );
    }

    // I have to set the cameraStyle to overflow: hidden to fix a bug on android
    // where the camera was streching along the whole height of the component
    // https://github.com/moaazsidat/react-native-qrcode-scanner/issues/182#issuecomment-494338330
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', alignSelf: 'stretch' }} onLayout={this.onViewLayout}>
        <QRCodeScanner
          ref={(node) => { this.QRCodeElement = node }}
          onRead={this.props.onSuccess}
          customMarker={renderMarker()}
          showMarker={true}
          topViewStyle={{ display: 'none' }}
          bottomViewStyle={{ display: 'none' }}
          cameraStyle={{ overflow: 'hidden', borderRadius: 16, width: this.state.width, height: this.state.height }}
        />
        {this.props.bottomText && renderBottomText()}
      </View>
    );
  }
}

QRCodeReader.propTypes = {
  // Optional (default 250). The height of the transparent rectangle
  height: PropTypes.number,

  // Optional (default 250). The width of the transparent rectangle
  width: PropTypes.number,
}

export default QRCodeReader;
