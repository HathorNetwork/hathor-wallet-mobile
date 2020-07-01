/**
 * Copyright (c) Hathor Labs and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import './i18nInit';
import { AppRegistry } from 'react-native';
import App from './src/App';
import { name as appName } from './app.json';

import { setJSExceptionHandler } from 'react-native-exception-handler';
import { errorHandler } from './src/errorHandler';

setJSExceptionHandler(errorHandler, true);

AppRegistry.registerComponent(appName, () => App);
