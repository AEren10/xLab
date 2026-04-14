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
import type { RadarItem, ComposeAlgoData, UserTweet, TweetSearchResult, ExternalTrends } from './xquik';

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
  viralTweets?: TweetSearchResult[]; // xquik searchTweets'ten gelen viral tweetler
  externalTrends?: ExternalTrends;  // Reddit / HN / Google trendler
}

export function buildSystemPrompt(
  persona: any,
  settings: Settings,
  algoData?: ComposeAlgoData | null,
  savedTweets?: TweetEntry[]
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

  // Hook hafızası: Arşiv'den en iyi 3 tweet (engagement skoruna göre)
  const hookMemory = savedTweets && savedTweets.length > 0
    ? [...savedTweets]
        .sort((a, b) => {
          const ea = (a.engagement?.like || 0) + (a.engagement?.reply || 0) * 5 + (a.engagement?.rt || 0) * 2;
          const eb = (b.engagement?.like || 0) + (b.engagement?.reply || 0) * 5 + (b.engagement?.rt || 0) * 2;
          return eb - ea;
        })
        .slice(0, 3)
        .map((t) => `  "${t.text}"`)
        .join('\n')
    : '';

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
${hookMemory ? `\n### Senin En İyi Tweetlerin (kendi tarzın — birebir kopyalama yok, dinamiği al)\n${hookMemory}` : ''}
## Output Format
Return ONLY a JSON array. No markdown fences, no explanation:
[
  {
    "text": "tweet text",
    "scores": {
      "hook": 0-20,
      "reply_potential": 0-25,
      "dwell_potential": 0-18,
      "information": 0-15,
      "algorithm": 0-12,
      "persona": 0-10
    },
    "total_score": 0-100,
    "score_reason": "one sentence explanation"
  }
]

## Scoring Notes
- reply_potential (25 puan — EN KRİTİK): İlk cümle reply daveti açıyor mu? Soru, gerilim, açık uç. reply_engaged_by_author = like'ın 150 katı. Reply almayan tweet algoritmada görünmez.
- dwell_potential (18 puan): Kaç kişi 2+ dakika okur? Uzun/thread/data/story = yüksek. Kısa hot take = düşük. +10 Grok sinyali.
- hook (20 puan): İlk cümle 3 saniyede scroll durduruyor mu? Zayıf hook = dwell 0 demek.
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
    viralTweets,
    externalTrends,
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
    short:    'MAKSIMUM 160 karakter. Tek güçlü cümle. 160yi geçme.',
    standard: '180-240 karakter arası. 240yi geçme.',
    extended: '260-480 karakter arası. 480yi geçme. (Premium)',
  };

  const premiumNote = settings.hasPremium === false
    ? '- HESAP FREE: Tweet içine link YAZMA, link varsa reply\'a yaz. 280 karakter sınırı.'
    : '- Hesap Premium: Extended tweet (500 karakter) ve link kullanılabilir.';

  const externalTrendsBlock = (() => {
    const parts: string[] = [];
    if (externalTrends?.reddit?.length) {
      parts.push(`Reddit: ${externalTrends.reddit.slice(0, 4).map((r) => `"${r.title}"`).join(', ')}`);
    }
    if (externalTrends?.hackernews?.length) {
      parts.push(`Hacker News: ${externalTrends.hackernews.slice(0, 4).map((r) => `"${r.title}"`).join(', ')}`);
    }
    if (externalTrends?.google?.length) {
      parts.push(`Google Trends: ${externalTrends.google.slice(0, 4).map((r) => r.keyword).join(', ')}`);
    }
    if (!parts.length) return '';
    return `## Dünya Gündemi (Reddit / HN / Google)\nBu konular şu an viral — tweet konunla bağlantı kur veya görmezden gel:\n${parts.join('\n')}`;
  })();

  const viralBlock = (() => {
    if (!viralTweets || viralTweets.length === 0) return '';
    const sorted = [...viralTweets].sort((a, b) =>
      (b.likes + b.replies * 5 + b.retweets * 2) - (a.likes + a.replies * 5 + a.retweets * 2)
    );
    const top = sorted.slice(0, 5);
    const dominant = top[0];
    const dominantTone = dominant.likes > 500
      ? 'Bu kitle öfkeli/heyecanlı — aynı enerjiyle yaz.'
      : dominant.replies > dominant.likes
      ? 'Bu kitle tartışmak istiyor — reply çeken soru veya iddia at.'
      : 'Bu kitle bilgi arıyor — güçlü bir bilgi/insight ver.';

    return `## ZORUNLU: Bu Konuda Gerçekten Tutan Tweetler
İnsanlar BUNLARI paylaşıyor. Senin tweetin de bu enerjiyi taşımalı.
${dominantTone}

Şu adımları uygula:
1. En çok tutan tweete bak: İlk kelime ne? Ton ne? Soru mu, suçlama mı, itiraf mı?
2. O tonu ve o ilk cümle yapısını al. Konuyu farklı aç ama AYNI hissi ver.
3. Birebir kopyalama yok — ama daha güçsüz de yazma. En az bu kadar sert/çarpıcı ol.

${top.map((t, i) => {
  const eng = t.likes + t.replies * 5 + t.retweets * 2;
  return `[${i + 1}] Skor:${eng} (❤${t.likes} 💬${t.replies||0} 🔁${t.retweets||0})\n"${t.text}"`;
}).join('\n\n')}`;
  })();

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
- First line must hook immediately${externalTrendsBlock ? `\n\n${externalTrendsBlock}` : ''}${viralBlock ? `\n\n${viralBlock}` : ''}`;
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
  viralTweets?: TweetSearchResult[],
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

  const viralBlock = (() => {
    if (!viralTweets || viralTweets.length === 0) return '';
    const sorted = [...viralTweets].sort((a, b) =>
      (b.likes + b.replies * 5 + b.retweets * 2) - (a.likes + a.replies * 5 + a.retweets * 2)
    );
    return `## Bu Konuda En Çok Tutulan Tweetler (son 72 saat)
Bu tweetler viral oldu. Neden tuttuğunu analiz et, örüntüyü çıkar, aynı dinamikle yaz.

${sorted.slice(0, 5).map((t, i) => {
  const eng = t.likes + t.replies * 5 + t.retweets * 2;
  return `[${i + 1}] Skor:${eng} (❤${t.likes} 💬${t.replies} 🔁${t.retweets})\n"${t.text}"`;
}).join('\n\n')}`;
  })();

  return `Sen bir X/Twitter içerik uzmanısın. Türkçe tweet üretiyorsun.
${algoSection}
${personaLine}${toneNote}
OUTPUT FORMAT — SADECE bu JSON'u yaz, hiç açıklama ekleme:
[{"text":"tweet metni","scores":{"hook":0-20,"reply_potential":0-25,"dwell_potential":0-18,"information":0-15,"algorithm":0-12,"persona":0-10},"total_score":0-100,"score_reason":"tek cümle"}]

---

${userMessage}${viralBlock ? `\n\n${viralBlock}` : ''}

HATIRLATMA: Sadece JSON array döndür. Markdown code block kullanma. Açıklama yapma. Türkçe yaz.`;
}

/**
 * Thread modu için kullanıcı mesajı.
 * Thread'ler standalone tweet'e göre 3x daha fazla toplam engagement alıyor (2026).
 * Yapı: Hook → 2-3 content tweet → CTA.
 */
export function buildThreadMessage(params: BuildContextParams): string {
  const { topic, settings, radarItems, goal, xUserTweets, recentTweets, viralTweets } = params;

  const trends = radarItems.slice(0, 3).map((r) => `- ${r.title}`).join('\n') || '';
  const premiumNote = settings.hasPremium === false
    ? 'FREE hesap: Link tweet içine yazma, reply\'a yaz.'
    : 'Premium: Link ve extended içerik kullanılabilir.';

  // Viral tweetler — konuda gerçekten tutunanlar, etkileşime göre sıralı
  const viralBlock = viralTweets && viralTweets.length > 0
    ? `\n## Bu Konuda Tutmuş Tweetler (ZORUNLU OKUMA — thread bunları referans alsın)\n` +
      `Gündem nereye gidiyor, insanlar ne konuşuyor — bunu anla, thread yapısını buna göre kur:\n` +
      [...viralTweets]
        .sort((a, b) => (b.likes + (b.replies||0)*5 + (b.retweets||0)*2) - (a.likes + (a.replies||0)*5 + (a.retweets||0)*2))
        .slice(0, 5)
        .map((t, i) => {
          const eng = t.likes + (t.replies||0)*5 + (t.retweets||0)*2;
          return `[${i+1}] @${t.authorHandle} · Skor:${eng} (❤${t.likes} 💬${t.replies||0} 🔁${t.retweets||0})\n"${t.text}"`;
        })
        .join('\n\n')
    : '';

  // Kendi hesabın — varsa en iyi tweeti referans al
  const topOwnTweet = xUserTweets && xUserTweets.length > 0
    ? [...xUserTweets].sort((a, b) => (b.likes + b.replies*5 + b.retweets*2) - (a.likes + a.replies*5 + a.retweets*2))[0]
    : recentTweets[0];
  const ownTweetNote = topOwnTweet
    ? `\n## Kendi En İyi Tweetin (ses tonunu koru)\n"${topOwnTweet.text?.slice(0, 120)}"\n`
    : '';

  return `## Görev
"${topic}" konusunda 4-5 tweet'lik thread üret.

## Thread Yapısı
1. Hook — scroll durduran, merak yaratan, okutturan ilk cümle
2-3. İçerik — asıl değeri ver, her tweet bağımsız okunabilir
4-5. CTA — soru sor, reply çek, bookmark istemine yönlendir

## Kurallar
- Her tweet 180-260 karakter
- Türkçe, hashtag yok, emoji yok
- Her tweet sonrakini merak ettirmeli
- ${premiumNote}
- Hedef: ${goal}
${trends ? `\n## Radar Gündem\n${trends}` : ''}${viralBlock}${ownTweetNote}
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
