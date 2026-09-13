import { randomBytes } from "node:crypto";
import { ProviderError } from "../types.js";
import { extractCode } from "../otp.js";
import { networkError } from "../net.js";
import { VERSION } from "../../version.js";
const BASE = "https://tempmail.plus";
const HOST = "tempmail.plus";
const REQUEST_TIMEOUT_MS = 20_000;
/** Public domains advertised by the tempmail.plus web client. The first one
 *  is the service default and is the one TossInbox spawns on. */
const DOMAIN = "mailto.plus";
function randomUser(length = 12) {
    const alphabet = "abcdefghijklmnopqrstuvwxyz0123456789";
    const bytes = randomBytes(length);
    let out = "";
    for (let i = 0; i < length; i++)
        out += alphabet[bytes[i] % alphabet.length];
    return out;
}
function timeToIso(ts) {
    if (!ts)
        return undefined;
    if (typeof ts === "string") {
        // Some endpoints return "YYYY-MM-DD HH:mm:ss" strings instead of epochs
        const d = new Date(ts.includes("T") ? ts : ts.replace(" ", "T") + "Z");
        return isNaN(d.getTime()) ? undefined : d.toISOString();
    }
    // Guard against seconds vs milliseconds epochs
    return new Date(ts < 1e12 ? ts * 1000 : ts).toISOString();
}
async function call(method, path, body) {
    const res = await fetch(`${BASE}${path}`, {
        method,
        headers: {
            Accept: "application/json",
            "User-Agent": `tossinbox/${VERSION}`,
            ...(body ? { "Content-Type": "application/json" } : {}),
        },
        body: body ? JSON.stringify(body) : undefined,
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    }).catch((err) => {
        throw networkError(err, "tempmailplus", HOST, REQUEST_TIMEOUT_MS);
    });
    if (res.status >= 500) {
        throw new ProviderError("tempmailplus", `HTTP ${res.status} from ${HOST} — provider is down or having trouble; retry, or switch with --provider`, res.status);
    }
    return res;
}
async function callJson(method, path, body) {
    const res = await call(method, path, body);
    if (!res.ok) {
        let detail = "";
        try {
            const data = (await res.json());
            if (typeof data.message === "string")
                detail = `: ${data.message}`;
        }
        catch {
            // ignore body parse errors
        }
        throw new ProviderError("tempmailplus", `HTTP ${res.status}${detail}`, res.status);
    }
    return (await res.json());
}
/** tempmail.plus inboxes are deterministic: any address on a public domain
 *  exists and can be read by anyone who knows it. Spawn mints a fresh random
 *  local part; messages are then fetched by address. */
export const tempmailPlus = {
    name: "tempmailplus",
    description: "tempmail.plus — pick-your-name inbox on 9 public domains, no API key required",
    async createInbox(options) {
        const inbox = {
            provider: this.name,
            address: `${randomUser()}@${DOMAIN}`,
            label: options?.label,
            createdAt: new Date().toISOString(),
        };
        return inbox;
    },
    async listMessages(inbox) {
        const data = await callJson("GET", `/api/mails/?email=${encodeURIComponent(inbox.address)}&first_id=0`);
        return (data.mail_list ?? []).map((m) => ({
            id: String(m.mail_id ?? m.id),
            from: m.from_mail ?? m.from ?? "unknown",
            fromName: m.from_name,
            subject: m.subject ?? "(no subject)",
            createdAt: timeToIso(m.time),
        }));
    },
    async readMessage(inbox, id) {
        const data = await callJson("GET", `/api/mails/${encodeURIComponent(id)}?email=${encodeURIComponent(inbox.address)}&first_id=-1`);
        if (!data.result) {
            throw new ProviderError("tempmailplus", "Message not found — re-list messages to see what is currently in the inbox");
        }
        const attachments = (data.attachments ?? []).map((a) => ({
            id: a.attachment_id !== undefined ? String(a.attachment_id) : undefined,
            filename: a.name || "attachment.bin",
            size: a.size,
            contentId: a.content_id || undefined,
        }));
        const message = {
            id,
            from: data.from_mail ?? data.from ?? "unknown",
            fromName: data.from_name,
            subject: data.subject ?? "(no subject)",
            createdAt: timeToIso(data.time) ?? data.date,
            text: data.text,
            html: data.html,
            ...(attachments.length > 0 ? { attachments } : {}),
        };
        message.code = extractCode(message.text) ?? extractCode(message.html);
        return message;
    },
    async downloadAttachment(inbox, messageId, attachment) {
        if (!attachment.id) {
            throw new ProviderError("tempmailplus", `Attachment "${attachment.filename}" has no id to download`);
        }
        // Download endpoint as used by the tempmail.plus web client:
        // /api/mails/{mailId}/attachments/{attachment_id}?email={address}&epin={pin?}
        const url = `${BASE}/api/mails/${encodeURIComponent(messageId)}` +
            `/attachments/${encodeURIComponent(attachment.id)}` +
            `?email=${encodeURIComponent(inbox.address)}&epin=${encodeURIComponent(inbox.session ?? "")}`;
        const res = await fetch(url, {
            headers: { Accept: "*/*", "User-Agent": `tossinbox/${VERSION}` },
            signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
        }).catch((err) => {
            throw networkError(err, "tempmailplus", HOST, REQUEST_TIMEOUT_MS);
        });
        if (!res.ok) {
            throw new ProviderError("tempmailplus", `HTTP ${res.status} while downloading "${attachment.filename}"`, res.status);
        }
        return Buffer.from(await res.arrayBuffer());
    },
    async destroyInbox(inbox) {
        try {
            const data = await callJson("GET", `/api/mails/?email=${encodeURIComponent(inbox.address)}&first_id=0`);
            const list = data.mail_list ?? [];
            if (list.length === 0)
                return;
            await call("DELETE", "/api/mails", {
                email: inbox.address,
                first_id: data.first_id ?? 0,
                last_id: data.last_id ?? 0,
                force: true,
            });
        }
        catch {
            // best effort: local removal always happens regardless
        }
    },
};
