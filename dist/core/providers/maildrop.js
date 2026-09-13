import { randomBytes } from "node:crypto";
import { ProviderError } from "../types.js";
import { extractCode } from "../otp.js";
import { networkError } from "../net.js";
import { VERSION } from "../../version.js";
const BASE = "https://api.maildrop.cc/graphql/graphql";
const HOST = "api.maildrop.cc";
const REQUEST_TIMEOUT_MS = 20_000;
function randomMailbox(length = 10) {
    const alphabet = "abcdefghijklmnopqrstuvwxyz0123456789";
    const bytes = randomBytes(length);
    let out = "";
    for (let i = 0; i < length; i++)
        out += alphabet[bytes[i] % alphabet.length];
    return out;
}
async function gql(query, variables) {
    const res = await fetch(BASE, {
        method: "POST",
        headers: {
            Accept: "application/json",
            "Content-Type": "application/json",
            "User-Agent": `tossinbox/${VERSION}`,
        },
        body: JSON.stringify({ query, variables }),
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    }).catch((err) => {
        throw networkError(err, "maildrop", HOST, REQUEST_TIMEOUT_MS);
    });
    if (res.status >= 500) {
        throw new ProviderError("maildrop", `HTTP ${res.status} from ${HOST} — provider is down or having trouble; retry, or switch with --provider`, res.status);
    }
    const body = (await res.json().catch(() => undefined));
    if (!body)
        throw new ProviderError("maildrop", `HTTP ${res.status} — unexpected response`, res.status);
    const firstError = body.errors?.[0]?.message;
    if (firstError)
        throw new ProviderError("maildrop", firstError, res.ok ? undefined : res.status);
    if (!res.ok || !body.data) {
        throw new ProviderError("maildrop", `HTTP ${res.status} — unexpected response`, res.status);
    }
    return body.data;
}
const INBOX_QUERY = `query ($mailbox: String!) { inbox(mailbox: $mailbox) { id headerfrom subject date } }`;
const MESSAGE_QUERY = `query ($mailbox: String!, $id: String!) { message(mailbox: $mailbox, id: $id) { id headerfrom subject date html } }`;
/** maildrop.cc inboxes are deterministic: every mailbox @maildrop.cc exists.
 *  Spawn mints a fresh random mailbox name; no account or auth is involved. */
export const maildrop = {
    name: "maildrop",
    description: "maildrop.cc — public inbox on one stable domain, no API key required",
    async createInbox(options) {
        const inbox = {
            provider: this.name,
            address: `${randomMailbox()}@maildrop.cc`,
            label: options?.label,
            createdAt: new Date().toISOString(),
        };
        return inbox;
    },
    async listMessages(inbox) {
        const mailbox = inbox.address.split("@")[0] ?? "";
        const data = await gql(INBOX_QUERY, { mailbox });
        return (data.inbox ?? []).map((m) => ({
            id: m.id,
            from: m.headerfrom ?? "unknown",
            subject: m.subject ?? "(no subject)",
            createdAt: m.date,
        }));
    },
    async readMessage(inbox, id) {
        const mailbox = inbox.address.split("@")[0] ?? "";
        const data = await gql(MESSAGE_QUERY, { mailbox, id });
        const m = data.message;
        if (!m) {
            throw new ProviderError("maildrop", "Message not found — re-list messages to see what is currently in the inbox");
        }
        const message = {
            id,
            from: m.headerfrom ?? "unknown",
            subject: m.subject ?? "(no subject)",
            createdAt: m.date,
            html: m.html,
        };
        message.code = extractCode(message.html);
        return message;
    },
};
