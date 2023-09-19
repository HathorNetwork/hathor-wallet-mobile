import {jest} from '@jest/globals';
import 'react-native-gesture-handler/jestSetup';

jest.mock('@react-navigation/stack');

// This mock is specially important because some libs still didn't updated
// the way to call NativeEventEmitter after a refactoring in react-native.
// Therefore, without it, test may complain with the following message:
// > Invariant Violation: new NativeEventEmitter() requires a non-null argument.
// 
// See the react-native PR that introduce this problem:
// https://github.com/facebook/react-native/commit/114be1d2170bae2d29da749c07b45acf931e51e2
//
// The package that calls in ole fashion the NativeEventEmitter
// is the react-native-device-info.
//
// See the issue describing the problem and the solution:
// https://github.com/react-native-device-info/react-native-device-info/issues/1507
jest.mock('react-native/Libraries/EventEmitter/NativeEventEmitter');

// react-native-device-info
// const RNDeviceInfo = {};
// jest.mock('react-native-device-info', () => ({
//   default: {
//     NativeModule: ({
//       default: RNDeviceInfo
//     })
//   }
// }));
jest.mock('react-native-device-info', () => require('react-native-device-info/jest/react-native-device-info-mock'));

// jest-babel transformer ignores the node_module. Threfore,
// we should either mock the module or configure to add it
// in the transformation.
// See the issue discussion: https://github.com/oblador/react-native-keychain/issues/72#issuecomment-309809798
//
// A more elegant solution would be the react-native-keychain team
// provide a jest setup file. We may contribute with them creating one.
jest.mock('react-native-keychain');

// react-native-gesture-handler faces the same problem of
// react-native-keychain. However, the team provides a setupFile
// which we can use in the "setupFiles" configuration withing
// jest in package.json.
//
// Don't remove this comment, because this is a documentation
// to increase awareness about these corner cases.
//
// See the jestSetup.js file from the project:
// https://github.com/software-mansion/react-native-gesture-handler/blob/main/jestSetup.js
//
// This solution was elaboreated by many contributors in this issue:
// https://github.com/software-mansion/react-native-gesture-handler/issues/344

jest.mock('@notifee/react-native', () => require('@notifee/react-native/jest-mock'));

jest.mock('react-native-status-bar-height');

jest.mock('@react-native-async-storage/async-storage', () => require('@react-native-async-storage/async-storage/jest/async-storage-mock'));

jest.mock('@react-native-firebase/messaging');

jest.mock('@sentry/react-native');

jest.mock('react-native-version-number');

jest.mock('unleash-proxy-client', () => ({
  UnleashClient: jest.fn(() => ({
    stop: () => {},
    getAllToggles: () => ({}),
    isEnabled: () => false,
    getVariant: () => ({}),
    updateContext: () => {},
    getContext: () => ({
      appName: 'hathor-wallet-mobile',
      environment: 'test',
      userId: 'test-user',
      sessionId: 'test-session',
      remoteAddress: undefined,
      properties: {},
    }),
    setContextField: () => {},
    start: () => {},
    stop: () => {},
    on: () => {},
  })),
  EVENTS: {
    INIT: 'INIT',
    ERROR: 'ERROR',
    READY: 'READY',
    UPDATE: 'UPDATE',
    IMPRESSION: 'IMPRESSION',
  },
}));

const RNPermissionsModule = {};
jest.mock('react-native-permissions', () => ({
  default: {
    NativeModule: ({
      default: RNPermissionsModule
    })
  }
}));

jest.mock('react-native-modal');

jest.mock('react-native-animatable');
