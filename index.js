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

import { setJSExceptionHandler, setNativeExceptionHandler } from 'react-native-exception-handler';
import { errorHandler, nativeErrorHandler } from './src/errorHandler';

// - errorHandler is the callback
// - 'true' is 'allowInDevMode' is an optional parameter
//   If set to true the handler to be called in place of RED screen
//   in development mode also
// XXX should be false (true only for testing)
setJSExceptionHandler(errorHandler, true);

// - error handler callback
// - forceAppQuit is an optional ANDROID specific parameter that defines
//    if the app should be force quit on error.  default value is true.
// - executeDefaultHandler is an optional boolean (both IOS, ANDROID)
//    It executes previous exception handlers if set by some other module.
//    It will come handy when you use any other crash analytics module along with this one
//    Default value is set to false. Set to true if you are using other analytics modules.
setNativeExceptionHandler(nativeErrorHandler, false, true);

AppRegistry.registerComponent(appName, () => App);
