/**
 * Copyright (c) Hathor Labs and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { jest, describe, test, expect } from '@jest/globals';
import React from 'react';
import { create, act } from 'react-test-renderer';

// The isolated registries below get this copy of wallet-lib (through constants.js): a second one
// would load a second bitcore-lib, which refuses to.
const walletLib = jest.requireActual('@hathor/wallet-lib');

/**
 * Loads the modules for a platform: SHRINK_TEXT_TO_FIT is read from Platform when constants.js
 * loads, so each platform needs its own module registry.
 */
function loadFor(os) {
  const modules = {};
  jest.isolateModules(() => {
    jest.doMock('react', () => React);
    jest.doMock('@hathor/wallet-lib', () => walletLib);
    jest.doMock('react-native/Libraries/Utilities/Platform', () => ({
      ...jest.requireActual('react-native/Libraries/Utilities/Platform'),
      OS: os,
      select: (spec) => (os in spec ? spec[os] : spec.default),
    }));
    /* eslint-disable global-require */
    modules.constants = require('../../src/constants');
    modules.NewHathorButton = require('../../src/components/NewHathorButton').default;
    modules.SimpleButton = require('../../src/components/SimpleButton').default;
    modules.HathorHeader = require('../../src/components/HathorHeader').default;
    /* eslint-enable global-require */
  });
  jest.dontMock('react');
  jest.dontMock('@hathor/wallet-lib');
  jest.dontMock('react-native/Libraries/Utilities/Platform');
  return modules;
}

// The props of the Text elements that render the given string. The jest preset's Text renders a
// host 'Text' element, the same whichever module registry the component was loaded in.
function textProps(element, text) {
  let renderer;
  act(() => {
    renderer = create(element);
  });
  return renderer.root
    .findAll((node) => node.type === 'Text' && node.props.children === text)
    .map((node) => node.props);
}

describe('shrinking text to fit', () => {
  test('is off on Android, where the shrink is broken, and on for iOS', () => {
    expect(loadFor('android').constants.SHRINK_TEXT_TO_FIT).toBe(false);
    expect(loadFor('ios').constants.SHRINK_TEXT_TO_FIT).toBe(true);
  });

  test.each([
    ['android', false],
    ['ios', true],
  ])('buttons keep one line and shrink only where it works (%s)', (os, shrinks) => {
    const { NewHathorButton, SimpleButton } = loadFor(os);

    const [newButtonTitle] = textProps(<NewHathorButton title='SEND' onPress={() => {}} />, 'SEND');
    expect(newButtonTitle.numberOfLines).toBe(1);
    expect(newButtonTitle.adjustsFontSizeToFit).toBe(shrinks);

    const [simpleButtonTitle] = textProps(<SimpleButton title='Cancel' onPress={() => {}} />, 'Cancel');
    expect(simpleButtonTitle.numberOfLines).toBe(1);
    expect(simpleButtonTitle.adjustsFontSizeToFit).toBe(shrinks);
  });
});

describe('HathorHeader', () => {
  test('keeps the title on one line, shrinking it between the side components', () => {
    const { HathorHeader } = loadFor('android');
    const titles = textProps(<HathorHeader title='SEND' />, 'SEND');
    expect(titles).toHaveLength(1);
    expect(titles[0].numberOfLines).toBe(1);
    expect([titles[0].style].flat()).toContainEqual(expect.objectContaining({ flexShrink: 1 }));
  });
});
