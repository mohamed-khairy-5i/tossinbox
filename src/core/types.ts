export interface Inbox {
  /** Provider identifier, e.g. "mailtm" */
  provider: string;
  /** Full email address of the disposable inbox */
  address: string;
  /** Optional label to help humans and agents identify the inbox */
  label?: string;
  /** Auth token for the provider API (if the provider uses one) */
  token?: string;
  /** Password used to create the account (if the provider uses one) */
  password?: string;
  /** Provider-side account id (if the provider uses one) */
  accountId?: string;
  /** Provider session token (if the provider uses one) */
  session?: string;
  /** ISO timestamp when the inbox was created */
  createdAt: string;
}

export interface MessageSummary {
  id: string;
  from: string;
  fromName?: string;
  subject: string;
  intro?: string;
  createdAt?: string;
}

export interface Message extends MessageSummary {
  text?: string;
  html?: string;
  /** OTP / verification code extracted from the message body, when found */
  code?: string;
}

export interface EmailProvider {
  /** Provider identifier used in CLI flags and state files */
  readonly name: string;
  /** Human readable description */
  readonly description: string;
  /** Create a brand new disposable inbox */
  createInbox(options?: { label?: string }): Promise<Inbox>;
  /** List messages currently in the inbox */
  listMessages(inbox: Inbox): Promise<MessageSummary[]>;
  /** Read a full message by id */
  readMessage(inbox: Inbox, id: string): Promise<Message>;
  /** Best-effort server-side deletion of the inbox. Providers that do not
   *  support deletion may simply resolve. */
  destroyInbox?(inbox: Inbox): Promise<void>;
}

export class ProviderError extends Error {
  readonly status?: number;
  readonly provider: string;

  constructor(provider: string, message: string, status?: number) {
    super(message);
    this.name = "ProviderError";
    this.provider = provider;
    this.status = status;
  }
}
