/**
 * db — localStorage tabanlı basit veri katmanı.
 */
const KEYS = {
  tweets:   'tl_tweets',
  settings: 'tl_settings',
  profiles: 'tl_profiles',
};

export interface TweetEntry {
  id: number;
  text: string;
  topic: string;
  persona: string;
  impressionType?: string;
  score: number;
  scores: Record<string, number>;
  scoreReason: string;
  createdAt: string;
  postedAt?: string;
  engagement: { like: number; reply: number; rt: number; quote: number };
  xSynced?: boolean;
  // Reply arşivi için
  entryType?: 'tweet' | 'reply';
  replyTo?: { author: string; handle: string; tweetId: string; text: string };
  xquikScore?: number; // Grok checklist skoru (0-100)
}

export interface AccountProfile {
  id: string;
  label: string;          // "Ana Hesap", "Kripto Hesabı" vb.
  niche: string;
  defaultPersona: string;
  toneProfile: string;
  twitterUsername: string;
  hasPremium: boolean;
}

export interface Settings {
  xquikKey: string;
  claudeKey: string;
  activeProfileId: string;
  niche: string;
  defaultPersona: string;
  toneProfile: string;
  twitterUsername: string;
  hasPremium: boolean;
  monitoredAccounts: string[];
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
  // ── Tweets ───────────────────────────────────────────────────────────────
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
    set(KEYS.tweets, tweets.map((t) => (t.id === id ? { ...t, ...updates } : t)));
  },

  deleteTweet: (id: number) => {
    set(KEYS.tweets, get<TweetEntry[]>(KEYS.tweets, []).filter((t) => t.id !== id));
  },

  // ── Settings ─────────────────────────────────────────────────────────────
  getSettings: (): Settings => {
    const envKey = (import.meta.env.VITE_CLAUDE_API_KEY as string) || '';
    const envXquik = (import.meta.env.VITE_XQUIK_API_KEY as string) || '';
    const defaults: Settings = {
      xquikKey: envXquik,
      claudeKey: envKey,
      activeProfileId: '',
      niche: '',
      defaultPersona: 'hurricane',
      toneProfile: '',
      twitterUsername: '',
      hasPremium: false,
      monitoredAccounts: ['lemarcaspors_', 'bosunatiklama', 'demarkesports', 'futbolarena'],
    };
    const saved = get<Partial<Settings>>(KEYS.settings, {});
    return { ...defaults, ...saved, claudeKey: saved.claudeKey || envKey, xquikKey: saved.xquikKey || envXquik };
  },

  saveSettings: (s: Partial<Settings>) =>
    set(KEYS.settings, { ...get(KEYS.settings, {}), ...s }),

  // ── Account Profiles ──────────────────────────────────────────────────────
  getProfiles: (): AccountProfile[] => get(KEYS.profiles, []),

  saveProfile: (profile: AccountProfile) => {
    const profiles = get<AccountProfile[]>(KEYS.profiles, []);
    const exists = profiles.findIndex((p) => p.id === profile.id);
    if (exists >= 0) {
      profiles[exists] = profile;
    } else {
      profiles.push(profile);
    }
    set(KEYS.profiles, profiles);
  },

  deleteProfile: (id: string) => {
    set(KEYS.profiles, get<AccountProfile[]>(KEYS.profiles, []).filter((p) => p.id !== id));
  },

  /**
   * Aktif profili döndür.
   * Eğer profil seçilmemişse Settings'teki legacy alanlardan oluşturulmuş
   * varsayılan bir profil döner — geriye dönük uyumluluk için.
   */
  getActiveProfile: (): AccountProfile => {
    const settings = get<Settings>(KEYS.settings, {
      xquikKey: '', claudeKey: '', activeProfileId: '',
      niche: '', defaultPersona: 'hurricane', toneProfile: '', twitterUsername: '', hasPremium: false,
      monitoredAccounts: ['lemarcaspors_', 'bosunatiklama', 'demarkesports', 'futbolarena'],
    });
    const profiles = get<AccountProfile[]>(KEYS.profiles, []);
    const active = profiles.find((p) => p.id === settings.activeProfileId);
    if (active) return active;
    // Fallback: legacy settings
    return {
      id: '__legacy__',
      label: 'Ana Hesap',
      niche: settings.niche,
      defaultPersona: settings.defaultPersona,
      toneProfile: settings.toneProfile,
      twitterUsername: settings.twitterUsername,
      hasPremium: settings.hasPremium,
    };
  },

  // ── Analytics ────────────────────────────────────────────────────────────
  getAnalytics: () => {
    const tweets = get<TweetEntry[]>(KEYS.tweets, []);
    const posted = tweets.filter((t) => t.postedAt);
    const avgScore = tweets.length
      ? tweets.reduce((a, t) => a + t.score, 0) / tweets.length
      : 0;

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
      byType,
    };
  },

  /**
   * Zaman bazlı analiz — en iyi paylaşım saati / günü.
   * Sadece postedAt olan ve engagement verisi bulunan tweetleri kullanır.
   * Döner: { byHour, byDay, bestHour, bestDay, heatmap }
   *
   * heatmap[dayIndex][hour] = { count, totalEng, avgEng }
   * dayIndex: 0=Pazartesi ... 6=Pazar
   */
  getTimeAnalytics: () => {
    const tweets = get<TweetEntry[]>(KEYS.tweets, []);
    const posted = tweets.filter(
      (t) => t.postedAt && (t.engagement.like + t.engagement.reply + t.engagement.rt > 0)
    );

    // byHour: 0-23
    const byHour: { count: number; totalEng: number; avgEng: number }[] =
      Array.from({ length: 24 }, () => ({ count: 0, totalEng: 0, avgEng: 0 }));

    // byDay: 0=Pzt ... 6=Paz
    const byDay: { count: number; totalEng: number; avgEng: number }[] =
      Array.from({ length: 7 }, () => ({ count: 0, totalEng: 0, avgEng: 0 }));

    // heatmap[day][hour]
    const heatmap: { count: number; totalEng: number; avgEng: number }[][] =
      Array.from({ length: 7 }, () =>
        Array.from({ length: 24 }, () => ({ count: 0, totalEng: 0, avgEng: 0 }))
      );

    for (const t of posted) {
      const date = new Date(t.postedAt!);
      // Istanbul saatine çevir (UTC+3)
      const utc = date.getTime() + date.getTimezoneOffset() * 60000;
      const istanbul = new Date(utc + 3 * 3600000);
      const hour = istanbul.getHours();
      // getDay(): 0=Pazar, 1=Pzt..6=Cmt → Monday-first: (day+6)%7
      const day = (istanbul.getDay() + 6) % 7;

      const eng = t.engagement.like + t.engagement.reply * 5 + t.engagement.rt * 2 + t.engagement.quote * 3;

      byHour[hour].count++;
      byHour[hour].totalEng += eng;
      byHour[hour].avgEng = Math.round(byHour[hour].totalEng / byHour[hour].count);

      byDay[day].count++;
      byDay[day].totalEng += eng;
      byDay[day].avgEng = Math.round(byDay[day].totalEng / byDay[day].count);

      heatmap[day][hour].count++;
      heatmap[day][hour].totalEng += eng;
      heatmap[day][hour].avgEng = Math.round(heatmap[day][hour].totalEng / heatmap[day][hour].count);
    }

    const bestHour = byHour.reduce((best, h, i) =>
      h.count > 0 && h.avgEng > (byHour[best]?.avgEng ?? 0) ? i : best, -1);
    const bestDay = byDay.reduce((best, d, i) =>
      d.count > 0 && d.avgEng > (byDay[best]?.avgEng ?? 0) ? i : best, -1);

    return { byHour, byDay, bestHour, bestDay, heatmap, totalPosted: posted.length };
  },
};
