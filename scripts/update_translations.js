const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

function runLocaleUpdatePot() {
  execSync('npm run locale-update-pot', { stdio: 'inherit' });
}

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

function checkFuzzyTags() {
  const localeDir = 'locale';
  const subfolders = fs.readdirSync(localeDir)
    .filter((subfolder) => fs.statSync(path.join(localeDir, subfolder))
      .isDirectory());

  subfolders.forEach((subfolder) => {
    const poFile = path.join(localeDir, subfolder, 'texts.po');
    const content = fs.readFileSync(poFile, 'utf-8');
    if (content.includes('fuzzy')) {
      console.warn(`Warning: Fuzzy translations found in ${poFile}. Please review these lines.`);
    }
  });
}

runLocaleUpdatePot();
mergeTranslations();
checkFuzzyTags();
