# Examples

Copy-paste recipes for the three jobs TossInbox does: **sign up with a throwaway
address**, **collect the verification code**, and **toss the inbox**. Every
snippet uses the documented JSON contract — no screen scraping, no fragile
parsing.

Markdown version of https://tossinbox.pages.dev/examples.html

## 1 · Shell: sign up, get the code, verify

Needs `jq` (or swap in `node -e` parsing). Replace the two `curl` calls with
whatever your target app actually does.

```bash
# 1: create the inbox and grab its address as plain text
ADDR=$(tossinbox spawn --json | jq -r .inbox.address)
echo "inbox: $ADDR"

# 2: use the address in the signup flow of the app under test
curl -fsS https://staging.example-app.dev/api/signup \
  -d "email=$ADDR" \
  -d "password=correct-horse-battery"

# 3: block until the verification email lands, print just the code
CODE=$(tossinbox wait --code --timeout 180 --json | jq -r .code)
echo "code: $CODE"

# 4: complete the verification
curl -fsS https://staging.example-app.dev/api/verify \
  -d "email=$ADDR" \
  -d "code=$CODE"

# 5: done — delete the inbox on the server and locally
tossinbox toss
```

Exit codes tell your script what happened: `2` = the email never arrived before
the timeout, `3` = nothing matched your filters. Treat non-zero as a test
failure.

## 2 · GitHub Actions: e2e signup on every push

A workflow that signs up a fresh account on your staging API every push and
verifies it — no shared test account, no mailbox quota, no state between runs.

```yaml
name: e2e-signup
on: [push]
jobs:
  signup:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
      - name: Install TossInbox
        run: npm install --global tossinbox@0.1.3

      - name: Spawn inbox
        id: inbox
        run: |
          echo "address=$(tossinbox spawn --json | jq -r .inbox.address)" >> "$GITHUB_OUTPUT"

      - name: Sign up on staging
        run: |
          curl -fsS https://staging.example-app.dev/api/signup \
            -d "email=${{ steps.inbox.outputs.address }}" \
            -d "password=correct-horse-battery"

      - name: Wait for the verification code
        id: code
        run: |
          echo "code=$(tossinbox wait --code --timeout 180 --json | jq -r .code)" >> "$GITHUB_OUTPUT"

      - name: Verify the account
        run: |
          curl -fsS https://staging.example-app.dev/api/verify \
            -d "email=${{ steps.inbox.outputs.address }}" \
            -d "code=${{ steps.code.outputs.code }}"

      - name: Toss the inbox
        if: always()
        run: tossinbox toss
```

There is also a packaged action (`- uses: mohamed-khairy-5i/tossinbox@v1`) that
spawns + waits in one composite step and exposes `address` / `code` outputs —
handy when nothing has to run between spawn and wait.

## 3 · Node.js: drive it from a script

Same contract, inside Node. `spawnSync` keeps it dependency-free; the exit code
is your error channel, `--json` is your data channel.

```js
import { spawnSync } from "node:child_process";

const run = (args) => {
  const r = spawnSync("tossinbox", args, { encoding: "utf8" });
  if (r.status !== 0) throw new Error(`tossinbox ${args.join(" ")} exited ${r.status}`);
  return JSON.parse(r.stdout);
};

// 1: a fresh inbox for this run
const { inbox } = run(["spawn", "--json"]);
console.log("inbox:", inbox.address);

// 2: your app under test does its signup with inbox.address here …

// 3: block until the verification email lands
const { code } = run(["wait", "--code", "--timeout", "180", "--json"]);
console.log("code:", code);

// 4: clean up no matter what happened
run(["toss"]);
```

State lives in `~/.tossinbox/state.json` (`0600`). Point it somewhere temporary
with `TOSSINBOX_STATE=$(mktemp)` to keep parallel runs isolated.

## 4 · MCP: hand the whole job to an agent

TossInbox ships a stdio MCP server. Point any MCP client at it and the agent
can create inboxes, read messages, and wait for codes with tool calls.

```json
{
  "mcpServers": {
    "tossinbox": {
      "command": "npx",
      "args": ["-y", "tossinbox", "mcp"]
    }
  }
}
```

Then just say it in natural language: “Create a disposable inbox, sign this test
account up on staging, wait for the code, finish the verification, then delete
the inbox.” The agent maps that to `create_inbox` → its own signup step →
`wait_for_code` → `tossinbox toss`.

## 5 · Second provider when the first is flaky

Three providers ship built in: `mailtm` (default), `mailgw` (mail.tm-compatible
API on independent infrastructure) and `guerrillamail`. When one is having a
bad day, switch with a flag — no config files.

```bash
# what is available?
tossinbox providers

# default provider is down / slow? spawn on another one
tossinbox spawn -p mailgw
tossinbox spawn -p guerrillamail
```

## 6 · Wait flags: filter by sender, subject, timing

`wait` polls until a message matches. Tighten the match so noise from other
mail never delays your run.

```bash
# only the sender you expect, only the subject you expect
tossinbox wait --code \
  --from noreply@example-app.dev \
  --subject verification \
  --timeout 120 \
  --interval 3
```

Codes with letters come back uppercased (`f4x9k2` → `F4X9K2`); extraction
understands prompts in twelve languages — English and Arabic
(رمز / كود / تفعيل / تحقق), plus French, Spanish, German, Portuguese, Italian,
Russian, Turkish, Chinese, Japanese, and Korean.

## 7 · Watch: stream codes the moment they land

Long-lived automation should not exit after the first message. `watch` keeps
polling, prints every new message (and its code when found), and stops on
Ctrl-C. Only new arrivals are reported — restarting a watch never replays
old mail.

```bash
# watch until the code from your app lands, then keep going
tossinbox watch --from noreply@example-app.dev

# agents: one compact JSON object per line on stdout, stderr stays silent
tossinbox watch --json
```

MIT License © 2026 Mohamed Khairy
