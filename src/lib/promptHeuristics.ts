import type { TweetSearchResult } from './xquik';

export function scoreTweet(tweet: Pick<TweetSearchResult, 'likes' | 'replies' | 'retweets' | 'views'>): number {
  return tweet.likes + (tweet.replies || 0) * 5 + (tweet.retweets || 0) * 2 + (tweet.views ? Math.round(tweet.views / 100) : 0);
}

function normalizeText(text: string): string {
  return (text || '')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9çğıöşü\s-]/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function uniqueStrings(values: string[]): string[] {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))];
}

function topicTokens(topic: string): string[] {
  return uniqueStrings(normalizeText(topic).split(' ').filter((token) => token.length > 2));
}

const SINGLE_TOPIC_CONTEXT_TERMS = [
  'mac',
  'maci',
  'match',
  'injury',
  'injuries',
  'sakat',
  'sakatlik',
  'lineup',
  'kadro',
  'saha',
  'pitch',
  'anfield',
  'goal',
  'gol',
  'manager',
  'coach',
  'transfer',
  'form',
  'derbi',
  'vs',
  'post-match',
  'prematch',
  'pre-match',
];

export function buildTopicSearchQueries(topic: string): string[] {
  const cleaned = topic.trim().replace(/\s+/g, ' ');
  if (!cleaned) return [];

  const queries = [cleaned];
  const tokens = topicTokens(cleaned);

  if (tokens.length <= 1) {
    const root = cleaned;
    queries.push(
      `${root} maç`,
      `${root} injury`,
      `${root} sakatlık`,
      `${root} lineup`,
      `${root} saha`,
    );
  } else {
    queries.push(
      `${cleaned} yorum`,
      `${cleaned} maç`,
      `${cleaned} analiz`,
    );
  }

  return uniqueStrings(queries).slice(0, 6);
}

export function buildTopicSearchLanguages(topic: string): Array<'tr' | 'en'> {
  const tokens = topicTokens(topic);
  if (tokens.length <= 1) return ['tr', 'en'];
  return ['tr'];
}

export function scoreTopicalRelevance(
  tweet: Pick<TweetSearchResult, 'text' | 'author' | 'authorHandle'>,
  topic: string
): number {
  const cleanedTopic = normalizeText(topic);
  if (!cleanedTopic) return 0;

  const text = normalizeText(`${tweet.text} ${tweet.author || ''} ${tweet.authorHandle || ''}`);
  if (!text) return 0;

  const tokens = topicTokens(cleanedTopic);
  let score = 0;

  if (text.includes(cleanedTopic)) score += 100;

  for (const token of tokens) {
    if (text.includes(token)) score += 18;
  }

  if (tokens.length <= 1) {
    let contextHits = 0;
    for (const term of SINGLE_TOPIC_CONTEXT_TERMS) {
      if (text.includes(term)) contextHits += 1;
    }
    score += Math.min(contextHits * 8, 48);
  }

  if (text.includes('sakat') || text.includes('injur') || text.includes('lineup')) {
    score += 10;
  }

  return score;
}

export function rankContextualTweets(tweets: TweetSearchResult[], topic: string): TweetSearchResult[] {
  return [...tweets].sort((a, b) => {
    const topicA = scoreTopicalRelevance(a, topic);
    const topicB = scoreTopicalRelevance(b, topic);
    if (topicA !== topicB) return topicB - topicA;

    const scoreA = scoreTweet(a);
    const scoreB = scoreTweet(b);
    if (scoreA !== scoreB) return scoreB - scoreA;

    return (b.views || 0) - (a.views || 0);
  });
}

export function cleanSnippet(text: string, max = 180): string {
  const clean = (text || '').replace(/\s+/g, ' ').trim();
  return clean.length > max ? `${clean.slice(0, max - 1)}...` : clean;
}

export function firstLine(text: string): string {
  return cleanSnippet((text || '').split('\n')[0] || '', 120);
}

export function inferHookType(text: string): string {
  const lower = text.toLowerCase();
  const line = firstLine(text);

  if (/[?\uFF1F]\s*$/.test(line)) return 'soru hook';
  if (/\d/.test(line) || /%|₺|tl|usd|eur/i.test(line)) return 'data hook';
  if (lower.includes('kimse') || lower.includes('herkes') || lower.includes('yanlis') || lower.includes('degil') || lower.includes('overrated')) {
    return 'karşı görüş hook';
  }
  if (lower.includes('itiraf') || lower.includes('bugun') || lower.includes('dun') || lower.includes('gecen') || lower.includes('sabah')) {
    return 'kişisel / itiraf hook';
  }
  if (lower.startsWith('bak ') || lower.startsWith('ok.') || lower.startsWith('tamam')) {
    return 'attention grab hook';
  }
  return 'merak açığı hook';
}

export function inferMechanic(tweet: TweetSearchResult): string {
  const parts: string[] = [];
  const hookType = inferHookType(tweet.text);
  const score = scoreTweet(tweet);

  parts.push(`hook: ${hookType}`);
  if ((tweet.text || '').includes('\n')) parts.push('satır ritmi var');
  if (tweet.replies > tweet.likes * 0.2) parts.push('reply çekiyor');
  else if (tweet.retweets > tweet.likes * 0.1) parts.push('paylaşım üretiyor');
  else parts.push('tek cümlede dikkat topluyor');
  if (tweet.views && tweet.views > tweet.likes * 10) parts.push('view odaklı dağıtım');
  if (score > 1000) parts.push('yüksek momentum');
  return parts.join(' · ');
}

export type MediaFormat =
  | 'video-thumbnail'
  | 'image-card'
  | 'infographic'
  | 'quote-card'
  | 'screenshot'
  | 'meme'
  | 'general';

export interface MediaOpportunity {
  format: MediaFormat;
  label: string;
  reason: string;
  promptHint: string;
}

export function inferMediaOpportunity(
  input: string | Partial<{ text: string; hasMedia: boolean; mediaType: string; isVideo: boolean }>,
  impressionType = 'general'
): MediaOpportunity {
  const text = typeof input === 'string' ? input : input.text || '';
  const lower = normalizeText(text);
  const hasMedia = typeof input === 'string' ? false : Boolean(input.hasMedia || input.isVideo || input.mediaType);
  const isVideo = typeof input === 'string' ? false : Boolean((input as any)?.isVideo || (input as any)?.mediaType === 'video');

  const mediaFormatFromImpression: Record<string, MediaOpportunity> = {
    Data: {
      format: 'infographic',
      label: 'Infografik',
      reason: 'Rakam ve karşılaştırma görselle daha iyi okunur.',
      promptHint: 'clean infographic, bold headline, compact chart, simple labels, high contrast, square social format',
    },
    Story: {
      format: 'image-card',
      label: 'Fotoğraf / Sahne',
      reason: 'Gerçek an hissi güven ve dwell time üretir.',
      promptHint: 'authentic documentary photo, candid moment, natural light, warm tones, social media square crop',
    },
    'Hot Take': {
      format: 'quote-card',
      label: 'Quote Kartı',
      reason: 'Sivri fikirler metin baskın görünürse daha güçlü çalışır.',
      promptHint: 'bold editorial quote card, strong typography, high contrast, sharp layout, social post square',
    },
    Edu: {
      format: 'screenshot',
      label: 'Ekran Görüntüsü / Diyagram',
      reason: 'Adım adım açıklama için ekran görüntüsü ve basit diyagram daha etkili.',
      promptHint: 'clean educational screenshot style, annotated steps, minimal diagram, modern flat layout, square',
    },
    Inspire: {
      format: 'quote-card',
      label: 'Alıntı Kartı',
      reason: 'Temiz quote kartı, paylaşım ve kaydetme için iyi çalışır.',
      promptHint: 'minimal quote card, elegant typography, soft gradient background, single focal point, premium social post',
    },
    Humor: {
      format: 'meme',
      label: 'Meme / GIF hissi',
      reason: 'Mizah içerikleri hızlı bağlam ister; görsel bunu güçlendirir.',
      promptHint: 'playful meme-adjacent social image, vibrant colors, clever composition, polished but funny, square',
    },
  };

  if (isVideo || /(video|clip|watch|izle|gol|goal|highlight|highlights|teaser|replay|live|canli|canlı)/.test(lower)) {
    return {
      format: 'video-thumbnail',
      label: 'Video Kapağı',
      reason: 'Video/dinamik an çağrısı varsa kapak dili daha iyi çalışır.',
      promptHint: 'cinematic video thumbnail, one strong focal subject, bold headline, dramatic contrast, social square frame',
    };
  }

  if (hasMedia || /(screenshot|ekran goruntusu|ekrangoruntusu|thread|adim adim|checklist|liste|step by step)/.test(lower)) {
    return {
      format: 'screenshot',
      label: 'Ekran Görüntüsü',
      reason: 'Kanıt/akış gösteren içeriklerde screenshot hissi güven sağlar.',
      promptHint: 'clean screenshot-inspired social visual, highlighted interface, crisp borders, readable layout, square',
    };
  }

  if (/\d|%|tl|usd|eur|₺/.test(lower) || /(stat|data|chart|graph|table|analiz|comparison|karşılaştır)/.test(lower)) {
    return mediaFormatFromImpression.Data;
  }

  if (/(quote|alıntı|alinti|söz|soz|opinion|fikir|hot take)/.test(lower)) {
    return mediaFormatFromImpression['Hot Take'];
  }

  return mediaFormatFromImpression[impressionType] || {
    format: 'general',
    label: 'Genel Görsel',
    reason: 'Tweet daha genel bir görsel dil istiyor.',
    promptHint: 'clean minimal social media visual, dark background, tasteful typography, premium, square',
  };
}

export function selectDiverseTweets(tweets: TweetSearchResult[], limit = 4, topic = ''): TweetSearchResult[] {
  if (!tweets.length) return [];

  const sorted = rankContextualTweets(tweets, topic);
  const picked: TweetSearchResult[] = [];
  const seenHooks = new Set<string>();

  for (const tweet of sorted) {
    const hook = inferHookType(tweet.text);
    if (!seenHooks.has(hook)) {
      seenHooks.add(hook);
      picked.push(tweet);
    }
    if (picked.length >= limit) return picked;
  }

  if (picked.length < limit) {
    for (const tweet of sorted) {
      if (picked.some((item) => item.id === tweet.id)) continue;
      picked.push(tweet);
      if (picked.length >= limit) break;
    }
  }

  return picked.slice(0, limit);
}
