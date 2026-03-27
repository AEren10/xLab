/**
 * xquik API wrapper
 *
 * Endpoint özeti (subscription: 20$/ay, zaten alındı):
 *   getRadar       → /radar          — ÜCRETSIZ  — güncel trend başlıkları
 *   saveDraft      → /drafts         — ÜCRETSIZ  — tweet draft'ı xquik'e kaydet
 *   getAlgoData    → /compose        — ÜCRETSIZ  — xAI GitHub'dan Grok algo verisi
 *   scoreTweet     → /compose        — ÜCRETSIZ  — tweet'e xquik skoru al
 *   searchTweets   → /x/tweets/search — SUBSCRIPTION — nişe göre viral tweet ara
 *   getUserTweets  → /x/tweets/search — SUBSCRIPTION — kendi hesabının son tweetleri
 *
 * Tüm çağrılar try/catch ile sarılı — hata olursa boş döner, uygulama çökmez.
 * Response mapping: xquik API farklı field isimleri dönebileceği için
 * (tweets vs items, likes vs favoriteCount vb.) birden fazla alternatif kontrol edilir.
 */
const BASE = 'https://xquik.com/api/v1';

const headers = (apiKey: string) => ({
  'Content-Type': 'application/json',
  'x-api-key': apiKey,
});

// ─── Mevcut ─────────────────────────────────────────────────────────────────

export interface RadarItem {
  id?: string;
  title: string;
  volume?: number;
  category?: string;
  trend?: string;
}

// ─── Compose / Grok canlı veri ──────────────────────────────────────────────

/**
 * xquik /compose endpoint'i — xAI Grok kaynaklı canlı algorithm verisi döndürür.
 * Bu veri statik skill.ts kurallarının yerine geçer; her prompt öncesi çekilir.
 */
export interface ComposeAlgoData {
  contentRules?: string[];
  engagementSignals?: Record<string, number>;
  algoSummary?: string;
  rawText?: string; // Endpoint düz metin dönerse bunu kullanırız
}

// ─── Tweet arama (Reply Fırsatları için) ─────────────────────────────────────

export interface TweetSearchResult {
  id: string;
  text: string;
  author: string;
  authorHandle: string;
  likes: number;
  replies: number;
  retweets: number;
  views?: number;
  createdAt: string;
  url: string;
}

// ─── Kullanıcı tweet'leri (Feedback loop için) ───────────────────────────────

export interface UserTweet {
  id: string;
  text: string;
  likes: number;
  replies: number;
  retweets: number;
  views?: number;
  createdAt: string;
}

// ─── Trends ──────────────────────────────────────────────────────────────────

export interface TrendItem {
  name: string;
  rank?: number;
  description?: string;
  query?: string;
}

// ─── User Profile ─────────────────────────────────────────────────────────────

export interface UserProfile {
  id: string;
  username: string;
  name: string;
  followers?: number;
  following?: number;
  verified?: boolean;
  description?: string;
  profileImageUrl?: string;
}

// ─── Monitor ─────────────────────────────────────────────────────────────────

export interface Monitor {
  id: string;
  xUsername: string;
  eventTypes: string[];
  isActive: boolean;
  createdAt: string;
}

// ─── Style Performance ───────────────────────────────────────────────────────

export interface StylePerformanceTweet {
  id: string;
  text: string;
  likeCount: number;
  retweetCount: number;
  replyCount: number;
  viewCount?: number;
  bookmarkCount?: number;
  createdAt?: string;
}

export interface StylePerformance {
  xUsername: string;
  tweetCount: number;
  tweets: StylePerformanceTweet[];
}

// ─── Score sonucu ────────────────────────────────────────────────────────────

export interface ChecklistItem {
  factor: string;
  passed: boolean;
  suggestion?: string; // sadece passed:false olanlar için
}

export interface XquikScore {
  total: number;       // passedCount/totalChecks * 100 olarak hesaplanır
  passed: boolean;     // tüm check'ler geçti mi?
  passedCount: number;
  totalChecks: number;
  checklist: ChecklistItem[];
  topSuggestion?: string;
  reason?: string;
}

// ─── API ─────────────────────────────────────────────────────────────────────

export const xquikApi = {
  // ── Radar (mevcut) ──────────────────────────────────────────────────────────
  async getRadar(apiKey: string, limit = 8): Promise<RadarItem[]> {
    if (!apiKey) return [];
    try {
      const res = await fetch(`${BASE}/radar?limit=${limit}`, {
        headers: headers(apiKey),
      });
      if (!res.ok) return [];
      const data = await res.json();
      return data.items || [];
    } catch {
      return [];
    }
  },

  // ── Draft kaydet (mevcut) ────────────────────────────────────────────────────
  async saveDraft(apiKey: string, text: string, topic: string): Promise<void> {
    if (!apiKey) return;
    try {
      await fetch(`${BASE}/drafts`, {
        method: 'POST',
        headers: headers(apiKey),
        body: JSON.stringify({ text, topic, goal: 'engagement' }),
      });
    } catch {}
  },

  // ── Compose — Grok canlı algorithm verisi ────────────────────────────────────
  // xquik /compose, Grok'un güncel engagement ağırlıklarını ve içerik kurallarını
  // döndürüyor. Bu veri contextBuilder'da statik ALGORITHM_RULES'un önüne geçiyor.
  async getAlgoData(apiKey: string, topic: string): Promise<ComposeAlgoData | null> {
    if (!apiKey) return null;
    try {
      const res = await fetch(`${BASE}/compose`, {
        method: 'POST',
        headers: headers(apiKey),
        body: JSON.stringify({ topic, step: 'compose', goal: 'engagement' }),
      });
      if (!res.ok) return null;
      const data = await res.json();
      return {
        contentRules: data.contentRules || [],
        engagementSignals: data.engagementSignals || {},
        algoSummary: data.algoSummary || '',
        rawText: data.rawText || '',
      };
    } catch {
      return null;
    }
  },

  // ── Score — tweet'i xquik'e gönder, Grok checklist al ───────────────────────
  // Yanıt: { checklist, passed, passedCount, totalChecks, topSuggestion }
  // Grok'un hangi kuralları geçip geçmediğini listeler (hashtag yok, CTA var vb.)
  async scoreTweet(apiKey: string, text: string): Promise<XquikScore | null> {
    if (!apiKey) return null;
    try {
      const res = await fetch(`${BASE}/compose`, {
        method: 'POST',
        headers: headers(apiKey),
        body: JSON.stringify({ draft: text, step: 'score' }),
      });
      if (!res.ok) return null;
      const data = await res.json();
      const passedCount = data.passedCount ?? 0;
      const totalChecks = data.totalChecks ?? 1;
      return {
        total: Math.round((passedCount / totalChecks) * 100),
        passed: data.passed ?? false,
        passedCount,
        totalChecks,
        checklist: data.checklist || [],
        topSuggestion: data.topSuggestion || '',
        reason: data.topSuggestion || '',
      };
    } catch {
      return null;
    }
  },

  // ── Tweet ara — Reply Fırsatları sekmesi için ─────────────────────────────────
  // minFaves + lang + hours filtresiyle niş'e göre viral tweet'leri bulur.
  // Bu tweet'lere reply atmak = juice transfer (TODO Item 3).
  async searchTweets(
    apiKey: string,
    query: string,
    options: {
      minFaves?: number;
      minReplies?: number;
      lang?: string;
      hours?: number;
      limit?: number;
    } = {}
  ): Promise<TweetSearchResult[]> {
    if (!apiKey) return [];
    try {
      const { minFaves = 50, minReplies = 5, lang = 'tr', hours = 2, limit = 10 } = options;
      const res = await fetch(`${BASE}/x/tweets/search`, {
        method: 'POST',
        headers: headers(apiKey),
        body: JSON.stringify({ query, minFaves, minReplies, lang, hours, limit }),
      });
      if (!res.ok) return [];
      const data = await res.json();
      return (data.tweets || data.items || []).map((t: any) => ({
        id: t.id || t.tweetId || '',
        text: t.text || t.content || '',
        author: t.author?.name || t.authorName || '',
        authorHandle: t.author?.handle || t.authorHandle || '',
        likes: t.likes || t.favoriteCount || 0,
        replies: t.replies || t.replyCount || 0,
        retweets: t.retweets || t.retweetCount || 0,
        views: t.views || t.viewCount,
        createdAt: t.createdAt || t.created_at || '',
        url: t.url || `https://x.com/i/web/status/${t.id || t.tweetId}`,
      }));
    } catch {
      return [];
    }
  },

  // ── Trending Topics ──────────────────────────────────────────────────────────
  async getTrends(apiKey: string, count = 20): Promise<TrendItem[]> {
    if (!apiKey) return [];
    try {
      const res = await fetch(`${BASE}/x/trends?count=${count}`, {
        headers: headers(apiKey),
      });
      if (!res.ok) return [];
      const data = await res.json();
      return (data.trends || []).map((t: any) => ({
        name: t.name || '',
        rank: t.rank,
        description: t.description,
        query: t.query,
      }));
    } catch {
      return [];
    }
  },

  // ── User Profile ──────────────────────────────────────────────────────────────
  async getUserProfile(apiKey: string, username: string): Promise<UserProfile | null> {
    if (!apiKey || !username) return null;
    try {
      const clean = username.replace(/^@/, '');
      const res = await fetch(`${BASE}/x/users/${clean}`, {
        headers: headers(apiKey),
      });
      if (!res.ok) return null;
      const d = await res.json();
      return {
        id: d.id || '',
        username: d.username || clean,
        name: d.name || '',
        followers: d.followers ?? d.followersCount,
        following: d.following ?? d.followingCount,
        verified: d.verified,
        description: d.description,
        profileImageUrl: d.profileImageUrl,
      };
    } catch {
      return null;
    }
  },

  // ── Home Timeline ─────────────────────────────────────────────────────────────
  async getTimeline(apiKey: string, cursor?: string): Promise<TweetSearchResult[]> {
    if (!apiKey) return [];
    try {
      const url = cursor
        ? `${BASE}/x/timeline?cursor=${encodeURIComponent(cursor)}`
        : `${BASE}/x/timeline`;
      const res = await fetch(url, { headers: headers(apiKey) });
      if (!res.ok) return [];
      const data = await res.json();
      return (data.tweets || []).map((t: any) => ({
        id: t.id || '',
        text: t.text || '',
        author: t.author?.name || t.authorName || '',
        authorHandle: t.author?.username || t.author?.handle || '',
        likes: t.likeCount || t.likes || 0,
        replies: t.replyCount || t.replies || 0,
        retweets: t.retweetCount || t.retweets || 0,
        views: t.viewCount || t.views,
        createdAt: t.createdAt || '',
        url: t.url || `https://x.com/i/web/status/${t.id}`,
      }));
    } catch {
      return [];
    }
  },

  // ── Style Performance ─────────────────────────────────────────────────────────
  async getStylePerformance(apiKey: string, username: string): Promise<StylePerformance | null> {
    if (!apiKey || !username) return null;
    try {
      const clean = username.replace(/^@/, '');
      const res = await fetch(`${BASE}/styles/${clean}/performance`, {
        headers: headers(apiKey),
      });
      if (!res.ok) return null;
      const data = await res.json();
      return {
        xUsername: data.xUsername || clean,
        tweetCount: data.tweetCount || 0,
        tweets: (data.tweets || []).map((t: any) => ({
          id: t.id || '',
          text: t.text || '',
          likeCount: t.likeCount || t.likes || 0,
          retweetCount: t.retweetCount || t.retweets || 0,
          replyCount: t.replyCount || t.replies || 0,
          viewCount: t.viewCount || t.views,
          bookmarkCount: t.bookmarkCount,
          createdAt: t.createdAt,
        })),
      };
    } catch {
      return null;
    }
  },

  // ── Monitors ──────────────────────────────────────────────────────────────────
  async getMonitors(apiKey: string): Promise<Monitor[]> {
    if (!apiKey) return [];
    try {
      const res = await fetch(`${BASE}/monitors`, { headers: headers(apiKey) });
      if (!res.ok) return [];
      const data = await res.json();
      return (data.monitors || []).map((m: any) => ({
        id: m.id || '',
        xUsername: m.xUsername || m.username || '',
        eventTypes: m.eventTypes || [],
        isActive: m.isActive ?? true,
        createdAt: m.createdAt || '',
      }));
    } catch {
      return [];
    }
  },

  async createMonitor(apiKey: string, username: string, eventTypes: string[]): Promise<Monitor | null> {
    if (!apiKey || !username) return null;
    try {
      const res = await fetch(`${BASE}/monitors`, {
        method: 'POST',
        headers: headers(apiKey),
        body: JSON.stringify({ username: username.replace(/^@/, ''), eventTypes }),
      });
      if (!res.ok) return null;
      const m = await res.json();
      return {
        id: m.id || '',
        xUsername: m.xUsername || m.username || username,
        eventTypes: m.eventTypes || eventTypes,
        isActive: m.isActive ?? true,
        createdAt: m.createdAt || new Date().toISOString(),
      };
    } catch {
      return null;
    }
  },

  async deleteMonitor(apiKey: string, id: string): Promise<boolean> {
    if (!apiKey || !id) return false;
    try {
      const res = await fetch(`${BASE}/monitors/${id}`, {
        method: 'DELETE',
        headers: headers(apiKey),
      });
      return res.ok;
    } catch {
      return false;
    }
  },

  // ── Direkt Tweet At ──────────────────────────────────────────────────────────
  async postTweet(apiKey: string, account: string, text: string, replyToId?: string): Promise<{ tweetId: string } | null> {
    if (!apiKey || !account || !text) return null;
    try {
      const body: Record<string, string> = {
        account: account.startsWith('@') ? account : `@${account}`,
        text,
      };
      if (replyToId) body.reply_to_tweet_id = replyToId;
      const res = await fetch(`${BASE}/x/tweets`, {
        method: 'POST',
        headers: headers(apiKey),
        body: JSON.stringify(body),
      });
      if (!res.ok) return null;
      const data = await res.json();
      return { tweetId: data.tweetId || '' };
    } catch {
      return null;
    }
  },

  // ── API Key Test ─────────────────────────────────────────────────────────────
  async testKey(apiKey: string): Promise<boolean> {
    if (!apiKey) return false;
    try {
      const res = await fetch(`${BASE}/radar?limit=1`, { headers: headers(apiKey) });
      return res.ok;
    } catch {
      return false;
    }
  },

  // ── Kullanıcı tweet'lerini çek — Feedback loop için ──────────────────────────
  // from:username son N tweet + engagement'larını getirir.
  // contextBuilder'daki recentPerf bölümüne gerçek data besler.
  async getUserTweets(
    apiKey: string,
    username: string,
    limit = 20
  ): Promise<UserTweet[]> {
    if (!apiKey || !username) return [];
    try {
      const res = await fetch(`${BASE}/x/tweets/search`, {
        method: 'POST',
        headers: headers(apiKey),
        body: JSON.stringify({
          query: `from:${username}`,
          limit,
          includeEngagement: true,
        }),
      });
      if (!res.ok) return [];
      const data = await res.json();
      return (data.tweets || data.items || []).map((t: any) => ({
        id: t.id || t.tweetId || '',
        text: t.text || t.content || '',
        likes: t.likes || t.favoriteCount || 0,
        replies: t.replies || t.replyCount || 0,
        retweets: t.retweets || t.retweetCount || 0,
        views: t.views || t.viewCount,
        createdAt: t.createdAt || t.created_at || '',
      }));
    } catch {
      return [];
    }
  },
};
