### Acceptance Criteria
- Include here all things that this PR should solve

### Checklist
- [ ] Make sure you updated the `CURRENT_PROJECT_VERSION` with the appropriate release-candidate version in `ios/HathorMobile.xcodeproj/project.pbxproj`
- [ ] Make sure you updated the `MARKETING_VERSION` with the appropriate version in `ios/HathorMobile.xcodeproj/project.pbxproj`
- [ ] Make sure you updated the version attribute in `package.json`
- [ ] Make sure you updated the version attribute in `package-lock.json`
- [ ] Make sure you incremented the `versionCode` attribute in `android/app/build.gradle`
- [ ] Make sure you updated the `versionName` with the appropriate version, including the release candidate number in `android/app/build.gradle`

### Security Checklist
- [ ] Make sure you do not include new dependencies in the project unless strictly necessary and do not include dev-dependencies as production ones. More dependencies increase the possibility of one of them being hijacked and affecting us.
