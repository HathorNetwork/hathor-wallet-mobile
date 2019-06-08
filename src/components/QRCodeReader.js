import React from 'react';
import QRCodeScanner from 'react-native-qrcode-scanner';
import { AppState } from 'react-native';

class QRCodeReader extends React.Component {
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
     */
    this.state = {
      focusedScreen: false,
      appState: AppState.currentState,
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

  render() {
    if (!this.state.focusedScreen) {
      return null;
    }

    // I have to set the cameraStyle to overflow: hidden to fix a bug on android
    // where the camera was streching along the whole height of the component
    // https://github.com/moaazsidat/react-native-qrcode-scanner/issues/182#issuecomment-494338330
    return (
        <QRCodeScanner
          ref={(node) => { this.QRCodeElement = node }}
          onRead={this.props.onSuccess}
          showMarker={true}
          topContent={this.props.topContent}
          bottomContent={this.props.bottomContent}
          topViewStyle={this.props.topViewStyle}
          cameraStyle={{overflow: 'hidden'}}
        />
    );
  }
}

export default QRCodeReader;
