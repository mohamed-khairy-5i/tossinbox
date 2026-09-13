import * as fs from "node:fs";
import * as path from "node:path";
import type { EmailProvider, Message } from "./types.js";

export interface SavedFile {
  /** What was saved: an attachment, or the message body */
  kind: "attachment" | "body.html" | "body.txt";
  /** Original file name (attachments) or body.html / body.txt */
  filename: string;
  /** Absolute path the file was written to */
  path: string;
  /** Size in bytes */
  size: number;
}

/** Filesystem-safe single path segment: strips separators, traversal and
 *  control characters, collapses blanks. */
export function safeSegment(name: string, fallback: string): string {
  const cleaned = name
    .replace(/[^A-Za-z0-9._ ()\[\]-]/g, "_")
    .replace(/\.{2,}/g, "_")
    .replace(/^_+|_+$/g, "")
    .trim();
  return cleaned.length > 0 && cleaned !== "." && cleaned !== ".." ? cleaned.slice(0, 120) : fallback;
}

/** Save everything a message carries to disk: every attachment (when the
 *  provider supports downloads) plus body.html / body.txt when present.
 *  Files land in `<dir>/<message-id>/`. Shared by the CLI and the MCP server. */
export async function saveMessageContent(
  provider: EmailProvider,
  inbox: Parameters<EmailProvider["readMessage"]>[0],
  message: Message,
  dir: string
): Promise<SavedFile[]> {
  const messageDir = path.join(path.resolve(dir), safeSegment(message.id, "message"));
  fs.mkdirSync(messageDir, { recursive: true });

  const saved: SavedFile[] = [];

  for (const attachment of message.attachments ?? []) {
    if (typeof provider.downloadAttachment !== "function") {
      throw new Error(
        `provider "${provider.name}" does not support attachment downloads — try another provider`
      );
    }
    const bytes = await provider.downloadAttachment(inbox, message.id, attachment);
    const filename = safeSegment(attachment.filename, "attachment.bin");
    const target = path.join(messageDir, filename);
    fs.writeFileSync(target, bytes);
    saved.push({ kind: "attachment", filename, path: target, size: bytes.length });
  }

  if (message.html !== undefined) {
    const target = path.join(messageDir, "body.html");
    fs.writeFileSync(target, message.html, "utf8");
    saved.push({ kind: "body.html", filename: "body.html", path: target, size: Buffer.byteLength(message.html) });
  }
  if (message.text !== undefined) {
    const target = path.join(messageDir, "body.txt");
    fs.writeFileSync(target, message.text, "utf8");
    saved.push({ kind: "body.txt", filename: "body.txt", path: target, size: Buffer.byteLength(message.text) });
  }

  return saved;
}
