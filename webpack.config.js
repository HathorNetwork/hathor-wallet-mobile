const path = require('path');
const LavaMoatPlugin = require('@lavamoat/webpack');

module.exports = {
  entry: './src/App.js', // Bundle the entire app through LavaMoat!
  mode: 'development', // Use development to avoid minification issues
  devtool: false, // Disable source maps completely
  optimization: {
    minimize: false, // Disable minification to avoid Terser errors
  },
  output: {
    filename: 'app-bundle.js', // Rename to distinguish from test bundle
    path: path.resolve(__dirname, 'dist'),
    libraryTarget: 'commonjs2',
    clean: true
  },
  externals: {
    // Don't bundle React Native APIs - they're provided by the host
    'react': 'react',
    'react-native': 'react-native',
    'react-native-tab-view': 'react-native-tab-view', // Fix tab view issue
    '@react-native-async-storage/async-storage': '@react-native-async-storage/async-storage',
    'react-native-keychain': 'react-native-keychain',
    'react-native-device-info': 'react-native-device-info',
    '@react-navigation/native': '@react-navigation/native',
    '@react-navigation/stack': '@react-navigation/stack',
    '@react-navigation/bottom-tabs': '@react-navigation/bottom-tabs',
    '@notifee/react-native': '@notifee/react-native',
    '@react-native-firebase/app': '@react-native-firebase/app',
    '@react-native-firebase/messaging': '@react-native-firebase/messaging',
    '@sentry/react-native': '@sentry/react-native',
    // Add more React Native specific modules
    'react-native-vector-icons': 'react-native-vector-icons',
    'react-native-svg': 'react-native-svg',
    'react-native-screens': 'react-native-screens',
    'react-native-safe-area-context': 'react-native-safe-area-context',
    'react-native-gesture-handler': 'react-native-gesture-handler',
    'react-native-reanimated': 'react-native-reanimated',
    // Add crypto/native modules that should be external
    'react-native-camera-kit': 'react-native-camera-kit',
    'react-native-qrcode-svg': 'react-native-qrcode-svg',
    'react-native-version-number': 'react-native-version-number',
    '@walletconnect/react-native-compat': '@walletconnect/react-native-compat',
    'isomorphic-ws': 'isomorphic-ws',
    'react-dom': 'react-dom',
    'invariant': 'invariant',
  },
  resolve: {
    alias: {
      // Direct aliases for crypto modules that react-native-crypto needs
      'create-hash': require.resolve('create-hash'),
      'create-hash/md5': require.resolve('create-hash/md5'),
      'create-hmac': require.resolve('create-hmac'),
      'pbkdf2': require.resolve('pbkdf2'),
      'browserify-cipher': require.resolve('browserify-cipher'),
      'diffie-hellman': require.resolve('diffie-hellman'),
      'create-ecdh': require.resolve('create-ecdh'),
      'browserify-sign': require.resolve('browserify-sign'),
      'browserify-sign/algos': require.resolve('browserify-sign/algos'),
      'public-encrypt': require.resolve('public-encrypt'),
      'randomfill': require.resolve('randomfill')
    },
    fallback: {
      // Match your existing React Native polyfills
      path: require.resolve('path-browserify'),
      crypto: require.resolve('react-native-crypto'), // Use react-native-crypto
      stream: require.resolve('stream-browserify'),
      buffer: require.resolve('buffer'),
      process: require.resolve('process'),
      console: require.resolve('console-browserify'),
      zlib: require.resolve('browserify-zlib'),
      events: require.resolve('events'),
      url: require.resolve('url'),
      // Add the missing crypto modules
      'create-hash': require.resolve('create-hash'),
      'create-hmac': require.resolve('create-hmac'),
      'pbkdf2': require.resolve('pbkdf2'),
      'browserify-cipher': require.resolve('browserify-cipher'),
      'diffie-hellman': require.resolve('diffie-hellman'),
      'create-ecdh': require.resolve('create-ecdh'),
      'browserify-sign': require.resolve('browserify-sign'),
      'public-encrypt': require.resolve('public-encrypt'),
      'randomfill': require.resolve('randomfill')
    }
  },
  module: {
    rules: [
      {
        test: /\.(js|jsx|ts|tsx)$/,
        exclude: /node_modules\/(?!(react-native-qrcode-svg|react-native-version-number)\/).*/,
        use: {
          loader: 'babel-loader',
          options: {
            presets: [
              ['@babel/preset-env', { loose: true }], // Fix the loose mode issue
              ['@react-native/babel-preset', { loose: true }]
            ],
            plugins: [
              ['@babel/plugin-transform-flow-strip-types'] // Handle Flow types
            ]
          }
        }
      },
      {
        test: /\.(png|jpg|jpeg|gif|svg)$/,
        type: 'asset/resource'
      }
    ]
  },
  plugins: [
    new (require('webpack').ProvidePlugin)({
      process: 'process/browser',
      Buffer: ['buffer', 'Buffer'],
      // Provide crypto modules globally
      createHash: 'create-hash',
      createHmac: 'create-hmac',
      pbkdf2: 'pbkdf2',
      randomFill: 'randomfill',
      randomFillSync: 'randomfill'
    }),
    new LavaMoatPlugin({
      generatePolicy: true,
      HtmlWebpackPluginInterop: false, // We're not using HTML webpack plugin
      readableResourceIds: true,
      diagnosticsVerbosity: 1,
      lockdown: {
        consoleTaming: 'unsafe',
        errorTrapping: 'none',
        unhandledRejectionTrapping: 'none',
        overrideTaming: 'severe',
      }
    })
  ]
};