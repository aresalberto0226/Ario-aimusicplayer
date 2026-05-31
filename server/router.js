import { readFile } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Router } from 'express';
import { chat } from './claude.js';
import { enrichSongs, fetchPlaylistTracks, getSongUrl, getLyric, likeSong } from './ncm.js';
import { getRecentPlays, getState, setPrefs, savePlay } from './state.js';

const router = Router();

/** POST /api/chat — Main chat endpoint */
router.post('/chat', async (req, res) => {
  try {
    const { message, mode, lang } = req.body;
    if (!message || typeof message !== 'string') {
      return res.status(400).json({ error: 'message is required' });
    }

    let result = await chat(message, mode || 'free', lang || 'en');

    // If AI returned no songs, retry once with a stronger prompt
    if (!result.play || result.play.length === 0) {
      console.log('[Ario] No songs in first response, retrying...');
      const retryMsg = `You forgot to include songs in your "play" array. Respond with valid JSON containing at least 3 songs in the "play" field. Original request: "${message}"`;
      result = await chat(retryMsg, mode || 'free', lang || 'en');
    }

    if (result.play && result.play.length > 0) {
      if (mode === 'playlist') {
        const playlists = await safeLoadPlaylists();
        const playlistIds = playlists?.favorites || [];
        let playlistTracks = [];
        for (const id of playlistIds) {
          playlistTracks.push(...(await fetchPlaylistTracks(id)));
        }
        result.play = matchPlaylistTracks(result.play, playlistTracks);
      } else {
        result.play = await enrichSongs(result.play);
      }
      for (const track of result.play) {
        savePlay(track);
      }
    }

    res.json(result);
  } catch (err) {
    console.error('Chat error:', err.message);
    res.status(500).json({
      error: 'Ario is having a moment... try again?',
      say: "Sorry, I got a bit of feedback there. Let me recalibrate — tell me again what you're feeling?",
      play: [],
      reason: '',
      segue: '',
    });
  }
});

/** GET /api/now — Current state */
router.get('/now', (req, res) => {
  const plays = getRecentPlays(1);
  res.json({
    nowPlaying: plays[0] || null,
    recentPlays: getRecentPlays(10),
  });
});

/** GET /api/state — Full state for debugging/hydration */
router.get('/state', (req, res) => {
  res.json(getState());
});

/** POST /api/prefs — Update preferences */
router.post('/prefs', (req, res) => {
  setPrefs(req.body);
  res.json({ ok: true });
});

/** POST /api/playlist/preview — Get playlist track list (for frontend display) */
router.get('/playlist/preview', async (req, res) => {
  try {
    const playlists = await safeLoadPlaylists();
    const playlistIds = playlists?.favorites || [];
    let allTracks = [];
    for (const id of playlistIds) {
      allTracks.push(...(await fetchPlaylistTracks(id)));
    }
    res.json({ count: allTracks.length, tracks: allTracks.slice(0, 50) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/** GET /api/song/url/:id — Get a fresh playable URL */
router.get('/song/url/:id', async (req, res) => {
  try {
    const url = await getSongUrl(req.params.id);
    if (url) {
      res.json({ url });
    } else {
      res.json({ url: null, hint: 'Song may require VIP or login' });
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Audio buffer cache: songId -> { buffer, ts }
const audioCache = new Map();

/** GET /api/song/stream/:id — Proxy audio with Range support for seeking */
router.get('/song/stream/:id', async (req, res) => {
  try {
    const songId = req.params.id;
    const cached = audioCache.get(songId);
    let buffer;

    if (cached && Date.now() - cached.ts < 5 * 60 * 1000) {
      buffer = cached.buffer;
    } else {
      const url = await getSongUrl(songId);
      if (!url) return res.status(404).json({ error: 'No playable URL' });

      const audioRes = await fetch(url, { headers: { 'Referer': 'https://music.163.com/' } });
      if (!audioRes.ok) return res.status(502).json({ error: 'CDN fetch failed' });

      buffer = Buffer.from(await audioRes.arrayBuffer());
      audioCache.set(songId, { buffer, ts: Date.now() });
    }

    const range = req.headers.range;
    if (range) {
      const parts = range.replace(/bytes=/, '').split('-');
      const start = parseInt(parts[0], 10);
      const end = parts[1] ? parseInt(parts[1], 10) : buffer.length - 1;
      const chunk = buffer.slice(start, end + 1);
      res.status(206);
      res.set({
        'Content-Type': 'audio/mpeg',
        'Content-Range': `bytes ${start}-${end}/${buffer.length}`,
        'Content-Length': chunk.length,
        'Accept-Ranges': 'bytes',
        'Cache-Control': 'public, max-age=3600',
      });
      res.send(chunk);
    } else {
      res.set({
        'Content-Type': 'audio/mpeg',
        'Content-Length': buffer.length,
        'Accept-Ranges': 'bytes',
        'Cache-Control': 'public, max-age=3600',
      });
      res.send(buffer);
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/** POST /api/song/like/:id — Like a song on NetEase */
router.post('/song/like/:id', async (req, res) => {
  try {
    const { liked } = req.body;
    const result = await likeSong(req.params.id, liked !== false);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/** GET /api/song/lyric/:id — Get song lyrics */
router.get('/song/lyric/:id', async (req, res) => {
  try {
    const data = await getLyric(req.params.id);
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// --- Helpers ---

async function safeLoadPlaylists() {
  try {
    const raw = await readFile(join((import.meta.dirname || dirname(fileURLToPath(import.meta.url))), '..', 'user', 'playlists.json'), 'utf-8');
    return JSON.parse(raw);
  } catch { return null; }
}

/**
 * Match Claude's text-based picks against real playlist tracks.
 * Uses fuzzy matching on song name.
 */
function matchPlaylistTracks(picks, playlistTracks) {
  return picks.map(pick => {
    const match = playlistTracks.find(t =>
      t.name.toLowerCase().includes(pick.name.toLowerCase()) ||
      pick.name.toLowerCase().includes(t.name.toLowerCase())
    );
    if (match) return match;
    // If no match found, return the pick with empty cover (still from playlist in spirit)
    return { name: pick.name, artist: pick.artist, album: '', cover: '', id: null, url: null, neteaseUrl: null };
  });
}

export default router;
