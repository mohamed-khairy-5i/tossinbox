# For AI agents

TossInbox ships a built-in MCP server, so any MCP client can create inboxes
and collect verification codes as native tools. The CLI is the same clean
contract (`--json`, exit codes 0–4, zero prompts), so agents that can only run
shell commands get the exact same power.

Markdown version of https://tossinbox.pages.dev/agents.html

## MCP tools

| MCP tool        | What it returns                                        |
|-----------------|--------------------------------------------------------|
| `create_inbox`  | A fresh disposable address + provider name. If the requested provider is down, another one serves the inbox automatically (`no_failover` opts out) |
| `list_messages` | Messages currently in an inbox                         |
| `read_message`  | Full message body, including any detected code         |
| `wait_for_code` | Blocks until a verification code arrives, returns it   |

Transport: stdio, no network, no auth.

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

## Where the config goes

| Client          | Where to put the config                                                                                     |
|-----------------|-------------------------------------------------------------------------------------------------------------|
| Claude Desktop  | Settings → Developer → Edit Config (`claude_desktop_config.json`)                                            |
| Claude Code     | `claude mcp add tossinbox -- npx -y tossinbox mcp`                                  |
| Cursor          | `~/.cursor/mcp.json`                                                                                         |
| Windsurf        | `~/.codeium/windsurf/mcp_config.json`                                                                       |
| Codex CLI       | `~/.codex/config.toml` → `[mcp_servers.tossinbox]` with command / args                                       |
| Gemini CLI      | `~/.gemini/settings.json` → `mcpServers`                                                                    |
| Cline / VS Code | MCP servers panel or workspace `.vscode/mcp.json`                                                            |
| Anything else   | Any MCP stdio client, same command + args, works unmodified                                                  |

MCP is client-agnostic by design: one server, every agent.

## A full agent flow, no human in the loop

1. "Create a disposable inbox" → `create_inbox`
2. "Sign up at example.com with that address" → your agent's browser
3. "Wait for the verification code" → `wait_for_code`
4. "Finish the signup with the code" → your agent's browser
5. "Toss the inbox" → `tossinbox toss`

## Verification codes in CI

Use TossInbox as a GitHub Action to test real email flows in your workflows:
spawn an inbox, submit it from your own step, then wait for the code. The
address and the extracted verification code are exposed as step outputs.

```yaml
# 1: create the inbox
- uses: mohamed-khairy-5i/tossinbox@v1
  id: inbox
  with:
    args: "spawn"

# 2: your own step submits the signup form using the address
- run: ./signup.sh "${{ steps.inbox.outputs.address }}"

# 3: block until the verification code arrives
- uses: mohamed-khairy-5i/tossinbox@v1
  id: code
  with:
    args: "wait --code --json"
  timeout: "180"

- run: echo "code: ${{ steps.code.outputs.code }}"
# outputs per step: steps.<id>.outputs.address, steps.<id>.outputs.code
```

Machine-readable discovery surfaces:

- MCP Server Card: https://tossinbox.pages.dev/.well-known/mcp/server-card.json
- Agent skill: https://tossinbox.pages.dev/.well-known/agent-skills/tossinbox/SKILL.md
- llms.txt: https://tossinbox.pages.dev/llms.txt

MIT License © 2026 Mohamed Khairy
