import { promises as fs } from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import type { Inbox } from "./types.js";

interface StateFile {
  inboxes: Inbox[];
}

export function statePath(): string {
  return process.env.TOSSINBOX_STATE || path.join(os.homedir(), ".tossinbox", "state.json");
}

export async function loadState(): Promise<StateFile> {
  try {
    const raw = await fs.readFile(statePath(), "utf8");
    const parsed = JSON.parse(raw) as Partial<StateFile>;
    return { inboxes: Array.isArray(parsed.inboxes) ? parsed.inboxes : [] };
  } catch {
    return { inboxes: [] };
  }
}

export async function saveInbox(inbox: Inbox): Promise<void> {
  const state = await loadState();
  const filtered = state.inboxes.filter((i) => i.address !== inbox.address);
  filtered.push(inbox);
  await writeState({ inboxes: filtered });
}

export async function removeInbox(address: string): Promise<boolean> {
  const state = await loadState();
  const before = state.inboxes.length;
  const filtered = state.inboxes.filter((i) => i.address !== address);
  await writeState({ inboxes: filtered });
  return filtered.length < before;
}

export async function clearInboxes(): Promise<number> {
  const state = await loadState();
  const count = state.inboxes.length;
  await writeState({ inboxes: [] });
  return count;
}

export async function listSavedInboxes(): Promise<Inbox[]> {
  const state = await loadState();
  return [...state.inboxes].sort((a, b) => (a.createdAt < b.createdAt ? -1 : 1));
}

/** Resolve the inbox to operate on: an explicit address, or the most recent one. */
export async function resolveInbox(address?: string): Promise<Inbox | undefined> {
  const inboxes = await listSavedInboxes();
  if (address) {
    const needle = address.trim().toLowerCase();
    return inboxes.find((i) => i.address.toLowerCase() === needle);
  }
  return inboxes.length > 0 ? inboxes[inboxes.length - 1] : undefined;
}

async function writeState(state: StateFile): Promise<void> {
  const file = statePath();
  // The state file contains provider tokens — keep it private.
  await fs.mkdir(path.dirname(file), { recursive: true, mode: 0o700 });
  await fs.writeFile(file, JSON.stringify(state, null, 2) + "\n", "utf8");
  // writeFile's mode option only applies at creation — enforce on every write.
  await fs.chmod(file, 0o600);
}
