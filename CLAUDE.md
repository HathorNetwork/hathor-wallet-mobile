# Claude Code instructions

## Hard rule: pin every dependency exactly

`package.json` MUST use exact versions — **no `^`, no `~`**. This is a
supply-chain mitigation and is mandatory; review tools (CodeRabbit,
Copilot) will flag any range and we must fix it. When you add or
upgrade a dep:

1. Edit `package.json` to the exact version (e.g. `"foo": "1.2.3"`,
   not `"^1.2.3"`).
2. Regenerate the lockfile **on Node 22 / npm 10** to match CI's
   matrix (`.github/workflows/main.yml`):

   ```sh
   nvm install 22 && nvm use 22
   npm install --no-audit --no-fund
   ```

   A lockfile generated on a different Node major (e.g. 24 / npm 11)
   will fail CI's `npm ci` with *"Missing: X from lock file"* errors.

## Pointers

- The cross-tool agent guide is [`AGENTS.md`](./AGENTS.md) — same
  rules in a tool-agnostic format. Read it for the full context
  (testing conventions, helper rules, etc.).
- For test work, the more detailed Claude Code skill at
  `.claude/skills/writing-tests/SKILL.md` auto-loads when you start
  modifying files under `__tests__/` or matching `*.test.{ts,tsx,js}`.
