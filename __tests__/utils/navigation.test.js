/**
 * Copyright (c) Hathor Labs and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { describe, test, expect, afterEach } from '@jest/globals';
import React from 'react';
import { act, create } from 'react-test-renderer';
import {
  NavigationContainer,
  StackRouter,
  createNavigationContainerRef,
  createNavigatorFactory,
  useNavigationBuilder,
} from '@react-navigation/native';
import { closeScreen } from '../../src/utils/navigation';

/**
 * A stack navigator on React Navigation's StackRouter that renders every route of its stack, as
 * the app's stack keeps the screens under the top one mounted. The app's own stack navigator is
 * mocked in the tests.
 */
function AllRoutesStack({
  id,
  initialRouteName,
  children,
  screenOptions,
}) {
  const { state, descriptors, NavigationContent } = useNavigationBuilder(StackRouter, {
    id,
    initialRouteName,
    children,
    screenOptions,
  });
  return (
    <NavigationContent>
      {state.routes.map((route) => (
        <React.Fragment key={route.key}>{descriptors[route.key].render()}</React.Fragment>
      ))}
    </NavigationContent>
  );
}

const Stack = createNavigatorFactory(AllRoutesStack)();

// The navigation object and the route of each screen, by the screen's name.
let screens = {};

function StandIn({ navigation, route }) {
  screens[route.name] = { navigation, route };
  return null;
}

let mounted = null;

afterEach(async () => {
  if (mounted) {
    await act(async () => { mounted.unmount(); });
    mounted = null;
  }
  screens = {};
});

/**
 * Renders a stack of the screens A, B, C and D that starts at A, then opens `names` on top of it.
 */
async function renderStack(names) {
  const navigationRef = createNavigationContainerRef();
  await act(async () => {
    mounted = create(
      <NavigationContainer ref={navigationRef}>
        <Stack.Navigator>
          {['A', 'B', 'C', 'D'].map((name) => (
            <Stack.Screen key={name} name={name} component={StandIn} />
          ))}
        </Stack.Navigator>
      </NavigationContainer>,
    );
  });
  await act(async () => {
    names.forEach((name) => navigationRef.navigate(name));
  });

  const routes = () => navigationRef.getRootState().routes.map((route) => route.name);
  /** Closes the screens in turn, as the effects of one render would. */
  const close = (...closed) => act(async () => {
    closed.forEach((name) => closeScreen(screens[name].navigation, screens[name].route.key));
  });
  return { routes, close };
}

describe('closeScreen', () => {
  test('closes the top screen, as goBack does', async () => {
    const { routes, close } = await renderStack(['B']);

    await close('B');

    expect(routes()).toEqual(['A']);
  });

  test('closes a screen under the top one with the screens above it, and leaves those under it', async () => {
    const { routes, close } = await renderStack(['B', 'C', 'D']);

    await close('C');

    expect(routes()).toEqual(['A', 'B']);
  });

  test.each([
    ['the lower one first', ['C', 'D']],
    ['the upper one first', ['D', 'C']],
  ])('closes two screens, %s, and nothing under them', async (_label, order) => {
    const { routes, close } = await renderStack(['B', 'C', 'D']);

    await close(...order);

    expect(routes()).toEqual(['A', 'B']);
  });

  test('does nothing for the first screen of its stack, which has none under it', async () => {
    const { routes, close } = await renderStack(['B']);

    await close('A');

    expect(routes()).toEqual(['A', 'B']);
  });
});
