/**
 * Copyright (c) Hathor Labs and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { NavigationActions } from 'react-navigation';

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
function navigate(routeName, params) {
  _navigator.dispatch(
    NavigationActions.navigate({
      routeName,
      params,
    })
  );
}

export default {
  navigate,
  setTopLevelNavigator,
};
