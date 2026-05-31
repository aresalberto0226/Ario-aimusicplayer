import 'dotenv/config';
import { writeFileSync } from 'fs';
import ncm from 'NeteaseCloudMusicApi';

const { playlist_detail } = ncm;
const COOKIE = process.env.NCM_COOKIE || '';

const res = await playlist_detail({ id: '7282965265', cookie: COOKIE });
const tracks = (res.body?.playlist?.tracks || []).map(t => ({
  id: String(t.id),
  name: t.name,
  artist: (t.ar || []).map(a => a.name).join(', '),
  cover: (t.al || {}).picUrl || ''
}));

writeFileSync('server/playlist-fallback.json', JSON.stringify(tracks, null, 2));
console.error(`Wrote ${tracks.length} tracks to server/playlist-fallback.json`);
