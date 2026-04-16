// Capture seed words from the clipboard (set by copyTextFrom)
var copied = maestro.copiedText;
if (copied && copied.trim().length > 0) {
    output.seedWords = copied.trim();
    output.wordCount = copied.trim().split(/\s+/).length;
} else {
    output.seedWords = '';
    output.wordCount = 0;
}
