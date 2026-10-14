/**
 * Copyright (c) Hathor Labs and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { describe, test, expect, afterEach } from '@jest/globals';
import React from 'react';
import { StyleSheet, View } from 'react-native';
import { act, create } from 'react-test-renderer';
import {
  HathorList, ListButton, ListItem, ListMenu,
} from '../../src/components/HathorList';
import { COLORS } from '../../src/styles/themes';

let mounted = null;

afterEach(async () => {
  if (mounted) {
    await act(async () => { mounted.unmount(); });
    mounted = null;
  }
});

async function render(element) {
  let renderer;
  await act(async () => {
    renderer = create(element);
  });
  mounted = renderer;
  return renderer;
}

/**
 * The title and the card a list renders, with their styles flattened.
 */
function parts(renderer) {
  const json = [].concat(renderer.toJSON());
  const card = json[json.length - 1];
  const title = json.length > 1 ? json[0] : null;
  return {
    title: title && StyleSheet.flatten(title.props.style),
    card: StyleSheet.flatten(card.props.style),
  };
}

/** The title and whether it is the last row, for each row of the list. */
const rows = (renderer) => renderer.root.findAllByType(ListButton)
  .map((node) => [node.props.title, node.props.isLast]);

describe('HathorList', () => {
  test.each([
    ['a list', {}],
    ['a list that fills the screen', { infinity: true }],
  ])('rings the card of %s with a hairline', async (_label, props) => {
    const renderer = await render(
      <HathorList {...props}>
        <ListMenu title='Security' isFirst />
      </HathorList>,
    );

    expect(parts(renderer).card).toEqual(expect.objectContaining({
      borderRadius: 16,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: COLORS.borderColor,
    }));
  });

  test('puts its title flush with the card, with room above it', async () => {
    const renderer = await render(
      <HathorList title='Advanced Settings'>
        <ListMenu title='Reset wallet' isFirst />
      </HathorList>,
    );

    const { title, card } = parts(renderer);
    expect(title).toEqual(expect.objectContaining({ paddingHorizontal: 16, marginTop: 8 }));
    expect(card.margin).toBe(16);
  });

  test('marks its last row as the last, past the rows a flag hides', async () => {
    const shown = false;
    const renderer = await render(
      <HathorList>
        <ListMenu title='Register a token' isFirst />
        <ListMenu title='Security' />
        {shown && <ListMenu title='Reown' />}
        {null}
      </HathorList>,
    );

    expect(rows(renderer)).toEqual([
      ['Register a token', false],
      ['Security', true],
    ]);
  });

  test('marks the last of the rows it maps as the last', async () => {
    const renderer = await render(
      <HathorList>
        {['Security', 'Reown', 'Push Notification'].map((title) => (
          <ListMenu key={title} title={title} />
        ))}
      </HathorList>,
    );

    expect(rows(renderer)).toEqual([
      ['Security', false],
      ['Reown', false],
      ['Push Notification', true],
    ]);
  });

  test('gives its last row no bottom line and round bottom corners', async () => {
    const renderer = await render(
      <HathorList>
        <ListItem title='Unique app identifier' text='abc' isFirst />
        <ListItem title='Connected to' text='https://node.example' />
      </HathorList>,
    );

    const [first, last] = renderer.root.findAllByType(ListItem);
    expect(first.props.isLast).toBe(false);
    expect(last.props.isLast).toBe(true);
    // Each item renders in a View with its bottom line, which holds the View of its content.
    const [container, content] = last.findAllByType(View);
    expect(StyleSheet.flatten(container.props.style).borderBottomWidth).toBe(0);
    expect(StyleSheet.flatten(content.props.style)).toEqual(expect.objectContaining({
      borderBottomLeftRadius: 16,
      borderBottomRightRadius: 16,
    }));
  });
});
