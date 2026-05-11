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
const { getDefaultConfig, mergeConfig } = require('@react-native/metro-config');
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
      /node_modules\/@hathor\/ct-crypto-node\/.*/,
      // ct-crypto-wasm is the browser-only verifier provider; mobile
      // uses the NAPI/UniFFI provider instead, so blacklist + shim
      // (see `extraNodeModules` below) — same pattern as ct-crypto-node.
      /node_modules\/@hathor\/ct-crypto-wasm\/.*/,
    ]),
    // Node-stdlib shims for imports made *inside* third-party deps
    // (e.g. `@hathor/wallet-lib/lib/utils/helpers.js` does
    // `require('path')`). The same aliases also live in this
    // package.json's `react-native` field, but that field only applies
    // to imports from the mobile app's OWN source — Metro doesn't
    // propagate it into deeply-resolved deps. Listing them here makes
    // the shims apply uniformly across the whole module graph.
    //
    // Keep in sync with the `react-native` / `browser` fields of
    // package.json. Adding a new wallet-lib stdlib import → add the
    // shim here too.
    extraNodeModules: {
      '@hathor/ct-crypto-node': require.resolve('./empty-module'),
      // wallet-lib's `provider.browser.js` does
      // `await import('@hathor/ct-crypto-wasm')` for the explorer's
      // verifier path. Mobile never reaches that code (it uses the
      // NAPI/UniFFI provider), but Metro statically analyzes dynamic
      // imports — without a shim it fails the bundle.
      '@hathor/ct-crypto-wasm': require.resolve('./empty-module'),
      assert: require.resolve('assert'),
      buffer: require.resolve('buffer'),
      console: require.resolve('console-browserify'),
      crypto: require.resolve('react-native-crypto'),
      path: require.resolve('path-browserify'),
      stream: require.resolve('stream-browserify'),
      zlib: require.resolve('browserify-zlib'),
    },
  },
  serializer: lockdownSerializer({ hermesRuntime: true }),
};

module.exports = mergeConfig(getDefaultConfig(__dirname), config);
