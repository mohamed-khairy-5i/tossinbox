import { ProviderError } from "../types.js";
import { extractCode } from "../otp.js";
import { networkError } from "../net.js";
import { VERSION } from "../../version.js";
const BASE = "https://api.guerrillamail.com/ajax.php";
const REQUEST_TIMEOUT_MS = 20_000;
function timestampToIso(ts) {
    if (!ts)
        return undefined;
    // guerrillamail timestamps are in seconds
    return new Date(ts * 1000).toISOString();
}
async function call(params) {
    const url = new URL(BASE);
    for (const [k, v] of Object.entries(params))
        url.searchParams.set(k, v);
    // Hard timeout on every request — an agent must never hang forever. Raw
    // network failures are translated into a readable, actionable ProviderError.
    const res = await fetch(url, {
        headers: { Accept: "application/json", "User-Agent": `tossinbox/${VERSION}` },
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    }).catch((err) => {
        throw networkError(err, "guerrillamail", "api.guerrillamail.com", REQUEST_TIMEOUT_MS);
    });
    if (!res.ok)
        throw new ProviderError("guerrillamail", `HTTP ${res.status}`, res.status);
    return (await res.json());
}
export const guerrillaMail = {
    name: "guerrillamail",
    description: "GuerrillaMail — classic disposable email, no API key required",
    async createInbox(options) {
        const data = await call({ f: "get_email_address", lang: "en" });
        const addr = data;
        if (!addr.email_addr || !addr.sid_token) {
            throw new ProviderError(this.name, "Unexpected response while creating inbox");
        }
        const inbox = {
            provider: this.name,
            address: addr.email_addr,
            label: options?.label,
            session: addr.sid_token,
            createdAt: new Date().toISOString(),
        };
        return inbox;
    },
    async listMessages(inbox) {
        if (!inbox.session)
            throw new ProviderError(this.name, "Inbox is missing its session token");
        const data = await call({ f: "get_email_list", offset: "0", sid_token: inbox.session });
        const list = data.list?.list ?? [];
        return list.map((m) => ({
            id: String(m.mail_id),
            from: m.mail_from ?? "unknown",
            subject: m.mail_subject ?? "(no subject)",
            intro: m.mail_excerpt,
            createdAt: timestampToIso(m.mail_timestamp),
        }));
    },
    async readMessage(inbox, id) {
        if (!inbox.session)
            throw new ProviderError(this.name, "Inbox is missing its session token");
        const data = await call({ f: "fetch_email", sid_token: inbox.session, email_id: id });
        const m = data;
        const message = {
            id: String(m.mail_id ?? id),
            from: m.mail_from ?? "unknown",
            subject: m.mail_subject ?? "(no subject)",
            intro: m.mail_excerpt,
            createdAt: timestampToIso(m.mail_timestamp),
            html: m.mail_body,
        };
        message.code = extractCode(message.html);
        return message;
    },
    async destroyInbox(inbox) {
        if (!inbox.session)
            return;
        try {
            await call({ f: "forget_me", email_addr: inbox.address, sid_token: inbox.session });
        }
        catch {
            // best effort
        }
    },
};
