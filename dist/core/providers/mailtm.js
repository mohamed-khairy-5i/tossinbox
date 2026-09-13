import { randomBytes } from "node:crypto";
import { ProviderError } from "../types.js";
import { extractCode } from "../otp.js";
import { networkError } from "../net.js";
import { VERSION } from "../../version.js";
const BASE = "https://api.mail.tm";
const REQUEST_TIMEOUT_MS = 20_000;
function randomString(length, alphabet) {
    const bytes = randomBytes(length);
    let out = "";
    for (let i = 0; i < length; i++) {
        out += alphabet[bytes[i] % alphabet.length];
    }
    return out;
}
function randomUser(length = 12) {
    return randomString(length, "abcdefghijklmnopqrstuvwxyz0123456789");
}
function randomPassword(length = 16) {
    return randomString(length, "abcdefghijkmnopqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789");
}
function headers(token) {
    const h = {
        Accept: "application/json",
        "User-Agent": `tossinbox/${VERSION}`,
    };
    if (token)
        h.Authorization = `Bearer ${token}`;
    return h;
}
/** Hard timeout on every request — an agent must never hang forever. Raw
 *  network failures (DNS, refused, timeout) are translated into a readable,
 *  actionable ProviderError instead of Node's bare "fetch failed". */
function fetchJson(url, init) {
    return fetch(url, { ...init, signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS) }).catch((err) => {
        throw networkError(err, "mailtm", "api.mail.tm", REQUEST_TIMEOUT_MS);
    });
}
/** mail.tm allows ~8 requests per second; retry once on 429. */
async function request(method, url, options = {}) {
    const init = {
        method,
        headers: { ...headers(options.token), ...(options.body ? { "Content-Type": "application/json" } : {}) },
        body: options.body ? JSON.stringify(options.body) : undefined,
    };
    let res = await fetchJson(url, init);
    if (res.status === 429) {
        await new Promise((r) => setTimeout(r, 1200));
        res = await fetchJson(url, init);
    }
    return res;
}
async function parseJson(res, provider) {
    if (!res.ok) {
        let detail = "";
        try {
            const body = (await res.json());
            const msg = body["hydra:description"] ?? body.message ?? body.detail;
            if (typeof msg === "string")
                detail = `: ${msg}`;
        }
        catch {
            // ignore body parse errors
        }
        throw new ProviderError(provider, `HTTP ${res.status}${detail}`, res.status);
    }
    return (await res.json());
}
/** mail.tm returns a plain array with Accept: application/json and a hydra
 *  collection with Accept: application/ld+json — normalize both. */
async function parseCollection(res, provider) {
    const data = await parseJson(res, provider);
    if (Array.isArray(data))
        return data;
    if (data && typeof data === "object") {
        const obj = data;
        const member = obj["hydra:member"] ?? obj.member;
        if (Array.isArray(member))
            return member;
    }
    throw new ProviderError(provider, "Unexpected collection response shape");
}
export const mailTm = {
    name: "mailtm",
    description: "mail.tm — free disposable email, no API key required",
    async createInbox(options) {
        const domainsRes = await request("GET", `${BASE}/domains?page=1`);
        const domains = await parseCollection(domainsRes, this.name);
        const domain = domains.find((d) => d.isActive && !d.isPrivate)?.domain;
        if (!domain) {
            throw new ProviderError(this.name, "No active public domain available on mail.tm");
        }
        const address = `${randomUser()}@${domain}`;
        const password = randomPassword();
        const accountRes = await request("POST", `${BASE}/accounts`, { body: { address, password } });
        const account = await parseJson(accountRes, this.name);
        const tokenRes = await request("POST", `${BASE}/token`, { body: { address, password } });
        const auth = await parseJson(tokenRes, this.name);
        const inbox = {
            provider: this.name,
            address: account.address || address,
            label: options?.label,
            token: auth.token,
            password,
            accountId: account.id || auth.id,
            createdAt: new Date().toISOString(),
        };
        return inbox;
    },
    async listMessages(inbox) {
        if (!inbox.token)
            throw new ProviderError(this.name, "Inbox is missing its API token");
        const res = await request("GET", `${BASE}/messages?page=1`, { token: inbox.token });
        const data = await parseCollection(res, this.name);
        return data.map((m) => ({
            id: m.id,
            from: m.from?.address ?? "unknown",
            fromName: m.from?.name,
            subject: m.subject ?? "(no subject)",
            intro: m.intro,
            createdAt: m.createdAt,
        }));
    },
    async readMessage(inbox, id) {
        if (!inbox.token)
            throw new ProviderError(this.name, "Inbox is missing its API token");
        const res = await request("GET", `${BASE}/messages/${encodeURIComponent(id)}`, { token: inbox.token });
        const m = await parseJson(res, this.name);
        const html = m.html && m.html.length > 0 ? m.html.join("\n") : undefined;
        const message = {
            id: m.id,
            from: m.from?.address ?? "unknown",
            fromName: m.from?.name,
            subject: m.subject ?? "(no subject)",
            intro: m.intro,
            createdAt: m.createdAt,
            text: m.text,
            html,
        };
        message.code = extractCode(message.text) ?? extractCode(message.html);
        return message;
    },
    async destroyInbox(inbox) {
        if (!inbox.token || !inbox.accountId)
            return;
        try {
            await request("DELETE", `${BASE}/accounts/${encodeURIComponent(inbox.accountId)}`, {
                token: inbox.token,
            });
        }
        catch {
            // best effort: local removal always happens regardless
        }
    },
};
