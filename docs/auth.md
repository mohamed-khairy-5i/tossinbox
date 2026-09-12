# Auth

This site has no protected APIs and no authentication. Nothing here issues
tokens, and nothing requires registration.

- The website and all documentation are public static files; there are no
  accounts and no user data is collected.
- The TossInbox CLI and MCP server run locally on the agent's own machine and
  talk to upstream disposable-email providers (mail.tm, GuerrillaMail)
  anonymously — no API keys, no OAuth, no sign-up.
- Consequently there is intentionally no `/.well-known/openid-configuration`,
  no `/.well-known/oauth-authorization-server`, and no
  `/.well-known/oauth-protected-resource` on this host: publishing one would
  describe a token issuer that does not exist.
- If TossInbox ever ships a hosted, authenticated API, this file and the
  matching OAuth discovery documents will be published here first.

Agent registration: not required. Just use the tool —
`npx tossinbox@latest spawn`.
