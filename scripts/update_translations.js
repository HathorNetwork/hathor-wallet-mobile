/**
 * Copyright (c) Hathor Labs and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const { tmpdir } = require('node:os');

/*
 * This file contains several steps necessary to maintain the translations in the project.
 * This update process consists of:
 * - Generating a `.pot` file with the strings obtained from all components in the `src` folder
 * - Creating `po` files for every existing language declared in the `existingTranslations` array
 * - Merging the `.pot` file with the existing translations in the `.po` files in `./locale`
 * - Warning the user if any manual intervention is needed (fuzzy tags)
 * - Generating a git-ignored JSON file containing all translations inside the `src/locale` folder
 *
 * The CI will run this script with the `--ci-validation` argument to check if the translations
 * were updated correctly. If there are any fuzzy tags, the CI will fail. The steps executed for
 * this validation are:
 * - Running all the translation steps as described above
 * - Checking if the `.pot` file is outdated
 * - Checking if all `.po` files have all messages from the `.pot` file
 * - Checking if the mandatory languages have all translations in place in their `.po` files
 * - Checking for any fuzzy tags in the `.po` files
 * - Exiting with code 1 and failing if any of the above checks fail
 * - Lastly, checking for filesystem changes using `git status` for easier debugging, if needed
 */

/**
 * All translations that should exist in the `locale` folder. Some of those may be incomplete.
 * @type {string[]}
 */
const existingTranslations = ['pt-br', 'da', 'ru-ru'];
/**
 * Translations that are mandatory to be complete. If any of those language files contain missing
 * lines, the CI validation script will fail.
 * Can be overridden by the `--strict-languages` argument.
 * @type {string[]}
 */
const mandatoryTranslations = ['pt-br'];
const temporaryDirs = [];

/**
 * Runs the script to update the root `.pot` file with the new strings
 */
function runLocaleUpdatePot() {
  console.log('⏳ Updating pot file...');
  try {
    // Check if the pot file exists. If not, create it.
    if (!fs.existsSync('./locale/texts.pot')) {
      fs.mkdirSync('./locale', { recursive: true });
      fs.writeFileSync('./locale/texts.pot', '');
    }

    // Extract the strings from the source code
    execSync('npx ttag extract -o ./locale/texts.pot ./src/', { stdio: 'inherit' });
  } catch (error) {
    console.error('❌ Error updating pot file:', error);
    process.exit(1);
  }
}

/**
 * Checks whether the root `.pot` file is outdated.
 * @returns {boolean} True if the `.pot` file is outdated
 */
function checkPotOutdated() {
  console.log(`⏳ Checking if pot file is outdated...`);

  let isPotOutdated = false;
  const myTmpDir = fs.mkdtempSync(path.join(tmpdir(), 'check_pot-'));
  temporaryDirs.push(myTmpDir); // Cleanup will be done on process.exit()
  try {
    // Extract the strings from the source code
    execSync(`npx ttag extract -o ${myTmpDir}/pot ./src/`, { stdio: 'inherit' });
    // Generate the `.po` files
    execSync(`msgen -o ${myTmpDir}/po ${myTmpDir}/pot`, { stdio: 'inherit' });
    // Check if the `.pot` file is outdated
    execSync(`msgcmp ${myTmpDir}/po ./locale/texts.pot`, { stdio: 'inherit' });
  } catch (error) {
    isPotOutdated = true;
    console.error('❌ Error checking pot file, or pot file outdated:', error);
  }

  return isPotOutdated;
}

/**
 * Merges the `.pot` file with the translations in the `.po` files in each of the `locale` folders.
 * Creates subfolders and their translation files if they do not exist.
 */
function mergeTranslations() {
  console.log(`⏳ Merging translations...`);

  const localeDir = 'locale';
  const potFile = path.join(localeDir, 'texts.pot');

  existingTranslations.forEach((subfolder) => {
    const subfolderPath = path.join(localeDir, subfolder);
    if (!fs.existsSync(subfolderPath)) {
      fs.mkdirSync(subfolderPath, { recursive: true });
    }
    const poFile = path.join(subfolderPath, 'texts.po');
    // Create the file if it does not exist
    if (!fs.existsSync(poFile)) {
      fs.writeFileSync(poFile, '');
    }

    // Merge the `.pot` file with the existing translations
    execSync(`msgmerge ${poFile} ${potFile} -o ${poFile}`, { stdio: 'inherit' });
  });
}

/**
 * Checks if all `.po` files have all messages from the `.pot` file.
 * Allows untranslated messages if `strict` is false.
 * @param {string[]} strictLanguages - Does not allow untranslated messages for those languages.
 * @returns {boolean} True if an error happened or if there are any missing i18n lines
 */
function checkPoTranslations(strictLanguages) {
  console.log(`⏳ Checking translations...`);

  const localeDir = 'locale';
  const potFile = path.join(localeDir, 'texts.pot');
  const subfolders = fs.readdirSync(localeDir)
    .filter((subfolder) => fs.statSync(path.join(localeDir, subfolder)).isDirectory());
  let errorHappened = false;

  subfolders.forEach((subfolder) => {
    const poFile = path.join(localeDir, subfolder, 'texts.po');
    const isStrictLanguage = strictLanguages.includes(subfolder);
    const cmd = isStrictLanguage
      ? `msgcmp ${poFile} ${potFile}`
      : `msgcmp --use-untranslated ${poFile} ${potFile}`;
    try {
      // If there are any differences, the command will throw an error
      execSync(cmd, { stdio: 'inherit' });
    } catch (error) {
      console.error(`Error checking ${poFile}:`, error);
      errorHappened = true;
    }
  });

  if (errorHappened) {
    console.warn('❌ Some translations are missing. Please review the changes.');
  }
  return errorHappened
}

/**
 * Checks for any fuzzy tags in the `.po` files, as they indicate human review is necessary
 * @see https://www.gnu.org/software/gettext/manual/html_node/Fuzzy-Entries.html
 * @returns {boolean} True if any fuzzy tags were found
 */
function checkFuzzyTags() {
  console.log(`⏳ Checking for fuzzy tags...`);

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
    console.warn(`❌: Fuzzy translations found in '.po' files. Please review the changes.`);
  }

  return containsFuzzy;
}

/**
 * Checks for filesystem changes using `git status`. If any changes are found, it means the
 * translation files have changed, and this may trigger a CI fail when running inside the CI.
 * @returns {boolean} True if changes were found, or if an error happened
 */
function checkForChanges() {
  console.log(`⏳ Checking for filesystem changes after i18n execution...`);
  let statusResult = '';
  let hasChanges = false;
  try {
    statusResult = execSync('git status --porcelain', { encoding: 'utf-8' });
    hasChanges = statusResult.trim().length > 0;
  } catch (error) {
    console.error('❌ Error checking for changes:', error);
    return true;
  }

  if (hasChanges) {
    // Print the full diff to the console
    console.warn(`❗ Changes found in the translation files. Please review them.`);
    execSync('git  --no-pager diff', { stdio: 'inherit' });
  }
  return hasChanges;
}

/**
 * Compiles the translations by generating JSON files from the `.po` files.
 */
function generateJsonFromPos() {
  console.log(`⏳ Compiling translations into JSON files...`);

  const localeDir = 'locale';
  const outputDir = 'src/locale';

  existingTranslations.forEach((locale) => {
    const poFile = path.join(localeDir, locale, 'texts.po');
    const jsonFile = path.join(outputDir, locale, 'texts.po.json');
    const jsonDir = path.dirname(jsonFile);

    if (!fs.existsSync(jsonDir)) {
      fs.mkdirSync(jsonDir, { recursive: true });
    }

    try {
      execSync(`npx ttag po2json ${poFile} > ${jsonFile}`, { stdio: 'inherit' });
    } catch (error) {
      console.error(`❌ Error compiling JSON translations for ${locale}:`, error);
    }
  });
}

/**
 * Cleanup function, removing any temporary files or folders created during the execution
 */
process.on('exit', (code) => {
  console.log(`🧹 Cleaning up on exit code ${code}...`);
  temporaryDirs.forEach((dirName) => {
    fs.rmSync(dirName, { recursive: true, force: true });
  });
});

/**
 * Parses the command line arguments and returns an object with the parameters
 * @returns {{isCiValidationRun: boolean, strictLanguages: string[]}}
 */
function getCliParameters() {
  const args = process.argv.slice(2);
  const parameters = {};
  args.forEach((arg) => {
    const [key, value] = arg.split('=');
    parameters[key.replace('--', '')] = value || true;
  });

  return {
    isCiValidationRun: parameters['ci-validation'] || false,
    strictLanguages: parameters['strict-languages']?.split(',') || mandatoryTranslations,
  }
}

try {
  const { isCiValidationRun, strictLanguages } = getCliParameters();

  runLocaleUpdatePot();
  mergeTranslations();
  generateJsonFromPos();
  const hasFuzzyTags = checkFuzzyTags();
  if (!isCiValidationRun) {
    // Translations upgraded successfully
    console.log(`✅ Translations updated successfully.`);
    process.exit(0);
  }

  // If this script was called with the "--ci-validation" argument, it will fail if there are any
  // fuzzy tags that need reviewing
  const invalidPot = checkPotOutdated();
  const invalidPos = checkPoTranslations(strictLanguages);
  checkForChanges(); // This will print the diff if changes are found, but not fail the script
  if (invalidPot || invalidPos || hasFuzzyTags) {
    console.log(`❌ Translations are not up-to-date. Please review the changes.`);
    process.exit(1);
  }

  console.log(`✅ Translations validated successfully.`);
  process.exit(0);
} catch (error) {
  console.error('Error updating translations:', error);
  process.exit(1);
}
