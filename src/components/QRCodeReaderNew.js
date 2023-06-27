import * as React from 'react';

import { AppState, StyleSheet, Text } from 'react-native';
import { Camera, useCameraDevices } from 'react-native-vision-camera';
import { BarcodeFormat, useScanBarcodes } from 'vision-camera-code-scanner';
import { useEffect } from 'react';

const APP_ACTIVE_STATE = 'active';

export default function QRCodeReaderNew({ navigation, onSuccess }) {
  const [currentAppState, setCurrentAppState] = React.useState(AppState.currentState);
  const [isFocusedScreen, setIsFocusedScreen] = React.useState(false);
  const [hasPermission, setHasPermission] = React.useState(false);
  const devices = useCameraDevices();
  const device = devices.back;

  const [frameProcessor, barcodes] = useScanBarcodes([BarcodeFormat.QR_CODE], {
    checkInverted: true,
  });

  React.useEffect(() => {
    // Ensure the app has permission to use the camera
    Camera.requestCameraPermission()
      .then((status) => {
        setHasPermission(status === 'authorized');
      });

    /*
     * We need to focus/unfocus the QRCode scanner, so that it doesn't freeze
     * - When the navigation focuses this screen or app becomes active, we set it to `true`
     * - When the navigation moves away or app becomes inactive, we set it to `false`
     */
    let appStateEvent;
    const willFocusEvent = navigation.addListener('willFocus', () => {
      setIsFocusedScreen(true);
      appStateEvent = AppState.addEventListener('change', (nextAppState) => {
        if (
          currentAppState === APP_ACTIVE_STATE
          && nextAppState !== APP_ACTIVE_STATE) {
          // It's changing and won't be active anymore
          setIsFocusedScreen(false);
        } else if (
          nextAppState === APP_ACTIVE_STATE
          && currentAppState !== APP_ACTIVE_STATE) {
          // Will become active now
          setIsFocusedScreen(true);
        }

        setCurrentAppState(nextAppState);
      });
    });
    const willBlurEvent = navigation.addListener('willBlur', () => {
      setIsFocusedScreen(false);
    });

    return () => {
      willFocusEvent.remove();
      willBlurEvent.remove();
      if (appStateEvent) { // This listener may have never been initialized
        appStateEvent.remove();
      }
    };
  }, []);

  useEffect(() => {
    // Ignore this effect if there is no successful QRCode read
    if (!barcodes.length) {
      return;
    }

    // Return only the first QRCode found
    setIsFocusedScreen(false); // Stop reading, since the focus will change soon
    console.log(`Found: ${JSON.stringify(barcodes, null, 2)}`);
    onSuccess(barcodes[0].content);
  }, [barcodes]);

  return (
    device != null
    && hasPermission
    && isFocusedScreen && (
      <>
        <Camera
          style={StyleSheet.absoluteFill}
          device={device}
          isActive
          frameProcessor={frameProcessor}
          frameProcessorFps={5}
        />
        {barcodes.map((barcode, idx) => (
          // eslint-disable-next-line react/no-array-index-key
          <Text key={idx} style={styles.barcodeTextURL}>
            {barcode.displayValue}
          </Text>
        ))}
      </>
    )
  );
}

const styles = StyleSheet.create({
  barcodeTextURL: {
    fontSize: 20,
    color: 'white',
    fontWeight: 'bold',
  },
});
