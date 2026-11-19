/**
 * Copyright (c) Hathor Labs and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { describe, test, expect } from '@jest/globals';

/* eslint-disable import/first */
import fs from 'fs';
import path from 'path';
import { parseSync } from '@babel/core';
/* eslint-enable import/first */

// What the app loads at start never reaches the crypto library only the Hathor Next code uses
// (@noble): that code runs only once Hathor Next is used. Jest can't load the app's entry point
// (Firebase's native module isn't there), so this walks the static imports from index.js instead:
// `import`, `export … from`, and a `require` outside any function. A require inside a function
// runs only when the function does.

const ROOT = path.resolve(__dirname, '../..');
const CANDIDATES = [
  '', '.ios.js', '.native.js', '.js', '.jsx', '.ts', '.tsx',
  '/index.ios.js', '/index.native.js', '/index.js', '/index.ts', '/index.tsx',
];
const SCOPES = new Set([
  'FunctionDeclaration', 'FunctionExpression', 'ArrowFunctionExpression', 'ObjectMethod',
  'ClassMethod', 'ClassPrivateMethod',
]);

function resolveFrom(file, spec) {
  const base = path.resolve(path.dirname(file), spec);
  const found = CANDIDATES.map((ext) => `${base}${ext}`)
    .find((candidate) => fs.existsSync(candidate) && fs.statSync(candidate).isFile());
  return found ?? null;
}

/** The modules a file loads as it is evaluated. */
function staticImports(file) {
  if (!/\.(js|jsx|ts|tsx)$/.test(file)) {
    return [];
  }
  const typescript = /\.tsx?$/.test(file);
  const ast = parseSync(fs.readFileSync(file, 'utf8'), {
    filename: file,
    configFile: false,
    babelrc: false,
    sourceType: 'module',
    parserOpts: {
      plugins: typescript
        ? ['jsx', 'typescript']
        : ['jsx', 'flow', 'classProperties', 'exportDefaultFrom'],
    },
  });
  const specs = [];
  const walk = (node, inScope) => {
    if (!node || typeof node.type !== 'string') {
      return;
    }
    if (node.type === 'ImportDeclaration' && node.importKind !== 'type') {
      specs.push(node.source.value);
    }
    if ((node.type === 'ExportNamedDeclaration' || node.type === 'ExportAllDeclaration')
      && node.source && node.exportKind !== 'type') {
      specs.push(node.source.value);
    }
    if (!inScope && node.type === 'CallExpression' && node.callee.type === 'Identifier'
      && node.callee.name === 'require' && node.arguments[0]?.type === 'StringLiteral') {
      specs.push(node.arguments[0].value);
    }
    // An instance field's value is evaluated with each instance, as a method body is.
    const deeper = inScope || SCOPES.has(node.type)
      || (node.type === 'ClassProperty' && !node.static);
    for (const key of Object.keys(node)) {
      if (key !== 'loc' && !key.endsWith('Comments')) {
        const value = node[key];
        if (Array.isArray(value)) {
          value.forEach((child) => walk(child, deeper));
        } else if (value && typeof value === 'object') {
          walk(value, deeper);
        }
      }
    }
  };
  walk(ast.program, false);
  return specs;
}

/**
 * The walk from index.js: every module it loads at start, with the one that loaded it first, and
 * each import of @noble with the shortest chain of imports from index.js that reaches it.
 */
function walkFromIndex() {
  const start = path.join(ROOT, 'index.js');
  const parent = new Map([[start, null]]);
  const queue = [start];
  const noble = [];
  const name = (file) => path.relative(ROOT, file);
  while (queue.length > 0) {
    const file = queue.shift();
    for (const spec of staticImports(file)) {
      if (spec.startsWith('@noble/')) {
        const chain = [spec];
        for (let at = file; at; at = parent.get(at)) {
          chain.unshift(name(at));
        }
        noble.push(chain.join(' → '));
      } else if (spec.startsWith('.')) {
        const target = resolveFrom(file, spec);
        if (target && !parent.has(target)) {
          parent.set(target, file);
          queue.push(target);
        }
      }
    }
  }
  return { loaded: new Set([...parent.keys()].map(name)), noble };
}

describe('what the app loads at start', () => {
  const { loaded, noble } = walkFromIndex();

  test('never reaches @noble, which only the Hathor Next code uses', () => {
    expect(noble).toEqual([]);
  });

  // So an empty answer above means something: the walk reaches the app, the multichain saga, the
  // Hathor Next address helpers and the screens that use them.
  test('reaches the app and its Hathor Next entry points', () => {
    for (const file of [
      'src/App.js',
      'src/sagas/multichain.js',
      'src/multichain/address.js',
      'src/multichain/bridge.js',
      'src/multichain/nextClient.js',
      'src/screens/SendAddressInput.js',
      'src/screens/UnifiedQRScanner.js',
      'src/screens/PasskeyLockScreen.js',
    ]) {
      expect(loaded.has(file)).toBe(true);
    }
  });
});
