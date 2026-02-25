/**
 * Copyright (c) Hathor Labs and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { CommonActions } from '@react-navigation/native';

let _navigator;

/**
 * Sets the navigator variable on this singleton. This should be called
 * on the ref callback of the NavigationContainer App initialization
 */
function setTopLevelNavigator(navigatorRef) {
  _navigator = navigatorRef;
}

/**
 * Uses the initialized navigator (from setTopLevelNavigator) to navigate to a
 * route.
 */
function navigate(name, params) {
  _navigator.current.dispatch(
    CommonActions.navigate({
      name,
      params,
    })
  );
}

/**
 * Clears the whole navigation history and navigates to the home screen of the logged user.
 * Useful when an operation has been successfully executed in a screen deep within nested navigators
 * @returns <void>
 */
function resetToMain() {
  _navigator.current.reset({
    index: 0,
    routes: [
      { name: 'App', params: { screen: 'Main', params: { screen: 'Home' } } },
    ]
  });
}

export default {
  navigate,
  setTopLevelNavigator,
  resetToMain,
};
