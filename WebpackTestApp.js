import React from 'react';
import { SafeAreaView, StatusBar, StyleSheet } from 'react-native';
import * as ReactNative from 'react-native';

// Import the webpack bundle 
const WebpackBundle = require('./dist/bundle.js');

// Simple standalone app to test the webpack bundle screen
function WebpackTestApp() {
  console.log('🎯 WebpackTestApp: Starting webpack bundle screen test');
  console.log('📦 WebpackBundle exports:', Object.keys(WebpackBundle));
  
  // Create the webpack test screen using the factory function
  const WebpackTestScreen = WebpackBundle.createWebpackTestScreen(React, ReactNative);
  
  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#f5f5f5" />
      <WebpackTestScreen />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
});

export default WebpackTestApp;