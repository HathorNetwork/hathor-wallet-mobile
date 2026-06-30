---
description: Execute a phase of the hathor-wallet-mobile release process (see docs/RELEASE_PROCESS.md)
---

Read `docs/RELEASE_PROCESS.md` end-to-end before doing anything. That document is the source of truth — including its **"Operating rules for agents"** section, which governs behaviour in every phase. Do not paraphrase the doc from memory; re-read on every invocation.

## Identify the phase

User input: $ARGUMENTS

| Hint | Phase in the doc |
|---|---|
| `1`, `kickoff`, `start` | Phase 1 — start the release |
| `2`, `bump`, `rc-bump` | Phase 2 — RC bump PR |
| `3`, `tag`, `pre-release`, `notes` | Phase 3 — approvals, signed tag, GitHub pre-release |
| `4`, `iterate`, `next-rc` | Phase 4 — RC iteration |
| `5`, `stable`, `promote` | Phase 5 — stable release |
| `6`, `sync`, `sync-back` | Phase 6 — sync back |
| `hotfix` | Hotfix flow |

If the input is empty or ambiguous, ask the user which phase they are in before running any command. Do not guess.

## Orchestration

1. **Report state.** Run `git status`, `git rev-parse --abbrev-ref HEAD`, `node -p "require('./package.json').version"`, and `git ls-remote --tags origin | tail -10`. Show the user and confirm the identified phase matches their intent.
2. **Execute the phase from the doc.** Follow it literally; do not run steps from other phases.
3. **Summarise on completion.** What was done, the tag / PR / release URLs created, and the next phase to run.
