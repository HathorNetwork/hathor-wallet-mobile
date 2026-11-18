/**
 * Copyright (c) Hathor Labs and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

// Turns what Maestro logs of a flow (its commands.json) into the timeline the viewer plays the
// screen recording against: each command's start and length in seconds of the video, how deep it
// sits, what it did, in words, and how it ended.

// Commands Maestro runs for every flow, which show nothing.
const HIDDEN = new Set(['defineVariablesCommand', 'applyConfigurationCommand']);

// A stretch longer than this where nothing new starts is a wait the viewer can skip; it keeps
// KEEP seconds at each end, so the screen before and after the wait still shows.
const LONG_WAIT = 3;
const KEEP = 1;

const quote = (text) => {
  const s = String(text);
  return `"${s.length > 60 ? `${s.slice(0, 57)}...` : s}"`;
};

function conditionText(condition = {}) {
  if (condition.visible) {
    const { textRegex, enabled, checked } = condition.visible;
    const what = textRegex ? quote(textRegex) : 'the element';
    if (enabled === false) return `${what} is visible and disabled`;
    if (checked) return `${what} is checked`;
    return `${what} is visible`;
  }
  if (condition.notVisible) return `${quote(condition.notVisible.textRegex)} is gone`;
  return 'the condition holds';
}

/** What a Maestro command did, in words, from its entry in commands.json. */
function describe(command) {
  const [type] = Object.keys(command);
  const c = command[type];
  if (c.label) return c.label;
  switch (type) {
    case 'tapOnElement': {
      const index = c.selector.index ? `, index ${c.selector.index}` : '';
      return `Tap on ${quote(c.selector.textRegex || c.selector.idRegex || 'the element')}${index}`;
    }
    case 'tapOnPointV2Command': return `Tap on point (${c.point})`;
    case 'inputTextCommand': return `Type ${quote(c.text)}`;
    case 'assertConditionCommand':
      return `${c.timeout ? 'Wait until' : 'Check that'} ${conditionText(c.condition)}`;
    case 'copyTextCommand': return `Copy the text of ${quote(c.selector.textRegex)}`;
    case 'backPressCommand': return 'Press back';
    case 'launchAppCommand': return `Launch ${c.appId}`;
    case 'repeatCommand': return c.condition ? `Repeat while ${conditionText(c.condition)}` : `Repeat ${c.times} times`;
    case 'runFlowCommand': return `Run ${c.sourceDescription || 'a sub-flow'}`;
    case 'runScriptCommand': return `Run ${c.sourceDescription || 'a script'}`;
    case 'evalScriptCommand': return 'Compute a value';
    case 'takeScreenshotCommand': return 'Take a screenshot';
    case 'eraseTextCommand': return 'Erase text';
    case 'pressKeyCommand': return `Press ${c.code}`;
    default: return type.replace(/Command$/, '').replace(/([A-Z])/g, ' $1').toLowerCase().trim();
  }
}

/**
 * The timeline entries of one Maestro run, in seconds from the video's start.
 *
 * @param {object[]} commands the parsed commands.json
 * @param {number} t0 when the video's first frame was taken, in host milliseconds
 * @param {number} [baseDepth] added to every depth, to nest a flow under a runner step
 */
function entriesFrom(commands, t0, baseDepth = 0) {
  return commands
    .filter(({ command }) => !HIDDEN.has(Object.keys(command)[0]))
    .map(({ command, metadata }) => {
      // The evaluated command has Maestro's variables filled in (the amount a flow computed).
      const shown = metadata.evaluatedCommand || command;
      return {
        t: (metadata.timestamp - t0) / 1000,
        d: (metadata.duration || 0) / 1000,
        depth: metadata.depth + baseDepth,
        text: describe(shown),
        status: (metadata.status || 'COMPLETED').toLowerCase(),
      };
    });
}

/** A step the runner did itself (adb taps, a top-up), as a timeline entry. */
const runnerEntry = ({ start, end, text }, t0) => ({
  t: (start - t0) / 1000, d: (end - start) / 1000, depth: 0, text, status: 'completed', runner: true,
});

/**
 * The stretches of the video the viewer can skip: long commands with no command inside them, and
 * long gaps between commands, minus KEEP seconds at each end.
 *
 * @param {{ t: number, d: number, depth: number }[]} entries sorted by t
 * @param {number} duration the video's length in seconds
 * @returns {[number, number][]}
 */
function skipRanges(entries, duration) {
  // The moments something new starts or ends on screen: every command's start, and the end of the
  // innermost ones (a group ends with its last command).
  const marks = new Set([0, duration]);
  entries.forEach((e, i) => {
    marks.add(e.t);
    const next = entries[i + 1];
    if (!next || next.depth <= e.depth) marks.add(e.t + e.d);
  });
  const sorted = [...marks].filter((m) => m >= 0 && m <= duration).sort((a, b) => a - b);
  const ranges = [];
  for (let i = 1; i < sorted.length; i += 1) {
    const [from, to] = [sorted[i - 1], sorted[i]];
    if (to - from > LONG_WAIT) ranges.push([from + KEEP, to - KEEP]);
  }
  return ranges.map(([from, to]) => [Math.round(from * 100) / 100, Math.round(to * 100) / 100]);
}

module.exports = { describe, entriesFrom, runnerEntry, skipRanges, LONG_WAIT, KEEP };
