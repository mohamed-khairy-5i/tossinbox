import type { EmailProvider } from "./types.js";
import { mailTm, mailGw } from "./providers/mailtm.js";
import { guerrillaMail } from "./providers/guerrillamail.js";
import { tempmailLol } from "./providers/tempmaillol.js";
import { tempmailIo } from "./providers/tempmailio.js";
import { tempmailPlus } from "./providers/tempmailplus.js";
import { maildrop } from "./providers/maildrop.js";

export * from "./types.js";
export { extractCode, htmlToText } from "./otp.js";
export * from "./state.js";
export { waitForMessage, sleep } from "./wait.js";
export { createInboxWithFailover, type FailoverOptions, type FailoverResult } from "./failover.js";
export { saveMessageContent, safeSegment, type SavedFile } from "./save.js";

export const providers: Record<string, EmailProvider> = {
  [mailTm.name]: mailTm,
  [mailGw.name]: mailGw,
  [guerrillaMail.name]: guerrillaMail,
  [tempmailLol.name]: tempmailLol,
  [tempmailIo.name]: tempmailIo,
  [tempmailPlus.name]: tempmailPlus,
  [maildrop.name]: maildrop,
};

export const DEFAULT_PROVIDER = mailTm.name;

export function getProvider(name?: string): EmailProvider {
  const key = (name || DEFAULT_PROVIDER).toLowerCase();
  const provider = providers[key];
  if (!provider) {
    const known = Object.values(providers)
      .map((p) => p.name)
      .join(", ");
    throw new Error(`Unknown provider "${name}". Available providers: ${known}`);
  }
  return provider;
}

export function listProviders(): EmailProvider[] {
  return Object.values(providers);
}
