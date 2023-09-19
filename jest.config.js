module.exports = {
  preset: 'react-native',
  transformIgnorePatterns: [
    '<rootDir>/node_modules/(?!(@react-native|react-native|@notifee/react-native|react-native-device-info|react-native-gesture-handler|react-native-keychain|@react-navigation|react-native-status-bar-height|@react-native-firebase|@sentry/react-native|react-native-version-number|unleash-proxy-client|react-native-permissions|react-native-modal|react-native-animatable|react-native-camera-kit|@fortawesome/react-native-fontawesome|react-native-qrcode-svg)/)'
  ],
  setupFiles: [
    '<rootDir>/jestMockSetup.js',
  ],
  cacheDirectory: '.jest/cache'
};
