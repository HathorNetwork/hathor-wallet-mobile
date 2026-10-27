/* eslint-disable */
// Runs in Maestro's JavaScript engine (ES5, with its maestro and output globals), not Node.
// Stores one "N. word" item (from copyTextFrom) at position N and rebuilds
// output.seedWords, the space-separated string the PoC's lookupWord.js reads.
var text = maestro.copiedText.trim();
var dot = text.indexOf('.');
var pos = parseInt(text.substring(0, dot), 10);
if (!output.words) { output.words = []; }
output.words[pos - 1] = text.substring(dot + 1).trim();
output.seedWords = output.words.join(' ');
console.log('captured ' + pos + ' -> ' + output.words[pos - 1] + ' (raw: ' + text + ')');
output.i = output.i + 1;
