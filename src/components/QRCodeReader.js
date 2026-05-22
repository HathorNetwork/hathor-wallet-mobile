/**
 * Copyright (c) Hathor Labs and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import * as React from 'react';

import { AppState, StyleSheet, Text, View } from 'react-native';
import { Camera, CameraType } from 'react-native-camera-kit';
import { useEffect, useState } from 'react';
import { useIsFocused } from '@react-navigation/native';
import { COLORS } from '../styles/themes';

const APP_ACTIVE_STATE = 'active';

export default ({
  onSuccess,
  focusHeight = 250,
  focusWidth = 250,
  bottomText = '',
}) => {
  // States related to Camera rendering logic
  const [currentAppState, setCurrentAppState] = useState(AppState.currentState);
  const isFocused = useIsFocused();

  // States related to the custom marker
  const [canvasHeight, setCanvasHeight] = useState(0);
  const [canvasWidth, setCanvasWidth] = useState(0);

  // Track app foreground/background. Pairing this with useIsFocused below in
  // the render predicate is what stops iOS AVCaptureSession from running when
  // the screen is alive but not actually visible (e.g. mounted in a blurred tab).
  useEffect(() => {
    const sub = AppState.addEventListener('change', setCurrentAppState);
    return () => sub.remove();
  }, []);

  /**
   * Triggers the callback function with the QR Code string value
   * @param {{ nativeEvent: { codeStringValue: string }}} event
   */
  function onCodeRead(event) {
    onSuccess({ data: event.nativeEvent.codeStringValue });
  }

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
        borderColor: COLORS.textColorShadowOpacity07,
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
    <View style={{
      position: 'absolute',
      bottom: 32
    }}
    >
      <Text style={{
        fontSize: 16,
        fontWeight: 'bold',
        lineHeight: 19,
        color: COLORS.backgroundColor,
      }}
      >
        {bottomText}
      </Text>
    </View>
  );

  /**
   * Decides if the camera should be rendered, or if the screen should remain on the Loader view
   */
  return (
    <View
      style={{
        flex: 1, alignItems: 'center', justifyContent: 'center', alignSelf: 'stretch',
      }}
      onLayout={onViewLayoutHandler}
    >
      <>
        {isFocused && currentAppState === APP_ACTIVE_STATE && (
          <Camera
            cameraType={CameraType.Back}
            flashMode='off'
            scanBarcode
            onReadCode={onCodeRead}
            style={StyleSheet.absoluteFill}
          />
        )}
        <CustomMarker />
        {bottomText && <BottomText />}
      </>
    </View>
  );
};
