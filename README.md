# Hathor Wallet Mobile

See the instructions to run on (Windows)[./WINDOWS.md].

## Install

`npm run setup`

### Check SES integrity

The SES lockdown file should match the commited sha256 sum

`sha256sum -c SHA256SUMS`

### Podfile install for iOS

#### Install cocoapods

Cocoapods is an iOS package manager. Sentry needs to add some native codes, so we must install an iOS native lib of Sentry.

Actually Apple already released a new package manager 'Swift Package Manager' but it's not supported for the React native version we use.

`sudo gem install cocoapods`

`cd ios && pod install`

### Sentry configuration

We use Sentry to allow users to send crash reports.

There is one file that must be created on ios and android folders. This file has a token used to upload some symbols to Sentry.
https://github.com/getsentry/sentry-react-native/issues/112#issuecomment-309980345

This token is only used when releasing an app version, no need to have it for development.

So you must create `ios/sentry.properties` and `android/sentry.properties` files with the following content in both:

```
defaults.url=https://sentry.io/
defaults.org=ORG-NAME
defaults.project=PROJECT-NAME
auth.token=YOUR-SENTRY-TOKEN
```

## Run

### iOS

First start the Metro bundler:

`npm start` or `npm run start:clean` to invalidate the cache before run.

Then press `i` to select the `run on iOS` option: this will build the app for iOS.

Alternatively, `npm run ios` to open on iOS simulator, or `npm run ios -- --simulator "iPhone 11"` to run it by name.

To list all available simulators, use `xcrun simctl list devices`.

#### Physical device

If you want to run in your physical device, you should first get its UDID by running the list of all possible devices:

```bash
xcrun xctrace list devices
```

You should see an output like this:
```text
== Devices ==
Alex’s ... (490613AE-...)
Alex’s ... (16.3.1) (3198...)

== Simulators ==
...
```

The code inside the last parentheses is your UDID. Then, deploy the app to your device with:

```bash
npm run ios -- --udid=3198...
```

> INFO: To be able to deploy to your physical device you can use `ios-deploy`, it can be downloaded from https://github.com/ios-control/ios-deploy:
> `ios-deploy --version`

#### Required resource

The Firebase package uses the credentials of `GoogleService-Info.plist` to initialize the device in the FCM automatically. You should generate and install this resource in your Xcode environment. Read [Generating iOS credentials](https://rnfirebase.io/#generating-ios-credentials).

### Android

First start the Metro bundler:

`npm start`

Then press `a` to select the `run on Android` option: this will build the app for Android. If a physical device is connected, the application will start on it. Else, the latest Android Studio's Emulator will be the run target. Alternatively, use `npm run android` after having the Metro bundler started.

If you need to open the Dev Menu on Android Studio Emulator, use `Ctrl + M` or run `adb shell input keyevent 82` in a terminal.

Obs: To run on your device some configuration may need to be done (see [running on device](https://reactnative.dev/docs/running-on-device))

#### Required resource

The Firebase package uses the credentials of `google-services.json` to initialize the device in the FCM automatically. You should generate and install this resource in your Android Studio environment. Read [Generating Android credentials](https://rnfirebase.io/#generating-android-credentials).

### Debugging
The preferred way of debugging the Wallet Mobile is through the Flipper Desktop application, as the Chromium-based debugger has multiple conflicts with the app's dependencies. It's also [being deprecated as of React Native v0.72](https://github.com/facebook/react-native/issues/38311#issuecomment-1731456182) due to incompatibilities with React Native's _New Architecture_.

On MacOS environments Safari debugging will continue to be supported, and is a viable alternative.

To install Flipper, [download it on the official website](https://fbflipper.com/docs/getting-started/#installation) and follow its instructions to run the executable. For Linux users, issue 1058 on Flipper's repository may [help with troubleshooting](https://github.com/facebook/flipper/issues/1058#issuecomment-786827372).

### Run linter

`npm run lint`

## Translations

We use the `ttag` lib for i18n. Check out the docs [here](https://ttag.js.org/docs/quickstart.html).

Run `make i18n` to update the root "pot" file, all the localized "po" files and their JSON compilations.

To validate all changes made to translation strings, run `make check_i18n`.

## License

Code released under [the MIT license](https://github.com/HathorNetwork/hathor-wallet-mobile/blob/master/LICENSE).
