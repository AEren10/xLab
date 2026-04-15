export interface PersonaTweetLike {
  text?: string;
  likes?: number;
  replies?: number;
  retweets?: number;
  views?: number;
  engagement?: {
    like?: number;
    reply?: number;
    rt?: number;
    quote?: number;
  };
}

export interface PersonaBestTweet {
  text: string;
  engagement_score: number;
  why_it_worked: string;
  hook_type: string;
}

export interface StoredPersonaRecord {
  personaId: string;
  source: 'static' | 'cached' | 'generated';
  persona: Record<string, any>;
  updatedAt: string;
}

const PERSONA_CACHE_PREFIX = 'persona_cache_';

const cleanText = (text: string, max = 160): string => {
  const compact = (text || '').replace(/\s+/g, ' ').trim();
  return compact.length > max ? `${compact.slice(0, max - 1)}…` : compact;
};

const getMetrics = (tweet: PersonaTweetLike) => {
  const like = tweet.engagement?.like ?? tweet.likes ?? 0;
  const reply = tweet.engagement?.reply ?? tweet.replies ?? 0;
  const rt = tweet.engagement?.rt ?? tweet.retweets ?? 0;
  const views = tweet.views ?? 0;

  return { like, reply, rt, views };
};

function isBrowser(): boolean {
  return typeof window !== 'undefined' && typeof localStorage !== 'undefined';
}

export function scorePersonaTweet(tweet: PersonaTweetLike): number {
  const { like, reply, rt, views } = getMetrics(tweet);
  return like + reply * 5 + rt * 2 + (views ? Math.round(views / 100) : 0);
}

export function getCachedPersona(personaId: string): StoredPersonaRecord | null {
  if (!isBrowser() || !personaId) return null;
  try {
    const raw = localStorage.getItem(`${PERSONA_CACHE_PREFIX}${personaId}`);
    if (!raw) return null;
    return JSON.parse(raw) as StoredPersonaRecord;
  } catch {
    return null;
  }
}

export function saveCachedPersona(personaId: string, persona: Record<string, any>, source: StoredPersonaRecord['source'] = 'generated'): void {
  if (!isBrowser() || !personaId || !persona) return;
  const payload: StoredPersonaRecord = {
    personaId,
    source,
    persona,
    updatedAt: new Date().toISOString(),
  };

  try {
    localStorage.setItem(`${PERSONA_CACHE_PREFIX}${personaId}`, JSON.stringify(payload));
    window.dispatchEvent(new CustomEvent('persona-cache-updated', { detail: { personaId } }));
  } catch {
    // cache best-effort
  }
}

export async function loadPersonaById(personaId: string): Promise<Record<string, any> | null> {
  const cached = getCachedPersona(personaId);
  if (cached?.persona) return cached.persona;

  try {
    const res = await fetch(`/personas/${personaId}.json`);
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

function getHookType(text: string): string {
  const lower = text.toLowerCase();
  const firstLine = cleanText((text || '').split('\n')[0] || '', 120);

  if (/[?؟]\s*$/.test(firstLine)) return 'soru hook';
  if (/\d/.test(firstLine) || /%|₺|tl|usd|eur/i.test(firstLine)) return 'data hook';
  if (lower.includes('kimse') || lower.includes('herkes') || lower.includes('yanlış') || lower.includes('değil') || lower.includes('overrated')) {
    return 'karşı görüş hook';
  }
  if (lower.includes('itiraf') || lower.includes('bugün') || lower.includes('dün') || lower.includes('geçen') || lower.includes('sabah')) {
    return 'kişisel hook';
  }
  if (lower.startsWith('bak ') || lower.startsWith('ok.') || lower.startsWith('tamam')) {
    return 'attention grab hook';
  }
  return 'merak açığı hook';
}

function getMechanicTags(text: string): string[] {
  const lower = text.toLowerCase();
  const tags = new Set<string>();

  if (/[?؟]\s*$/.test((text || '').split('\n')[0] || '')) tags.add('question');
  if (/\d/.test(text) || /%|₺|tl|usd|eur/i.test(text)) tags.add('data');
  if ((text || '').includes('\n')) tags.add('linebreak');
  if ((text || '').trim().length <= 120) tags.add('short');
  if (lower.includes('kimse') || lower.includes('herkes') || lower.includes('yanlış') || lower.includes('değil') || lower.includes('overrated')) tags.add('contrarian');
  if (lower.includes('ben ') || lower.includes('bana') || lower.includes('bence') || lower.includes('biz')) tags.add('personal');
  if (lower.includes('sadece soruyorum') || lower.includes('ya neyse') || lower.includes('tabii')) tags.add('irony');
  if (lower.includes('neden') || lower.includes('nasıl')) tags.add('open_loop');

  return [...tags];
}

function buildWhyItWorked(tweet: PersonaTweetLike): string {
  const text = tweet.text || '';
  const tags = getMechanicTags(text);
  const reasons: string[] = [];

  if (tags.includes('question')) reasons.push('yorum çağırıyor');
  if (tags.includes('data')) reasons.push('sayıyla güven veriyor');
  if (tags.includes('linebreak')) reasons.push('ritim ve dwell yaratıyor');
  if (tags.includes('short')) reasons.push('tek nefeste okunuyor');
  if (tags.includes('contrarian')) reasons.push('karşı görüş gerilimi kuruyor');
  if (tags.includes('personal')) reasons.push('kişisel temas kuruyor');
  if (tags.includes('irony')) reasons.push('hafif ironiyle ima bırakıyor');
  if (tags.includes('open_loop')) reasons.push('açık döngü bırakıyor');

  if (!reasons.length) {
    reasons.push('net hook ve kısa kapanış taşıyor');
  }

  return reasons.slice(0, 3).join(', ');
}

function formatAngleLabel(tag: string): string {
  switch (tag) {
    case 'question':
      return 'Açık uçlu soru ile yorum çağırma';
    case 'data':
      return 'Sayı / istatistik ile güven kurma';
    case 'linebreak':
      return 'Satır kırarak ritim ve dwell yaratma';
    case 'short':
      return 'Kısa tek vuruşlu yapı';
    case 'contrarian':
      return 'Karşı görüş gerilimi';
    case 'personal':
      return 'Kişisel gözlem / itiraf tonu';
    case 'irony':
      return 'Hafif ironi ve ima';
    case 'open_loop':
      return 'Açık döngü bırakma';
    default:
      return tag;
  }
}

function mergeUniqueStrings(base: string[], extra: string[]): string[] {
  const seen = new Set(base.map((item) => item.toLowerCase()));
  const merged = [...base];
  for (const item of extra) {
    const key = item.toLowerCase();
    if (!seen.has(key)) {
      seen.add(key);
      merged.push(item);
    }
  }
  return merged;
}

function mergeBestTweets(base: PersonaBestTweet[], extra: PersonaBestTweet[], limit = 20): PersonaBestTweet[] {
  const seen = new Set(base.map((tweet) => tweet.text.toLowerCase()));
  const merged = [...base];
  for (const tweet of extra) {
    const key = tweet.text.toLowerCase();
    if (!seen.has(key)) {
      seen.add(key);
      merged.push(tweet);
    }
    if (merged.length >= limit) break;
  }
  return merged.slice(0, limit);
}

function buildLearningSignature(tweets: PersonaTweetLike[], limit = 5): string {
  return [...tweets]
    .filter((tweet) => (tweet.text || '').trim())
    .sort((a, b) => scorePersonaTweet(b) - scorePersonaTweet(a))
    .slice(0, limit)
    .map((tweet) => cleanText(tweet.text || '', 120).toLowerCase())
    .join('||');
}

export function derivePersonaAngles(tweets: PersonaTweetLike[], limit = 8): string[] {
  if (!tweets.length) return [];

  const counts = new Map<string, number>();
  const scored = [...tweets]
    .filter((tweet) => (tweet.text || '').trim())
    .sort((a, b) => scorePersonaTweet(b) - scorePersonaTweet(a))
    .slice(0, 5);

  for (const tweet of scored) {
    for (const tag of getMechanicTags(tweet.text || '')) {
      counts.set(tag, (counts.get(tag) || 0) + 1);
    }
  }

  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([tag, count]) => `${formatAngleLabel(tag)} (${count}/${scored.length})`);
}

export function deriveBestPerformingTweets(tweets: PersonaTweetLike[], limit = 5): PersonaBestTweet[] {
  if (!tweets.length) return [];

  return [...tweets]
    .filter((tweet) => (tweet.text || '').trim())
    .sort((a, b) => scorePersonaTweet(b) - scorePersonaTweet(a))
    .slice(0, limit)
    .map((tweet) => ({
      text: cleanText(tweet.text || '', 180),
      engagement_score: Math.round(scorePersonaTweet(tweet)),
      why_it_worked: buildWhyItWorked(tweet),
      hook_type: getHookType(tweet.text || ''),
    }));
}

export function enrichPersonaWithTweets<T extends Record<string, any>>(persona: T | null | undefined, tweets: PersonaTweetLike[] = []): T | null {
  if (!persona) return persona ?? null;

  const sourceTweets = tweets.filter((tweet) => (tweet.text || '').trim());
  if (!sourceTweets.length) return persona;

  const derivedBest = deriveBestPerformingTweets(sourceTweets, 5);
  const derivedAngles = derivePersonaAngles(sourceTweets, 8);

  const existingBest = Array.isArray(persona.best_performing_tweets) ? persona.best_performing_tweets : [];
  const existingAngles = Array.isArray(persona.content_angles) ? persona.content_angles : [];

  const mergedBest = mergeBestTweets(existingBest, derivedBest, 20);
  const mergedAngles = mergeUniqueStrings(existingAngles, derivedAngles);

  return {
    ...persona,
    best_performing_tweets: mergedBest.slice(0, 20),
    content_angles: mergeUniqueStrings(mergedAngles, derivedAngles).slice(0, 8),
    learning_summary: {
      source_tweet_count: sourceTweets.length,
      derived_best_tweets: derivedBest.length,
      learning_signature: buildLearningSignature(sourceTweets, 5),
      updated_at: new Date().toISOString(),
    },
  };
}

export function persistEnrichedPersona(personaId: string, persona: Record<string, any> | null | undefined): void {
  if (!personaId || !persona) return;
  saveCachedPersona(personaId, persona, 'cached');
}
