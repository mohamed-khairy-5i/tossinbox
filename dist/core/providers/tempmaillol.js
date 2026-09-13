import { ProviderError } from "../types.js";
import { extractCode } from "../otp.js";
import { networkError } from "../net.js";
import { VERSION } from "../../version.js";
const BASE = "https://api.tempmail.lol";
const HOST = "api.tempmail.lol";
const REQUEST_TIMEOUT_MS = 20_000;
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
        throw networkError(err, "tempmaillol", HOST, REQUEST_TIMEOUT_MS);
    });
    if (res.status >= 500) {
        throw new ProviderError("tempmaillol", `HTTP ${res.status} from ${HOST} — provider is down or having trouble; retry, or switch with --provider`, res.status);
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
        throw new ProviderError("tempmaillol", `HTTP ${res.status}${detail}`, res.status);
    }
    return (await res.json());
}
/** tempmail.lol list responses may omit per-email ids; synthesize a stable one */
function synthesizedId(email, index) {
    return email.id ?? `${email.date ?? "undated"}#${index}`;
}
export const tempmailLol = {
    name: "tempmaillol",
    description: "tempmail.lol — random inbox with rotating domains, no API key required",
    async createInbox(options) {
        const data = await callJson("POST", "/v2/inbox/create");
        if (!data.address || !data.token) {
            throw new ProviderError("tempmaillol", "Unexpected response while creating inbox");
        }
        const inbox = {
            provider: this.name,
            address: data.address,
            label: options?.label,
            token: data.token,
            createdAt: new Date().toISOString(),
        };
        return inbox;
    },
    async listMessages(inbox) {
        if (!inbox.token)
            throw new ProviderError("tempmaillol", "Inbox is missing its API token");
        const data = await callJson("GET", `/v2/inbox?token=${encodeURIComponent(inbox.token)}`);
        if (data.expired) {
            throw new ProviderError("tempmaillol", "Inbox has expired on tempmail.lol — spawn a new one");
        }
        return (data.emails ?? []).map((e, i) => ({
            id: synthesizedId(e, i),
            from: e.from ?? "unknown",
            subject: e.subject ?? "(no subject)",
            createdAt: e.date,
        }));
    },
    async readMessage(inbox, id) {
        if (!inbox.token)
            throw new ProviderError("tempmaillol", "Inbox is missing its API token");
        const data = await callJson("GET", `/v2/inbox?token=${encodeURIComponent(inbox.token)}`);
        if (data.expired) {
            throw new ProviderError("tempmaillol", "Inbox has expired on tempmail.lol — spawn a new one");
        }
        const email = (data.emails ?? []).find((e, i) => synthesizedId(e, i) === id);
        if (!email) {
            throw new ProviderError("tempmaillol", "Message not found — it may have been dropped when the inbox rolled over; re-list messages");
        }
        const message = {
            id,
            from: email.from ?? "unknown",
            subject: email.subject ?? "(no subject)",
            createdAt: email.date,
            text: email.body,
            html: email.html,
        };
        message.code = extractCode(message.text) ?? extractCode(message.html);
        return message;
    },
};
