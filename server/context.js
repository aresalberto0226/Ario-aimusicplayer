import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { getRecentMessages } from './state.js';
import { fetchPlaylistTracks } from './ncm.js';

const ROOT = join(import.meta.dirname, '..');

/**
 * Assemble the full system prompt for Claude.
 * Combines: DJ persona + user taste + routines + recent context
 */
function langInstruction(lang) {
  if (lang === 'zh') {
    return '\n## LANGUAGE RULE\nYou MUST respond entirely in Chinese. All fields (say, reason, segue) must be in Chinese. Use natural, conversational Chinese.';
  }
  return '\n## LANGUAGE RULE\nYou MUST respond entirely in English. All fields (say, reason, segue) must be in English. Use natural, conversational English.';
}

export async function buildSystemPrompt(lang = 'en') {
  const persona = await readUserFile('server/prompts/dj-persona.md');
  const taste = await readUserFile('user/taste.md');
  const routines = await readUserFile('user/routines.md');
  const playlists = await safeReadJson('user/playlists.json');

  const recent = getRecentMessages(10);
  const historyBlock = recent.length > 0
    ? `\n## Recent Conversation\n${recent.map(m => `- [${m.role}]: ${m.content?.slice(0, 200)}`).join('\n')}`
    : '';

  return [
    persona,
    '---',
    '## User Music Taste',
    taste || '(No taste profile yet — ask the user about their taste!)',
    '---',
    '## User Daily Routines',
    routines || '(No routines set)',
    '---',
    '## User Playlists',
    playlists ? JSON.stringify(playlists, null, 2) : '{}',
    historyBlock,
    '---',
    langInstruction(lang),
    'Now, be Ario. Respond to the user with warmth and great music picks.',
  ].join('\n');
}

/**
 * Build the messages array for Claude API:
 * system prompt + recent conversation history + latest user message
 */
export async function buildMessages(userMessage, lang = 'en') {
  const systemPrompt = await buildSystemPrompt(lang);
  const recent = getRecentMessages(8);

  const messages = [
    { role: 'system', content: systemPrompt },
    ...recent.map(m => ({ role: m.role, content: m.content })),
    { role: 'user', content: userMessage },
  ];

  return messages;
}

async function readUserFile(relativePath) {
  try {
    const content = await readFile(join(ROOT, relativePath), 'utf-8');
    return content.trim();
  } catch {
    return null;
  }
}

async function safeReadJson(relativePath) {
  try {
    const raw = await readFile(join(ROOT, relativePath), 'utf-8');
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

/**
 * Build system prompt for playlist-only mode.
 * Fetches the user's playlist tracks and instructs Claude to ONLY pick from them.
 */
export async function buildPlaylistPrompt(lang = 'en') {
  const persona = await readUserFile('server/prompts/dj-persona.md');
  const playlists = await safeReadJson('user/playlists.json');
  const playlistIds = playlists?.favorites || [];

  // Fetch all tracks from user's playlists
  let allTracks = [];
  for (const id of playlistIds) {
    const tracks = await fetchPlaylistTracks(id);
    allTracks.push(...tracks);
  }

  // Shuffle and limit to prevent prompt overload
  const shuffled = allTracks.sort(() => Math.random() - 0.5);
  const selected = shuffled.slice(0, 150);

  const trackList = selected.length > 0
    ? selected.map((t, i) => `${i + 1}. ${t.name} — ${t.artist}`).join('\n')
    : '(Unable to load playlist — please check your playlist ID in user/playlists.json)';

  console.log(`📝 Playlist prompt: ${selected.length} tracks selected from ${allTracks.length} total`);

  return [
    persona,
    '---',
    '## ⚠️ PLAYLIST-ONLY MODE — CRITICAL RULES',
    '1. You MUST ONLY recommend songs that appear in the playlist below. Copy song name + artist EXACTLY.',
    '2. You MUST respond in JSON format: {"say":"...", "play":[{"name":"Song","artist":"Artist"}], "reason":"...", "segue":"..."}',
    '3. The "play" array MUST contain 1-3 songs from this playlist — do NOT leave it empty.',
    `4. The full playlist has ${allTracks.length} tracks. Below is a random selection of ${selected.length} for reference.`,
    '',
    `## Playlist Tracks (${selected.length} of ${allTracks.length}):`,
    trackList,
    '---',
    langInstruction(lang),
    'Be Ario. Respond as JSON with songs ONLY from this playlist.',
  ].join('\n');
}

/**
 * Build messages for playlist-only mode.
 */
export async function buildPlaylistMessages(userMessage, lang = 'en') {
  const systemPrompt = await buildPlaylistPrompt(lang);
  const recent = getRecentMessages(8);

  return [
    { role: 'system', content: systemPrompt },
    ...recent.map(m => ({ role: m.role, content: m.content })),
    { role: 'user', content: userMessage },
  ];
}
