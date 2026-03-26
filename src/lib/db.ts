/**
 * db — localStorage tabanlı basit veri katmanı.
 *
 * Neden localStorage?
 *   - Sunucu yok, kurulum yok, hız yok — saf client-side uygulama
 *   - Tweet geçmişi + settings tarayıcıda kalır, paylaşılmaz
 *   - Limit: ~5MB (tweet metinleri küçük, binlerce tweet sığar)
 *
 * Tweet engagement puanları (like/reply/rt/quote) manuel girilir (History sayfası).
 * İleride xquik getUserTweets ile otomatik doldurulacak (feedback loop).
 */
const KEYS = {
  tweets: 'tl_tweets',
  settings: 'tl_settings',
};

export interface TweetEntry {
  id: number;
  text: string;
  topic: string;
  persona: string;
  impressionType?: string; // Data / Story / Hot Take / Edu / Inspire / Humor
  score: number;
  scores: Record<string, number>;
  scoreReason: string;
  createdAt: string;
  postedAt?: string;
  engagement: { like: number; reply: number; rt: number; quote: number };
  xSynced?: boolean; // true = engagement X'ten çekildi, manuel değil
}

export interface Settings {
  xquikKey: string;
  claudeKey: string;
  niche: string;
  defaultPersona: string;
  toneProfile: string;
  twitterUsername: string; // feedback loop: from:kullanici son tweetleri çekmek için
  hasPremium: boolean;     // false = link tweet içine yazma, thread öncelikli
}

const get = <T>(key: string, fallback: T): T => {
  try {
    return JSON.parse(localStorage.getItem(key) ?? 'null') ?? fallback;
  } catch {
    return fallback;
  }
};

const set = (key: string, val: unknown) =>
  localStorage.setItem(key, JSON.stringify(val));

export const db = {
  getTweets: (): TweetEntry[] => get(KEYS.tweets, []),

  saveTweet: (tweet: Omit<TweetEntry, 'id' | 'createdAt'>): TweetEntry => {
    const tweets = get<TweetEntry[]>(KEYS.tweets, []);
    const entry: TweetEntry = {
      ...tweet,
      id: Date.now(),
      createdAt: new Date().toISOString(),
    };
    set(KEYS.tweets, [entry, ...tweets]);
    return entry;
  },

  updateTweet: (id: number, updates: Partial<TweetEntry>) => {
    const tweets = get<TweetEntry[]>(KEYS.tweets, []);
    set(
      KEYS.tweets,
      tweets.map((t) => (t.id === id ? { ...t, ...updates } : t))
    );
  },

  deleteTweet: (id: number) => {
    set(
      KEYS.tweets,
      get<TweetEntry[]>(KEYS.tweets, []).filter((t) => t.id !== id)
    );
  },

  getSettings: (): Settings =>
    get(KEYS.settings, {
      xquikKey: '',
      claudeKey: '',
      niche: '',
      defaultPersona: 'hurricane',
      toneProfile: '',
      twitterUsername: '',
      hasPremium: false,
    }),

  saveSettings: (s: Partial<Settings>) =>
    set(KEYS.settings, { ...get(KEYS.settings, {}), ...s }),

  getAnalytics: () => {
    const tweets = get<TweetEntry[]>(KEYS.tweets, []);
    const posted = tweets.filter((t) => t.postedAt);
    const avgScore = tweets.length
      ? tweets.reduce((a, t) => a + t.score, 0) / tweets.length
      : 0;

    // Tip bazında analiz: hangi içerik tipi ne kadar engagement alıyor?
    // Engagement skoru = like + reply×5 + rt×2 + quote×3 (Grok ağırlıklarına göre)
    const byType: Record<string, { count: number; totalEng: number; avgEng: number }> = {};
    for (const t of tweets) {
      const type = t.impressionType || 'Diğer';
      const eng = t.engagement.like + t.engagement.reply * 5 + t.engagement.rt * 2 + t.engagement.quote * 3;
      if (!byType[type]) byType[type] = { count: 0, totalEng: 0, avgEng: 0 };
      byType[type].count++;
      byType[type].totalEng += eng;
      byType[type].avgEng = Math.round(byType[type].totalEng / byType[type].count);
    }

    return {
      total: tweets.length,
      posted: posted.length,
      avgScore: Math.round(avgScore),
      byType, // { 'Data': { count: 3, avgEng: 42 }, 'Hot Take': { ... } }
    };
  },
};
