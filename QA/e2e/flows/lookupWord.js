/* eslint-disable */
// Runs in Maestro's JavaScript engine (ES5, with its maestro and output globals), not Node.
// Look up the correct word for the current backup validation step
var words = output.seedWords.trim().split(/\s+/);
var posText = maestro.copiedText.trim();
var position = parseInt(posText, 10);
output.correctWord = words[position - 1];
