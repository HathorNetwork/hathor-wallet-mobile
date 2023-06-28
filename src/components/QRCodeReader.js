/**
 * Copyright (c) Hathor Labs and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import * as React from 'react';

import { ActivityIndicator, AppState, StyleSheet, Text, View } from 'react-native';
import { Camera, useCameraDevices } from 'react-native-vision-camera';
import { BarcodeFormat, useScanBarcodes } from 'vision-camera-code-scanner';
import { useEffect } from 'react';
import { t } from 'ttag';

const APP_ACTIVE_STATE = 'active';

export default function QRCodeReader({
  navigation,
  onSuccess,
  focusHeight = 250,
  focusWidth = 250,
  bottomText = '',
}) {
  // States related to Camera rendering logic
  const [currentAppState, setCurrentAppState] = React.useState(AppState.currentState);
  const [isFocusedScreen, setIsFocusedScreen] = React.useState(false);
  const [hasPermission, setHasPermission] = React.useState(false);

  // States related to the custom marker
  const [canvasHeight, setCanvasHeight] = React.useState(0);
  const [canvasWidth, setCanvasWidth] = React.useState(0);

  // States related to capturing camera data and reading QRCodes
  const devices = useCameraDevices();
  const device = devices.back;
  const [frameProcessor, barcodes] = useScanBarcodes([BarcodeFormat.QR_CODE], {
    checkInverted: true,
  });

  // Initialization and event listeners
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
    const focusEvent = navigation.addListener('focus', () => {
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
    const blurEvent = navigation.addListener('blur', () => {
      setIsFocusedScreen(false);
    });

    // After all the listeners are in place, allow the Camera component to be rendered
    setIsFocusedScreen(true);

    return () => {
      focusEvent.remove();
      blurEvent.remove();
      if (appStateEvent) { // This listener may have never been initialized
        appStateEvent.remove();
        appStateEvent = null;
      }
    };
  }, []);

  // Captured barcodes monitoring
  useEffect(() => {
    // Ignore this effect if there is no successful QRCode read
    if (!barcodes.length) {
      return;
    }

    // Return only the first QRCode found
    setIsFocusedScreen(false); // Stop reading, since the focus will change soon
    onSuccess(barcodes[0].content);
  }, [barcodes]);

  /**
   * Fetches screen data from the `onLayout` event
   * @param {LayoutEvent} e
   */
  const onViewLayoutHandler = (e) => {
    const { width, height } = e.nativeEvent.layout;
    setCanvasHeight(height);
    setCanvasWidth(width);
  };

  /**
   * Draws a helper margin to focus user attention in the center of the camera reading area.
   */
  const CustomMarker = () => {
    const borderHeight = (canvasHeight - focusHeight) / 2;
    const borderWidth = (canvasWidth - focusWidth) / 2;

    const styles = StyleSheet.create({
      wrapper: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        alignSelf: 'stretch',
      },
      rectangle: {
        height: canvasHeight,
        width: canvasWidth,
        borderTopWidth: borderHeight,
        borderBottomWidth: borderHeight,
        borderLeftWidth: borderWidth,
        borderRightWidth: borderWidth,
        backgroundColor: 'transparent',
        borderColor: 'rgba(0, 0, 0, 0.7)',
      },
    });
    return (
      <View style={styles.wrapper}>
        <View style={styles.rectangle} />
      </View>
    );
  };

  /**
   * Renders custom bottom text
   */
  const BottomText = () => (
    <View style={{ position: 'absolute', bottom: 32 }}>
      <Text style={{
        fontSize: 16, fontWeight: 'bold', lineHeight: 19, color: 'white',
      }}
      >
        {bottomText}
      </Text>
    </View>
  );

  /**
   * Draws the camera loader
   */
  const WaitingForCameraLoader = () => (
    <View style={{
      position: 'absolute', flex: 1, alignItems: 'center', justifyContent: 'center',
    }}
    >
      <Text>{t`Opening camera`}</Text>
      <ActivityIndicator style={{ marginTop: 16 }} size='small' animating />
    </View>
  );

  /**
   * Decides if the camera should be rendered, or if the screen should remain on the Loader view
   */
  const shouldRenderCamera = device !== null
    && hasPermission
    && isFocusedScreen;

  return (
    <View
      style={{
        flex: 1, alignItems: 'center', justifyContent: 'center', alignSelf: 'stretch',
      }}
      onLayout={onViewLayoutHandler}
    >
      { !shouldRenderCamera && <WaitingForCameraLoader /> }
      { shouldRenderCamera && (
        <>
          <Camera
            style={StyleSheet.absoluteFill}
            device={device}
            isActive
            frameProcessor={frameProcessor}
            frameProcessorFps={5}
          />
          <CustomMarker />
          {bottomText && <BottomText />}
        </>
      )}
    </View>
  );
}
