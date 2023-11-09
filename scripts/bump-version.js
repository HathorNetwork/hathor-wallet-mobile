/**
 * Copyright (c) Hathor Labs and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

const fs = require('fs');
const path = require('path');

function updateAndroidBuildVersion() {
  const gradlePath = path.join(__dirname, '..', 'android', 'app', 'build.gradle');
  const gradleFile = fs.readFileSync(gradlePath, 'utf8');

  // Look for the line containing "versionCode"
  const versionCodeRegex = /versionCode\s+(\d+)/;
  const versionCodeMatch = gradleFile.match(versionCodeRegex);
  const currentVersionCode = parseInt(versionCodeMatch[1], 10);
  const updatedVersionCode = currentVersionCode + 1;

  // Replace the version code on the file
  const updatedGradleFile = gradleFile.replace(versionCodeRegex, `versionCode ${updatedVersionCode}`);

  // Write the new file in disk on "testResults.txt"
  fs.writeFileSync(gradlePath, updatedGradleFile);
}

function calculateNewVersion(_updateType, currentVersionString) {
  const versionNameRegex = /(\d+)\.(\d+)\.(\d+)(-rc)?(\d+)?/;
  const versionNameMatch = currentVersionString.match(versionNameRegex);
  let major = parseInt(versionNameMatch[1], 10);
  let minor = parseInt(versionNameMatch[2], 10);
  let patch = parseInt(versionNameMatch[3], 10);
  let rc = parseInt(versionNameMatch[5], 10);

  switch (_updateType) {
    case 'major':
      major += 1;
      minor = 0;
      patch = 0;
      rc = null;
      break;
    case 'minor':
      minor += 1;
      patch = 0;
      rc = null;
      break;
    case 'patch':
      patch += 1;
      rc = null;
      break;
    case 'rc':
      if (rc) {
        rc += 1;
      } else {
        rc = 1;
      }
      break;
    case 'release':
      rc = null;
      break;
    default:
      throw new Error(`Invalid update type: ${_updateType}`);
  }

  const mainVersionString = `${major}.${minor}.${patch}`;
  const rcVersion = rc;
  const updatedVersionString = `${mainVersionString}${rc ? `-rc${rc}` : ''}`;
  return {
    mainVersionString,
    rcVersion,
    updatedVersionString,
  }
}

function updateVersionPackageJson(_updateType) {
  const packageJsonPath = path.join(__dirname, '..', 'package.json');
  const packageJsonFile = fs.readFileSync(packageJsonPath, 'utf8');

  // Look for the line containing "version", containing a "rc" tag or not
  const versionNameRegex = /"version": "(.+)"/;
  const versionNameMatch = packageJsonFile.match(versionNameRegex);
  const currentVersionString = versionNameMatch[1];
  const updatedVersionObj = calculateNewVersion(_updateType, currentVersionString);

  // Replace the version code on the file
  const updatedPackageJsonFile = packageJsonFile.replace(versionNameRegex, `"version": "${updatedVersionObj.updatedVersionString}"`);

  // Write the new file in disk on "testResults.txt"
  fs.writeFileSync(packageJsonPath, updatedPackageJsonFile);

  return updatedVersionObj;
}

function updateVersionPackageLockJson(updatedVersionString) {
  const packageLockJsonPath = path.join(__dirname, '..', 'package-lock.json');
  const packageLockJsonFile = fs.readFileSync(packageLockJsonPath, 'utf8');

  // Iterate over each line of this file
  const lines = packageLockJsonFile.split('\n');
  let nextVersionLine = -1;
  let updatedLinesCount = 0;
  for (let i = 0; i < lines.length; i += 1) {
    if (updatedLinesCount === 2) {
      break; // No need to continue: all the needed versions were already updated
    }

    const line = lines[i];
    if (line.includes('"name": "HathorMobile"')) {
      // Found a block related to this app, will update its version number
      nextVersionLine = i + 1;
      continue;
    }
    if (i === nextVersionLine) {
      // Replace the release candidate version on this line
      const versionNameRegex = /"version": ".+"/;
      lines[i] = line.replace(versionNameRegex, `"version": "${updatedVersionString}"`);
      updatedLinesCount += 1;
    }
  }

  // Update the file
  fs.writeFileSync(packageLockJsonPath, lines.join('\n'));
}

function updateVersionAndroid(updatedVersionString) {
  const gradlePath = path.join(__dirname, '..', 'android', 'app', 'build.gradle');
  const gradleFile = fs.readFileSync(gradlePath, 'utf8');

  // Look for the line containing "versionName"
  const versionNameRegex = /versionName\s+".+"/;

  // Replace the version code on the file
  const updatedGradleFile = gradleFile.replace(versionNameRegex, `versionName "${updatedVersionString}"`);

  // Write the new file in disk on "testResults.txt"
  fs.writeFileSync(gradlePath, updatedGradleFile);
}

function updateReleaseCandidateIos(updatedVersionString, rcVersion) {
  const projPath = path.join(__dirname, '..', 'ios', 'HathorMobile.xcodeproj', 'project.pbxproj');
  const projFile = fs.readFileSync(projPath, 'utf8');

  let updatedProjFile;
  // Look for the line containing "MARKETING_VERSION = X.X.X"
  const versionCodeRegex = /MARKETING_VERSION = (.+)/g;
  // Update the X value
  updatedProjFile = projFile.replace(
    versionCodeRegex,
    `MARKETING_VERSION = ${updatedVersionString};`
  );

  if (rcVersion) {
    // Look for the multiple lines containing "CURRENT_PROJECT_VERSION = 0.X.0"
    const rcCodeRegex = /CURRENT_PROJECT_VERSION = \d+.(\d+).0/g;
    // Update the X value
    updatedProjFile = updatedProjFile.replace(
      rcCodeRegex,
      `CURRENT_PROJECT_VERSION = 0.${rcVersion}.0`
    );
  } else {
    // Look for the multiple lines containing "CURRENT_PROJECT_VERSION = 0.X.0"
    const rcCodeRegex = /CURRENT_PROJECT_VERSION = 0.(\d+).0/g;
    // Update the X value
    updatedProjFile = updatedProjFile.replace(
      rcCodeRegex,
      `CURRENT_PROJECT_VERSION = 1.0.0`
    );
  }

  // Update the file contents
  fs.writeFileSync(projPath, updatedProjFile);
}

// Fetch the "updateType" parameter from command line
const updateType = process.argv[2];
// If the updateType is not "major", "minor", "patch" or "rc", print a friendly message to the user
// and exit processing with an error
if (!['major', 'minor', 'patch', 'rc', 'release'].includes(updateType)) {
  console.error(`Invalid update type: ${updateType}`);
  console.log('Usage: node scripts/bump-version.js <updateType>');
  console.log('Where <updateType> can be "major", "minor", "patch", "rc" or "release"');
  process.exit(1);
}

const {
  updatedVersionString,
  mainVersionString,
  rcVersion
} = updateVersionPackageJson(updateType);
updateVersionPackageLockJson(updatedVersionString);
updateAndroidBuildVersion();
updateVersionAndroid(updatedVersionString);
updateReleaseCandidateIos(mainVersionString, rcVersion);
