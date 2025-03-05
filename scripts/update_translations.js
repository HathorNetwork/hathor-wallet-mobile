/**
 * Copyright (c) Hathor Labs and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

/**
 * Runs the `npm run locale-update-pot` script to update the root `.pot` file with the new strings
 */
function runLocaleUpdatePot() {
  execSync('npm run locale-update-pot', { stdio: 'inherit' });
}

/**
 * Merges the `.pot` file with the translations in the `.po` files in each of the `locale` folders
 */
function mergeTranslations() {
  const localeDir = 'locale';
  const potFile = path.join(localeDir, 'texts.pot');
  const subfolders = fs.readdirSync(localeDir)
    .filter((subfolder) => fs.statSync(path.join(localeDir, subfolder))
      .isDirectory());

  subfolders.forEach((subfolder) => {
    const poFile = path.join(localeDir, subfolder, 'texts.po');
    execSync(`msgmerge ${poFile} ${potFile} -o ${poFile}`, { stdio: 'inherit' });
  });
}

/**
 * Checks for any fuzzy tags in the `.po` files, as they indicate human review is necessary
 * @see https://www.gnu.org/software/gettext/manual/html_node/Fuzzy-Entries.html
 * @returns {boolean} True if any fuzzy tags were found
 */
function checkFuzzyTags() {
  const localeDir = 'locale';
  const subfolders = fs.readdirSync(localeDir)
    .filter((subfolder) => fs.statSync(path.join(localeDir, subfolder))
      .isDirectory());
  let containsFuzzy = false;

  subfolders.forEach((subfolder) => {
    const poFile = path.join(localeDir, subfolder, 'texts.po');
    const content = fs.readFileSync(poFile, 'utf-8');
    if (content.includes('fuzzy')) {
      containsFuzzy = true;
    }
  });

  if (containsFuzzy) {
    console.warn(`Warning: Fuzzy translations found in '.po' files. Please review the changes.`);
  }

  return containsFuzzy;
}

/**
 * Checks for filesystem changes using `git status`. If any changes are found, it means the
 * translation files have changed, and this may trigger a CI fail when running inside the CI.
 * @returns {boolean} True if changes were found, or if an error happened
 */
function checkForChanges() {
  try {
    const result = execSync('git status --porcelain', { encoding: 'utf-8' });
    return result.trim().length > 0;
  } catch (error) {
    console.error('Error checking for changes:', error);
    return true;
  }
}

runLocaleUpdatePot();
mergeTranslations();
const hasFuzzyTags = checkFuzzyTags();
const translationFilesChanged = checkForChanges();

// If this script was called with the "--ci-validation" argument, it will fail if there are any
// changes in the translation files or if there are any fuzzy tags
if (process.argv.includes('--ci-validation') && (hasFuzzyTags || translationFilesChanged)) {
  process.exit(1);
}
