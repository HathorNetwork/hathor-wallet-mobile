# Preparing credentials to use Firebase

Add the `google-service.json` file for the `mainnet` environment in the folder `/android/app/`. It will result in `/android/app/google-services.json`. After add the file rebuild the project.


# Bumping up the version

The following files must be updated:
- `android/app/build.gradle`
- `ios/HathorMobile.xcodeproj/project.pbxproj`
- `package.json`
- `package-lock.json`

In the `package.json` and `package-lock.json`:
- Update the `version` field accordingly with the bump version

In the `android/app/build.gradle`:
- Increase the field `versionCode` and `versionName`

  > The `versionCode` must always be increased because Google Play uses it to uniquely identify the release.

In the `ios/HathorMobile.xcodeproj/project.pbxproj`:
- Increase the field `MARKETING_VERSION` 

  > Notice that there are two places to update the `MARKETING_VERSION` field, one for debug and another for release.

  > App Store uses the pair `(CFBundleShortVersionString, CFBundleVersion)` to identify a release. They are both from `ios/HathorMobile/Info.plist`.

Create a git tag and a new release on GitHub.

# Publishing the new App

## App Store

First, open the project in the XCode and Archive a new version. Then, upload this version to the App Store. Finally, go to the AppStoreConnect [1] to submit the new version to the TestFlight and to the App Store.

When writing the version number in the AppStoreConnect, we should supress the prefix `v`. So, `v0.4.1` becomes `0.4.1`.

We need to request the App review for both the FlightTest and the App Store. The reviews are independent processes.

When submitting for the App Store, in the Version Release section, "Manually release this version" should be checked.


## Google Play

First, open the project in Android Studio and Generate a Signed Bundle (Android App Bundle). Then, go to the Google Play Console [2] and generate the new release. Finally, upload the `.aab` to the release and do the rollout.

Usually, we first rollout to the Open track, and, after testing, we rollout to the Production track.


# Links

[1] https://appstoreconnect.apple.com/

[2] https://play.google.com/apps/publish/
