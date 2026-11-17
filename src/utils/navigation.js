/**
 * Copyright (c) Hathor Labs and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { StackActions } from '@react-navigation/native';

/**
 * Closes a screen of a stack, with the screens above it, such as a PIN screen it opened. It finds
 * the screen by its route's key, so it also closes a screen under the top one: goBack() from there
 * would pop the top screen instead. It closes nothing once the route is gone, as when a screen
 * under it closed first, and nothing for the first screen of the stack, which has none under it.
 *
 * @param {Object} navigation The screen's navigation object, from its stack
 * @param {string} routeKey The key of the screen's route
 */
export function closeScreen(navigation, routeKey) {
  navigation.dispatch((state) => {
    const index = state.routes.findIndex((route) => route.key === routeKey);
    if (index < 1) {
      return null;
    }
    return StackActions.pop(state.index - index + 1);
  });
}
