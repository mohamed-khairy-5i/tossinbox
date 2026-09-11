# Contributing to TossInbox

Thanks for your interest! TossInbox is intentionally small: a multi-provider
core, an agent-first CLI, and an MCP server. Please keep changes focused.

## Development setup

```bash
git clone https://github.com/mohamed-khairy-5i/tossinbox.git
cd tossinbox
npm install
npm run typecheck
npm run build
node dist/cli.js --help
```

Requires Node.js 18+ (CI runs on Node 20).

## Ground rules

- **Agent-first first**: every user-facing change must work with `--json`
  and respect the documented exit codes (0/1/2/3/4).
- **No interactive prompts.** The CLI must stay usable by scripts and agents.
- **No bulk mode.** TossInbox is for privacy and testing, not for abuse.
  Features that enable bulk signup/sending will be rejected.
- **Minimal dependencies.** New runtime dependencies need a strong reason.
- TypeScript strict mode must pass (`npm run typecheck`).

## Adding a provider

Implement the `EmailProvider` interface in `src/core/providers/`:

- `createInbox()` — create the inbox, return an `Inbox`
- `listMessages()` — return `MessageSummary[]`
- `readMessage()` — return a full `Message` (run `extractCode` on the body)
- `destroyInbox()` (optional) — best-effort server-side deletion

Register it in `src/core/index.ts`, add it to the README providers table,
and test it live against the real provider before opening a PR.

## Pull requests

1. Fork, create a feature branch.
2. Keep diffs small and describe *why*, not just *what*.
3. Run `npm run typecheck && npm run build` before pushing.
4. Update `CHANGELOG.md` and, when relevant, `README.md` / `llms.txt`.

## Reporting bugs

Open an issue with: command run, full output (redact tokens/addresses),
provider, Node version, and OS. Security issues: see `SECURITY.md`.
