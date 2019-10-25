
# Bumping up the version

The following files must be updated: `android/app/build.gradle`, `ios/HathorMobile/Info.plist`, and `package.json`.

In the `package.json`, the field `version` must be updated.

In the `android/app/build.gradle`, the fields `versionCode` and `versionName` must be updated. The `versionCode` must always be increased because Google Play uses it to uniquelly identify the release.

In the `ios/HathorMobile/Info.plist`, the fields `CFBundleShortVersionString` and `CFBundleVersion` must be updated. Usually, the `CFBundleVersion` is always `1`, while the `CFBundleShortVersionString` is updated with the new version. App Store uses the pair `(CFBundleShortVersionString, CFBundleVersion)` to identify a release.

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
