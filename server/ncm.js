/**
 * Netease Cloud Music integration.
 * Uses NeteaseCloudMusicApi for crypto/auth handling + official outer URL as direct playable link.
 */
import ncm from 'NeteaseCloudMusicApi';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import playlistFallbackData from './playlist-fallback.js';

const { playlist_detail, cloudsearch, song_url_v1, lyric, like } = ncm;

const __dirname = import.meta.dirname || dirname(fileURLToPath(import.meta.url));
const playlistCache = new Map();
const COOKIE = process.env.NCM_COOKIE || '';

// ============================================================
// BUILT-IN DEFAULT SONGS — hardcoded NetEase IDs that always work
// These are public, non-VIP songs used as ultimate fallback.
// ============================================================
const BUILTIN_SONGS = [
  { id: '1923385373', name: 'West Coast',         artist: 'OneRepublic',            cover: '' },
  { id: '405564682',  name: 'Better Now',         artist: 'Post Malone',            cover: '' },
  { id: '2624179654', name: 'Two of Us',          artist: 'WIM',                    cover: '' },
  { id: '1860572005', name: 'Counting Stars',     artist: 'OneRepublic',            cover: '' },
  { id: '1376098852', name: 'Something Just Like This', artist: 'The Chainsmokers', cover: '' },
];

// ============================================================
// DIRECT OUTER URL — official NetEase public audio link
// Format: https://music.163.com/song/media/outer/url?id={id}.mp3
// Works without login/cookie for most songs.
// ============================================================
function getDirectUrl(songId) {
  return `https://music.163.com/song/media/outer/url?id=${songId}.mp3`;
}

let _builtinIdx = 0;
function pickBuiltinSong() {
  const s = BUILTIN_SONGS[_builtinIdx % BUILTIN_SONGS.length];
  _builtinIdx++;
  return {
    ...s,
    album: 'Ario Default',
    url: getDirectUrl(s.id),
    neteaseUrl: `https://music.163.com/song?id=${s.id}`,
    _builtin: true,
  };
}

// --- Secondary fallback: generic public MP3s (last resort) ---
let _fallbackCache = null;
function loadFallbackTracks() {
  if (_fallbackCache) return _fallbackCache;
  try {
    const raw = readFileSync(join(__dirname, 'fallback-tracks.json'), 'utf-8');
    _fallbackCache = JSON.parse(raw);
  } catch {
    _fallbackCache = [];
  }
  return _fallbackCache;
}

let _fallbackIdx = 0;
function pickFallbackTrack() {
  const tracks = loadFallbackTracks();
  if (tracks.length === 0) return null;
  const t = tracks[_fallbackIdx % tracks.length];
  _fallbackIdx++;
  return {
    name: t.name,
    artist: t.artist,
    album: 'Ario Fallback',
    cover: t.cover || '',
    id: null,
    url: t.url,
    neteaseUrl: null,
    _fallback: true,
  };
}

// ============================================================
// PUBLIC API
// ============================================================

/**
 * Fetch all tracks from a Netease playlist.
 * Falls back to hardcoded playlist data when API is unreachable (Vercel).
 */
export async function fetchPlaylistTracks(playlistId) {
  const cached = playlistCache.get(playlistId);
  if (cached && Date.now() - cached.ts < 10 * 60 * 1000) {
    return cached.tracks;
  }

  // Attempt 1: NeteaseCloudMusicApi
  try {
    console.log(`🔍 Fetching playlist ${playlistId} via API`);
    const result = await playlist_detail({ id: playlistId, cookie: COOKIE });
    const tracks = (result?.body?.playlist?.tracks || []).map(formatNcmTrack);
    if (tracks.length > 0) {
      playlistCache.set(playlistId, { tracks, ts: Date.now() });
      console.log(`🎵 Loaded ${tracks.length} tracks from playlist ${playlistId}`);
      return tracks;
    }
    console.warn(`API returned 0 tracks for playlist ${playlistId}, trying next source...`);
  } catch (err) {
    console.warn(`API fetch failed for playlist ${playlistId}:`, err.message);
  }

  // Attempt 2: Direct HTTP fetch to public Netease API
  try {
    console.log(`🔍 Fetching playlist ${playlistId} via public API`);
    const res = await fetch(`https://music.163.com/api/v3/playlist/detail?id=${playlistId}`);
    const data = await res.json();
    const tracks = (data?.playlist?.tracks || []).map(t => formatNcmTrack({
      id: t.id,
      name: t.name,
      ar: t.ar,
      al: t.al,
    }));
    if (tracks.length > 0) {
      playlistCache.set(playlistId, { tracks, ts: Date.now() });
      console.log(`🎵 Loaded ${tracks.length} tracks via public API`);
      return tracks;
    }
    console.warn(`Public API returned 0 tracks, trying fallback...`);
  } catch (err) {
    console.warn(`Public API fetch failed:`, err.message);
  }

  // Attempt 3: Load hardcoded playlist fallback
  const fallback = loadPlaylistFallback();
  if (fallback.length > 0) {
    console.log(`🆘 Using hardcoded fallback: ${fallback.length} tracks`);
    return fallback;
  }

  console.warn('⚠️  All playlist sources failed, no tracks available');
  return [];
}

// --- Hardcoded playlist fallback (JS module import, no file I/O on Vercel) ---
function loadPlaylistFallback() {
  if (!playlistFallbackData || playlistFallbackData.length === 0) return [];
  return playlistFallbackData.map(t => ({
    id: t.id,
    name: t.name,
    artist: t.artist,
    album: '',
    cover: t.cover || '',
    url: null,
  }));
}

/**
 * Search for a song.
 */
export async function searchSong(name, artist = '') {
  const query = artist ? `${name} ${artist}` : name;
  try {
    const result = await cloudsearch({ keywords: query, type: 1, limit: 5, cookie: COOKIE });
    const songs = result?.body?.result?.songs || [];
    return songs.map(formatNcmTrack);
  } catch (err) {
    console.warn('NCM search failed:', err.message);
    return [];
  }
}

/**
 * Get a playable audio URL for a song.
 * Uses official NetEase outer URL format — works without login.
 */
export async function getSongUrl(songId) {
  if (!songId) return null;

  // Primary: official outer URL (no login needed)
  const directUrl = getDirectUrl(songId);
  console.log(`🎵 Direct URL for song ${songId}`);

  // Also try the API for a potentially higher-quality URL
  try {
    const result = await song_url_v1({ id: songId, level: 'standard', cookie: COOKIE });
    const apiUrl = result?.body?.data?.[0]?.url;
    if (apiUrl) {
      console.log(`🎵 Got API URL for song ${songId}`);
      return apiUrl;
    }
  } catch { /* fall through to direct URL */ }

  return directUrl;
}

/**
 * Enrich play[] with Netease metadata + playable URLs.
 *
 * Strategy (tried in order):
 * 1. Search NetEase for each track → use direct outer URL for playback
 * 2. If search fails → use built-in default song IDs
 * 3. If built-in exhausted → use generic fallback MP3s
 */
export async function enrichSongs(playlist) {
  if (!playlist || playlist.length === 0) return [];

  const enriched = await Promise.all(
    playlist.map(async (track, idx) => {
      // If track already has a valid ID from playlist matching, use it directly
      if (track.id) {
        console.log(`🎧 Using existing ID for "${track.name}" → ${track.id}`);
        return {
          name: track.name,
          artist: track.artist,
          album: track.album || '',
          cover: track.cover || '',
          id: track.id,
          url: getDirectUrl(track.id),
          neteaseUrl: `https://music.163.com/song?id=${track.id}`,
        };
      }

      // Search NetEase for the song
      const results = await searchSong(track.name, track.artist);
      if (results.length > 0) {
        const best = results[0];
        console.log(`✅ Found on NetEase: "${best.name}" (${best.id})`);
        return {
          name: best.name || track.name,
          artist: best.artist || track.artist,
          album: best.album || '',
          cover: best.cover || '',
          id: best.id || null,
          url: best.id ? getDirectUrl(best.id) : null,
          neteaseUrl: best.id ? `https://music.163.com/song?id=${best.id}` : null,
        };
      }

      // Search failed → use built-in default song IDs
      console.log(`🔀 NetEase search failed for "${track.name}", using built-in default`);
      return pickBuiltinSong();
    })
  );

  // Last resort: if ALL enrichment failed (no tracks at all), return built-in defaults
  if (enriched.length === 0) {
    console.log('🆘 All enrichment failed, returning built-in defaults');
    return BUILTIN_SONGS.map(s => ({
      ...s,
      album: 'Ario Default',
      url: getDirectUrl(s.id),
      neteaseUrl: `https://music.163.com/song?id=${s.id}`,
      _builtin: true,
    }));
  }

  return enriched;
}

/** Get lyrics for a song */
export async function getLyric(songId) {
  try {
    const result = await lyric({ id: songId, cookie: COOKIE });
    const lrc = result?.body?.lrc?.lyric || '';
    const tlyric = result?.body?.tlyric?.lyric || ''; // translated
    return { lrc, tlyric };
  } catch {
    return { lrc: '', tlyric: '' };
  }
}

/** Like or unlike a song on NetEase */
export async function likeSong(songId, liked = true) {
  try {
    const result = await like({ id: songId, like: liked, cookie: COOKIE });
    const code = result?.body?.code;
    if (code === 200) {
      console.log(`❤️  ${liked ? 'Liked' : 'Unliked'} song ${songId}`);
      return { ok: true, liked };
    }
    console.warn(`Like failed for ${songId}: code ${code}`);
    return { ok: false, error: `Code ${code}` };
  } catch (err) {
    console.warn('Like API error:', err.message);
    return { ok: false, error: err.message };
  }
}

function formatNcmTrack(song) {
  return {
    id: String(song.id || ''),
    name: song.name || '',
    artist: (song.ar || song.artists || []).map(a => a.name).join(', '),
    album: (song.al || song.album || {}).name || '',
    cover: (song.al || song.album || {}).picUrl || '',
    url: null,
  };
}
