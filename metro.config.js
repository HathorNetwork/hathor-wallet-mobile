/**
 * Metro configuration for React Native
 * https://github.com/facebook/react-native
 *
 * @format
 */

/*
 * XXX: Metro config is able to fetch the default config from the react-native package just fine,
 *      but the linter is not able to resolve these imports.
 */
/* eslint-disable import/no-extraneous-dependencies,import/no-unresolved */
const path = require('path');
const { getDefaultConfig, mergeConfig } = require('@react-native/metro-config')
const blacklist = require('metro-config/src/defaults/exclusionList');
const { lockdownSerializer } = require('@lavamoat/react-native-lockdown');

/* eslint-enable import/no-extraneous-dependencies,import/no-unresolved */

/**
 * Metro configuration
 * https://reactnative.dev/docs/metro
 *
 * @type {import('@react-native/metro-config').MetroConfig}
 */
const config = {
  resolver: {
    blacklistRE: blacklist([
      /node_modules\/.*\/node_modules\/react-native\/.*/,
    ]),
    alias: {
      'webpack-bundle': path.resolve(__dirname, 'dist/bundle.js')
    }
  },
  // serializer: lockdownSerializer({ hermesRuntime: true }), // Disabled for webpack bundle testing
};

module.exports = mergeConfig(getDefaultConfig(__dirname), config);
