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

const APP_ACTIVE_STATE = 'active';

export default ({
  navigation,
  onSuccess,
  focusHeight = 250,
  focusWidth = 250,
  bottomText = '',
}) => {
  // States related to Camera rendering logic
  const [currentAppState, setCurrentAppState] = useState(AppState.currentState);
  const [isFocusedScreen, setIsFocusedScreen] = useState(false);

  // States related to the custom marker
  const [canvasHeight, setCanvasHeight] = useState(0);
  const [canvasWidth, setCanvasWidth] = useState(0);

  // Initialization and event listeners
  useEffect(() => {
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
    <View style={{
      position: 'absolute',
      bottom: 32
    }}
    >
      <Text style={{
        fontSize: 16,
        fontWeight: 'bold',
        lineHeight: 19,
        color: 'white',
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
        {isFocusedScreen && (
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
