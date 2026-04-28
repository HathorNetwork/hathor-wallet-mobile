# Agent guide for hathor-wallet-mobile

This file is the entry point for AI coding agents (Claude Code, Cursor,
Codex, etc.) working in this repo. Read it first; follow the pointers
for depth.

## Repo conventions

### 1. Pin every dependency version exactly

`package.json` MUST use exact versions — no `^`, no `~`. This is a
supply-chain mitigation and is **mandatory**. When a CodeRabbit-style
review flags a version mismatch, fix both sides to the same exact
version. After editing `package.json`, regenerate `package-lock.json`
following rule (3) below.

### 2. Use Node 22 / npm 10 for any lockfile regeneration

CI runs Node 22.x (`.github/workflows/main.yml` matrix). Running
`npm install` with a different major (e.g. Node 24 / npm 11) produces
a divergent lockfile that fails CI's `npm ci`.

```sh
nvm install 22 && nvm use 22
npm install --no-audit --no-fund
```

### 3. Tests follow `docs/testing-guide.md`

Read it before writing tests. The short version:

- **Always import jest globals** in `.test.ts` / `.test.tsx`:
  `import { describe, it, expect } from '@jest/globals';`
  (the repo's ESLint has no `env.jest`, so `no-undef` will fire).
- **Test the public contract**: dispatch real action creators against
  the *root* `reducer`; never import internal `onXxx` handlers.
- **Reducer tests pin three contracts**: behavior (action → state),
  initial-state shape (sorted-keys equality), action-type strings.
  Canonical examples: `__tests__/reducers/reducer.{wallet,reown}.test.ts`.
- **Reuse `__tests__/helpers/`** — don't redefine setup boilerplate.
  Note: helpers use `.js`, not `.ts`; the repo has no TS-aware import
  resolver, so `.ts` helpers fail `import/no-unresolved`.
- For Claude Code: a more detailed skill auto-loads on test work — see
  `.claude/skills/writing-tests/SKILL.md`. Other agents should read
  `docs/testing-guide.md` directly.

### 4. Commits

- Conventional Commits (`feat:`, `fix:`, `chore:`, `test:`, `docs:`).
- 50-char title cap, 72-col body wrap.
- Sign commits with GPG before merge (`git commit -S` or sign-and-amend
  before push). CI may require all commits signed.

### 5. PRs

- Assign to `tuliomir`. Tag `tests` for test PRs, `bug` for fixes,
  `dependencies` for dep changes.
- Add to project 15 with status "In Progress WIP".
- Description should be concise; explicit breaking-change notes when
  applicable.
