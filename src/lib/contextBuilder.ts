/**
 * contextBuilder — Claude'a gönderilecek prompt'u inşa eder.
 *
 * İki parçadan oluşur:
 *   buildSystemPrompt → "Sen kimsin, nasıl davranacaksın" — her üretimde aynı
 *   buildUserMessage  → "Şu konuda şu tweet'i üret" — her üretimde değişir
 *
 * Sistem prompt katmanları (üstten alta öncelik sırası):
 *   1. toneProfile  — kullanıcının "daha cesur yaz" gibi özel notları
 *   2. algoBlock    — canlı Grok kuralları (xquik) VEYA statik skill.ts fallback
 *   3. Persona      — hurricane / tr_educational vb. persona JSON'u
 *
 * Kullanıcı mesajında:
 *   - recentPerf: localStorage'daki son 5 tweet + manuel girilen engagement puanı
 *     (engagement puanı = like + reply×5 + rt×2 + quote×3 — algoritma ağırlıklarına göre)
 *   - trends: xquik radar'dan gelen güncel başlıklar
 */
import { ALGORITHM_RULES, ALGORITHM_RULES_SHORT } from './skill';
import type { TweetEntry, Settings } from './db';
import type { RadarItem, ComposeAlgoData, UserTweet } from './xquik';

interface BuildContextParams {
  topic: string;
  persona: any;
  settings: Settings;
  recentTweets: TweetEntry[];
  radarItems: RadarItem[];
  impressionType: string;
  length: string;
  goal: string;
  variations: number;
  algoData?: ComposeAlgoData | null;
  xUserTweets?: UserTweet[]; // xquik getUserTweets'ten gelen gerçek X verisi (öncelikli)
}

export function buildSystemPrompt(
  persona: any,
  settings: Settings,
  algoData?: ComposeAlgoData | null
): string {
  const styleRules = (persona?.style_rules || [])
    .map((r: string) => `- ${r}`)
    .join('\n');

  const hookExamples = (persona?.hook_patterns || [])
    .flatMap((hp: any) => hp.examples || [])
    .slice(0, 4)
    .map((e: string) => `  "${e}"`)
    .join('\n');

  const bestTweets = (persona?.best_performing_tweets || [])
    .slice(0, 3)
    .map(
      (t: any) =>
        `  "${t.text}" (${t.engagement_rate}% engagement)`
    )
    .join('\n');

  const toneNote = settings.toneProfile
    ? `\n## Özel Ton Notu (ÖNCE BU)\n${settings.toneProfile}\n`
    : '';

  // algoData öncelik sırası:
  // 1. xquik compose endpoint'inden gelen canlı Grok verisi (API key varsa çekilir)
  // 2. Statik ALGORITHM_RULES (skill.ts) — fallback, her zaman geçerli ama güncel olmayabilir
  //
  // İki versiyonu AYNI ANDA eklemiyoruz — canlı veri gerçek içerik döndürdüyse
  // statik kuralı prompt'a dahil etme, token israfı olur (~600 token).
  // Canlı verinin içerik döndürmediği durumlarda (boş endpoint) statik devreye girer.
  const liveAlgoContent = algoData
    ? [
        algoData.rawText || '',
        algoData.algoSummary || '',
        algoData.contentRules?.length
          ? algoData.contentRules.map((r) => `- ${r}`).join('\n')
          : '',
        algoData.engagementSignals && Object.keys(algoData.engagementSignals).length
          ? Object.entries(algoData.engagementSignals)
              .sort(([, a], [, b]) => b - a)
              .map(([k, v]) => `- ${k}: ${v}`)
              .join('\n')
          : '',
      ]
        .filter(Boolean)
        .join('\n')
        .trim()
    : '';

  const algoBlock = liveAlgoContent
    ? `## X Algorithm Rules (Grok — Canlı Veri)\n${liveAlgoContent}`
    : ALGORITHM_RULES; // canlı veri boşsa statik kural devreye girer

  return `# Tweet Generation Expert

${algoBlock}

## Active Persona: ${persona?.name || 'Default'}
Tone: ${persona?.tone || 'casual, direct'}
Language: ${persona?.language || 'tr'}
Niche: ${settings.niche || 'general'}
${toneNote}
### Style Rules
${styleRules}

### Hook Patterns (inspiration, not copy-paste)
${hookExamples}

### Best Performing Examples
${bestTweets}

## Output Format
Return ONLY a JSON array. No markdown fences, no explanation:
[
  {
    "text": "tweet text",
    "scores": {
      "hook": 0-22,
      "information": 0-18,
      "reply_potential": 0-15,
      "dwell_potential": 0-10,
      "algorithm": 0-12,
      "persona": 0-12,
      "originality": 0-11
    },
    "total_score": 0-100,
    "score_reason": "one sentence explanation"
  }
]

## Scoring Notes
- dwell_potential: Kaç kişi 2+ dakika okur? Uzun/thread/data/story = yüksek. Kısa hot take = düşük.
- hook: İlk cümle 3 saniyede scroll durduruyor mu? Zayıf hook = dwell 0 demek.
- reply_potential: Soru veya açık uç var mı? reply_engaged_by_author = like'ın 150 katı.
- algorithm: Hashtag yok, emoji yok, em dash yok, link reply'da. Tüm Grok kurallarına uyuyor mu?`;
}

export function buildUserMessage(params: BuildContextParams): string {
  const {
    topic,
    settings,
    recentTweets,
    radarItems,
    impressionType,
    length,
    goal,
    variations,
    xUserTweets,
  } = params;

  // recentPerf: Önce xquik'ten gelen gerçek X verisi kullanılır (xUserTweets).
  // Yoksa localStorage'daki manuel engagement girişleri (recentTweets) kullanılır.
  // Formül: like + reply×5 + rt×2 (Grok ağırlıklarına en yakın proxy)
  const recentPerf = (() => {
    if (xUserTweets && xUserTweets.length > 0) {
      // Gerçek X verisi — xquik getUserTweets'ten
      const sorted = [...xUserTweets].sort((a, b) => {
        const scoreA = a.likes + a.replies * 5 + a.retweets * 2;
        const scoreB = b.likes + b.replies * 5 + b.retweets * 2;
        return scoreB - scoreA;
      });
      return sorted
        .slice(0, 5)
        .map((t) => {
          const eng = t.likes + t.replies * 5 + t.retweets * 2;
          return `"${t.text.slice(0, 80)}..." → likes:${t.likes} replies:${t.replies} rt:${t.retweets} | algo_score:${eng}`;
        })
        .join('\n');
    }
    // Fallback: localStorage manuel veri
    return recentTweets
      .slice(0, 5)
      .map((t) => {
        const eng = t.engagement;
        const score = eng.like + eng.reply * 5 + eng.rt * 2 + eng.quote * 3;
        return `"${t.text.slice(0, 80)}..." → engagement score: ${score}, tweet score: ${t.score}`;
      })
      .join('\n') || 'No history yet';
  })();

  const trends =
    radarItems
      .slice(0, 4)
      .map((r) => `- ${r.title}`)
      .join('\n') || 'No trends available';

  const lengthGuide: Record<string, string> = {
    short: '140-200 characters',
    standard: '200-280 characters',
    extended: '280-500 characters',
  };

  const premiumNote = settings.hasPremium === false
    ? '- HESAP FREE: Tweet içine link YAZMA, link varsa reply\'a yaz. 280 karakter sınırı.'
    : '- Hesap Premium: Extended tweet (500 karakter) ve link kullanılabilir.';

  return `## Task
Generate ${variations} tweet variation(s) about: "${topic}"

## Configuration
- Impression type: ${impressionType}
- Length: ${length} (${lengthGuide[length] || '200-280 characters'})
- Goal: ${goal}
- Language: Turkish
- ${premiumNote}

## Current Trending Topics (use if relevant)
${trends}

## My Recent Tweet Performance (learn from this)
${recentPerf}

## Important
- Write in Turkish
- No hashtags, no emojis
- End with question or open loop
- Sound human, not AI-generated
- First line must hook immediately`;
}

/**
 * buildCopyPrompt — claude.ai'a yapıştırılacak kısa prompt.
 *
 * Neden ayrı?
 *   Full prompt (~1500 token) + 3 varyasyon JSON output = ~2500 token total.
 *   claude.ai bazen yanıtı kesiyor. Bu versiyon ~800 tokena düşürür.
 *   Kısaltılanlar: ALGORITHM_RULES → ALGORITHM_RULES_SHORT (~150 token),
 *   persona örnekleri yok, scoring 3 alana indirgendi.
 */
export function buildCopyPrompt(
  _systemPrompt: string, // full system prompt — copy modda kullanılmıyor
  userMessage: string,
  persona: any = null,
  settings: any = null,
  algoData: any = null,
): string {
  const algoSection = (() => {
    // xquik canlı veri varsa onu kullan (zaten kısa)
    if (algoData?.contentRules?.length) {
      return `## X Algoritması (Grok canlı)\n${algoData.contentRules.slice(0, 8).map((r: string) => `- ${r}`).join('\n')}`;
    }
    return ALGORITHM_RULES_SHORT;
  })();

  const toneNote = settings?.toneProfile ? `\nTon notu: ${settings.toneProfile}\n` : '';
  const personaLine = persona
    ? `Persona: ${persona.name || ''} — ${persona.tone || ''}\nDil kuralları: ${(persona.style_rules || []).slice(0, 3).join('; ')}`
    : 'Persona: Türkçe, doğrudan, insan gibi';

  return `Sen bir X/Twitter içerik uzmanısın. Türkçe tweet üretiyorsun.
${algoSection}
${personaLine}${toneNote}
OUTPUT FORMAT — SADECE bu JSON'u yaz, hiç açıklama ekleme:
[{"text":"tweet metni","scores":{"hook":0-22,"reply_potential":0-15,"dwell_potential":0-10},"total_score":0-100,"score_reason":"tek cümle"}]

---

${userMessage}

HATIRLATMA: Sadece JSON array döndür. Markdown code block kullanma. Açıklama yapma. Türkçe yaz.`;
}

/**
 * Thread modu için kullanıcı mesajı.
 * Thread'ler standalone tweet'e göre 3x daha fazla toplam engagement alıyor (2026).
 * Yapı: Hook → 2-3 content tweet → CTA.
 */
export function buildThreadMessage(params: BuildContextParams): string {
  const { topic, settings, radarItems, goal, xUserTweets, recentTweets } = params;
  const topTweet = (xUserTweets && xUserTweets.length > 0)
    ? xUserTweets.sort((a, b) => (b.likes + b.replies * 5 + b.retweets * 2) - (a.likes + a.replies * 5 + a.retweets * 2))[0]
    : recentTweets[0];
  const topTweetNote = topTweet
    ? `\n## En İyi Tweeti (bunu model al)\n"${topTweet.text?.slice(0, 120)}..."\n`
    : '';

  const trends =
    radarItems
      .slice(0, 3)
      .map((r) => `- ${r.title}`)
      .join('\n') || 'No trends available';

  const premiumNote = settings.hasPremium === false
    ? 'FREE hesap: Link tweet içine yazma, reply\'a yaz.'
    : 'Premium: Link ve extended içerik kullanılabilir.';

  return `## Task
"${topic}" konusunda 4-5 tweet'lik bir thread üret.

## Thread Yapısı
1. Hook tweet — scroll durduracak, merak uyandıracak ilk cümle. Soru veya şaşırtıcı stat.
2-3. Content tweet(ler) — asıl değeri ver. Her tweet bağımsız okunabilir olsun.
4-5. CTA tweet — "bunu bookmarkla", "dene", soru sor — reply çek.

## Kurallar
- Her tweet 180-260 karakter (hızlı okunuyor)
- Türkçe, hashtag yok, emoji yok
- Thread içinde aynı kelimeyi tekrarlama
- Her tweet bir sonrakini merak ettirmeli
- ${premiumNote}
- Goal: ${goal}

## Güncel Trendler (ilgili varsa kullan)
${trends}
${topTweetNote}
## Output Format — SADECE bu JSON, markdown yok:
{
  "tweets": [
    { "text": "tweet 1", "position": 1, "type": "hook" },
    { "text": "tweet 2", "position": 2, "type": "content" },
    { "text": "tweet 3", "position": 3, "type": "content" },
    { "text": "tweet 4", "position": 4, "type": "cta" }
  ],
  "total_score": 0-100,
  "score_reason": "tek cümle"
}`;
}
