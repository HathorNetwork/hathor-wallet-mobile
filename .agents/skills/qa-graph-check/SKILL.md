---
name: qa-graph-check
description: Before opening any PR in this repo, check whether QA/graph/graph.yaml needs updating for the change, update it when the gap is local, and write the "QA graph" line of the PR body. Built to run on a cheaper model; delegate it to a Haiku or Sonnet subagent if you like.
---

# QA graph check

`QA/graph/graph.yaml` maps the wallet's features, flags, axes, setups and actions for QA. This skill finds where a change has left the graph behind, fixes the local gaps, and hands structural gaps to a stronger agent. It never blocks the PR. Schema: `QA/graph/README.md`.

The diff is the evidence. The CLI catches some gaps mechanically; most need you to read the diff.

## 1. Get the diff and run the check

- Diff: `git diff origin/master...HEAD`, plus `git diff HEAD` for uncommitted work. If you were handed a diff instead of a branch, use that diff and skip the CLI.
- Check: `npm run qa:graph:check -- --base origin/master`. Lines are `ERROR` (schema broken, exit 1), `WARN` (a stale graph, or a schema warning such as a flag and feature that don't list each other) or `NOTE` (worth a look). No output means nothing was detected, which is not the same as nothing missing.
- An `ERROR` or schema `WARN` that was already there before your change is still yours to report: fix it if it is local (step 4), otherwise name it in the PR-body line.

The check has blind spots; cover them from the diff:

- It scans routes only in `src/App.js`. Screens registered elsewhere (e.g. `src/screens/NetworkSettings/NetworkSettingsFlowStack.js`) are not checked.
- It sees only committed changes (`base...HEAD`). Uncommitted code changes are invisible to it, and an uncommitted `graph.yaml` edit still produces "the graph did not change" warnings.
- If it prints `WARN Cannot diff against ...; assuming no changed files` (a fork or shallow clone without `origin/master`), its clean result means nothing. Re-run with `--base master` or the upstream remote's default branch (`--base upstream/master`), or rely on your read of the diff.
- It cannot see new axis values, new or changed messages, new path steps or changed switching costs.

Done when every `ERROR`, `WARN` and `NOTE` is listed for step 2.

## 2. Map each change in the diff to the graph

Walk every hunk under `src/` and every `WARN`/`NOTE`. For each, find the matching graph entry and decide whether it is now wrong or missing:

| In the diff | In the graph |
|---|---|
| A `*.rollout` constant added, renamed or removed in `src/constants.js` | `flags` entry (`name` = flag string, `constant`, `default`, `gates`, `appliesAt`), and the gated features' `flags`. When the flag controls a setup axis value (a facade, a wallet type, a flag axis like `flag-fbt`), list it in the flag's `axisValues` |
| A screen added, renamed or removed (`*.Screen name=...` in any navigator) | The feature's `screens` |
| A source file added, moved or deleted | The feature's `files` |
| A user-facing message added or changed (`` t`...` `` strings, alerts, error mapping) | An `outcome` of the action: `message` copied verbatim, `source: 'path:line'`, `verified: false`, `at` = the step where it shows |
| A step added to or removed from a flow | The action's `path.steps` |
| A combination the app now refuses, allows, or treats differently | `constraints` (`rejected` needs an error `outcome`) |
| A new kind of thing a tester must vary: token type, address kind, wallet type, network, privacy mode | An axis value, the feature's `introduces` |
| Something that changes how hard it is to move between axis values (a reset, a migration, a one-way switch) | The axis `switch` transitions or `fallback` |
| A feature depending on another in a new way | The dependant's `links` (a link means "this feature depends on `to`"); if the relation is an axis value rather than code, the providing feature's `introduces` instead |

For a new flag, read `src/sagas/featureToggle.js` and the flag's readers to decide `appliesAt` (`live`, `next-start` or `next-pin`). Mark any value you had to guess (`appliesAt`, `default`, `status`, a cost) with a trailing `# QA: confirm` comment.

A `NOTE` about an unverified outcome whose source changed: check the `message` and the `source` line still match the code; fix the line number or text.

Ids in the graph are just names within this version; rename or restructure them freely when the change calls for it.

Done when every hunk is either mapped to a graph change or marked "no graph impact" (refactors, tests, styling, logs).

## 3. Classify the gap: local or structural

**Local** gaps fit the existing shape of the graph. Examples: add or rename a flag; add a screen to a feature; add an outcome or fix a message; add a constraint; adjust a file path or a `source` line.

**Structural** gaps change the shape: they add axes or setups, or touch many actions at once. Examples: a new feature that introduces a new axis or axis value; a new setup axis; a change touching many actions, such as inter-chain transactions adding a destination chain to every send.

A mix of both counts as structural for the structural part; still fix the local part.

## 4. Act

- **Local**: edit `graph.yaml`, then run `node QA/graph/tools/cli.js validate` until it prints no `ERROR`. Re-run the check from step 1.
- **Structural**: leave the structural part unpatched. Report that an Opus-level agent should update the graph, with the list of what is missing: each new axis or value, affected actions and setups, new outcomes, and the diff hunks that prompted them.

## 5. Write the PR-body line

Add one line to the PR body, whatever the result:

- `QA graph: updated (<what changed>)`
- `QA graph: not needed`
- `QA graph: needs follow-up (<what is missing>)`

The PR goes ahead in every case.
