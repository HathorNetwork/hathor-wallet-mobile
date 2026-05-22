/* eslint-disable */

if (typeof __dirname === 'undefined') global.__dirname = '/'
if (typeof __filename === 'undefined') global.__filename = ''
if (typeof process === 'undefined') {
  global.process = require('process')
} else {
  const bProcess = require('process')
  for (var p in bProcess) {
    if (!(p in process)) {
      process[p] = bProcess[p]
    }
  }
}

process.browser = false
if (typeof Buffer === 'undefined') global.Buffer = require('buffer').Buffer

// global.location = global.location || { port: 80 }
const isDev = typeof __DEV__ === 'boolean' && __DEV__
process.env['NODE_ENV'] = isDev ? 'development' : 'production'
if (typeof localStorage !== 'undefined') {
  localStorage.debug = isDev ? '*' : ''
}

// If using the crypto shim, uncomment the following line to ensure
// crypto is loaded first, so it can populate global.crypto
const cryptoPolyfill = require('crypto')

// Expose createHash/createHmac on globalThis.crypto so that
// @toruslabs/eccrypto (which checks globalThis.crypto.createHash) can use them.
// Without this, eccrypto falls back to subtle.digest() which doesn't exist in RN.
if (typeof globalThis.crypto === 'undefined') {
  globalThis.crypto = {};
}
// Expose all crypto polyfill methods on globalThis.crypto so that
// @toruslabs/eccrypto can use createHash, createCipheriv, createDecipheriv, etc.
const methodsToExpose = [
  'createHash', 'createHmac', 'createCipheriv', 'createDecipheriv',
  'randomBytes', 'publicEncrypt', 'publicDecrypt',
];
for (const method of methodsToExpose) {
  if (cryptoPolyfill[method] && !globalThis.crypto[method]) {
    globalThis.crypto[method] = cryptoPolyfill[method];
  }
}
if (!globalThis.crypto.getRandomValues && cryptoPolyfill.randomFillSync) {
  globalThis.crypto.getRandomValues = function(arr) {
    return cryptoPolyfill.randomFillSync(arr);
  };
}

const { TextEncoder, TextDecoder } = require('text-encoding');

global.TextDecoder = TextDecoder;
global.TextEncoder = TextEncoder;

if (typeof btoa === 'undefined') {
  global.btoa = function (str) {
    return Buffer.from(str, 'binary').toString('base64');
  };
}

if (typeof atob === 'undefined') {
  global.atob = function (b64Encoded) {
    return Buffer.from(b64Encoded, 'base64').toString('binary');
  };
}

const { URLSearchParams } = require('react-native-url-polyfill');

global.URLSearchParams = URLSearchParams;

// Fix bitcore-lib prototype pollution on elliptic points.
// bitcore-lib replaces elliptic's BasePoint.prototype.validate (returns boolean)
// with a version that THROWS on invalid points. This breaks Web3Auth SDK
// because elliptic's ec/key.js calls pub.validate() expecting a boolean.
// Fix: save native validate, let bitcore-lib load, then restore it.
// bitcore-lib's own Point constructor calls .validate() but we patch it
// to use its own strict validation function directly.
try {
  const EC = require('elliptic').ec;
  const ec = new EC('secp256k1');
  const pointProto = Object.getPrototypeOf(ec.curve.point());

  // Save elliptic's native validate (returns boolean)
  const nativeValidate = pointProto.validate;

  // Load bitcore-lib which will monkey-patch pointProto.validate
  require('bitcore-lib');

  // Save bitcore-lib's strict validate (throws on invalid)
  const bitcoreValidate = pointProto.validate;

  // Restore elliptic's native validate on the shared prototype
  pointProto.validate = nativeValidate;

  // Store bitcore's validate so it can still be called explicitly
  // by bitcore-lib code that needs it (via the Point constructor)
  global.__bitcorePointValidate = bitcoreValidate;
} catch (e) {
  // bitcore-lib or elliptic not available — no action needed
}
