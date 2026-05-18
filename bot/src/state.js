import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { dirname } from 'node:path';

const STATE_FILE = '/app/state/seen.json';

export async function loadSeen() {
  try {
    const raw = await readFile(STATE_FILE, 'utf8');
    const parsed = JSON.parse(raw);
    return new Set(parsed.ids ?? []);
  } catch {
    return new Set();
  }
}

export async function saveSeen(seen) {
  await mkdir(dirname(STATE_FILE), { recursive: true });
  // Cap history so the file does not grow forever.
  const ids = [...seen].slice(-500);
  await writeFile(STATE_FILE, JSON.stringify({ ids }, null, 2));
}
