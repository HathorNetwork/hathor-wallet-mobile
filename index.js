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
// - second parameter is an optional boolean and defines the error handler behavior
//   If set to true the handler will be called in place of red screen
//   in development mode also (default is false)
setJSExceptionHandler(errorHandler);

AppRegistry.registerComponent(appName, () => App);
