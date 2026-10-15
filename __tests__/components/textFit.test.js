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
    modules.FitText = require('../../src/components/FitText');
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

describe('fitFontSize', () => {
  const { FitText: { fitFontSize } } = loadFor('android');

  test('keeps the full size while it is not measured, or when the text fits', () => {
    expect(fitFontSize(32, 16, 300, {})).toBe(32);
    expect(fitFontSize(32, 16, 300, { 32: 280 })).toBe(32);
  });

  test('scales down to the next size to measure, rounded down to a whole point', () => {
    expect(fitFontSize(32, 16, 300, { 32: 400 })).toBe(24);
  });

  test('keeps lowering while a measured size is still too wide', () => {
    // Android 14+ scales large fonts non-linearly, so 24 can still be too wide.
    expect(fitFontSize(32, 16, 300, { 32: 400, 24: 310 })).toBe(23);
    expect(fitFontSize(32, 16, 300, { 32: 400, 24: 310, 23: 299 })).toBe(23);
  });

  test('always moves at least one point down', () => {
    expect(fitFontSize(32, 16, 300, { 32: 300.5 })).toBe(31);
  });

  test('stops at the minimum size', () => {
    expect(fitFontSize(32, 16, 100, { 32: 1000 })).toBe(16);
    expect(fitFontSize(32, 16, 100, { 32: 1000, 16: 500 })).toBe(16);
  });
});

describe('FitText', () => {
  const text = '1,234,567.89 HTR';

  // The visible Text and the hidden one used to measure, in that order.
  function render(os) {
    const { FitText: { default: FitText } } = loadFor(os);
    let renderer;
    act(() => {
      renderer = create(<FitText style={{ fontSize: 32, fontWeight: 'bold' }}>{text}</FitText>);
    });
    const texts = () => renderer.root.findAll((node) => node.type === 'Text');
    return { renderer, texts };
  }

  const fontSize = (props) => Object.assign({}, ...[props.style].flat()).fontSize;

  test('uses the native shrink on iOS', () => {
    const { texts } = render('ios');
    const [title] = texts();
    expect(texts()).toHaveLength(1);
    expect(title.props.adjustsFontSizeToFit).toBe(true);
    expect(title.props.minimumFontScale).toBe(0.5);
  });

  test('on Android, lowers the font size until the measured text fits', () => {
    const { renderer, texts } = render('android');
    const layout = (width) => act(() => {
      renderer.root.findByType('View').props.onLayout({ nativeEvent: { layout: { width } } });
    });
    const measure = (width) => act(() => {
      texts()[1].props.onTextLayout({ nativeEvent: { lines: [{ width }] } });
    });

    // The measurement may arrive before the available width.
    measure(400);
    expect(fontSize(texts()[0].props)).toBe(32);
    layout(300);
    expect(fontSize(texts()[0].props)).toBe(24);
    expect(fontSize(texts()[1].props)).toBe(24);
    measure(310);
    expect(fontSize(texts()[0].props)).toBe(23);
    measure(299);
    expect(fontSize(texts()[0].props)).toBe(23);
    expect(texts()[0].props.numberOfLines).toBe(1);
    expect(texts()[0].props.adjustsFontSizeToFit).toBeUndefined();
  });
});
