import { createContext, useContext, useState, useEffect, useCallback } from 'react';

const LANG_KEY = 'ario_language';

const translations = {
  en: {
    // Nav
    'nav.fm': 'Ario FM',
    'nav.radio': 'My Radio',
    'nav.profile': 'Profile',
    'nav.settings': 'Settings',
    // Mood input
    'mood.placeholder': "> What's your mood? _",
    // Player (Ario FM)
    'player.welcome': 'ARIO',
    'player.subtitle': '> PERSONAL_AI_DJ // now spinning',
    'player.prompt': 'Drop your mood, I drop the beat.',
    'player.chill': 'Chill vibes',
    'player.energy': 'Energy boost',
    'player.late': 'Late night',
    'player.feels': 'In my feels',
    'player.loading': '> SPINNING_UP...',
    'player.error': "[ERR] Signal interference... Try again?",
    // MyRadio
    'radio.title': 'MY RADIO',
    'radio.subtitle': 'Random Shuffle Radio',
    'radio.desc': 'Ario picks from your playlist only. Every spin is a surprise — like reaching into a box of your favorite records and pulling out a random gem.',
    'radio.source': 'from your NetEase playlist',
    'radio.start': 'START RADIO',
    'radio.loading': '> Loading your radio...',
    'radio.upNext': 'UP_NEXT',
    'radio.instrumental': 'instrumental',
    'radio.placeholder': '> TELL_ME_YOUR_VIBE...',
    'radio.defaultMsg': 'Recommend 3-5 songs from my playlists. Output JSON format.',
    // Settings
    'settings.title': 'SETTINGS',
    'settings.subtitle': '> Configure your AI DJ',
    'settings.apiKey': '> API_KEY',
    'settings.language': '> LANGUAGE',
    'settings.langEn': 'English',
    'settings.langZh': '中文',
    'settings.voice': '> AI VOICE',
    'settings.voiceHint': 'Select the voice for AI narration',
    'settings.voiceAuto': 'Auto (by language)',
    'settings.about': '> ABOUT ARIO',
    'settings.aboutText': 'Ario is your personal AI DJ — a late-night radio host who knows your taste. Tell Ario your vibe, and he spins the perfect tracks from your playlists or the wider music universe. The name "Ario" blends Ares + audio, and echoes the Italian musical term "aria" — sleek, melodic, and carrying a bit of Alberto in it.',
    'settings.aboutFM': 'Ario FM — Chat freely with Ario. Describe your mood or ask for any genre, and Ario will recommend songs from across all of music. The AI DJ picks tracks based on your vibe, then streams them via NetEase Cloud Music.',
    'settings.aboutRadio': 'My Radio — Pulls tracks exclusively from your NetEase Cloud Music playlists (configured in user/playlists.json). No random internet picks — just the songs you already love, shuffled fresh every time.',
    'settings.aboutProfile': 'Profile — Your music DNA. Tell Ario about your taste (genres, artists, vibes), your daily routines (morning, work, evening), and link your NetEase playlists. Ario uses this to personalize every recommendation.',
    'settings.apiPlaceholder': 'sk-ant-xxxxx',
    'settings.save': '[WRITE] SAVE',
    'settings.saved': '[OK] SAVED',
    'settings.version': '> Ario v1.0 // built with Claude',
    'settings.tagline': '> Always on air_',
    // Profile
    'profile.title': 'PROFILE',
    'profile.subtitle': '> Your music DNA',
    'profile.taste': '> MUSIC_TASTE',
    'profile.routines': '> DAILY_ROUTINES',
    'profile.playlists': '> PLAYLISTS',
    'profile.editHint': 'Edit these files in the user/ folder',
    // NowPlaying / GlobalPlayer
    'now.playing': 'NOW PLAYING',
    'now.playlist': 'in queue',
    // FloatingPlayer
    'float.title': 'NOW PLAYING',
    // Chat bubble
    'chat.reason': 'Why this vibe:',
    'chat.segue': 'Up next:',
    // Generic
    'track.count': 'TRACK',
    'track.of': '/',
    // Immersive
    'immersive.listening': 'Immersive mode — listening to',
  },
  zh: {
    'nav.fm': 'Ario 电台',
    'nav.radio': '我的电台',
    'nav.profile': '个人',
    'nav.settings': '设置',
    'mood.placeholder': '> 今天心情怎么样？_',
    'player.welcome': 'ARIO',
    'player.subtitle': '> 你的专属AI打碟师',
    'player.prompt': '告诉我你的心情，我来打碟。',
    'player.chill': '😌 放松',
    'player.energy': '⚡ 充电',
    'player.late': '🌙 深夜',
    'player.feels': '💔 走心',
    'player.loading': '> 正在为你打碟...',
    'player.error': '[ERR] 信号干乱了... 再试试？',
    'radio.title': '我的电台',
    'radio.subtitle': '随机播放模式',
    'radio.desc': 'Ario 从你的歌单中随机挑选歌曲，每次点击都是一次惊喜——就像从你最爱的唱片盒里抽出一张来听。',
    'radio.source': '来自你的网易云歌单',
    'radio.sourceFile': 'user/playlists.json',
    'radio.start': '开始播放',
    'radio.loading': '> 加载中...',
    'radio.upNext': '即将播放',
    'radio.instrumental': '纯音乐',
    'radio.placeholder': '> 告诉我你想听什么...',
    'radio.defaultMsg': '从我的歌单里推荐3-5首歌。输出JSON格式。',
    'settings.title': '设置',
    'settings.subtitle': '> 配置你的AI打碟师',
    'settings.apiKey': '> API 密钥',
    'settings.language': '> 语言',
    'settings.langEn': 'English',
    'settings.langZh': '中文',
    'settings.voice': '> AI 音色',
    'settings.voiceHint': '选择 AI 旁白的语音音色',
    'settings.voiceAuto': '自动（根据语言）',
    'settings.about': '> 关于 ARIO',
    'settings.aboutText': 'Ario 是你的专属 AI 打碟师——一位深夜电台主持人，了解你的音乐品味。告诉 Ario 你的心情，他会从你的歌单或更广阔的音乐世界中为你挑选最合适的歌曲。名字"Ario"融合了 Ares 与 audio，同时呼应意大利语中的音乐术语"aria"（咏叹调）——优雅、富有旋律感，也承载着 Alberto 的一部分。',
    'settings.aboutFM': 'Ario FM — 与 Ario 自由对话。描述你的心情或指定音乐风格，Ario 会从全网音乐中为你推荐歌曲。AI DJ 根据你的状态挑选曲目，然后通过网易云音乐进行播放。',
    'settings.aboutRadio': 'My Radio — 只从你的网易云音乐歌单中抽取歌曲（在 user/playlists.json 中配置）。不是随机网络推荐——只播放你已经收藏的歌曲，每次随机打乱顺序。',
    'settings.aboutProfile': 'Profile — 你的音乐基因。告诉 Ario 你的音乐品味（风格、艺人、氛围）、日常作息（早、中、晚），以及关联你的网易云歌单。Ario 会根据这些信息为你个性化推荐。',
    'settings.apiPlaceholder': 'sk-ant-xxxxx',
    'settings.save': '[写入] 保存',
    'settings.saved': '[完成] 已保存',
    'settings.version': '> Ario v1.0 // 由 Claude 构建',
    'settings.tagline': '> 永远在线_',
    'profile.title': '个人',
    'profile.subtitle': '> 你的音乐基因',
    'profile.taste': '> 音乐品味',
    'profile.routines': '> 日常作息',
    'profile.playlists': '> 歌单',
    'profile.editHint': '在 user/ 文件夹中编辑这些文件',
    'now.playing': '正在播放',
    'now.playlist': '首歌',
    'float.title': '正在播放',
    'chat.reason': '推荐理由：',
    'chat.segue': '下一首：',
    'track.count': '第',
    'track.of': '/',
    'immersive.listening': '沉浸模式 — 正在聆听',
  },
};

const LanguageContext = createContext({
  lang: 'en',
  setLang: () => {},
  t: (key) => key,
});

export function LanguageProvider({ children }) {
  const [lang, setLangState] = useState(() => {
    try { return localStorage.getItem(LANG_KEY) || 'en'; }
    catch { return 'en'; }
  });

  const setLang = useCallback((l) => {
    setLangState(l);
    localStorage.setItem(LANG_KEY, l);
  }, []);

  const t = useCallback((key) => {
    return translations[lang]?.[key] || translations.en[key] || key;
  }, [lang]);

  // Sync to <html lang> attribute
  useEffect(() => {
    document.documentElement.lang = lang === 'zh' ? 'zh-CN' : 'en';
  }, [lang]);

  return (
    <LanguageContext.Provider value={{ lang, setLang, t }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  return useContext(LanguageContext);
}

export { translations };
