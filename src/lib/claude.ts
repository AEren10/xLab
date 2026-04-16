export interface TweetVariation {
  text: string;
  scores: {
    hook: number;
    reply_potential: number;
    dwell_potential: number;
    information: number;
    algorithm: number;
    persona: number;
    [key: string]: number;
  };
  total_score: number;
  score_reason: string;
  xquikScore?: import('./xquik').XquikScore | null;
}

export interface ThreadTweet {
  text: string;
  position: number;
  type: 'hook' | 'content' | 'cta';
}

export interface TweetThread {
  tweets: ThreadTweet[];
  total_score: number;
  score_reason: string;
  xquikScore?: import('./xquik').XquikScore | null;
}

const CLAUDE_API = 'https://api.anthropic.com/v1/messages';
const MODEL = 'claude-haiku-4-5-20251001';

const logModel = () =>
  console.info(`%c[TweetLab] Claude API → model: ${MODEL}`, 'color:#7c6af7;font-weight:bold;font-size:11px');

const baseHeaders = (apiKey: string) => ({
  'Content-Type': 'application/json',
  'x-api-key': apiKey,
  'anthropic-version': '2023-06-01',
  'anthropic-beta': 'prompt-caching-2024-07-31',
  'anthropic-dangerous-direct-browser-access': 'true',
});

function safeParseJSON<T>(raw: string, _fallback: T): T {
  // Markdown fence temizle
  let clean = raw.replace(/```json|```/g, '').trim();
  // Önündeki açıklama metnini at — { veya [ ile başlayan kısımdan al
  const objIdx = clean.indexOf('{');
  const arrIdx = clean.indexOf('[');
  if (objIdx !== -1 || arrIdx !== -1) {
    const start = objIdx === -1 ? arrIdx : arrIdx === -1 ? objIdx : Math.min(objIdx, arrIdx);
    clean = clean.slice(start);
  }
  try {
    return JSON.parse(clean) as T;
  } catch {
    throw new Error('Claude yanıtı işlenemedi. Tekrar dene.');
  }
}

export const claudeApi = {
  async generateTweets(
    apiKey: string,
    systemPrompt: string,
    userMessage: string,
    variations = 3
  ): Promise<TweetVariation[]> {
    logModel();
    const res = await fetch(CLAUDE_API, {
      method: 'POST',
      headers: baseHeaders(apiKey),
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 600,
        system: [{ type: 'text', text: systemPrompt, cache_control: { type: 'ephemeral' } }],
        messages: [{
          role: 'user',
          content: `${userMessage}\n\nGenerate ${variations} tweet variations. Return ONLY a JSON array of objects with a "text" field. No markdown, no scores.`,
        }],
      }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err?.error?.message || `API error: ${res.status}`);
    }

    const data = await res.json();
    const text = data.content?.[0]?.text || '[]';
    // Scoring devre dışı — Claude sadece metin döndürüyor.
    // Skor alanları varsayılan değerle doldurulur; xquik skoru asıl sıralama kaynağı.
    // Scoring'i geri açmak için contextBuilder.ts > Output Format bloğunu uncomment et.
    const raw = safeParseJSON<{ text: string }[]>(text, []);
    return raw.map((t) => ({
      text: t.text || '',
      scores: { hook: 0, reply_potential: 0, dwell_potential: 0, information: 0, algorithm: 0, persona: 0 },
      total_score: 0,
      score_reason: '',
    }));
  },

  async generateThread(
    apiKey: string,
    systemPrompt: string,
    userMessage: string
  ): Promise<TweetThread | null> {
    logModel();
    const res = await fetch(CLAUDE_API, {
      method: 'POST',
      headers: baseHeaders(apiKey),
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 1400,
        system: [{ type: 'text', text: systemPrompt, cache_control: { type: 'ephemeral' } }],
        messages: [{ role: 'user', content: userMessage }],
      }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err?.error?.message || `API error: ${res.status}`);
    }

    const data = await res.json();
    const text = data.content?.[0]?.text || 'null';
    const raw = safeParseJSON<{ tweets: ThreadTweet[]; total_score?: number; score_reason?: string } | null>(text, null);
    if (!raw) return null;
    return {
      tweets: raw.tweets || [],
      total_score: raw.total_score ?? 0,
      score_reason: raw.score_reason ?? '',
    };
  },

  /**
   * Tweet metninden Midjourney / DALL-E için görsel prompt üretir.
   * ~150 token kullanır. Kullanıcı açıkça butona basınca çağrılır.
   */
  async generateVisualPrompt(
    apiKey: string,
    tweetText: string,
    impressionType = 'general',
    mediaHint = ''
  ): Promise<string> {
    const styleGuide: Record<string, string> = {
      'Data':     'clean infographic style, data visualization, minimal charts, white background, professional',
      'Story':    'authentic documentary photography, candid moment, natural light, warm tones',
      'Hot Take': 'bold typographic poster, high contrast, strong color, editorial design',
      'Edu':      'clean educational diagram, step-by-step visual, pastel colors, modern flat illustration',
      'Inspire':  'minimalist quote card, elegant typography, soft gradient background, single focal point',
      'Humor':    'playful illustration, vibrant colors, meme-adjacent but polished, fun composition',
    };
    const style = styleGuide[impressionType] || 'clean minimal social media visual, dark background, professional';

    const res = await fetch(CLAUDE_API, {
      method: 'POST',
      headers: baseHeaders(apiKey),
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 200,
        messages: [{
          role: 'user',
          content: `Tweet: "${tweetText.slice(0, 250)}"
Content type: ${impressionType}
Style reference: ${style}
Media cue: ${mediaHint || 'no special media cue'}

Write a concise Midjourney/DALL-E prompt (max 60 words) for a Twitter post visual that matches this tweet's tone and topic. If the media cue suggests a video moment, make it feel like a thumbnail or cover frame. If it suggests data, make it feel like an infographic. 1:1 square format. Return ONLY the prompt text, no explanation.`,
        }],
      }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err?.error?.message || `API error: ${res.status}`);
    }

    const data = await res.json();
    return (data.content?.[0]?.text || '').trim();
  },

  /**
   * Verilen tweete kısa, güçlü bir reply üretir. Düz metin döner (JSON yok).
   */
  async generateReply(apiKey: string, prompt: string): Promise<string> {
    const res = await fetch(CLAUDE_API, {
      method: 'POST',
      headers: baseHeaders(apiKey),
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 120,
        temperature: 0.8,
        messages: [{
          role: 'user',
          content: prompt,
        }],
      }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err?.error?.message || `API error: ${res.status}`);
    }
    const data = await res.json();
    return (data.content?.[0]?.text || '').trim();
  },

  /**
   * Gerçek tweet'lerden persona JSON üretir.
   * xquik ile çekilen tweet'leri analiz eder, stil kuralları çıkartır.
   */
  async buildPersonaFromTweets(
    apiKey: string,
    handle: string,
    tweets: { text: string; likes: number; replies: number; retweets: number }[],
    strategyNote = ''
  ): Promise<object | null> {
    logModel();
    const tweetList = tweets
      .slice(0, 5)
      .map((t, i) => `[${i + 1}] (❤${t.likes} 💬${t.replies} 🔁${t.retweets})\n"${t.text}"`)
      .join('\n\n');

    const res = await fetch(CLAUDE_API, {
      method: 'POST',
      headers: baseHeaders(apiKey),
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 800,
        messages: [{
          role: 'user',
          content: `Aşağıdaki Twitter hesabının en çok etkileşim alan tweet'lerini analiz et ve persona JSON üret.

Handle: @${handle}
${strategyNote ? `Strateji notu: ${strategyNote}\n` : ''}
En yüksek performanslı 5 tweet:
${tweetList}

Şu JSON formatını AYNEN döndür (açıklama ekleme):
{
  "name": "${handle}",
  "handle": "@${handle}",
  "language": "tr",
  "tone": "kısa tek satır ton tanımı",
  "strategy": "bu hesabın içerik stratejisini bir cümleyle açıkla",
  "style_rules": ["kural1", "kural2", "kural3", "kural4", "kural5"],
  "hook_patterns": [
    {"pattern": "isim", "examples": ["örnek1", "örnek2"]}
  ],
  "best_performing_tweets": [
    {
      "text": "tweet metni",
      "engagement_score": 0,
      "hook_type": "soru hook / data hook / karşı görüş hook",
      "why_it_worked": "neden tuttuğunu kısa açıkla"
    }
  ],
  "content_angles": ["açı1", "açı2", "açı3"],
  "avoid": ["kaçınılacak1", "kaçınılacak2"]
}`,
        }],
      }),
    });

    if (!res.ok) return null;
    const data = await res.json();
    const text = data.content?.[0]?.text || 'null';
    return safeParseJSON<object | null>(text, null);
  },

  /**
   * API key geçerliliğini test et — minimal token kullanır.
   */
  async testKey(apiKey: string): Promise<{ ok: boolean; error?: string }> {
    try {
      const res = await fetch(CLAUDE_API, {
        method: 'POST',
        headers: baseHeaders(apiKey),
        body: JSON.stringify({
          model: MODEL,
          max_tokens: 5,
          messages: [{ role: 'user', content: 'hi' }],
        }),
      });
      if (res.ok) return { ok: true };
      const err = await res.json().catch(() => ({}));
      return { ok: false, error: err?.error?.message || `HTTP ${res.status}` };
    } catch (e: any) {
      return { ok: false, error: e.message };
    }
  },
};
