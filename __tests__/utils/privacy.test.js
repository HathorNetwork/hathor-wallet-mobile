/**
 * Copyright (c) Hathor Labs and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { jest, describe, test, expect } from '@jest/globals';
import {
  DEFAULT_PRIVACY_MODE,
  EXPLORER_MAINNET_URL,
  EXPLORER_SHIELDED_TESTNET_URL,
  EXPLORER_TESTNET_URL,
  PRIVACY_MODE,
} from '../../src/constants';
import {
  PRIVACY_DEFAULT_MODE_OPTIONS,
  getUnblindingEncoder,
  normalizePrivacyDefaultMode,
  supportsUnblindLink,
} from '../../src/utils/privacy';

describe('the default privacy mode', () => {
  test('can be any mode, Public by default', () => {
    expect(PRIVACY_DEFAULT_MODE_OPTIONS).toEqual(expect.arrayContaining([
      PRIVACY_MODE.PRIVATE,
      PRIVACY_MODE.HIDE_AMOUNT,
      PRIVACY_MODE.PUBLIC,
    ]));
    expect(PRIVACY_DEFAULT_MODE_OPTIONS).toHaveLength(3);
    expect(DEFAULT_PRIVACY_MODE).toBe(PRIVACY_MODE.PUBLIC);
  });

  test.each([
    PRIVACY_MODE.HIDE_AMOUNT,
    PRIVACY_MODE.PRIVATE,
    PRIVACY_MODE.PUBLIC,
  ])('keeps a stored %s', (mode) => {
    expect(normalizePrivacyDefaultMode(mode)).toBe(mode);
  });

  test.each([
    ['nothing stored', null],
    ['undefined', undefined],
    ['an unknown mode', 'garbage'],
    ['a number', 1],
    ['an object', { mode: PRIVACY_MODE.PRIVATE }],
  ])('turns %s into the default', (_label, value) => {
    expect(normalizePrivacyDefaultMode(value)).toBe(DEFAULT_PRIVACY_MODE);
  });
});

describe('getUnblindingEncoder', () => {
  // The isolated modules below get this copy of wallet-lib: a second one would load a second
  // bitcore-lib, which refuses to.
  const walletLib = jest.requireActual('@hathor/wallet-lib');

  test('finds the encoder of the wallet-lib build the app runs with', () => {
    expect(getUnblindingEncoder()).toBe(walletLib.shielded.encodeShieldedUnblindingPayload);
  });

  test('finds no encoder in a wallet-lib build without one, and looks it up at each call', () => {
    // wallet-lib's own exports are read-only, so a stand-in shielded namespace starts without
    // the encoder and gets it once the module that looks it up is loaded.
    const shieldedNamespace = {};
    let isolated;
    jest.isolateModules(() => {
      jest.doMock('@hathor/wallet-lib', () => {
        Object.keys(walletLib.shielded)
          .filter((name) => name !== 'encodeShieldedUnblindingPayload')
          .forEach((name) => { shieldedNamespace[name] = walletLib.shielded[name]; });
        return { ...walletLib, shielded: shieldedNamespace };
      });
      // eslint-disable-next-line global-require
      isolated = require('../../src/utils/privacy');
    });
    jest.dontMock('@hathor/wallet-lib');
    expect(isolated.getUnblindingEncoder()).toBeNull();

    const encoder = jest.fn();
    shieldedNamespace.encodeShieldedUnblindingPayload = encoder;

    expect(isolated.getUnblindingEncoder()).toBe(encoder);
  });

  test('ignores an encoder that is not a function', () => {
    let isolated;
    jest.isolateModules(() => {
      jest.doMock('@hathor/wallet-lib', () => ({
        ...walletLib,
        shielded: { ...walletLib.shielded, encodeShieldedUnblindingPayload: 'v1' },
      }));
      // eslint-disable-next-line global-require
      isolated = require('../../src/utils/privacy');
    });
    jest.dontMock('@hathor/wallet-lib');

    expect(isolated.getUnblindingEncoder()).toBeNull();
  });
});

describe('supportsUnblindLink', () => {
  test.each([
    EXPLORER_SHIELDED_TESTNET_URL,
    EXPLORER_SHIELDED_TESTNET_URL.replace(/\/+$/, ''),
    `${EXPLORER_SHIELDED_TESTNET_URL}/`,
  ])('is true for the shielded testnet explorer, at %s', (url) => {
    expect(supportsUnblindLink(url)).toBe(true);
  });

  test.each([
    EXPLORER_MAINNET_URL,
    EXPLORER_TESTNET_URL,
    'https://explorer.shielded-outputs.testnet.hathor.network.example/',
    '',
    null,
    undefined,
  ])('is false for %s', (url) => {
    expect(supportsUnblindLink(url)).toBe(false);
  });
});
