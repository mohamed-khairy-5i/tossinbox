import { randomBytes } from "node:crypto";
import { ProviderError, type Attachment, type EmailProvider, type Inbox, type Message, type MessageSummary } from "../types.js";
import { extractCode } from "../otp.js";
import { networkError } from "../net.js";
import { VERSION } from "../../version.js";

const REQUEST_TIMEOUT_MS = 20_000;

interface MailTmDomain {
  domain: string;
  isActive: boolean;
  isPrivate: boolean;
}

interface MailTmAttachment {
  id: string;
  filename: string;
  contentType?: string;
  disposition?: string;
  transferEncoding?: string;
  related?: boolean;
  size?: number;
  downloadUrl?: string;
}

interface MailTmMessage {
  id: string;
  from?: { address?: string; name?: string };
  to?: Array<{ address?: string; name?: string }>;
  subject?: string;
  intro?: string;
  text?: string;
  html?: string[];
  attachments?: MailTmAttachment[];
  createdAt?: string;
}

function randomString(length: number, alphabet: string): string {
  const bytes = randomBytes(length);
  let out = "";
  for (let i = 0; i < length; i++) {
    out += alphabet[bytes[i] % alphabet.length];
  }
  return out;
}

function randomUser(length = 12): string {
  return randomString(length, "abcdefghijklmnopqrstuvwxyz0123456789");
}

function randomPassword(length = 16): string {
  return randomString(length, "abcdefghijkmnopqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789");
}

function headers(token?: string): Record<string, string> {
  const h: Record<string, string> = {
    Accept: "application/json",
    "User-Agent": `tossinbox/${VERSION}`,
  };
  if (token) h.Authorization = `Bearer ${token}`;
  return h;
}

interface MailTmLikeConfig {
  /** Provider identifier used in CLI flags and state files */
  name: string;
  /** API base URL, e.g. https://api.mail.tm */
  base: string;
  /** API host, used in network error messages */
  host: string;
  /** Human readable description shown by `tossinbox providers` */
  description: string;
}

/** mail.tm and mail.gw expose the identical API (mail.gw is an independent
 *  infrastructure running the same software), so one factory serves both.
 *  Every request gets a hard timeout and raw network failures are translated
 *  into readable, actionable ProviderErrors naming the right provider. */
function createMailTmLikeProvider(config: MailTmLikeConfig): EmailProvider {
  const { name: providerName, base, host } = config;

  function fetchJson(url: string, init: RequestInit): Promise<Response> {
    return fetch(url, { ...init, signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS) }).catch(
      (err: unknown) => {
        throw networkError(err, providerName, host, REQUEST_TIMEOUT_MS);
      }
    );
  }

  /** These APIs allow ~8 requests per second; retry once on 429. */
  async function request(
    method: string,
    url: string,
    options: { token?: string; body?: unknown } = {}
  ): Promise<Response> {
    const init: RequestInit = {
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

  async function parseJson<T>(res: Response): Promise<T> {
    if (!res.ok) {
      // 5xx = the upstream itself is failing — say so and point at the fix.
      if (res.status >= 500) {
        throw new ProviderError(
          providerName,
          `HTTP ${res.status} from ${host} — provider is down or having trouble; retry, or switch with --provider`,
          res.status
        );
      }
      let detail = "";
      try {
        const body = (await res.json()) as Record<string, unknown>;
        const msg = body["hydra:description"] ?? body.message ?? body.detail;
        if (typeof msg === "string") detail = `: ${msg}`;
      } catch {
        // ignore body parse errors
      }
      throw new ProviderError(providerName, `HTTP ${res.status}${detail}`, res.status);
    }
    return (await res.json()) as T;
  }

  /** These APIs return a plain array with Accept: application/json and a hydra
   *  collection with Accept: application/ld+json — normalize both. */
  async function parseCollection<T>(res: Response): Promise<T[]> {
    const data = await parseJson<unknown>(res);
    if (Array.isArray(data)) return data as T[];
    if (data && typeof data === "object") {
      const obj = data as Record<string, unknown>;
      const member = obj["hydra:member"] ?? obj.member;
      if (Array.isArray(member)) return member as T[];
    }
    throw new ProviderError(providerName, "Unexpected collection response shape");
  }

  return {
    name: providerName,
    description: config.description,

    async createInbox(options) {
      const domainsRes = await request("GET", `${base}/domains?page=1`);
      const domains = await parseCollection<MailTmDomain>(domainsRes);
      const domain = domains.find((d) => d.isActive && !d.isPrivate)?.domain;
      if (!domain) {
        throw new ProviderError(providerName, `No active public domain available on ${host}`);
      }

      const address = `${randomUser()}@${domain}`;
      const password = randomPassword();

      const accountRes = await request("POST", `${base}/accounts`, { body: { address, password } });
      const account = await parseJson<{ id: string; address: string }>(accountRes);

      const tokenRes = await request("POST", `${base}/token`, { body: { address, password } });
      const auth = await parseJson<{ token: string; id: string }>(tokenRes);

      const inbox: Inbox = {
        provider: providerName,
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
      if (!inbox.token) throw new ProviderError(providerName, "Inbox is missing its API token");
      const res = await request("GET", `${base}/messages?page=1`, { token: inbox.token });
      const data = await parseCollection<MailTmMessage>(res);
      return data.map(
        (m): MessageSummary => ({
          id: m.id,
          from: m.from?.address ?? "unknown",
          fromName: m.from?.name,
          subject: m.subject ?? "(no subject)",
          intro: m.intro,
          createdAt: m.createdAt,
        })
      );
    },

    async readMessage(inbox, id) {
      if (!inbox.token) throw new ProviderError(providerName, "Inbox is missing its API token");
      const res = await request("GET", `${base}/messages/${encodeURIComponent(id)}`, { token: inbox.token });
      const m = await parseJson<MailTmMessage>(res);
      const html = m.html && m.html.length > 0 ? m.html.join("\n") : undefined;
      const attachments: Attachment[] = (m.attachments ?? []).map((a) => ({
        id: a.id,
        filename: a.filename || "attachment.bin",
        contentType: a.contentType,
        size: a.size,
        contentId: a.disposition === "inline" ? a.id : undefined,
      }));
      const message: Message = {
        id: m.id,
        from: m.from?.address ?? "unknown",
        fromName: m.from?.name,
        subject: m.subject ?? "(no subject)",
        intro: m.intro,
        createdAt: m.createdAt,
        text: m.text,
        html,
        ...(attachments.length > 0 ? { attachments } : {}),
      };
      message.code = extractCode(message.text) ?? extractCode(message.html);
      return message;
    },

    async downloadAttachment(inbox, messageId, attachment) {
      if (!inbox.token) throw new ProviderError(providerName, "Inbox is missing its API token");
      if (!attachment.id) {
        throw new ProviderError(providerName, `Attachment "${attachment.filename}" has no id to download`);
      }
      const url = `${base}/messages/${encodeURIComponent(messageId)}/attachment/${encodeURIComponent(attachment.id)}`;
      const res = await request("GET", url, { token: inbox.token });
      if (!res.ok) {
        throw new ProviderError(
          providerName,
          `HTTP ${res.status} while downloading "${attachment.filename}"`,
          res.status
        );
      }
      return Buffer.from(await res.arrayBuffer());
    },

    async destroyInbox(inbox) {
      if (!inbox.token || !inbox.accountId) return;
      try {
        await request("DELETE", `${base}/accounts/${encodeURIComponent(inbox.accountId)}`, {
          token: inbox.token,
        });
      } catch {
        // best effort: local removal always happens regardless
      }
    },
  };
}

export const mailTm: EmailProvider = createMailTmLikeProvider({
  name: "mailtm",
  base: "https://api.mail.tm",
  host: "api.mail.tm",
  description: "mail.tm — free disposable email, no API key required",
});

export const mailGw: EmailProvider = createMailTmLikeProvider({
  name: "mailgw",
  base: "https://api.mail.gw",
  host: "api.mail.gw",
  description: "mail.gw — mail.tm-compatible API on independent infrastructure",
});
