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
      // Use Xcode's default DerivedData to avoid AssetCatalogSimulatorAgent spawn issue
      // triggered by -derivedDataPath on Xcode 16.x
      binaryPath: `${process.env.HOME}/Library/Developer/Xcode/DerivedData/HathorMobile-cbapwsfseepdpbcjvvcfzhzwkjyf/Build/Products/Debug-iphonesimulator/HathorMobile.app`,
      build: 'xcodebuild -workspace ios/HathorMobile.xcworkspace -scheme HathorMobile -configuration Debug -sdk iphonesimulator -destination "platform=iOS Simulator,name=iPhone 16"',
    },
    'ios.release': {
      type: 'ios.app',
      binaryPath: `${process.env.HOME}/Library/Developer/Xcode/DerivedData/HathorMobile-cbapwsfseepdpbcjvvcfzhzwkjyf/Build/Products/Release-iphonesimulator/HathorMobile.app`,
      build: 'xcodebuild -workspace ios/HathorMobile.xcworkspace -scheme HathorMobile -configuration Release -sdk iphonesimulator -destination "platform=iOS Simulator,name=iPhone 16"',
    },
    'android.debug': {
      type: 'android.apk',
      binaryPath: 'android/app/build/outputs/apk/debug/app-debug.apk',
      build: 'cd android && ./gradlew assembleDebug assembleAndroidTest -DtestBuildType=debug',
      reversePorts: [8081],
    },
  },
  devices: {
    simulator: {
      type: 'ios.simulator',
      device: {
        type: 'iPhone 16',
      },
    },
    emulator: {
      type: 'android.emulator',
      device: {
        avdName: 'Pixel_4_API_34',
      },
    },
  },
  configurations: {
    'ios.sim.debug': {
      device: 'simulator',
      app: 'ios.debug',
    },
    'ios.sim.release': {
      device: 'simulator',
      app: 'ios.release',
    },
    'android.emu.debug': {
      device: 'emulator',
      app: 'android.debug',
    },
  },
};
