#!/usr/bin/env node
import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { DEFAULT_PROVIDER, createInboxWithFailover, getProvider, resolveInbox, saveInbox, waitForMessage, htmlToText, } from "./core/index.js";
import { VERSION } from "./version.js";
function text(result, isError = false) {
    return {
        content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
        ...(isError ? { isError: true } : {}),
    };
}
function messageJson(message, includeHtml = false) {
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
async function requireInbox(address) {
    const inbox = await resolveInbox(address);
    if (inbox)
        return inbox;
    return null;
}
export async function startMcpServer() {
    const server = new McpServer({
        name: "tossinbox",
        version: VERSION,
    });
    server.registerTool("create_inbox", {
        title: "Create a disposable inbox",
        description: "Create a brand new disposable email inbox. The inbox is saved locally so the other tools can use it. Returns the full email address to use in sign-up forms.",
        inputSchema: {
            provider: z.string().optional().describe(`Provider name (default: "${DEFAULT_PROVIDER}", see the providers list). If the provider is down, another one is used automatically unless no_failover is set`),
            label: z.string().optional().describe("Optional label to identify this inbox"),
            no_failover: z.boolean().optional().describe("Fail when the chosen provider is down instead of falling back to another one"),
        },
    }, async ({ provider, label, no_failover }) => {
        try {
            getProvider(provider); // unknown name = clean error before any network call
            const { inbox, switched, warnings } = await createInboxWithFailover({
                requested: provider,
                label,
                failover: !no_failover,
            });
            await saveInbox(inbox);
            return text({
                ok: true,
                inbox: { address: inbox.address, provider: inbox.provider, label: inbox.label },
                ...(switched ? { failover: { requested: provider ?? DEFAULT_PROVIDER, used: inbox.provider } } : {}),
                ...(warnings.length > 0 ? { warnings } : {}),
                hint: `Use address "${inbox.address}" in the sign-up form, then call wait_for_code after submitting it.`,
            });
        }
        catch (err) {
            return text({ ok: false, error: err instanceof Error ? err.message : String(err) }, true);
        }
    });
    server.registerTool("list_messages", {
        title: "List inbox messages",
        description: "List the messages currently in a disposable inbox (defaults to the most recently created inbox).",
        inputSchema: {
            address: z.string().optional().describe("Inbox address; defaults to the most recent inbox"),
        },
    }, async ({ address }) => {
        try {
            const inbox = await requireInbox(address);
            if (!inbox)
                return text({ ok: false, error: "No saved inbox found. Call create_inbox first." }, true);
            const p = getProvider(inbox.provider);
            const messages = await p.listMessages(inbox);
            return text({ ok: true, inbox: inbox.address, count: messages.length, messages });
        }
        catch (err) {
            return text({ ok: false, error: err instanceof Error ? err.message : String(err) }, true);
        }
    });
    server.registerTool("read_message", {
        title: "Read a message",
        description: "Read the full body of a message by id, including any verification code detected in it.",
        inputSchema: {
            id: z.string().describe("Message id (from list_messages)"),
            address: z.string().optional().describe("Inbox address; defaults to the most recent inbox"),
        },
    }, async ({ id, address }) => {
        try {
            const inbox = await requireInbox(address);
            if (!inbox)
                return text({ ok: false, error: "No saved inbox found. Call create_inbox first." }, true);
            const p = getProvider(inbox.provider);
            const message = await p.readMessage(inbox, id);
            return text({ ok: true, message: messageJson(message, false) });
        }
        catch (err) {
            return text({ ok: false, error: err instanceof Error ? err.message : String(err) }, true);
        }
    });
    server.registerTool("wait_for_code", {
        title: "Wait for a verification code",
        description: "Poll a disposable inbox until a message arrives, then return the verification code (OTP) found in it. Ideal right after submitting a sign-up form. Times out gracefully.",
        inputSchema: {
            address: z.string().optional().describe("Inbox address; defaults to the most recent inbox"),
            timeout_seconds: z.number().int().min(5).max(600).optional().describe("Max seconds to wait (default 120)"),
            from: z.string().optional().describe("Only match messages from this sender (substring)"),
            subject: z.string().optional().describe("Only match messages whose subject contains this text"),
        },
    }, async ({ address, timeout_seconds, from, subject }) => {
        try {
            const inbox = await requireInbox(address);
            if (!inbox)
                return text({ ok: false, error: "No saved inbox found. Call create_inbox first." }, true);
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
                }, true);
            }
            if (!message.code) {
                return text({
                    ok: false,
                    error: "message arrived but no code was detected",
                    message: messageJson(message, false),
                }, true);
            }
            return text({ ok: true, code: message.code, inbox: inbox.address, message: messageJson(message, false) });
        }
        catch (err) {
            return text({ ok: false, error: err instanceof Error ? err.message : String(err) }, true);
        }
    });
    const transport = new StdioServerTransport();
    await server.connect(transport);
    // stdout is reserved for the MCP protocol; status goes to stderr.
    console.error("tossinbox MCP server running on stdio");
}
/* When executed directly, start the server. This must also work when the file
 * is launched through an npm/Homebrew bin symlink — resolve both paths before
 * comparing, and fall back to the script name for exotic shim wrappers. */
function isDirectRun() {
    if (!process.argv[1])
        return false;
    try {
        const arg = fs.realpathSync(process.argv[1]);
        const self = fs.realpathSync(fileURLToPath(import.meta.url));
        if (arg === self)
            return true;
        return path.basename(arg) === "mcp.js";
    }
    catch {
        return false;
    }
}
if (isDirectRun()) {
    startMcpServer().catch((err) => {
        console.error(err);
        process.exit(1);
    });
}
