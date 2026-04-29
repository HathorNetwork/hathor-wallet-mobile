# Agent guide for hathor-wallet-mobile

Single source of truth for AI coding agents (Claude Code, Cursor,
Codex, etc.). `CLAUDE.md` is a thin pointer to this file — don't
duplicate rules across both.

## 1. Pin every dependency exactly

`package.json` MUST use exact versions — **no `^`, no `~`**. Supply-
chain mitigation, mandatory. Review tools (CodeRabbit, Copilot) flag
ranges; fix both sides to the same exact version. Regenerate the
lockfile per rule 2 after editing.

## 2. Lockfile regen on Node 22 / npm 10

CI's matrix is Node 22 (`.github/workflows/main.yml`). A lockfile
generated on a different major fails `npm ci` with *"Missing: X
from lock file"*.

```sh
nvm install 22 && nvm use 22
npm install --no-audit --no-fund
```

## 3. Tests

Read `docs/testing-guide.md` before writing tests. Quick rules:

- **Import jest globals** (`.eslintrc` has no `env.jest`):
  `import { describe, it, expect } from '@jest/globals';`
- **Test the public contract**: dispatch real action creators against
  the *root* reducer; never import internal `onXxx` handlers.
- **Reducer tests pin three contracts**: behavior, initial-state shape
  (sorted-keys equality), action-type strings. Canonical:
  `__tests__/reducers/reducer.{wallet,reown}.test.ts`.
- **Reuse `__tests__/helpers/`**; helpers must be `.js` (no TS-aware
  resolver in this repo).
- Claude Code only: `.claude/skills/writing-tests/SKILL.md` auto-loads
  on test file edits and has the deeper gotchas.

## 4. Commits

- Conventional Commits (`feat:`/`fix:`/`chore:`/`test:`/`docs:`).
- 50-char title cap, 72-col body wrap.
- Sign with GPG before merge — CI may require all commits signed.

## 5. PRs

- Assign `tuliomir`. Tag `tests`/`bug`/`dependencies` as applicable.
- Add to project 15 with status "In Progress WIP".
- Concise description; explicit breaking-change notes when applicable.
