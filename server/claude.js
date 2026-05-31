import { buildMessages, buildPlaylistMessages } from './context.js';
import { saveMessage, getPrefs } from './state.js';

const BASE_URL = process.env.API_BASE_URL || 'https://api.deepseek.com/v1';

function apiKey() {
  return process.env.API_KEY || getPrefs().apiKey;
}

/**
 * Send user message to DeepSeek and get parsed DJ response.
 */
export async function chat(userMessage, mode = 'free', lang = 'en') {
  const builder = mode === 'playlist' ? buildPlaylistMessages : buildMessages;
  const messages = await builder(userMessage, lang);

  // DeepSeek uses OpenAI format: system prompt is a message, not a separate param
  // Sanitize content: strip chars that break DeepSeek's JSON parser
  const sanitize = (s) => (s || '').replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F-\x9F]/g, '');

  const allMessages = messages.map(m => ({
    role: m.role,
    content: sanitize(m.content).slice(0, 8000), // reasonable limit
  }));

  const payload = JSON.stringify({
    model: 'deepseek-chat',
    max_tokens: 2048,
    temperature: 0.9,
    messages: allMessages,
  });

  const res = await fetch(`${BASE_URL}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey()}`,
    },
    body: payload,
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`DeepSeek API error ${res.status}: ${err}`);
  }

  const data = await res.json();
  const text = data?.choices?.[0]?.message?.content || '';

  const parsed = parseDJResponse(text);

  saveMessage({ role: 'user', content: userMessage });
  saveMessage({ role: 'assistant', content: parsed.say });

  return parsed;
}

function parseDJResponse(text) {
  console.log(`[Ario] Raw AI response (${text.length} chars):`, text.slice(0, 300));

  // Try to extract JSON — look for { ... } containing "say" and "play"
  const jsonMatch = text.match(/\{[\s\S]*"say"[\s\S]*"play"[\s\S]*\}/);
  if (jsonMatch) {
    try {
      const parsed = JSON.parse(jsonMatch[0]);
      console.log(`[Ario] Parsed JSON: say=${!!parsed.say}, play=${parsed.play?.length || 0}`);
      if (parsed.play && parsed.play.length > 0) {
        return parsed;
      }
    } catch { /* fall through */ }
  }

  // Try looser: find any {...}
  const looseMatch = text.match(/\{[\s\S]*\}/);
  if (looseMatch) {
    try {
      const parsed = JSON.parse(looseMatch[0]);
      if (parsed.say && parsed.play?.length > 0) {
        return { say: parsed.say, play: parsed.play, reason: parsed.reason || '', segue: parsed.segue || '' };
      }
    } catch { /* fall through */ }
  }

  // Fallback: extract songs from text patterns
  const songs = extractSongs(text);
  const say = text.replace(/\{[\s\S]*\}/, '').trim() || text.trim();

  console.log(`[Ario] Fallback: play=${songs.length} songs extracted`);
  return {
    say: say.slice(0, 500),
    play: songs.slice(0, 5),
    reason: '',
    segue: '',
  };
}

function extractSongs(text) {
  const songs = [];
  // Pattern 1: "Song Name" by Artist or Song Name — Artist
  const p1 = /"([^"]+)"\s*(?:by\s+)?\s*[—–-]\s*(.+?)(?:\n|$|，|。)/gi;
  // Pattern 2: **Song** — Artist or **Song** by Artist
  const p2 = /\*\*([^*]+)\*\*\s*(?:by\s+)?\s*[—–-]\s*(.+?)(?:\n|$|，|。)/gi;
  // Pattern 3: Numbered list: 1. Song — Artist
  const p3 = /\d+[.)]\s*["“]?(.+?)["”]?\s*[—–-]\s*(.+?)(?:\n|$|，)/g;
  // Pattern 4: "name" and "artist" fields in JSON-like fragments
  const p4 = /"name"\s*:\s*"([^"]+)"\s*,\s*"artist"\s*:\s*"([^"]+)"/g;

  for (const pattern of [p1, p2, p3, p4]) {
    let match;
    while ((match = pattern.exec(text)) !== null) {
      const name = match[1].trim();
      const artist = match[2].trim();
      if (name.length > 1 && name.length < 100 &&
          artist.length > 1 && artist.length < 100 &&
          !/^[{}\[\]:,]+$/.test(name) &&
          !/^[{}\[\]:,]+$/.test(artist)) {
        // Deduplicate
        if (!songs.find(s => s.name === name && s.artist === artist)) {
          songs.push({ name, artist });
        }
      }
    }
    if (songs.length >= 3) break;
  }
  return songs;
}
