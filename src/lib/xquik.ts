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
