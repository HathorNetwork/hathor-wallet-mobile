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
  if (!_navigator.current) { // XXX: Maybe this validation is not necessary
    throw new Error('Navigator is not in a consistent state to be manipulated');
  }
  _navigator.current.dispatch(
    CommonActions.navigate({
      name,
      params,
    })
  );
}

export default {
  navigate,
  setTopLevelNavigator,
};
