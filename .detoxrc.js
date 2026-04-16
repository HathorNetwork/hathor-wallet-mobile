/** @type {Detox.DetoxConfig} */
module.exports = {
  testRunner: {
    args: {
      $0: 'jest',
      config: 'e2e/jest.config.js',
    },
    jest: {
      setupTimeout: 240000,
    },
  },
  apps: {
    'ios.debug': {
      type: 'ios.app',
      binaryPath: `${process.env.HOME}/Library/Developer/Xcode/DerivedData/HathorMobile-cbapwsfseepdpbcjvvcfzhzwkjyf/Build/Products/Debug-iphonesimulator/HathorMobile.app`,
      build: 'xcodebuild -workspace ios/HathorMobile.xcworkspace -scheme HathorMobile -configuration Debug -sdk iphonesimulator -destination "platform=iOS Simulator,name=iPhone 16"',
    },
  },
  devices: {
    simulator: {
      type: 'ios.simulator',
      device: {
        type: 'iPhone 16',
      },
    },
  },
  configurations: {
    'ios.sim.debug': {
      device: 'simulator',
      app: 'ios.debug',
    },
  },
};
