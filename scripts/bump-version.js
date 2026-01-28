/**
 * Copyright (c) Hathor Labs and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

/**
 * Gets the current git branch name
 * @returns {string|null} The current branch name
 */
function getCurrentBranch() {
  try {
    return execFileSync('git', ['rev-parse', '--abbrev-ref', 'HEAD'], { encoding: 'utf8' }).trim();
  } catch (error) {
    console.warn('Warning: Could not determine git branch');
    return null;
  }
}

/**
 * Gets the current version from package.json without modifying it
 * @returns {string} The current version string
 */
function getCurrentVersion() {
  const packageJsonPath = path.join(__dirname, '..', 'package.json');
  const packageJsonFile = fs.readFileSync(packageJsonPath, 'utf8');
  const versionNameRegex = /"version": "(.+)"/;
  const versionNameMatch = packageJsonFile.match(versionNameRegex);
  if (!versionNameMatch) {
    throw new Error('Could not find "version" field in package.json. Please ensure the file contains a valid version.');
  }
  return versionNameMatch[1];
}

/**
 * Validates that the version bump is appropriate for the current branch
 * @param {string|null} branch - Current git branch
 * @param {string} newVersion - The new version string that will be set
 * @returns {{ valid: boolean, error?: string }}
 */
function validateBranchVersion(branch, newVersion) {
  if (branch === null) {
    return {
      valid: false,
      error: 'Could not determine the current git branch.\n'
        + 'Please ensure you are in a git repository and try again.',
    };
  }

  if (branch !== 'release' && branch !== 'release-candidate') {
    return {
      valid: false,
      error: `Bump should only be executed on the 'release' or 'release-candidate' branches, but current branch is '${branch}'.`,
    };
  }

  const hasRcTag = newVersion.includes('-rc.');

  if (branch === 'release-candidate' && !hasRcTag) {
    return {
      valid: false,
      error: `Branch 'release-candidate' requires an -rc.* version tag, but got '${newVersion}'.\n`
        + `Hint: Use 'rc' update type or add '--bumpRc' flag.`
    };
  }

  if (branch === 'release' && hasRcTag) {
    return {
      valid: false,
      error: `Branch 'release' must NOT have an -rc.* version tag, but got '${newVersion}'.\n`
        + `Hint: Use 'release' update type to remove the rc tag.`
    };
  }

  return { valid: true };
}

function updateAndroidBuildVersion() {
  const gradlePath = path.join(__dirname, '..', 'android', 'app', 'build.gradle');
  const gradleFile = fs.readFileSync(gradlePath, 'utf8');

  // Look for the line containing "versionCode"
  const versionCodeRegex = /versionCode\s+(\d+)/;
  const versionCodeMatch = gradleFile.match(versionCodeRegex);
  const currentVersionCode = parseInt(versionCodeMatch[1], 10);
  const updatedVersionCode = currentVersionCode + 1;

  // Replace the version code on the file contents
  const updatedGradleFile = gradleFile.replace(versionCodeRegex, `versionCode ${updatedVersionCode}`);

  // Replace the file on disk
  fs.writeFileSync(gradlePath, updatedGradleFile);
}

/**
 * @typedef {'major'|'minor'|'patch'|'rc'|'release'} UpdateType
 */
/**
 * Calculates the next version number based on the current version and the update type
 * @param {UpdateType} _updateType
 * @param {string} currentVersionString
 * @param [options]
 * @param {boolean} [options.addRc=false] Whether to also add an rc version to the other increment
 * @returns {{rcVersion: number, updatedVersionString: string, mainVersionString: string}}
 */
function calculateNewVersion(_updateType, currentVersionString, { addRc = false } = {}) {
  const versionNameRegex = /(\d+)\.(\d+)\.(\d+)(-rc\.)?(\d+)?/;
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
      rc = addRc ? 1 : null;
      break;
    case 'minor':
      minor += 1;
      patch = 0;
      rc = addRc ? 1 : null;
      break;
    case 'patch':
      patch += 1;
      rc = addRc ? 1 : null;
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
  const updatedVersionString = `${mainVersionString}${rc ? `-rc.${rc}` : ''}`;
  return {
    mainVersionString,
    rcVersion,
    updatedVersionString,
  }
}

/**
 * Updates the version number on package.json and returns an object containing the updated values
 * to be used on other file updates
 * @param {UpdateType} _updateType
 * @param {boolean} [forceRcBump=false] Whether to force the rc version to be bumped
 * @returns {{rcVersion: number, updatedVersionString: string, mainVersionString: string}}
 */
function updatePackageJson(_updateType, forceRcBump) {
  const packageJsonPath = path.join(__dirname, '..', 'package.json');
  const packageJsonFile = fs.readFileSync(packageJsonPath, 'utf8');

  // Look for the line containing "version"
  const versionNameRegex = /"version": "(.+)"/;
  const versionNameMatch = packageJsonFile.match(versionNameRegex);
  const currentVersionString = versionNameMatch[1];
  const updatedVersionObj = calculateNewVersion(
    _updateType,
    currentVersionString,
    { addRc: forceRcBump }
  );

  // Replace the version code on the file contents
  const updatedPackageJsonFile = packageJsonFile.replace(versionNameRegex, `"version": "${updatedVersionObj.updatedVersionString}"`);

  // Replace the file on disk
  fs.writeFileSync(packageJsonPath, updatedPackageJsonFile);

  // Return the updated version numbers in an object
  return updatedVersionObj;
}

function updatePackageLockJson(updatedVersionString) {
  const packageLockJsonPath = path.join(__dirname, '..', 'package-lock.json');
  const packageLockJsonFile = fs.readFileSync(packageLockJsonPath, 'utf8');

  /*
   * This file contains versions for many different dependencies, so a simple regex approach won't
   * work. We'll have to parse the file line by line, identify the code blocks related to the
   * mobile app and map only their version numbers.
   */
  const lines = packageLockJsonFile.split('\n');
  const linesToUpdate = [];
  for (let i = 0; i < lines.length; i += 1) {
    if (linesToUpdate.length === 2) {
      break; // No need to continue: all the needed versions were already mapped
    }

    const line = lines[i];
    if (line.includes('"name": "HathorMobile"')) {
      // Found a block related to this app, will map its "version" line
      // The version number is always on the next line.
      linesToUpdate.push(i + 1)
    }
  }

  // Updates all mapped lines
  for (const indexToUpdate of linesToUpdate) {
    // Replace the app version on this line
    const versionNameRegex = /"version": ".+"/;
    lines[indexToUpdate] = lines[indexToUpdate].replace(
      versionNameRegex,
      `"version": "${updatedVersionString}"`
    );
  }

  // Update the file contents
  fs.writeFileSync(packageLockJsonPath, lines.join('\n'));
}

function updateVersionAndroid(updatedVersionString) {
  const gradlePath = path.join(__dirname, '..', 'android', 'app', 'build.gradle');
  const gradleFile = fs.readFileSync(gradlePath, 'utf8');

  // Look for the line containing "versionName"
  const versionNameRegex = /versionName\s+".+"/;

  // Replace the version code on the file
  const updatedGradleFile = gradleFile.replace(versionNameRegex, `versionName "${updatedVersionString}"`);

  // Update the file contents
  fs.writeFileSync(gradlePath, updatedGradleFile);
}

function updateVersionIos(updatedVersionString, rcVersion) {
  const projPath = path.join(__dirname, '..', 'ios', 'HathorMobile.xcodeproj', 'project.pbxproj');
  const projFile = fs.readFileSync(projPath, 'utf8');

  let updatedProjFile;
  // For the common version, look for the lines containing "MARKETING_VERSION = X.X.X"
  const versionCodeRegex = /MARKETING_VERSION = (.+)/g;
  // Update the version
  updatedProjFile = projFile.replace(
    versionCodeRegex,
    `MARKETING_VERSION = ${updatedVersionString};`
  );

  if (rcVersion) {
    // For the rc version, look for the lines containing "CURRENT_PROJECT_VERSION = X.X.0"
    const rcCodeRegex = /CURRENT_PROJECT_VERSION = \d+.(\d+).0/g;
    // Update the version
    updatedProjFile = updatedProjFile.replace(
      rcCodeRegex,
      `CURRENT_PROJECT_VERSION = 0.${rcVersion}.0`
    );
  } else {
    // To reset the rc version, look for the lines containing "CURRENT_PROJECT_VERSION = X.X.0"
    const rcCodeRegex = /CURRENT_PROJECT_VERSION = 0.(\d+).0/g;
    // Reset the rc version number
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
  console.log('Usage: node scripts/bump-version.js <updateType> [--bumpRc]');
  console.log('Where <updateType> can be "major", "minor", "patch", "rc" or "release"');
  console.log(`\nExamples using the Makefile syntax:
'3.0.1' -> make bump updateType=major -> '4.0.0'
'3.0.1' -> make bump updateType=major bumpRc=true -> '4.0.0-rc.1'
'3.0.1' -> make bump updateType=minor bumpRc=true -> '3.1.0-rc.1'
'3.2.1' -> make bump updateType=patch -> '3.2.2'
'3.2.1' -> make bump updateType=rc -> '3.2.1-rc.1'
'3.2.1-rc.3' -> make bump updateType=release -> '3.2.1'
`)
  process.exit(1);
}

const forceRcBump = process.argv[3]?.toLowerCase() === '--bumprc';

// Get current state before making changes
const currentBranch = getCurrentBranch();
const previousVersion = getCurrentVersion();

// Calculate what the new version will be (without applying yet)
const previewVersion = calculateNewVersion(updateType, previousVersion, { addRc: forceRcBump });

// Validate branch/version compatibility
const validation = validateBranchVersion(currentBranch, previewVersion.updatedVersionString);
if (!validation.valid) {
  console.error('\n❌ Version bump blocked!\n');
  console.error(validation.error);
  console.error(`\nCurrent state:`);
  console.error(`  Branch:  ${currentBranch || 'unknown'}`);
  console.error(`  Version: ${previousVersion}`);
  process.exit(1);
}

// Warn if bumping version on 'release' branch with anything other than 'release' type
if (currentBranch === 'release' && updateType !== 'release') {
  const yellow = '\x1b[33m';
  const reset = '\x1b[0m';
  console.warn(`${yellow}`);
  console.warn('⚠️  Warning: You are bumping the version directly on the \'release\' branch.');
  console.warn('   Version bumps should typically be made on \'release-candidate\' first,');
  console.warn('   then merged to \'release\' using updateType=release.');
  console.warn('   This call may be incorrect.');
  console.warn(`${reset}`);
}

// Show feedback header
console.log('\n📦 Version Bump');
console.log('─'.repeat(40));
console.log(`  Branch:           ${currentBranch || 'unknown'}`);
console.log(`  Update type:      ${updateType}${forceRcBump ? ' (with --bumpRc)' : ''}`);
console.log(`  Previous version: ${previousVersion}`);
console.log(`  New version:      ${previewVersion.updatedVersionString}`);
console.log('─'.repeat(40));

// Apply the version bump
const {
  updatedVersionString,
  mainVersionString,
  rcVersion
} = updatePackageJson(updateType, forceRcBump);
console.log('  ✓ Updated package.json');

updatePackageLockJson(updatedVersionString);
console.log('  ✓ Updated package-lock.json');

updateAndroidBuildVersion();
console.log('  ✓ Updated Android build version code');

updateVersionAndroid(updatedVersionString);
console.log('  ✓ Updated Android version name');

updateVersionIos(mainVersionString, rcVersion);
console.log('  ✓ Updated iOS version');

console.log('─'.repeat(40));
console.log(`\n✅ Successfully bumped version to ${updatedVersionString}\n`);
