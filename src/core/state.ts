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
  let raw: string;
  try {
    raw = await fs.readFile(statePath(), "utf8");
  } catch (err) {
    // Only a missing file means "no state yet" — anything else must be loud,
    // otherwise the next write would silently destroy saved inboxes.
    const code = (err as NodeJS.ErrnoException).code;
    if (code === "ENOENT") return { inboxes: [] };
    throw new Error(
      `Cannot read state file ${statePath()} (${(err as Error).message}). ` +
        "Fix its permissions or point TOSSINBOX_STATE at a writable path."
    );
  }
  try {
    const parsed = JSON.parse(raw) as Partial<StateFile>;
    return { inboxes: Array.isArray(parsed.inboxes) ? parsed.inboxes : [] };
  } catch {
    throw new Error(
      `State file ${statePath()} is not valid JSON. ` +
        "Refusing to overwrite it — fix or delete the file manually (it may contain inboxes you still need)."
    );
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
  const dir = path.dirname(file);
  // The state file contains provider tokens — keep it private.
  await fs.mkdir(dir, { recursive: true, mode: 0o700 });

  // Atomic save: write a sibling temp file, fsync it, then rename it over the
  // real one. A crash mid-write can no longer truncate state.json and destroy
  // saved inboxes — readers always see either the old file or the new one.
  const tmp = path.join(dir, `.${path.basename(file)}.${process.pid}.${Date.now()}.tmp`);
  const handle = await fs.open(tmp, "w", 0o600);
  try {
    await handle.writeFile(JSON.stringify(state, null, 2) + "\n", "utf8");
    // open()'s mode is filtered by umask — enforce 0600 before the rename.
    await handle.chmod(0o600);
    await handle.sync(); // flush to disk before it becomes the real file
  } finally {
    await handle.close();
  }
  try {
    await fs.rename(tmp, file); // atomic on POSIX; replaces the target on Windows too
  } catch (err) {
    await fs.rm(tmp, { force: true }).catch(() => {});
    throw err;
  }
}
