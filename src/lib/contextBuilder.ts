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
import type { RadarItem, ComposeAlgoData, UserTweet, TweetSearchResult, ExternalTrends, ThreadResult } from './xquik';
import { selectDiverseTweets as pickDiverseTweets } from './promptHeuristics';

interface BuildContextParams {
  topic: string;
  persona: any;
  settings: Settings;
  recentTweets: TweetEntry[];
  radarItems: RadarItem[];
  impressionType: string;
  angle?: string;
  mediaMode?: string;
  length: string;
  goal: string;
  variations: number;
  algoData?: ComposeAlgoData | null;
  xUserTweets?: UserTweet[]; // xquik getUserTweets'ten gelen gerçek X verisi (öncelikli)
  viralTweets?: TweetSearchResult[]; // xquik searchTweets'ten gelen viral tweetler
  viralThreads?: ThreadResult[]; // xquik thread benzeri referanslar
  externalTrends?: ExternalTrends;  // Reddit / HN / Google trendler
}

type ReplyLengthMode = 'short' | 'standard' | 'long';

function scoreTweet(tweet: Pick<TweetSearchResult, 'likes' | 'replies' | 'retweets' | 'views'>): number {
  return tweet.likes + (tweet.replies || 0) * 5 + (tweet.retweets || 0) * 2 + (tweet.views ? Math.round(tweet.views / 100) : 0);
}

function cleanSnippet(text: string, max = 180): string {
  const clean = (text || '').replace(/\s+/g, ' ').trim();
  return clean.length > max ? `${clean.slice(0, max - 1)}…` : clean;
}

function firstLine(text: string): string {
  return cleanSnippet((text || '').split('\n')[0] || '', 120);
}

function inferHookType(text: string): string {
  const lower = text.toLowerCase();
  const line = firstLine(text);

  if (/[?؟]\s*$/.test(line)) return 'soru hook';
  if (/\d/.test(line) || /%|₺|tl|usd|eur/i.test(line)) return 'data hook';
  if (lower.includes('kimse') || lower.includes('herkes') || lower.includes('yanlış') || lower.includes('değil') || lower.includes('overrated')) {
    return 'karşı görüş hook';
  }
  if (lower.includes('itiraf') || lower.includes('bugün') || lower.includes('dün') || lower.includes('geçen') || lower.includes('sabah')) {
    return 'kişisel / itiraf hook';
  }
  if (lower.startsWith('bak ') || lower.startsWith('ok.') || lower.startsWith('tamam')) {
    return 'attention grab hook';
  }
  return 'merak açığı hook';
}

function inferMechanic(tweet: TweetSearchResult): string {
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

function summarizeHookTypes(tweets: TweetSearchResult[]): { dominant: string; all: string[] } {
  const counts = new Map<string, number>();
  for (const tweet of tweets) {
    const hook = inferHookType(tweet.text);
    counts.set(hook, (counts.get(hook) || 0) + 1);
  }

  const all = [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([hook, count]) => `${hook} (${count})`);

  return {
    dominant: all[0] ? all[0].replace(/\s*\(\d+\)$/, '') : 'merak açığı hook',
    all,
  };
}

function personaRewriteHint(persona: any): string {
  const name = String(persona?.name || '').toLowerCase();
  const tone = String(persona?.tone || '').toLowerCase();
  const styleRules = Array.isArray(persona?.style_rules) ? persona.style_rules : [];
  const has = (value: string) => name.includes(value) || tone.includes(value) || styleRules.some((r: string) => String(r).toLowerCase().includes(value));

  if (has('alperk55')) return 'Persona rewrite: tarafsız bir gözlemci gibi başla, ama ima yüklü bitir. Hafif ironi kullan. "Ben bir şey demiyorum ama..." tadında. Okuyucu yoruma teşvik edilmeli, ama sen taraf tutmamış görünmelisin. Kısa, mizahi, keskin bir gözlemle bitir — soru sorma.';
  if (has('hurricane')) return 'Persona rewrite: hurricane gibi yaz. Kısa, direkt, hafif alçak ton, ilk satırda yumruk, son satırda açık uç.';
  if (has('educational')) return 'Persona rewrite: öğretici yaz. Tek güçlü fikir, net örnek, anlaşılır dil, mümkünse sayısal veya somut çerçeve.';
  if (has('controversial')) return 'Persona rewrite: tartışma aç. Fikre karşı net dur, kişiye değil; ama cümle sert, kısa ve savunulabilir olsun.';
  if (has('casual')) return 'Persona rewrite: arkadaş konuşması gibi yaz. Samimi, küçük gözlem, doğal ritim, fazla süs yok.';
  return `Persona rewrite: ${tone || 'direct'} tonunu koru, ama viral örneğin mekanizmasını bu sesle yeniden kur.`;
}

function formatContentAngle(angle: any): string {
  if (!angle) return '';
  if (typeof angle === 'string') return angle.trim();
  if (typeof angle === 'object') {
    const label = angle.title || angle.angle || angle.label || angle.name || '';
    const note = angle.note || angle.why || angle.reason || '';
    return [label, note].filter(Boolean).join(' — ').trim();
  }
  return String(angle).trim();
}

function formatBestTweetEntry(tweet: any): string {
  const text = cleanSnippet(String(tweet?.text || ''), 160);
  if (!text) return '';
  const score = tweet?.engagement_score ?? tweet?.engagement_rate ?? tweet?.score;
  const hookType = tweet?.hook_type ? ` · hook: ${tweet.hook_type}` : '';
  const why = tweet?.why_it_worked || tweet?.reason || tweet?.note;
  const scoreLabel = score != null ? ` [${typeof score === 'number' ? Math.round(score) : score}]` : '';
  return `- ${text}${scoreLabel}${hookType}${why ? ` — ${why}` : ''}`;
}

function buildPersonaMemoryBlock(persona: any, bestLimit = 20, angleLimit = 8): string {
  const bestTweets = Array.isArray(persona?.best_performing_tweets)
    ? persona.best_performing_tweets
        .map((tweet: any) => formatBestTweetEntry(tweet))
        .filter(Boolean)
        .slice(0, bestLimit)
    : [];

  const contentAngles = Array.isArray(persona?.content_angles)
    ? persona.content_angles
        .map((angle: any) => formatContentAngle(angle))
        .filter(Boolean)
        .slice(0, angleLimit)
    : [];

  if (!bestTweets.length && !contentAngles.length) return '';

  return `## Persona Hafızası
Bu bölüm, bu hesabın hangi mekaniklerle tuttuğunu gösterir. Kelimeleri değil, kalıbı öğren.
${contentAngles.length ? `### Tutan içerik açıları\n${contentAngles.map((angle: string) => `- ${angle}`).join('\n')}\n` : ''}
${bestTweets.length ? `### En iyi tweet örnekleri\n${bestTweets.join('\n')}\n` : ''}
Kural: Aynı mekanik, farklı cümle. Hook, ritim, kapanış, ima seviyesi ve soru kullanımını al; metni yeniden kur.`;
}

function buildInspirationBlock(
  tweets: TweetSearchResult[] | undefined,
  persona: any,
  label = 'Viral İlham Mekaniği',
  topic = ''
): string {
  if (!tweets || tweets.length === 0) return '';

  const sorted = pickDiverseTweets(tweets, 4, topic);
  const hookSummary = summarizeHookTypes(sorted);

  const personaHint = personaRewriteHint(persona);
  return `## ${label}
Bu tweetlerin içinden bir kalıp seç. Hook yapısını, cümle ritmini ve kapanış mantığını çöz.
Kelimeyi değil mekanizmayı al. Aynı kalıp, yeni cümle.
${personaHint}

## Hook Kilidi
Bu referanslarda baskın hook tipi: ${hookSummary.dominant}
Görülen hook'lar: ${hookSummary.all.join(', ')}
Kural: Yeni tweet/yanıt üretirken bu hook tipine yakın kal. Hook'u değiştireceksen, aynı etkiyi başka bir mekanikle kur.

${sorted.map((t, i) => {
  const score = scoreTweet(t);
  const hook = inferHookType(t.text);
  const mechanic = inferMechanic(t);
  return `[${i + 1}] Skor:${score} (❤${t.likes} 💬${t.replies || 0} 🔁${t.retweets || 0})\nHook: ${hook}\nMekanik: ${mechanic}\nTweet: "${cleanSnippet(t.text, 180)}"`;
}).join('\n\n')}

  Kural: Referans tweetin yüzeyini değil, mekanizmasını taklit et. Persona sesiyle, ama yeni kelimelerle yeniden kur.`;
}

function buildLengthContract(length: string, hasPremium: boolean): { guide: string; variationHint: string; emphasis: string } {
  if (length === 'short') {
    return {
      guide: 'Kısa mod: 70-120 karakter, 8-15 kelime, tek cümle. Fazla açıklama yapma. Vurucu başla, hızlı bitir.',
      variationHint: 'Varyasyonlar aynı bantta kalsın ama biri daha sert, biri daha alaycı, biri daha direkt olsun.',
      emphasis: 'Tek yumruk etki.',
    };
  }

  if (length === 'extended') {
    return {
      guide: hasPremium
        ? 'Uzun mod: 260-420 karakter, 35-70 kelime, 3-5 cümle. Mini giriş + orta bölüm + payoff kur. Gerekirse satır kır.'
        : 'Uzun mod: 240-280 karakter, 30-45 kelime, 2-4 cümle. Free hesap sınırını geçme ama diğer modlardan bariz uzun yaz.',
      variationHint: 'Bir varyasyon daha hikayeli, biri daha bilgi ağırlıklı, biri daha güçlü kapanışlı olsun.',
      emphasis: 'Nefesli ve katmanlı anlatım.',
    };
  }

  return {
    guide: 'Standart mod: 150-220 karakter, 18-30 kelime, 1-2 cümle. Açıklayıcı ama sıkı kal. Ne kısa tweet kadar sert ne uzun tweet kadar dağınık olsun.',
    variationHint: 'Bir varyasyon kısa açılışlı, biri açıklamalı, biri daha akıcı ve dengeli olsun.',
    emphasis: 'Orta yoğunluk, net akış.',
  };
}

function buildAngleContract(angle?: string): { label: string; guide: string; promptHint: string } {
  switch ((angle || 'auto').toLowerCase()) {
    case 'sharp':
      return {
        label: 'Sivri açı',
        guide: 'Daha net, daha keskin, daha kısa yaz. Bir cümlede pozisyon al.',
        promptHint: 'sharp, direct, punchy, slightly provocative, no filler, fast hook',
      };
    case 'counter':
      return {
        label: 'Karşı görüş',
        guide: 'Hafif zıtlık kur. Herkesin söylediğini tekrar etme; küçük bir ters köşe ekle.',
        promptHint: 'counterpoint, mild disagreement, tension, crisp but fair, reply-friendly',
      };
    case 'question':
      return {
        label: 'Soru açısı',
        guide: 'Cevaptan çok soru veya açık loop kur. Reply çekmesini öncelik yap.',
        promptHint: 'question-led, open loop, conversational, reply bait without sounding bait-y',
      };
    case 'story':
      return {
        label: 'Hikaye açısı',
        guide: 'Küçük anekdot, gözlem veya sahne ile aç. İnsan hissi katsın.',
        promptHint: 'story-driven, human, vivid but concise, scene-based opening',
      };
    case 'nuance':
      return {
        label: 'Nüanslı açı',
        guide: 'Tek cümlede fazla bağırma. İnce bir ayrım, küçük ama akıllı bir nüans koy.',
        promptHint: 'nuanced, balanced, smart, subtle tension, understated confidence',
      };
    default:
      return {
        label: 'Otomatik açı',
        guide: 'Konuya göre en uygun açı seçilsin.',
        promptHint: 'auto-select the strongest angle for the topic',
      };
  }
}

function buildReplyLengthContract(replyLength: ReplyLengthMode): { label: string; guide: string; maxChars: number; minChars: number; retryHint: string } {
  if (replyLength === 'short') {
    return {
      label: 'Kısa reply',
      minChars: 35,
      maxChars: 80,
      guide: 'Tek cümle, 35-80 karakter. Kısa, sivri, hızlı reaksiyon. Gereksiz bağlam yok.',
      retryHint: 'Kısa reply üretirken tweeti özetleme; sadece tek bir açıdan küçük ama sert bir tepki ver.',
    };
  }

  if (replyLength === 'long') {
    return {
      label: 'Uzun reply',
      minChars: 90,
      maxChars: 170,
      guide: '2 cümle, 90-170 karakter. Bir gözlem + bir nüans veya küçük karşılık. Çok uzatma ama tek satır da kalma.',
      retryHint: 'Uzun reply üretirken mini haber özeti yazma; iki parçalı doğal bir cevap kur.',
    };
  }

  return {
    label: 'Standart reply',
    minChars: 55,
    maxChars: 120,
    guide: '1 cümle veya 1 cümle + kısa ek. 55-120 karakter. Dengeli, doğal, feed içi cevap gibi.',
    retryHint: 'Standart reply üretirken rahat ama sıkı kal; tweeti yeniden anlatma.',
  };
}

function inferReplyAngle(text: string): { title: string; instruction: string; doNot: string } {
  const lower = (text || '').toLowerCase();

  if (/(injur|sakat|return|geri dön|dönüyor|dönmek|lineup|kadro|match|maç|pitch|saha|anfield|derbi)/i.test(lower)) {
    return {
      title: 'Sports/news reply',
      instruction: 'Tweeti tekrar etme. Dönüşün etkisine, riskine veya sahadaki sonucuna kısa bir vurgu yap. Bir tık skeptik veya nüanslı ol.',
      doNot: 'Haber özeti yazma; "Açısından çıktı..." gibi düz cümlelerle aynı cümleyi yeniden kurma.',
    };
  }

  if (/\?$/.test(lower) || /(neden|nasıl|hangi|sence|ne düşün)/i.test(lower)) {
    return {
      title: 'Question reply',
      instruction: 'Soruyu cevapla ama tek cümlelik net bir stance ver. İki tarafı da söyleme, bir taraf seç.',
      doNot: 'Kararsız, yuvarlak cevap verme.',
    };
  }

  if (/\d|%|₺|tl|usd|eur/i.test(lower)) {
    return {
      title: 'Data reply',
      instruction: 'Sayının sonucunu yorumla. Veriyi tekrar etme; ne anlama geldiğini ve neden önemli olduğunu söyle.',
      doNot: 'İstatistik özeti yapma.',
    };
  }

  if (/(bence|düşün|fikrim|yanlış|doğru|katılmıyorum|katılıyorum|overrated|abartı)/i.test(lower)) {
    return {
      title: 'Opinion reply',
      instruction: 'Kısa bir karşı görüş veya teyit ver. Bir fikri destekliyorsan nedenini tek detayla bağla; karşı çıkıyorsan sert ama ölçülü ol.',
      doNot: 'Genel geçer laf etme.',
    };
  }

  return {
    title: 'Conversation reply',
    instruction: 'Doğal bir feed yanıtı yaz. Bir küçük gözlem, bir minik twist veya bir net reaksiyon ekle. Sanki biri tweet atmış da sen anında cevap veriyorsun.',
    doNot: 'Tweeti yeniden anlatma.',
  };
}

function buildReplyRecipe(tweet: TweetSearchResult): string {
  const angle = inferReplyAngle(tweet.text);
  return `## Reply Açısı
- Tür: ${angle.title}
- Yap: ${angle.instruction}
- Yapma: ${angle.doNot}

## Reply Formülü
1) Tek bir görüş seç.
2) Tweetten sadece 1 somut detay kullan.
3) O detaya bir reaksiyon, nüans veya küçük çarpışma ekle.
4) Cümleyi uzatma.

## Sert Kural
Bu tweetin haber özeti, yeniden yazımı ya da temiz paraphrase'i olmasın. Reply, postun üstüne yeni bir şey koysun.`;
}

function buildOwnTweetMemoryBlock(ownTweets?: { text: string; likes: number; replies: number; retweets: number }[]): string {
  if (!ownTweets || ownTweets.length === 0) return '';
  const best = [...ownTweets]
    .sort((a, b) => (b.likes + b.replies * 5 + b.retweets * 2) - (a.likes + a.replies * 5 + a.retweets * 2))
    .slice(0, 5)
    .map((t, i) => `- [${i + 1}] ${cleanSnippet(t.text, 110)} (❤${t.likes} 💬${t.replies} 🔁${t.retweets})`)
    .join('\n');

  return `## Kendi Hesap Hafızan
Bu hesaptan gelen örnekler reply tonunu ayarlamak için referans olsun. Aynı cümleyi kopyalama; ritim, sertlik ve doğallığı al.
${best}`;
}

export function buildReplyPrompt(params: {
  tweet: TweetSearchResult;
  persona: any;
  settings: Settings;
  query: string;
  inspirationTweets?: TweetSearchResult[];
  ownTweets?: { text: string; likes: number; replies: number; retweets: number }[];
  replyLength?: ReplyLengthMode;
  retryNote?: string;
  attempt?: number;
}): string {
  const { tweet, persona, settings, query, inspirationTweets, ownTweets, replyLength = 'standard', retryNote, attempt = 1 } = params;
  const personaBlock = personaRewriteHint(persona);
  const topExamples = (inspirationTweets || [])
    .filter((t) => t.id !== tweet.id);
  const inspirationBlock = buildInspirationBlock(topExamples, persona, 'Bu Konudaki Tutan Reply İlhamı', query);
  const personaMemoryBlock = buildPersonaMemoryBlock(persona, 8, 4);
  const replyRecipe = buildReplyRecipe(tweet);
  const lengthContract = buildReplyLengthContract(replyLength);
  const ownTweetMemoryBlock = buildOwnTweetMemoryBlock(ownTweets);

  return `Sen bir X reply uzmanısın. Hedefin bu tweete doğal, keskin, insan gibi bir reply yazmak.

## Persona
${persona?.name || 'Default'} — ${persona?.tone || 'direct'}
${personaBlock}
${personaMemoryBlock ? `${personaMemoryBlock}\n` : ''}
${ownTweetMemoryBlock ? `${ownTweetMemoryBlock}\n` : ''}
${settings.toneProfile ? `\n## Ton Notu\n${settings.toneProfile}\n` : ''}
${query ? `## Niche / Konu\n${query}\n` : ''}
## Reply Uzunluğu
${lengthContract.label}
${lengthContract.guide}
${lengthContract.retryHint}
${attempt > 1 ? `\n## Retry Notu\n${retryNote || 'Bir önceki denemeyi tekrar etme. Farklı açıda, daha doğal yaz.'}` : ''}
${replyRecipe}
${inspirationBlock ? `${inspirationBlock}\n` : ''}
## Hedef Tweet
@${tweet.authorHandle || 'user'} · ❤${tweet.likes} 💬${tweet.replies || 0} 🔁${tweet.retweets || 0}${tweet.views ? ` 👁${tweet.views}` : ''}
"${cleanSnippet(tweet.text, 420)}"

## Reply Kuralları
- İdeal aralık ${lengthContract.minChars}-${lengthContract.maxChars} karakter
- Sadece bu tweete tepki ver, başka konu getirme
- Ana tweetin mekanizmasını yakala ama yeni açıyı sen kur
- Açık uç bırakmak serbest, ama soru zorunlu değil
- Türkçe, hashtag yok, emoji yok
- AI dili yok; düz, net, insan gibi yaz
- Kısa ve vurucu; gereksiz kelime yok
- İlk kelime tweeti tekrar etmesin; mümkünse reaksiyon / stance ile başla
- Cümle "haber özeti" gibi değil, "feed içi cevap" gibi duyulsun
- Eğer reply tweeti fazla özetliyorsa, yeniden denemede özet değil tepki yaz

Sadece reply metnini döndür, açıklama yazma.`;
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
    .slice(0, 8)
    .map((t: any) => {
      const score = t.engagement_score ?? t.engagement_rate ?? t.score;
      const note = t.why_it_worked || t.reason || t.note;
      const hookType = t.hook_type ? ` | ${t.hook_type}` : '';
      return `  "${t.text}"${score != null ? ` [${typeof score === 'number' ? Math.round(score) : score}]` : ''}${hookType}${note ? ` — ${note}` : ''}`;
    })
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
  const rewriteNote = `\n## Rewrite Rule\nViral örnekler kopyalanacak cümleler değil; çözülecek mekaniklerdir. Aynı hook mantığını, aynı duygusal sıcaklığı ve aynı ritmi bu persona sesiyle yeniden yaz.\n`;
  const personaMemoryBlock = buildPersonaMemoryBlock(persona, 20, 8);

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
          ? algoData.contentRules.map((r: any) => `- ${typeof r === 'string' ? r : r.text || r.rule || JSON.stringify(r)}`).join('\n')
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
${rewriteNote}
${personaMemoryBlock ? `${personaMemoryBlock}\n` : ''}
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
    persona,
    settings,
    recentTweets,
    radarItems,
    impressionType,
    angle,
    mediaMode,
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
    short:    '70-120 karakter. 8-15 kelime. Tek cümle. En kısa, en sert versiyon.',
    standard: '150-220 karakter. 18-30 kelime. 1-2 cümle. Dengeli ve temiz.',
    extended: settings.hasPremium === false
      ? '240-280 karakter. 30-45 kelime. 2-4 cümle. Free sınırını aşma.'
      : '260-420 karakter. 35-70 kelime. 3-5 cümle. Uzun ve katmanlı.',
  };
  const lengthContract = buildLengthContract(length, settings.hasPremium !== false);
  const angleContract = buildAngleContract(angle);
  const mediaPreference = (mediaMode || 'auto').toLowerCase();

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

  const viralBlock = buildInspirationBlock(viralTweets, persona, 'Bu Konuda En Çok Tutan Tweetler', topic);

  return `## Task
Generate ${variations} tweet variation(s) about: "${topic}"

## Configuration
- Impression type: ${impressionType}
- Length: ${length} (${lengthGuide[length] || '200-280 characters'})
- Length contract: ${lengthContract.guide}
- Angle: ${angleContract.label}
- Angle contract: ${angleContract.guide}
- Media preference: ${mediaPreference}
- Goal: ${goal}
- Language: Turkish
- ${premiumNote}

## Length Variation Rule
${lengthContract.variationHint}
${variations > 1 ? `- Çoklu varyasyonda her tweet aynı uzunlukta olmasın.\n- 1. varyasyon: alt sınır\n- 2. varyasyon: orta bant\n- 3. varyasyon: üst bant\n- Ama hepsi seçilen length bandının içinde kalsın.` : ''}

## Current Trending Topics (use if relevant)
${trends}

${viralBlock ? `${viralBlock}\n` : ''}

## My Recent Tweet Performance (learn from this)
${recentPerf}

## Important
- Write in Turkish
- No hashtags, no emojis
- End with question or open loop
- Sound human, not AI-generated
- First line must hook immediately
- If generating multiple variations, make each one use a different hook type or angle when possible
- Keep the selected length mode obvious. Do not let short, standard, and extended collapse into the same word count.
- Keep the selected angle obvious. Do not let "sivri" and "nüanslı" collapse into the same tone.
- If media preference is not auto, align the writing with that media form.
- Borrow the mechanism from the viral examples above, then rewrite it in the active persona's voice
${externalTrendsBlock ? `\n\n${externalTrendsBlock}` : ''}`;
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
  length: string = 'standard',
): string {
  const algoSection = (() => {
    // xquik canlı veri varsa onu kullan (zaten kısa)
    if (algoData?.contentRules?.length) {
      return `## X Algoritması (Grok canlı)\n${algoData.contentRules.slice(0, 8).map((r: any) => `- ${typeof r === 'string' ? r : r.text || r.rule || JSON.stringify(r)}`).join('\n')}`;
    }
    return ALGORITHM_RULES_SHORT;
  })();

  const toneNote = settings?.toneProfile ? `\nTon notu: ${settings.toneProfile}\n` : '';
  const personaLine = persona
    ? `Persona: ${persona.name || ''} — ${persona.tone || ''}\nDil kuralları: ${(persona.style_rules || []).slice(0, 3).join('; ')}`
    : 'Persona: Türkçe, doğrudan, insan gibi';
  const personaMemoryBlock = buildPersonaMemoryBlock(persona, 8, 4);
  const lengthContract = buildLengthContract(length, settings?.hasPremium !== false);

  return `Sen bir X/Twitter içerik uzmanısın. Türkçe tweet üretiyorsun.
${algoSection}
${personaLine}${toneNote}
${personaMemoryBlock ? `${personaMemoryBlock}\n` : ''}
Length mode: ${lengthContract.guide}
OUTPUT FORMAT — SADECE bu JSON'u yaz, hiç açıklama ekleme:
[{"text":"tweet metni","scores":{"hook":0-20,"reply_potential":0-25,"dwell_potential":0-18,"information":0-15,"algorithm":0-12,"persona":0-10},"total_score":0-100,"score_reason":"tek cümle"}]

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
  const { topic, persona, settings, radarItems, goal, xUserTweets, recentTweets, viralTweets, viralThreads, angle, mediaMode } = params;

  const trends = radarItems.slice(0, 3).map((r) => `- ${r.title}`).join('\n') || '';
  const premiumNote = settings.hasPremium === false
    ? 'FREE hesap: Link tweet içine yazma, reply\'a yaz.'
    : 'Premium: Link ve extended içerik kullanılabilir.';

  // Viral tweetler — konuda gerçekten tutunanlar, etkileşime göre sıralı
  const viralBlock = viralThreads && viralThreads.length > 0
    ? `\n## Bu Konuda Tutmuş Thread Referansları\n${viralThreads.slice(0, 3).map((t, i) => {
        return `[${i + 1}] ${t.authorHandle || t.author} · ${t.totalTweets} tweet\nHook: ${cleanSnippet(t.firstTweet, 160)}\nSkor ipucu: ${t.likes || 0} like`;
      }).join('\n\n')}`
    : buildInspirationBlock(viralTweets, persona, 'Bu Konudaki Viral Tweet Mekaniği', topic);

  const ownTweetCandidates = xUserTweets && xUserTweets.length > 0
    ? xUserTweets.map((tweet) => ({
        text: tweet.text,
        likes: tweet.likes,
        replies: tweet.replies,
        retweets: tweet.retweets,
      }))
    : recentTweets.map((tweet) => ({
        text: tweet.text,
        likes: tweet.engagement?.like || 0,
        replies: tweet.engagement?.reply || 0,
        retweets: tweet.engagement?.rt || 0,
      }));
  const ownTweetNote = buildOwnTweetMemoryBlock(ownTweetCandidates);
  const personaMemoryBlock = buildPersonaMemoryBlock(persona, 10, 5);

  return `## Görev
"${topic}" konusunda 4-5 tweet'lik thread üret.

## Thread Yazım Stratejisi
- İlk tweet tek başına güçlü bir hook olmalı: iddia, merak boşluğu veya kontrast kur.
- İkinci tweet bağlam açmalı: "neden bu konu önemli?" sorusunu cevapla.
- Üçüncü tweet asıl değeri vermeli: framework, veri, örnek veya net çıkarım.
- Dördüncü tweet dönüş noktası olmalı: beklenmeyen insight, karşılaştırma veya mini hikaye.
- Son tweet CTA olmalı: soru, açık uç, reply daveti veya bookmark sebebi.
- Her tweet bağımsız okunabilir olsun ama bir sonrakini de merak ettirsin.
- Aynı hook'u tekrar etme; her tweet kendi işini yapsın.
- Farklı tweetlerde aynı giriş kalıbını tekrar etme; ritmi bilinçli çeşitlendir.
- Angle tercihi: ${buildAngleContract(angle).guide}
- Media tercihi: ${mediaMode || 'auto'}

## Kurallar
- Her tweet 180-260 karakter
- Türkçe, hashtag yok, emoji yok
- Her tweet sonrakini merak ettirmeli
- Thread tek bir fikir etrafında dönmeli, ama her tweet yeni bir katman eklemeli
- ${premiumNote}
  - Hedef: ${goal}
${personaMemoryBlock ? `\n${personaMemoryBlock}\n` : ''}${trends ? `\n## Radar Gündem\n${trends}` : ''}${viralBlock}${ownTweetNote ? `\n${ownTweetNote}` : ''}
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
