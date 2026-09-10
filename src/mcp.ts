#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import {
  DEFAULT_PROVIDER,
  getProvider,
  resolveInbox,
  saveInbox,
  waitForMessage,
  htmlToText,
  type Inbox,
  type Message,
} from "./core/index.js";

function text(result: unknown) {
  return {
    content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }],
  };
}

function messageJson(message: Message, includeHtml = false) {
  return {
    id: message.id,
    from: message.from,
    fromName: message.fromName,
    subject: message.subject,
    createdAt: message.createdAt,
    code: message.code,
    text: message.text ?? (message.html ? htmlToText(message.html) : undefined),
    html: includeHtml ? message.html : undefined,
  };
}

async function requireInbox(address?: string): Promise<Inbox | null> {
  const inbox = await resolveInbox(address);
  if (inbox) return inbox;
  return null;
}

export async function startMcpServer(): Promise<void> {
  const server = new McpServer({
    name: "tossinbox",
    version: "0.1.0",
  });

  server.registerTool(
    "create_inbox",
    {
      title: "Create a disposable inbox",
      description:
        "Create a brand new disposable email inbox. The inbox is saved locally so the other tools can use it. Returns the full email address to use in sign-up forms.",
      inputSchema: {
        provider: z.string().optional().describe(`Provider name (default: "${DEFAULT_PROVIDER}", see the providers list)`),
        label: z.string().optional().describe("Optional label to identify this inbox"),
      },
    },
    async ({ provider, label }) => {
      try {
        const p = getProvider(provider);
        const inbox = await p.createInbox({ label });
        await saveInbox(inbox);
        return text({
          ok: true,
          inbox: { address: inbox.address, provider: inbox.provider, label: inbox.label },
          hint: `Use address "${inbox.address}" in the sign-up form, then call wait_for_code after submitting it.`,
        });
      } catch (err) {
        return text({ ok: false, error: err instanceof Error ? err.message : String(err) });
      }
    }
  );

  server.registerTool(
    "list_messages",
    {
      title: "List inbox messages",
      description:
        "List the messages currently in a disposable inbox (defaults to the most recently created inbox).",
      inputSchema: {
        address: z.string().optional().describe("Inbox address; defaults to the most recent inbox"),
      },
    },
    async ({ address }) => {
      try {
        const inbox = await requireInbox(address);
        if (!inbox) return text({ ok: false, error: "No saved inbox found. Call create_inbox first." });

        const p = getProvider(inbox.provider);
        const messages = await p.listMessages(inbox);
        return text({ ok: true, inbox: inbox.address, count: messages.length, messages });
      } catch (err) {
        return text({ ok: false, error: err instanceof Error ? err.message : String(err) });
      }
    }
  );

  server.registerTool(
    "read_message",
    {
      title: "Read a message",
      description:
        "Read the full body of a message by id, including any verification code detected in it.",
      inputSchema: {
        id: z.string().describe("Message id (from list_messages)"),
        address: z.string().optional().describe("Inbox address; defaults to the most recent inbox"),
      },
    },
    async ({ id, address }) => {
      try {
        const inbox = await requireInbox(address);
        if (!inbox) return text({ ok: false, error: "No saved inbox found. Call create_inbox first." });

        const p = getProvider(inbox.provider);
        const message = await p.readMessage(inbox, id);
        return text({ ok: true, message: messageJson(message, false) });
      } catch (err) {
        return text({ ok: false, error: err instanceof Error ? err.message : String(err) });
      }
    }
  );

  server.registerTool(
    "wait_for_code",
    {
      title: "Wait for a verification code",
      description:
        "Poll a disposable inbox until a message arrives, then return the verification code (OTP) found in it. Ideal right after submitting a sign-up form. Times out gracefully.",
      inputSchema: {
        address: z.string().optional().describe("Inbox address; defaults to the most recent inbox"),
        timeout_seconds: z.number().int().min(5).max(600).optional().describe("Max seconds to wait (default 120)"),
        from: z.string().optional().describe("Only match messages from this sender (substring)"),
        subject: z.string().optional().describe("Only match messages whose subject contains this text"),
      },
    },
    async ({ address, timeout_seconds, from, subject }) => {
      try {
        const inbox = await requireInbox(address);
        if (!inbox) return text({ ok: false, error: "No saved inbox found. Call create_inbox first." });

        const p = getProvider(inbox.provider);
        const { timedOut, message } = await waitForMessage(p, inbox, {
          timeoutSeconds: timeout_seconds,
          from,
          subject,
        });

        if (timedOut || !message) {
          return text({
            ok: false,
            error: "timeout",
            detail: `No matching message within ${timeout_seconds ?? 120}s`,
            inbox: inbox.address,
          });
        }
        if (!message.code) {
          return text({
            ok: false,
            error: "message arrived but no code was detected",
            message: messageJson(message, false),
          });
        }
        return text({ ok: true, code: message.code, inbox: inbox.address, message: messageJson(message, false) });
      } catch (err) {
        return text({ ok: false, error: err instanceof Error ? err.message : String(err) });
      }
    }
  );

  const transport = new StdioServerTransport();
  await server.connect(transport);
  // stdout is reserved for the MCP protocol; status goes to stderr.
  console.error("tossinbox MCP server running on stdio");
}

/* When executed directly, start the server. */
if (process.argv[1] && import.meta.url === new URL(`file://${process.argv[1]}`).href) {
  startMcpServer().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
