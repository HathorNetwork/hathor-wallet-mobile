import React from 'react';
import * as ReactNative from 'react-native';

// Import the webpack bundle 
const WebpackBundle = require('./dist/bundle.js');

export default function TestWebpackBundle() {
  console.log('Testing webpack bundle screen in React Native...');
  
  // Create the webpack test screen using the factory function
  const WebpackTestScreen = WebpackBundle.createWebpackTestScreen(React, ReactNative);
  
  // Return the webpack-generated screen
  return React.createElement(WebpackTestScreen);
}