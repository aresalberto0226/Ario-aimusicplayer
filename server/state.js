import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = import.meta.dirname || dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const DATA_DIR = join(ROOT, 'data');
const STATE_FILE = join(DATA_DIR, 'state.json');

// Ensure data directory exists (safe for Vercel read-only filesystem)
try {
  if (!existsSync(DATA_DIR)) {
    mkdirSync(DATA_DIR, { recursive: true });
  }
} catch {
  // Vercel: filesystem is read-only — state persists in memory only
}

function load() {
  try {
    if (existsSync(STATE_FILE)) {
      return JSON.parse(readFileSync(STATE_FILE, 'utf-8'));
    }
  } catch { /* corrupt file, start fresh */ }
  return { messages: [], plays: [], plan: [], prefs: {} };
}

function save(state) {
  try {
    writeFileSync(STATE_FILE, JSON.stringify(state, null, 2), 'utf-8');
  } catch {
    // Vercel filesystem is read-only — state persists in memory for the function's lifetime
  }
}

const state = load();

/** Save a chat message */
export function saveMessage(msg) {
  state.messages.push({
    ...msg,
    ts: new Date().toISOString(),
  });
  // Keep only last 200 messages
  if (state.messages.length > 200) {
    state.messages = state.messages.slice(-200);
  }
  save(state);
}

/** Get recent N messages */
export function getRecentMessages(n = 10) {
  return state.messages.slice(-n);
}

/** Save a play event */
export function savePlay(song) {
  state.plays.push({ ...song, ts: new Date().toISOString() });
  if (state.plays.length > 500) {
    state.plays = state.plays.slice(-500);
  }
  save(state);
}

/** Get recent plays */
export function getRecentPlays(n = 20) {
  return state.plays.slice(-n);
}

/** Get/set preferences */
export function getPrefs() {
  return state.prefs;
}

export function setPrefs(partial) {
  Object.assign(state.prefs, partial);
  save(state);
}

/** Get full state (for API) */
export function getState() {
  return {
    messages: state.messages.slice(-50),
    plays: state.plays.slice(-20),
    prefs: state.prefs,
  };
}
