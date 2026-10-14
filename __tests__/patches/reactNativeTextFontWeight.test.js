/**
 * Copyright (c) Hathor Labs and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { jest, describe, test, expect } from '@jest/globals';
import React from 'react';
import { create, act } from 'react-test-renderer';

/**
 * The react-native patch in patches/ gives a top-level Text without fontWeight, fontFamily or
 * fontStyle an explicit fontWeight on Android, so it is measured and drawn with the same typeface.
 * The jest preset mocks Text, so these tests load the real (patched) one for the platform.
 */
function loadText(os) {
  let Text;
  jest.isolateModules(() => {
    // The isolated registry must share the renderer's React, or Text's hooks find no dispatcher.
    jest.doMock('react', () => React);
    // Both modules export with module.exports.
    jest.doMock('react-native/Libraries/Utilities/Platform', () => ({
      OS: os,
      select: (spec) => (os in spec ? spec[os] : spec.default),
      isTesting: true,
    }));
    // eslint-disable-next-line global-require
    Text = jest.requireActual('react-native/Libraries/Text/Text');
  });
  jest.dontMock('react');
  jest.dontMock('react-native/Libraries/Utilities/Platform');
  return Text;
}

// The style of each native text node, outermost first.
function nativeStyles(element) {
  let renderer;
  act(() => {
    renderer = create(element);
  });
  return renderer.root
    .findAll((node) => typeof node.type === 'string')
    .map((node) => node.props.style);
}

const flatten = (style) => [style].flat(Infinity).filter(Boolean)
  .reduce((acc, s) => ({ ...acc, ...s }), {});

describe('react-native Text patch', () => {
  test('gives a Text without a font weight an explicit one on Android', () => {
    const Text = loadText('android');
    const [style] = nativeStyles(<Text style={{ fontSize: 13 }}>HTR</Text>);
    expect(flatten(style)).toEqual({ fontWeight: '400', fontSize: 13 });
  });

  test('also when the Text has no style', () => {
    const Text = loadText('android');
    const [style] = nativeStyles(<Text>SEND</Text>);
    expect(flatten(style)).toEqual({ fontWeight: '400' });
  });

  test.each([
    ['fontWeight', { fontWeight: 'bold' }],
    ['fontFamily', { fontFamily: 'monospace' }],
    ['fontStyle', { fontStyle: 'italic' }],
  ])('leaves a Text that sets %s as it is', (_label, fontStyle) => {
    const Text = loadText('android');
    const [style] = nativeStyles(<Text style={fontStyle}>HTR</Text>);
    expect(flatten(style)).toEqual(fontStyle);
  });

  test('leaves a nested Text alone, so it keeps inheriting its parent weight', () => {
    const Text = loadText('android');
    const [outer, inner] = nativeStyles(
      <Text style={{ fontWeight: 'bold' }}>Total <Text style={{ color: 'red' }}>HTR</Text></Text>,
    );
    expect(flatten(outer)).toEqual({ fontWeight: 'bold' });
    expect(flatten(inner)).toEqual({ color: 'red' });
  });

  test('changes nothing on iOS', () => {
    const Text = loadText('ios');
    const [style] = nativeStyles(<Text style={{ fontSize: 13 }}>HTR</Text>);
    expect(flatten(style)).toEqual({ fontSize: 13 });
  });
});
