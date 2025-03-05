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
require('crypto')

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

// Save the original JSON.parse
const originalJSONParse = JSON.parse;

// Override JSON.parse with our own implementation
JSON.parse = function(text, reviver) {
  if (!reviver) {
    return originalJSONParse(text);
  }
  
  // Create a tokenizer to extract the original string representation
  const tokens = [];
  let pos = 0;
  
  // Simple tokenizer for JSON
  const tokenize = () => {
    while (pos < text.length) {
      const char = text[pos];
      
      // Skip whitespace
      if (/\s/.test(char)) {
        pos++;
        continue;
      }
      
      // Handle strings
      if (char === '"') {
        const start = pos;
        pos++;
        while (pos < text.length) {
          if (text[pos] === '\\') {
            pos += 2;
            continue;
          }
          if (text[pos] === '"') {
            pos++;
            break;
          }
          pos++;
        }
        tokens.push({ type: 'string', value: text.substring(start, pos) });
        continue;
      }
      
      // Handle numbers
      if (/[\d\-]/.test(char)) {
        const start = pos;
        // Match integers, decimals, and scientific notation
        while (pos < text.length && /[\d\-\+\.eE]/.test(text[pos])) {
          pos++;
        }
        const numStr = text.substring(start, pos);
        tokens.push({ type: 'number', value: numStr });
        continue;
      }
      
      // Handle other characters
      tokens.push({ type: 'char', value: char });
      pos++;
    }
  };
  
  // Tokenize the JSON string
  tokenize();
  
  // Track the current token index
  let tokenIndex = 0;
  
  // Custom reviver that adds context
  const reviverWithContext = function(key, value) {
    // Find the corresponding token for this value
    let sourceValue = undefined;
    
    if (typeof value === 'number') {
      // Look for a number token
      for (let i = tokenIndex; i < tokens.length; i++) {
        if (tokens[i].type === 'number') {
          sourceValue = tokens[i].value;
          tokenIndex = i + 1;
          break;
        }
      }
    }
    
    // Call the original reviver with context
    return reviver.call(this, key, value, { source: sourceValue });
  };
  
  return originalJSONParse(text, reviverWithContext);
};
