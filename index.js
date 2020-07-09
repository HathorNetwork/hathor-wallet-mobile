/**
 * Copyright (c) Hathor Labs and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import './i18nInit';
import { AppRegistry } from 'react-native';
import { setJSExceptionHandler } from 'react-native-exception-handler';
import App from './src/App';
import { name as appName } from './app.json';
import { errorHandler } from './src/errorHandler';

// - errorHandler is the callback
// - 'true' is 'allowInDevMode' is an optional parameter
//   If set to true the handler to be called in place of RED screen
//   in development mode also
setJSExceptionHandler(errorHandler, false);

AppRegistry.registerComponent(appName, () => App);
