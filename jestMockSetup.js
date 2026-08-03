import { jest } from '@jest/globals'; // eslint-disable-line import/no-extraneous-dependencies
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
jest.mock('react-native-device-info', () => jest.requireActual('react-native-device-info/jest/react-native-device-info-mock'));

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

jest.mock('@notifee/react-native', () => jest.requireActual('@notifee/react-native/jest-mock'));

jest.mock('react-native-status-bar-height');

jest.mock('@react-native-async-storage/async-storage', () => jest.requireActual('@react-native-async-storage/async-storage/jest/async-storage-mock'));

// NOTE: this mocks the module's default export as a callable returning the
// messaging object. Production code in src/sagas/pushNotification.js and
// src/workers/backgroundListeners.js imports NAMED exports (getMessaging,
// getToken, setBackgroundMessageHandler, etc.), which would resolve to
// undefined under this mock. That is acceptable today because no test path
// invokes those code paths — the imports never get called. If a future test
// exercises pushNotification.js or backgroundListeners.js, this mock must be
// rewritten to export named symbols (getMessaging, getToken, deleteToken,
// hasPermission, requestPermission, getInitialNotification, onMessage,
// onNotificationOpenedApp, setBackgroundMessageHandler,
// isDeviceRegisteredForRemoteMessages, registerDeviceForRemoteMessages,
// AuthorizationStatus) alongside the default factory.
jest.mock('@react-native-firebase/messaging', () => () => ({
  getToken: jest.fn(() => Promise.resolve('mock-token')),
  deleteToken: jest.fn(() => Promise.resolve()),
  requestPermission: jest.fn(() => Promise.resolve(1)),
  getInitialNotification: jest.fn(() => Promise.resolve(null)),
  onMessage: jest.fn(() => jest.fn()),
  onNotificationOpenedApp: jest.fn(() => jest.fn()),
  setBackgroundMessageHandler: jest.fn(),
  isDeviceRegisteredForRemoteMessages: true,
  registerDeviceForRemoteMessages: jest.fn(() => Promise.resolve()),
  AuthorizationStatus: { AUTHORIZED: 1, NOT_DETERMINED: -1, DENIED: 0, PROVISIONAL: 2 },
}));
jest.mock('@react-native-firebase/app', () => ({
  firebase: {
    app: jest.fn(),
  },
}));

jest.mock('@sentry/react-native');

jest.mock('react-native-version-number');

// NOTE: production code in src/sagas/featureToggle.js imports the DEFAULT
// export `UnleashClient` and the named export `FetchTogglesStatus`. This
// mock instead exposes a named `HathorUnleashClient` and `EVENTS`, so those
// imports would resolve to undefined at module load time. Acceptable today
// because no test exercises featureToggle.js (the saga is never imported by
// any __tests__/ file). If a future test runs through that saga, replace
// this mock with one that exports a default mapping to HathorUnleashClient
// and adds FetchTogglesStatus with values matching the production enum.
jest.mock('@hathor/unleash-client', () => ({
  HathorUnleashClient: jest.fn(() => ({
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

// react-native-modal and react-native-animatable were removed as dependencies.
// If re-added, uncomment these mocks:
// jest.mock('react-native-modal');
// jest.mock('react-native-animatable');

// WalletConnect compat shim imports native modules not available in test
jest.mock('@walletconnect/react-native-compat', () => ({}));

// react-native-camera-kit native component can't be parsed by babel codegen in tests
jest.mock('react-native-camera-kit', () => ({
  Camera: 'Camera',
  CameraType: { Back: 'back', Front: 'front' },
}));

// wallet-lib sub-path imports trigger bitcore-lib double-instance error in tests.
// These must be mocked to avoid loading bitcore-lib twice.
jest.mock('@hathor/wallet-lib/lib/nano_contracts/utils', () => ({
  getBlueprintId: jest.fn(),
}));
jest.mock('@hathor/wallet-lib/lib/api/axiosWrapper', () => ({
  __esModule: true,
  default: jest.fn(() => ({ get: jest.fn(), post: jest.fn() })),
}));
