/**
 * Netease Cloud Music integration.
 * Uses NeteaseCloudMusicApi for crypto/auth handling.
 */
import ncm from 'NeteaseCloudMusicApi';

const { playlist_detail, cloudsearch, song_url_v1, lyric, like } = ncm;

const playlistCache = new Map();
const COOKIE = process.env.NCM_COOKIE || '';

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
    playlist.map(async (track) => {
      const results = await searchSong(track.name, track.artist);
      if (results.length > 0) {
        const best = results[0];
        const url = best.id ? await getSongUrl(best.id) : null;
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
      return {
        name: track.name, artist: track.artist, album: '', cover: '',
        id: null, url: null, neteaseUrl: null,
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
