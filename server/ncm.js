/**
 * Netease Cloud Music integration.
 * Uses NeteaseCloudMusicApi for crypto/auth handling.
 */
import ncm from 'NeteaseCloudMusicApi';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const { playlist_detail, cloudsearch, song_url_v1, lyric, like } = ncm;

const __dirname = import.meta.dirname || dirname(fileURLToPath(import.meta.url));
const playlistCache = new Map();
const COOKIE = process.env.NCM_COOKIE || '';

// --- Fallback audio: public royalty-free MP3s when NetEase is unreachable ---
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

/**
 * Get a fallback track URL (round-robin through the fallback list).
 */
let _fallbackIdx = 0;
function getFallbackUrl() {
  const tracks = loadFallbackTracks();
  if (tracks.length === 0) return null;
  const url = tracks[_fallbackIdx % tracks.length].url;
  _fallbackIdx++;
  return url;
}

function getFallbackTrackForIndex(idx) {
  const tracks = loadFallbackTracks();
  if (tracks.length === 0) return null;
  const t = tracks[idx % tracks.length];
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

/**
 * Fetch all tracks from a Netease playlist.
 */
export async function fetchPlaylistTracks(playlistId) {
  const cached = playlistCache.get(playlistId);
  if (cached && Date.now() - cached.ts < 10 * 60 * 1000) {
    return cached.tracks;
  }

  try {
    console.log(`🔍 Fetching playlist ${playlistId}`);
    const result = await playlist_detail({ id: playlistId, cookie: COOKIE });
    const tracks = (result?.body?.playlist?.tracks || []).map(formatNcmTrack);

    if (tracks.length > 0) {
      playlistCache.set(playlistId, { tracks, ts: Date.now() });
    }

    console.log(`🎵 Loaded ${tracks.length} tracks from playlist ${playlistId}`);
    return tracks;
  } catch (err) {
    console.warn('Failed to fetch playlist:', err.message);
    return [];
  }
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
 * Try to get a playable song URL.
 * Returns null if song requires VIP or no cookie.
 */
export async function getSongUrl(songId) {
  try {
    const result = await song_url_v1({ id: songId, level: 'standard', cookie: COOKIE });
    const url = result?.body?.data?.[0]?.url;
    if (url) {
      console.log(`🎵 Got playable URL for song ${songId}`);
      return url;
    }
  } catch { /* not playable */ }
  return null;
}

/**
 * Enrich play[] with Netease metadata + URLs.
 */
export async function enrichSongs(playlist) {
  if (!playlist || playlist.length === 0) return [];

  const enriched = await Promise.all(
    playlist.map(async (track, idx) => {
      const results = await searchSong(track.name, track.artist);
      if (results.length > 0) {
        const best = results[0];
        const url = best.id ? await getSongUrl(best.id) : null;
        if (url) {
          return {
            name: best.name || track.name,
            artist: best.artist || track.artist,
            album: best.album || '',
            cover: best.cover || '',
            id: best.id || null,
            url: url,
            neteaseUrl: best.id ? `https://music.163.com/song?id=${best.id}` : null,
          };
        }
        // Found on NetEase but URL not playable → use fallback audio
        console.log(`⚠️  No playable URL for "${track.name}", using fallback audio`);
        return {
          name: best.name || track.name,
          artist: best.artist || track.artist,
          album: best.album || '',
          cover: best.cover || '',
          id: best.id || null,
          url: getFallbackUrl(),
          neteaseUrl: best.id ? `https://music.163.com/song?id=${best.id}` : null,
          _fallback: true,
        };
      }
      // Not found on Netease → use fallback entirely
      console.log(`⚠️  NetEase search failed for "${track.name}", using fallback track`);
      return getFallbackTrackForIndex(idx) || {
        name: track.name, artist: track.artist, album: '', cover: '',
        id: null, url: getFallbackUrl(), neteaseUrl: null, _fallback: true,
      };
    })
  );

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
