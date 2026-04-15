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
const BASE = '/xquik';
const RATE_LIMIT_COOLDOWN_MS = 60_000;
let searchTweetsCooldownUntil = 0;
let searchTweetsCooldownReason = '';

const headers = (apiKey: string) => ({
  'Content-Type': 'application/json',
  'x-api-key': apiKey,
});

function extractMediaUrls(t: any): string[] {
  const urls = [
    ...(Array.isArray(t?.media) ? t.media.flatMap((m: any) => [
      m?.url,
      m?.media_url_https,
      m?.mediaUrl,
      m?.previewImageUrl,
      m?.thumbUrl,
      m?.thumbnailUrl,
    ]) : []),
    ...(Array.isArray(t?.extended_entities?.media) ? t.extended_entities.media.flatMap((m: any) => [
      m?.media_url_https,
      m?.mediaUrl,
      m?.url,
      m?.media_url,
    ]) : []),
    t?.imageUrl,
    t?.image_url,
    t?.thumbnailUrl,
    t?.thumbnail_url,
    t?.previewImageUrl,
    t?.preview_image_url,
    t?.videoThumbnailUrl,
    t?.video_thumbnail_url,
    t?.videoUrl,
    t?.video_url,
    t?.mediaUrl,
    t?.media_url,
    t?.quotedMedia?.url,
  ]
    .flat()
    .filter((value): value is string => typeof value === 'string' && value.trim().length > 0);

  return [...new Set(urls)];
}

function extractMediaPreviewUrl(t: any): string | undefined {
  const urls = extractMediaUrls(t);
  if (urls.length > 0) return urls[0];
  if (typeof t?.video === 'string') return t.video;
  if (typeof t?.videoUrl === 'string') return t.videoUrl;
  if (typeof t?.mediaType === 'string' && t.mediaType === 'photo' && typeof t?.imageUrl === 'string') return t.imageUrl;
  return undefined;
}

const MONTH_MAP: Record<string, string> = {
  Jan:'01',Feb:'02',Mar:'03',Apr:'04',May:'05',Jun:'06',
  Jul:'07',Aug:'08',Sep:'09',Oct:'10',Nov:'11',Dec:'12',
};

function parseTwitterDate(raw: string | number): string {
  if (!raw) return '';
  const n = Number(raw);
  if (!isNaN(n) && n > 1_000_000_000) return new Date(n < 1e12 ? n * 1000 : n).toISOString();
  const s = String(raw);
  // Twitter format: "Wed Apr 15 14:00:02 +0000 2026"
  const m = s.match(/^\w{3}\s+(\w{3})\s+(\d{1,2})\s+(\d{2}:\d{2}:\d{2})\s+\+\d{4}\s+(\d{4})$/);
  if (m) {
    const mo = MONTH_MAP[m[1]] || '01';
    const day = m[2].padStart(2, '0');
    return `${m[4]}-${mo}-${day}T${m[3]}Z`;
  }
  const d = new Date(s);
  return isNaN(d.getTime()) ? '' : d.toISOString();
}

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
  hasMedia?: boolean;
  mediaType?: string;
  isVideo?: boolean;
  mediaPreviewUrl?: string;
  mediaUrls?: string[];
  bookmarkCount?: number;
  quotedText?: string;
  quotedAuthor?: string;
  quotedAuthorHandle?: string;
  quotedUrl?: string;
  quotedMediaPreviewUrl?: string;
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
  bookmarkCount?: number;
  mediaPreviewUrl?: string;
  mediaUrls?: string[];
  quotedText?: string;
  quotedAuthor?: string;
  quotedAuthorHandle?: string;
  quotedUrl?: string;
  quotedMediaPreviewUrl?: string;
  createdAt: string;
}

// ─── Trends ──────────────────────────────────────────────────────────────────

export interface TrendItem {
  name: string;
  rank?: number;
  description?: string;
  query?: string;
}

// ─── Dış Trendler (Reddit / HN / Google) ─────────────────────────────────────

export interface ExternalTrends {
  reddit: Array<{ title: string; url?: string; score?: number; subreddit?: string }>;
  hackernews: Array<{ title: string; url?: string; score?: number; comments?: number }>;
  google: Array<{ keyword: string; interest?: number }>;
}

// ─── Dizi Çıkarıcı (Thread Extractor) ────────────────────────────────────────

export interface ThreadResult {
  id: string;
  firstTweet: string;
  totalTweets: number;
  author: string;
  authorHandle: string;
  likes: number;
  views?: number;
  url: string;
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

// ─── xquik Pipeline Sonucu ───────────────────────────────────────────────────

export interface XquikTweetResult {
  text: string;
  score: XquikScore | null;
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
      if (!res.ok) {
        const body = await res.text().catch(() => '');
        console.error(`[xquik] radar ${res.status}:`, body);
        return [];
      }
      const data = await res.json();
      const arr = data.items ?? data.results ?? data.data ?? data.trending ?? data.feed ?? data.topics ?? data.radar ?? null;
      const list: any[] = Array.isArray(arr) ? arr : Array.isArray(data) ? data : [];
      // xquik "description" döndürüyor, uygulama "title" bekliyor — normalize et
      return list.map((item) => ({ ...item, title: item.title || item.description || item.name || '' }));
    } catch (e) {
      console.error('[xquik] radar fetch error:', e);
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
      minRetweets?: number;
      minBookmarks?: number;
      lang?: string;
      hours?: number;
      limit?: number;
    } = {}
  ): Promise<TweetSearchResult[]> {
    if (!apiKey) return [];
    if (Date.now() < searchTweetsCooldownUntil) {
      return [];
    }
    try {
      const { minFaves = 10, minReplies = 0, minRetweets = 0, minBookmarks = 0, lang = 'tr', hours, limit = 20 } = options;
      // GET endpoint — sadece q parametresi, X search operatörleriyle
      let q = query;
      if (lang) q += ` lang:${lang}`;
      if (minFaves > 0) q += ` min_faves:${minFaves}`;
      if (hours && hours > 0) {
        const since = new Date(Date.now() - hours * 60 * 60 * 1000);
        q += ` since:${since.toISOString().slice(0, 10)}`;
      }
      const params = new URLSearchParams({ q });
      const res = await fetch(`${BASE}/x/tweets/search?${params}`, {
        headers: headers(apiKey),
      });
      if (!res.ok) {
        const body = await res.text().catch(() => '');
        if (res.status === 429) {
          searchTweetsCooldownUntil = Date.now() + RATE_LIMIT_COOLDOWN_MS;
          searchTweetsCooldownReason = body.includes('Cloudflare') || body.includes('Access denied')
            ? 'Cloudflare rate limit'
            : 'xquik rate limit';
          console.warn(`[xquik] searchTweets rate-limited: ${searchTweetsCooldownReason}`);
        } else {
          console.error(`[xquik] searchTweets ${res.status}:`, body.slice(0, 300));
        }
        return [];
      }
      const data = await res.json();
      const rawItems = data.tweets || data.items || data.results || [];
      const items = rawItems.map((t: any) => {
        const quoted = t.quotedTweet || t.quoted_status || t.quotedStatus || t.quoted || null;
        return {
        id: t.id || t.tweetId || '',
        text: t.text || t.content || '',
        author: t.author?.name || t.authorName || t.user?.name || '',
        authorHandle: t.author?.username || t.authorHandle || t.user?.username || '',
        likes: t.likeCount || t.likes || t.favoriteCount || 0,
        replies: t.replyCount || t.replies || 0,
        retweets: t.retweetCount || t.retweets || 0,
        views: t.viewCount || t.views,
        bookmarkCount: t.bookmarkCount || t.bookmarks || t.saveCount,
        hasMedia: Boolean(
          t.hasMedia ||
          t.media?.length ||
          t.mediaType ||
          t.videoUrl ||
          t.video ||
          t.quotedMedia
        ),
        mediaType: t.mediaType || t.media?.[0]?.type || t.extended_entities?.media?.[0]?.type || (t.videoUrl || t.video ? 'video' : undefined),
        isVideo: Boolean(t.isVideo || t.mediaType === 'video' || t.videoUrl || t.video),
        mediaPreviewUrl: extractMediaPreviewUrl(t),
        mediaUrls: extractMediaUrls(t),
        quotedText: quoted?.text || quoted?.full_text || quoted?.content || '',
        quotedAuthor: quoted?.author?.name || quoted?.authorName || quoted?.user?.name || '',
        quotedAuthorHandle: quoted?.author?.username || quoted?.authorHandle || quoted?.user?.username || '',
        quotedUrl: quoted?.url || (quoted?.id ? `https://x.com/i/web/status/${quoted.id}` : ''),
        quotedMediaPreviewUrl: quoted ? extractMediaPreviewUrl(quoted) : undefined,
        createdAt: parseTwitterDate(t.createdAt || t.created_at || t.timestamp || t.time || t.date || t.publishedAt || t.postedAt || t.tweetCreatedAt || ''),
        url: t.url || `https://x.com/i/web/status/${t.id || t.tweetId}`,
        };
      });

      const cutoff = hours && hours > 0 ? Date.now() - hours * 60 * 60 * 1000 : 0;
      const filtered = items
        .filter((t: TweetSearchResult) => {
          const created = t.createdAt ? Date.parse(t.createdAt) : NaN;
          const recentOk = !cutoff || Number.isNaN(created) || created >= cutoff;
          return recentOk
            && t.likes >= minFaves
            && (t.replies || 0) >= minReplies
            && (t.retweets || 0) >= minRetweets
            && (minBookmarks <= 0 || (t.bookmarkCount || 0) >= minBookmarks);
        })
        .sort((a: TweetSearchResult, b: TweetSearchResult) => {
          const scoreA = (a.likes || 0) + (a.replies || 0) * 5 + (a.retweets || 0) * 2 + (a.views ? Math.round(a.views / 100) : 0);
          const scoreB = (b.likes || 0) + (b.replies || 0) * 5 + (b.retweets || 0) * 2 + (b.views ? Math.round(b.views / 100) : 0);
          return scoreB - scoreA;
        });

      return filtered.slice(0, limit);
    } catch (e) {
      console.error('[xquik] searchTweets error:', e);
      return [];
    }
  },

  // ── Trending Topics ──────────────────────────────────────────────────────────
  async getTrends(apiKey: string, _count = 20): Promise<TrendItem[]> {
    if (!apiKey) return [];
    try {
      // woeid=23424969 → Türkiye
      const res = await fetch(`${BASE}/x/trends?woeid=23424969`, {
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
      return (data.tweets || []).map((t: any) => {
        const quoted = t.quotedTweet || t.quoted_status || t.quotedStatus || t.quoted || null;
        return {
        id: t.id || '',
        text: t.text || '',
        author: t.author?.name || t.authorName || '',
        authorHandle: t.author?.username || t.author?.handle || '',
        likes: t.likeCount || t.likes || 0,
        replies: t.replyCount || t.replies || 0,
        retweets: t.retweetCount || t.retweets || 0,
        views: t.viewCount || t.views,
        bookmarkCount: t.bookmarkCount || t.bookmarks || t.saveCount,
        hasMedia: Boolean(t.hasMedia || t.media?.length || t.mediaType || t.videoUrl || t.video || t.quotedMedia),
        mediaType: t.mediaType || t.media?.[0]?.type || t.extended_entities?.media?.[0]?.type || (t.videoUrl || t.video ? 'video' : undefined),
        isVideo: Boolean(t.isVideo || t.mediaType === 'video' || t.videoUrl || t.video),
        mediaPreviewUrl: extractMediaPreviewUrl(t),
        mediaUrls: extractMediaUrls(t),
        quotedText: quoted?.text || quoted?.full_text || quoted?.content || '',
        quotedAuthor: quoted?.author?.name || quoted?.authorName || quoted?.user?.name || '',
        quotedAuthorHandle: quoted?.author?.username || quoted?.authorHandle || quoted?.user?.username || '',
        quotedUrl: quoted?.url || (quoted?.id ? `https://x.com/i/web/status/${quoted.id}` : ''),
        quotedMediaPreviewUrl: quoted ? extractMediaPreviewUrl(quoted) : undefined,
        createdAt: t.createdAt || '',
        url: t.url || `https://x.com/i/web/status/${t.id}`,
        };
      });
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

  // ── Dış Trendler (Reddit / HN / Google) ─────────────────────────────────────
  // xquik'in gündem araçlarından gelen harici trend verileri.
  // Her biri kendi endpoint'inden çekilir; hata olursa boş dizi döner.
  async getExternalTrends(apiKey: string): Promise<ExternalTrends> {
    if (!apiKey) return { reddit: [], hackernews: [], google: [] };
    // Radar endpoint'i source filtresiyle kullanılıyor
    const toItem = (i: any) => ({ title: i.title || i.description || '', url: i.url, score: i.score });
    try {
      const [redditRes, hnRes, googleRes] = await Promise.allSettled([
        fetch(`${BASE}/radar?source=reddit&limit=6`, { headers: headers(apiKey) }),
        fetch(`${BASE}/radar?source=hacker_news&limit=6`, { headers: headers(apiKey) }),
        fetch(`${BASE}/radar?source=google_trends&limit=6`, { headers: headers(apiKey) }),
      ]);
      const parse = async (r: PromiseSettledResult<Response>) => {
        if (r.status !== 'fulfilled' || !r.value.ok) return [];
        const d = await r.value.json();
        return (d.items || []).slice(0, 6).map(toItem);
      };
      const [reddit, hackernews, google] = await Promise.all([parse(redditRes), parse(hnRes), parse(googleRes)]);
      return { reddit, hackernews, google };
    } catch {
      return { reddit: [], hackernews: [], google: [] };
    }
  },

  // ── Dizi Çıkarıcı — konuya göre başarılı thread'leri bul ──────────────────
  // Thread modu için ilham kaynağı: hook yapısı, içerik akışı, CTA örnekleri.
  async searchThreads(
    _apiKey: string,
    _query: string,
    _options: { lang?: string; hours?: number; limit?: number } = {}
  ): Promise<ThreadResult[]> {
    // /x/threads/search 404 döndürüyor — xquik'te bu endpoint yok, devre dışı.
    return [];
    // eslint-disable-next-line no-unreachable
    if (!_apiKey) return [];
    try {
      const { lang = 'tr', hours = 72, limit = 5 } = _options;
      const res = await fetch(`${BASE}/x/threads/search`, {
        method: 'POST',
        headers: headers(_apiKey),
        body: JSON.stringify({ query: _query, lang, hours, limit }),
      });
      if (!res.ok) return [];
      const data = await res.json();
      return (data.threads || data.items || []).map((t: any) => ({
        id: t.id || '',
        firstTweet: t.firstTweet || t.text || '',
        totalTweets: t.totalTweets || t.tweetCount || 0,
        author: t.author?.name || t.authorName || '',
        authorHandle: t.author?.handle || t.authorHandle || '',
        likes: t.likes || t.favoriteCount || 0,
        views: t.views || t.viewCount,
        url: t.url || `https://x.com/i/web/status/${t.id}`,
      }));
    } catch {
      return [];
    }
  },

  // ── Compose → Refine → Score pipeline ───────────────────────────────────────
  // Claude API olmadan tam tweet üretimi: xquik kendi motoru ile compose eder,
  // refine ile düzeltir, score ile puanlar. Tüm adımlar /compose endpoint'i.
  async composeTweetPipeline(
    apiKey: string,
    topic: string,
    options: { count?: number; goal?: string; lang?: string; persona?: string } = {}
  ): Promise<XquikTweetResult[]> {
    if (!apiKey) return [];
    const { count = 1, goal = 'engagement', lang = 'tr', persona = 'hurricane' } = options;

    const runOnce = async (): Promise<XquikTweetResult | null> => {
      try {
        // Step 1: Compose
        const composeRes = await fetch(`${BASE}/compose`, {
          method: 'POST',
          headers: headers(apiKey),
          body: JSON.stringify({ topic, step: 'compose', goal, lang, persona }),
        });
        if (!composeRes.ok) return null;
        const cd = await composeRes.json();
        const draft =
          cd.draft || cd.tweet || cd.text || cd.content ||
          cd.result?.draft || cd.result?.text || cd.rawText || '';
        if (!draft) return null;

        // Step 2: Refine (best-effort — bazı planlarda olmayabilir)
        let refined = draft;
        try {
          const refineRes = await fetch(`${BASE}/compose`, {
            method: 'POST',
            headers: headers(apiKey),
            body: JSON.stringify({ draft, topic, step: 'refine', goal, lang }),
          });
          if (refineRes.ok) {
            const rd = await refineRes.json();
            refined = rd.draft || rd.tweet || rd.text || rd.result?.draft || draft;
          }
        } catch { /* orijinal draft kullan */ }

        // Step 3: Score
        const score = await this.scoreTweet(apiKey, refined);
        return { text: refined, score };
      } catch {
        return null;
      }
    };

    const all = await Promise.all(Array.from({ length: count }, runOnce));
    return all.filter(Boolean) as XquikTweetResult[];
  },

  // ── Account & Credits ────────────────────────────────────────────────────────
  async getAccountInfo(apiKey: string): Promise<{ subscription?: string; credits?: number; creditsUsed?: number; email?: string } | null> {
    if (!apiKey) return null;
    try {
      const [accRes, credRes] = await Promise.all([
        fetch(`${BASE}/account`, { headers: headers(apiKey) }),
        fetch(`${BASE}/credits`, { headers: headers(apiKey) }),
      ]);
      const acc = accRes.ok ? await accRes.json() : {};
      const cred = credRes.ok ? await credRes.json() : {};
      return {
        email: acc.email || acc.user?.email,
        subscription: acc.subscription?.plan || acc.plan || (acc.subscriptionStatus === 'active' ? 'active' : 'none'),
        credits: cred.balance ?? cred.credits ?? cred.remaining,
        creditsUsed: cred.used ?? cred.creditsUsed,
      };
    } catch {
      return null;
    }
  },

  // ── API Key Test ─────────────────────────────────────────────────────────────
  async testKey(apiKey: string): Promise<boolean> {
    if (!apiKey) return false;
    try {
      const res = await fetch(`${BASE}/radar?limit=1`, { headers: headers(apiKey) });
      if (!res.ok) {
        const body = await res.text().catch(() => '');
        console.error(`[xquik] testKey ${res.status}:`, body);
      }
      return res.ok;
    } catch (e) {
      console.error('[xquik] testKey error:', e);
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
      const clean = username.replace(/^@/, '');
      // GET /x/users/{username}/tweets
      const res = await fetch(`${BASE}/x/users/${clean}/tweets?resultsLimit=${limit}`, {
        headers: headers(apiKey),
      });
      if (!res.ok) {
        console.error(`[xquik] getUserTweets ${res.status}`);
        return [];
      }
      const data = await res.json();
      return (data.tweets || data.items || data.results || []).map((t: any) => {
        const quoted = t.quotedTweet || t.quoted_status || t.quotedStatus || t.quoted || null;
        return {
        id: t.id || '',
        text: t.text || '',
        likes: t.likeCount ?? t.likes ?? t.favoriteCount ?? 0,
        replies: t.replyCount ?? t.replies ?? 0,
        retweets: t.retweetCount ?? t.retweets ?? 0,
        views: t.viewCount ?? t.views,
        bookmarkCount: t.bookmarkCount ?? t.bookmarks ?? t.saveCount,
        mediaPreviewUrl: extractMediaPreviewUrl(t),
        mediaUrls: extractMediaUrls(t),
        quotedText: quoted?.text || quoted?.full_text || quoted?.content || '',
        quotedAuthor: quoted?.author?.name || quoted?.authorName || quoted?.user?.name || '',
        quotedAuthorHandle: quoted?.author?.username || quoted?.authorHandle || quoted?.user?.username || '',
        quotedUrl: quoted?.url || (quoted?.id ? `https://x.com/i/web/status/${quoted.id}` : ''),
        quotedMediaPreviewUrl: quoted ? extractMediaPreviewUrl(quoted) : undefined,
        createdAt: t.createdAt || '',
        };
      });
    } catch {
      return [];
    }
  },
};
