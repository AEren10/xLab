import { useState, useEffect, useCallback, useRef, useLayoutEffect, useMemo } from 'react';
import { TweetCard } from '../components/TweetCard';
import { InspirationSpotlight } from '../components/InspirationSpotlight';
import { ContextPreview } from '../components/ContextPreview';
import { PageHeader } from '../components/PageHeader';
import { Tooltip } from '../components/Tooltip';
import { db } from '../lib/db';
import type { AccountProfile } from '../lib/db';
import { xquikApi } from '../lib/xquik';
import type { RadarItem, ComposeAlgoData, UserTweet, TweetSearchResult, ExternalTrends, ThreadResult } from '../lib/xquik';
import { claudeApi } from '../lib/claude';
import type { TweetVariation, TweetThread } from '../lib/claude';
import { enrichPersonaWithTweets, loadPersonaById, persistEnrichedPersona } from '../lib/persona';
import {
  buildSystemPrompt,
  buildUserMessage,
  buildThreadMessage,
  buildCopyPrompt,
} from '../lib/contextBuilder';
import {
  buildTopicSearchQueries,
  buildTopicSearchLanguages,
  rankContextualTweets,
} from '../lib/promptHeuristics';
import { getCurrentSlot } from '../lib/skill';

const IMPRESSION_TYPES = [
  { id: 'Data',     label: 'Veri',      tip: 'Stat, rakam, araştırma. Güvenilirlik yüksek, bookmark alan içerik.' },
  { id: 'Story',    label: 'Hikaye',    tip: 'Kişisel deneyim. Dwell time artırır — okutturan içerik.' },
  { id: 'Hot Take', label: 'Cesur Fikir', tip: 'Tartışma açar, reply patlar. Dikkatli kullan, negatif sinyal riski var.' },
  { id: 'Edu',      label: 'Eğitici',   tip: 'Öğretici. "Bunu bilmiyordum" bookmark oranı yüksek.' },
  { id: 'Inspire',  label: 'İlham',     tip: 'Motivasyon, bakış açısı. RT ve quote alır, reply az.' },
  { id: 'Humor',    label: 'Mizah',     tip: 'Bağlam gerektirir. Yanlış zamanda atılırsa sıfır reach.' },
];

const ANGLES = [
  { id: 'auto',    label: 'Otomatik', tip: 'Konuya göre en uygun açı seçilsin.' },
  { id: 'sharp',   label: 'Sivri',    tip: 'Daha sert, daha net ve daha iddialı.' },
  { id: 'nuance',  label: 'Nüans',    tip: 'Daha dengeli ve ince bir ton.' },
  { id: 'question', label: 'Soru',    tip: 'Reply çeken açık loop kur.' },
  { id: 'counter', label: 'Karşı Görüş', tip: 'Küçük bir ters köşe / zıtlık ekle.' },
  { id: 'story',   label: 'Hikaye',   tip: 'Küçük anekdot veya sahne hissi ver.' },
];

const MEDIA_MODES = [
  { id: 'auto',    label: 'Otomatik', tip: 'Model içerikten medya biçimini seçsin.' },
  { id: 'text',    label: 'Metin',    tip: 'Saf metin, görsel baskın olmasın.' },
  { id: 'image',   label: 'Görsel',   tip: 'Screenshot, quote card veya infografik hissi.' },
  { id: 'video',   label: 'Video',    tip: 'Video kapağı / clip hissiyle yaz.' },
  { id: 'quote',   label: 'Quote',    tip: 'Alıntı tweet / reply hissi ver.' },
];

const LENGTHS = [
  { id: 'short',    label: 'Kısa',     tip: '140-200 karakter. Hook gücü çok kritik, tek cümle işi bitirir.' },
  { id: 'standard', label: 'Standart', tip: '200-280 karakter. En güvenli alan. Grok bunu favoriyor.' },
  { id: 'extended', label: 'Uzun',     tip: '280-500 karakter (Premium gerekir). Dwell time +10 puan — ama hook daha güçlü olmalı.' },
];

const GOALS = [
  { id: 'Engagement', label: 'Etkileşim', tip: 'Reply ve bookmark çek. En güçlü büyüme sinyali.' },
  { id: 'Followers',  label: 'Takipçi',   tip: 'Değer ver, follow bıraktır. Yeni hesap için öncelikli.' },
  { id: 'Authority',  label: 'Otorite',   tip: 'Bilgi + güven inşa et. Uzun vadede en karlı.' },
];

const VARIATIONS_OPTS = [1, 2, 3];
const INSPIRATION_HOURS_OPTS = [4, 12, 24, 72];

// Boş ekranda gösterilecek Grok algoritması ipuçları
const ALGO_TIPS = [
  {
    icon: '⚡',
    title: 'İlk 1 saat hayat memat',
    desc: 'Tweet atınca hemen 2-3 kendi reply\'ını yaz. Gelen her reply\'a hızlıca cevap ver. İlk saatte kötü performans = tweet ölü doğar. Velocity kuralı: 15 dakikada 10 reply >> 24 saatte 10 reply.',
    color: 'border-accent-green/20 bg-accent-green/[0.04]',
  },
  {
    icon: '↩',
    title: 'Reply en güçlü sinyal — 150x like',
    desc: 'reply_engaged_by_author ağırlığı 75 — like\'ın 150 katı. Standalone reply 27x. Büyük hesaplara iyi reply at, juice transfer (TweepCred aktarımı) al.',
    color: 'border-accent/20 bg-accent/[0.04]',
  },
  {
    icon: '⏱',
    title: 'Dwell Time — Grok seni izliyor',
    desc: 'P(dwell) Grok\'un model outputlarından biri. 2+ dakika okuma: +10 puan. 3 saniyeden az scroll pass: quality multiplier -%15-20. Thread veya uzun format dwell time\'ı 3x artırıyor.',
    color: 'border-accent-yellow/20 bg-accent-yellow/[0.04]',
  },
  {
    icon: '📌',
    title: 'Bookmark = DM kadar güçlü',
    desc: 'Bookmark ağırlığı: 10 (like\'ın 20 katı). "Bunu kaydet" aldıran içerik yaz: data, guide, checklist, reusable framework. Edu ve Data formatı bookmark oranı en yüksek.',
    color: 'border-accent-green/20 bg-accent-green/[0.04]',
  },
  {
    icon: '🧵',
    title: 'Thread: dwell + bookmark combo',
    desc: 'Thread modunda 4-5 tweet üret. Hook tweet tutarsa tüm thread görünür. Her tweet bağımsız okunabilir olmalı — okuyucu istediği yerden girebilmeli.',
    color: 'border-accent/20 bg-accent/[0.04]',
  },
  {
    icon: '📸',
    title: 'Medya ek sinyal açar',
    desc: 'Fotoğraf: photo_expand sinyali. Video: vqv (video quality view, minimum süre eşiği gerekiyor). Medyasız tweet bu sinyalleri kaçırıyor — önemli içeriğe görsel ekle.',
    color: 'border-accent-yellow/20 bg-accent-yellow/[0.04]',
  },
  {
    icon: '🚫',
    title: 'Hashtag ve emoji yasak',
    desc: 'Grok sentiment analizi yapıyor. Hashtag nötr/negatif, em dash (—) AI sinyali. Obvious engagement bait ("like if agree") tespit edilip bastırılıyor.',
    color: 'border-accent-red/20 bg-accent-red/[0.04]',
  },
  {
    icon: '🔗',
    title: 'Link tweet içinde = sıfır reach',
    desc: 'Free hesapta link tweet içindeyse %30-50 reach kaybı. Linki reply\'a yaz. Premium hesapta da linki ana tweetin içine koymak yerine reply tercih et.',
    color: 'border-accent-orange/20 bg-accent-orange/[0.04]',
  },
  {
    icon: '📊',
    title: 'TweepCred eşiği: 65',
    desc: 'Her hesabın 0-100 arası gizli bir TweepCred skoru var. 65 altında = sadece 3 tweet dağıtım için seçiliyor. 65 üstünde = tüm tweetler uygun. Mavi tik: otomatik +100 başlangıç.',
    color: 'border-accent-red/20 bg-accent-red/[0.04]',
  },
];

/**
 * TimingBadge — Istanbul UTC+3 saatine göre anlık slot gösterir.
 *
 * Saat nereden geliyor?
 *   skill.ts'teki TIMING_SLOTS sabit verisi. Akademik kaynak değil —
 *   Hurricane @hrrcnes'in 59B impression analiziyle doğrulanmış Türk kitlesi için
 *   en yüksek engagement alan zaman dilimleri.
 *
 * Neden bu saatler?
 *   07:30-09:00 Sabah commute: Telefon yoğun, motivasyon içerik çalışıyor
 *   12:00-13:30 Öğle molası: Kısa içerik, hot take
 *   20:00-22:30 Peak: Türk kullanıcıların en aktif olduğu zaman — reply chain için ideal
 *   23:00-00:30 Gece niche: Düşük rekabet, niş kitleye ulaşmak için iyi
 *
 * "Weak" dönemde tweet atmak kötü mü?
 *   Hayır — sadece ilk dağıtım kitlesi küçük başlar. Golden Hour mantığı aynı.
 */
function TimingBadge() {
  const slot = getCurrentSlot();
  const now = new Date();
  const utc = now.getTime() + now.getTimezoneOffset() * 60000;
  const istanbul = new Date(utc + 3 * 3600000);
  const timeStr = istanbul.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });

  const colors = {
    best:   'text-accent-green bg-accent-green/10 border-accent-green/30',
    good:   'text-accent-green bg-accent-green/10 border-accent-green/20',
    medium: 'text-accent-yellow bg-accent-yellow/10 border-accent-yellow/30',
    ok:     'text-[#6b6b72] bg-white/[0.04] border-white/[0.07]',
    weak:   'text-accent-red bg-accent-red/10 border-accent-red/30',
  };
  const qualityLabel = { best: 'En iyi slot', good: 'İyi slot', medium: 'Orta slot', ok: 'Sakin slot', weak: 'Zayıf slot' };

  return (
    <div className={`group relative inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs cursor-default ${colors[slot.quality]}`}>
      <span className="font-semibold">{slot.label}</span>
      <span className="opacity-60">·</span>
      <span className="opacity-60">{slot.tip}</span>
      <span className="opacity-40 ml-1">{timeStr} İST</span>

      {/* Hover açıklaması */}
      <div className="pointer-events-none absolute left-0 top-full mt-2 z-50 hidden group-hover:block
                      bg-[#1c1c22] border border-white/[0.1] rounded-xl p-3 w-72 shadow-2xl shadow-black/60">
        <p className="text-[11px] font-semibold text-[#e8e8e0] mb-1">{qualityLabel[slot.quality]} — Neden?</p>
        <p className="text-[10px] text-[#8b8b96] leading-relaxed">
          Bu saatler Hurricane @hrrcnes'in 59B impression analizinden. Türk kitlesinin en aktif olduğu
          dilimler. Peak saatte (20:00-22:30) reply chain başlatmak için ideal — velocity kuralı:
          15 dakikada 10 reply, 24 saatte 10 reply'dan çok daha değerli.
        </p>
        <p className="text-[10px] text-[#4a4a55] mt-2">Zayıf slotta atılan tweet kötü değil — sadece küçük kitleyle başlar.</p>
      </div>
    </div>
  );
}

// İmpresyon tipine göre medya önerisi
const MEDIA_TIPS: Record<string, { type: string; why: string; color: string }> = {
  'Data':     { type: 'İnfografik / Tablo', why: 'Sayıları görsel yap — photo_expand sinyali açar (+2 puan)', color: 'border-accent/20 text-accent' },
  'Story':    { type: 'Kişisel Fotoğraf',   why: 'Yüz + gerçek an = güven, dwell time uzar',                  color: 'border-accent-green/20 text-accent-green' },
  'Hot Take': { type: 'Görsel Gerekmez',    why: 'Hot take metin gücüyle çalışır — görsel dikkat dağıtır',     color: 'border-[#4a4a55] text-[#8b8b96]' },
  'Edu':      { type: 'Screenshot / Diyagram', why: 'Adım adım görsel = bookmark oranı artar',                color: 'border-accent-yellow/20 text-accent-yellow' },
  'Inspire':  { type: 'Alıntı Kartı',       why: 'Temiz bg üstüne tek cümle — RT / quote bait',               color: 'border-accent/20 text-accent' },
  'Humor':    { type: 'Meme / GIF',         why: 'Varsa güçlendirir, yoksa metin yeterli',                    color: 'border-accent-orange/20 text-accent-orange' },
};

async function scoreGeneratedVariations(apiKey: string, variations: TweetVariation[]): Promise<TweetVariation[]> {
  if (!apiKey || variations.length === 0) return variations;

  const scored = await Promise.all(
    variations.map(async (tweet) => {
      const xquikScore = await xquikApi.scoreTweet(apiKey, tweet.text);
      return { ...tweet, xquikScore };
    })
  );

  return scored.sort((a, b) => {
    const aExternal = a.xquikScore?.total ?? a.total_score;
    const bExternal = b.xquikScore?.total ?? b.total_score;
    if (bExternal !== aExternal) return bExternal - aExternal;
    return b.total_score - a.total_score;
  });
}

async function scoreThreadWithXquik(apiKey: string, thread: TweetThread): Promise<TweetThread> {
  if (!apiKey || !thread?.tweets?.length) return thread;
  const draft = thread.tweets.map((tweet) => tweet.text).join('\n\n');
  const xquikScore = await xquikApi.scoreTweet(apiKey, draft);
  return { ...thread, xquikScore };
}

/**
 * MediaSuggestion — seçilen impressionType'a göre "hangi görseli ekle" önerisi.
 * Kaynak: Grok'ta photo_expand (+2) ve vqv (+2) sinyalleri ayrı ölçülüyor.
 * Görsel = bu iki sinyali açar, medyasız tweet bunları kaçırır.
 */
function MediaSuggestion({ impressionType }: { impressionType: string }) {
  const tip = MEDIA_TIPS[impressionType];
  if (!tip) return null;
  return (
    <div className={`flex items-start gap-3 rounded-xl border px-3.5 py-2.5 mb-3 ${tip.color} bg-white/[0.02]`}>
      <span className="text-sm shrink-0 mt-0.5">📸</span>
      <div>
        <p className={`text-[11px] font-semibold ${tip.color.split(' ')[1]}`}>
          Önerilen Görsel: {tip.type}
        </p>
        <p className="text-[10px] text-[#6b6b72] mt-0.5">{tip.why}</p>
      </div>
    </div>
  );
}

/*
function WorkbenchSnapshot({
  topic,
  personaId,
  mode,
  impressionType,
  angle,
  mediaMode,
  length,
  goal,
  selectedExampleCount,
  inspirationCount,
  userTweetCount,
}: {
  topic: string;
  personaId: string;
  mode: 'tweet' | 'thread';
  impressionType: string;
  angle: string;
  mediaMode: string;
  length: string;
  goal: string;
  selectedExampleCount: number;
  inspirationCount: number;
  userTweetCount: number;
}) {
  const metricCards = [
    { label: 'Konu', value: topic.trim() || 'Henüz boş', sub: mode === 'thread' ? 'Thread brief' : 'Tweet brief' },
    { label: 'Persona', value: personaId, sub: 'Ses hafızası' },
    { label: 'Tip', value: impressionType, sub: `${angle} · ${mediaMode}` },
    { label: 'Uzunluk', value: length, sub: goal },
  ];

  return (
    <div className="rounded-2xl border border-white/[0.07] bg-white/[0.03] p-4 space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold text-[#e8e8e0] uppercase tracking-[0.14em]">Çalışma Özeti</p>
          <p className="text-[10px] text-[#6b6b72] mt-0.5">Sağ panel boş kalmasın diye anlık brief burada görünür.</p>
        </div>
        <span className="text-[9px] px-2 py-1 rounded-full bg-accent/[0.1] text-accent border border-accent/20">
          live
        </span>
      </div>

      <div className="grid grid-cols-2 gap-2">
        {metricCards.map((card) => (
          <div key={card.label} className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-2.5 min-h-[76px]">
            <p className="text-[9px] uppercase tracking-[0.16em] text-[#4a4a55]">{card.label}</p>
            <p className="text-sm font-semibold text-[#e8e8e0] mt-1 break-words line-clamp-2">{card.value}</p>
            <p className="text-[10px] text-[#6b6b72] mt-1">{card.sub}</p>
          </div>
        ))}
      </div>

      <div className="grid gap-2 sm:grid-cols-3">
        <div className="rounded-xl border border-accent/20 bg-accent/[0.05] p-2.5">
          <p className="text-[9px] uppercase tracking-[0.16em] text-accent">İlham</p>
          <p className="text-lg font-semibold text-[#e8e8e0] mt-1">
            {selectedExampleCount > 0 ? `${selectedExampleCount}/${inspirationCount}` : inspirationCount}
          </p>
          <p className="text-[10px] text-[#6b6b72] mt-0.5">seçili örnek / havuz</p>
        </div>
        <div className="rounded-xl border border-accent-green/20 bg-accent-green/[0.05] p-2.5">
          <p className="text-[9px] uppercase tracking-[0.16em] text-accent-green">Kendi Sesin</p>
          <p className="text-lg font-semibold text-[#e8e8e0] mt-1">{userTweetCount}</p>
          <p className="text-[10px] text-[#6b6b72] mt-0.5">öğrenilen tweet</p>
        </div>
        <div className="rounded-xl border border-accent-yellow/20 bg-accent-yellow/[0.05] p-2.5">
          <p className="text-[9px] uppercase tracking-[0.16em] text-accent-yellow">Format</p>
          <p className="text-lg font-semibold text-[#e8e8e0] mt-1">{mode === 'thread' ? '🧵' : '✍︎'}</p>
          <p className="text-[10px] text-[#6b6b72] mt-0.5">{mode === 'thread' ? 'çok parçalı' : 'tek akış'}</p>
        </div>
      </div>

      <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-3 space-y-2">
        <p className="text-[9px] uppercase tracking-[0.16em] text-[#4a4a55]">Bugün ne oluyor?</p>
        <ol className="space-y-1.5 text-[11px] text-[#8b8b96] leading-relaxed">
          <li className="flex gap-2">
            <span className="text-accent-green shrink-0">1.</span>
            Konuyu yaz, örnekler otomatik sıralansın, prompt’u gerektiğinde daralt.
          </li>
          <li className="flex gap-2">
            <span className="text-accent-green shrink-0">2.</span>
            Persona ve konu aynı havuzu okur, en alakalı ve en çok görülenler üstte gelir.
          </li>
          <li className="flex gap-2">
            <span className="text-accent-green shrink-0">3.</span>
            Üret sonrası sağ panelde örnekleri tekrar karşılaştır, iyi olanı kaydet.
          </li>
        </ol>
        <p className="text-[10px] text-[#4a4a55]">
          İlham havuzu: {selectedExampleCount > 0 ? `${selectedExampleCount}/${inspirationCount}` : inspirationCount} · Kullanıcı tweeti: {userTweetCount}
        </p>
      </div>
    </div>
  );
}

/**
 * AccountHealth — Sol panelde hesap durumu ve feedback loop özeti.
 * TweepCred tahmini: gerçek skor API'de yok, hesabın özelliklerine göre tahmin.
 * userTweets varsa: son tweetlerin ortalama engagement'ı ve en iyi tweet gösterilir.
 */
function AccountHealth({ settings, userTweets }: { settings: any; userTweets: UserTweet[] }) {
  const [open, setOpen] = useState(false);

  // TweepCred kaba tahmini
  const tweepCredTier = settings.hasPremium
    ? { label: '65+ muhtemelen', color: 'text-accent-green', note: 'Mavi tik +100 başlangıç → dağıtım eşiği aşıldı' }
    : { label: 'Belirsiz', color: 'text-accent-yellow', note: '65 altında = sadece 3 tweet seçiliyor. Mavi tik alınırsa garantilenir' };

  // Gerçek engagement ortalaması
  const avgEng = userTweets.length > 0
    ? Math.round(userTweets.reduce((s, t) => s + t.likes + t.replies * 5 + t.retweets * 2, 0) / userTweets.length)
    : null;

  // En iyi tweet
  const topTweet = userTweets.length > 0
    ? [...userTweets].sort((a, b) => (b.likes + b.replies * 5 + b.retweets * 2) - (a.likes + a.replies * 5 + a.retweets * 2))[0]
    : null;

  return (
    <div className="rounded-xl border border-white/[0.07] overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-3.5 py-2.5 hover:bg-white/[0.03] transition-colors"
      >
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-medium text-[#8b8b96]">Hesap Durumu</span>
          {userTweets.length > 0 && (
            <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-accent-green/10 text-accent-green border border-accent-green/20">
              {userTweets.length} tweet
            </span>
          )}
        </div>
        <span className="text-[#4a4a55] text-[10px]">{open ? '▲' : '▼'}</span>
      </button>

      {open && (
        <div className="px-3.5 pb-3.5 pt-1 border-t border-white/[0.05] space-y-3">
          {/* TweepCred tahmini */}
          <div>
            <p className="text-[9px] font-semibold text-[#4a4a55] uppercase tracking-wider mb-1.5">TweepCred Tahmini</p>
            <div className="flex items-center justify-between">
              <span className={`text-[11px] font-semibold ${tweepCredTier.color}`}>{tweepCredTier.label}</span>
              <span className="text-[9px] text-[#4a4a55]">eşik: 65</span>
            </div>
            <p className="text-[10px] text-[#6b6b72] mt-1 leading-relaxed">{tweepCredTier.note}</p>
          </div>

          {/* Gerçek engagement verisi */}
          {userTweets.length > 0 ? (
            <div>
              <p className="text-[9px] font-semibold text-[#4a4a55] uppercase tracking-wider mb-1.5">
                Son {userTweets.length} Tweet — Gerçek X Verisi
              </p>
              {avgEng !== null && (
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[10px] text-[#8b8b96]">Ort. algo skoru</span>
                  <span className={`text-[11px] font-semibold ${avgEng >= 50 ? 'text-accent-green' : avgEng >= 20 ? 'text-accent-yellow' : 'text-[#6b6b72]'}`}>
                    {avgEng}
                  </span>
                </div>
              )}
              {topTweet && (
                <div className="bg-white/[0.03] rounded-lg px-2.5 py-2">
                  <p className="text-[9px] text-accent-green mb-1">En iyi tweet</p>
                  <p className="text-[10px] text-[#e8e8e0] leading-relaxed line-clamp-2">
                    {topTweet.text.slice(0, 100)}...
                  </p>
                  <p className="text-[9px] text-[#4a4a55] mt-1">
                    {topTweet.likes} like · {topTweet.replies} reply · {topTweet.retweets} rt
                  </p>
                </div>
              )}
            </div>
          ) : !settings.twitterUsername ? (
            <p className="text-[10px] text-[#6b6b72] leading-relaxed">
              Ayarlar'a Twitter kullanıcı adını ekle → gerçek performans verisi buraya çekilir.
            </p>
          ) : !settings.xquikKey ? (
            <p className="text-[10px] text-[#6b6b72] leading-relaxed">
              xquik API key gerekli → Ayarlar'dan ekle.
            </p>
          ) : (
            <p className="text-[10px] text-[#4a4a55]">Tweetler yükleniyor...</p>
          )}
        </div>
      )} 
    </div>
  );
}

// Grok sinyal ağırlıkları — xquik /compose API'den alınan canlı veri (Mart 2026)
const SIGNAL_WEIGHTS = [
  { signal: 'reply_engaged_by_author', weight: 75,   color: 'bg-accent-green',  label: 'Reply Chain (sen yanıt verdiysen)',  mult: '150x like' },
  { signal: 'reply',                   weight: 13.5, color: 'bg-accent-green',  label: 'Standalone Reply',                   mult: '27x like' },
  { signal: 'profile_click',           weight: 12,   color: 'bg-accent',        label: 'Profil Tıklaması',                   mult: '12x like' },
  { signal: 'click',                   weight: 11,   color: 'bg-accent',        label: 'Tweet Tıklaması',                    mult: '11x like' },
  { signal: 'dwell_time_2min',         weight: 10,   color: 'bg-accent-yellow', label: 'Dwell Time (2+ dakika okuma)',       mult: '+10 puan' },
  { signal: 'bookmark',                weight: 10,   color: 'bg-accent-yellow', label: 'Bookmark',                           mult: '10x like' },
  { signal: 'share_via_dm',            weight: 9,    color: 'bg-accent-yellow', label: 'DM ile Paylaşım',                    mult: '9x like' },
  { signal: 'follow_author',           weight: 5,    color: 'bg-[#6b6b72]',    label: 'Takip (tweetden)',                   mult: '5x like' },
  { signal: 'quote',                   weight: 3,    color: 'bg-[#6b6b72]',    label: 'Quote Tweet',                        mult: '3x like' },
  { signal: 'retweet',                 weight: 1,    color: 'bg-[#4a4a55]',    label: 'Retweet',                            mult: '1x like' },
  { signal: 'like',                    weight: 0.5,  color: 'bg-[#4a4a55]',    label: 'Like (baseline)',                    mult: 'baz' },
  { signal: 'report',                  weight: -369, color: 'bg-accent-red',    label: 'Report',                             mult: '-738x like' },
  { signal: 'not_interested',          weight: -74,  color: 'bg-accent-red',    label: 'İlgilenmiyorum',                     mult: '-74x like' },
  { signal: 'mute_author',             weight: -74,  color: 'bg-accent-red',    label: 'Sesi Kapat',                         mult: '-74x like' },
];

/**
 * Boş ekran bileşeni — konu girilmeden önce gösterilir.
 * İki bölüm: ALGO_TIPS kartları + collapsible sinyal ağırlıkları tablosu.
 */
function EmptyState({ algoData }: { algoData: any }) {
  const [showWeights, setShowWeights] = useState(false);
  const positiveWeights = SIGNAL_WEIGHTS.filter(s => s.weight > 0);
  const negativeWeights = SIGNAL_WEIGHTS.filter(s => s.weight < 0);

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 mb-4">
        <div className="h-px flex-1 bg-white/[0.05]" />
        <span className="text-[11px] text-[#4a4a55] font-medium">Grok Algoritması — Bilmen Gerekenler</span>
        <div className="h-px flex-1 bg-white/[0.05]" />
      </div>

      {ALGO_TIPS.map((tip) => (
        <div key={tip.title} className={`rounded-xl border p-3.5 hover:border-accent/20 hover:bg-white/[0.04] cursor-default transition-all duration-200 ${tip.color}`}>
          <div className="flex items-start gap-3">
            <span className="text-base shrink-0 mt-0.5">{tip.icon}</span>
            <div>
              <p className="text-xs font-semibold text-[#e8e8e0] mb-0.5">{tip.title}</p>
              <p className="text-[11px] text-[#8b8b96] leading-relaxed">{tip.desc}</p>
            </div>
          </div>
        </div>
      ))}

      {/* Sinyal ağırlıkları — collapsible tablo */}
      <div className="rounded-xl border border-white/[0.07] overflow-hidden">
        <button
          onClick={() => setShowWeights(!showWeights)}
          className="w-full flex items-center justify-between px-4 py-3 hover:bg-white/[0.03] transition-colors"
        >
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-[#8b8b96]">Sinyal Ağırlık Tablosu</span>
            <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-accent/10 text-accent border border-accent/20">
              {algoData ? 'Grok Canlı' : 'Statik'}
            </span>
          </div>
          <span className="text-[#4a4a55] text-xs">{showWeights ? '▲' : '▼'}</span>
        </button>

        {showWeights && (
          <div className="px-4 pb-4 space-y-3 border-t border-white/[0.05]">
            <p className="text-[10px] text-[#4a4a55] mt-3">
              Kaynak: xai-org/x-algorithm (Ocak 2026, Grok transformer). Ağırlıklar xquik /compose API'den.
            </p>

            {/* Pozitif sinyaller */}
            <div className="space-y-1.5">
              <p className="text-[9px] font-semibold text-accent-green uppercase tracking-wider">Pozitif</p>
              {positiveWeights.map((s) => (
                <div key={s.signal} className="flex items-center gap-2">
                  <div className="w-24 shrink-0">
                    <div
                      className={`h-1 rounded-full ${s.color} opacity-70`}
                      style={{ width: `${Math.min(100, (s.weight / 75) * 100)}%` }}
                    />
                  </div>
                  <span className="text-[9px] text-[#8b8b96] flex-1 truncate">{s.label}</span>
                  <span className="text-[9px] text-[#4a4a55] shrink-0">{s.mult}</span>
                </div>
              ))}
            </div>

            {/* Negatif sinyaller */}
            <div className="space-y-1.5">
              <p className="text-[9px] font-semibold text-accent-red uppercase tracking-wider">Negatif — Kaçın</p>
              {negativeWeights.map((s) => (
                <div key={s.signal} className="flex items-center gap-2">
                  <div className="w-24 shrink-0 flex justify-end">
                    <div
                      className={`h-1 rounded-full ${s.color} opacity-70`}
                      style={{ width: `${Math.min(100, (Math.abs(s.weight) / 369) * 100)}%` }}
                    />
                  </div>
                  <span className="text-[9px] text-[#8b8b96] flex-1 truncate">{s.label}</span>
                  <span className="text-[9px] text-accent-red shrink-0">{s.mult}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function SkeletonCard() {
  return (
    <div className="bg-card border border-white/[0.07] rounded-xl p-4 space-y-3 overflow-hidden">
      <div className="h-4 animate-shimmer rounded-lg w-full" />
      <div className="h-4 animate-shimmer rounded-lg w-4/5" />
      <div className="h-4 animate-shimmer rounded-lg w-3/5" />
      <div className="flex gap-2 mt-3">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="h-1.5 flex-1 animate-shimmer rounded-full" />
        ))}
      </div>
      <div className="flex gap-2">
        <div className="h-8 flex-1 animate-shimmer rounded-lg" />
        <div className="h-8 flex-1 animate-shimmer rounded-lg" />
        <div className="h-8 w-12 animate-shimmer rounded-lg" />
      </div>
    </div>
  );
}

/**
 * Generate sayfası — ana üretim akışı.
 * Sayfa açılınca persona JSON + xquik radar + canlı Grok algo verisi çekilir.
 * Kullanıcı input değiştirdikçe copyPrompt rebuild edilir (ContextPreview gösterir).
 * Üret → Claude API ile direkt üretim VEYA prompt panoya kopyalanır.
 */
export function Generate() {
  const settings = db.getSettings();

  // Aktif profil — profil seçilmişse onun ayarlarını kullan
  const [profiles] = useState<AccountProfile[]>(db.getProfiles());
  const [activeProfileId, setActiveProfileId] = useState<string>(settings.activeProfileId || '');
  const activeProfile = profiles.find((p) => p.id === activeProfileId) ?? null;

  // Aktif profilden veya legacy settings'ten ayarları al
  const effectiveSettings = useMemo(() => (
    activeProfile
      ? { ...settings, niche: activeProfile.niche, defaultPersona: activeProfile.defaultPersona, toneProfile: activeProfile.toneProfile, twitterUsername: activeProfile.twitterUsername, hasPremium: activeProfile.hasPremium }
      : settings
  ), [
    settings.xquikKey,
    settings.claudeKey,
    settings.activeProfileId,
    settings.niche,
    settings.defaultPersona,
    settings.toneProfile,
    settings.twitterUsername,
    settings.hasPremium,
    activeProfile?.id,
    activeProfile?.niche,
    activeProfile?.defaultPersona,
    activeProfile?.toneProfile,
    activeProfile?.twitterUsername,
    activeProfile?.hasPremium,
  ]);

  const ss = sessionStorage;
  const [topic, setTopic] = useState(() => ss.getItem('gen_topic') || '');
  const [impressionType, setImpressionType] = useState(() => ss.getItem('gen_type') || 'Data');
  const [angle, setAngle] = useState(() => ss.getItem('gen_angle') || 'auto');
  const [mediaMode, setMediaMode] = useState(() => ss.getItem('gen_media') || 'auto');
  const [length, setLength] = useState(() => ss.getItem('gen_length') || 'standard');
  const [goal, setGoal] = useState(() => ss.getItem('gen_goal') || 'Engagement');
  const [variations, setVariations] = useState(() => Number(ss.getItem('gen_vars')) || 3);
  const [inspirationHours, setInspirationHours] = useState(() => Number(ss.getItem('gen_inspiration_hours')) || 24);
  const [persona, setPersona] = useState<any>(null);
  const [personaId, setPersonaId] = useState(() => ss.getItem('gen_persona') || effectiveSettings.defaultPersona || 'hurricane');
  const personaList = ['alperk55', 'hurricane', 'tr_educational', 'tr_controversial', 'tr_casual'];
  const [radarItems, setRadarItems] = useState<RadarItem[]>([]);
  const [algoData, setAlgoData] = useState<ComposeAlgoData | null>(null);
  const [userTweets, setUserTweets] = useState<UserTweet[]>([]);
  const [mode, setMode] = useState<'tweet' | 'thread'>('tweet');

  // ── Resize panel ──────────────────────────────────────────────────────────
  const [panelWidth, setPanelWidth] = useState<number>(() => {
    const saved = localStorage.getItem('tl_panel_width');
    return saved ? Number(saved) : 380;
  });
  const isDragging = useRef(false);
  const dragStartX = useRef(0);
  const dragStartWidth = useRef(0);
  const panelWidthRef = useRef(panelWidth);
  panelWidthRef.current = panelWidth;

  useLayoutEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (!isDragging.current) return;
      const delta = e.clientX - dragStartX.current;
      const next = Math.min(600, Math.max(260, dragStartWidth.current + delta));
      setPanelWidth(next);
    };
    const onUp = () => {
      if (!isDragging.current) return;
      isDragging.current = false;
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      localStorage.setItem('tl_panel_width', String(panelWidthRef.current));
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
  }, []);
  const [results, setResults] = useState<TweetVariation[]>([]);
  const [thread, setThread] = useState<TweetThread | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [copyPrompt, setCopyPrompt] = useState('');
  const [promptCopied, setPromptCopied] = useState(false);
  // Viral tweetler — konuya göre xquik'ten çekilen örnek tweetler
  const [viralTweets, setViralTweets] = useState<TweetSearchResult[]>([]);
  const [viralLoading, setViralLoading] = useState(false);
  const [showInspirationRail, setShowInspirationRail] = useState(false);
  const [selectedViralTweetIds, setSelectedViralTweetIds] = useState<string[]>(() => {
    try {
      const saved = sessionStorage.getItem('gen_viral_selected_ids');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });
  const viralDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const viralRequestIdRef = useRef(0);
  const viralSelectionSeedRef = useRef('');
  // Viral thread'ler — thread modu için ilham
  const [, setViralThreads] = useState<ThreadResult[]>([]);
  // Dış trendler (Reddit / HN / Google)
  const [externalTrends, setExternalTrends] = useState<ExternalTrends>({ reddit: [], hackernews: [], google: [] });

  const loadTopicInspiration = useCallback(async (
    queryText: string,
    force = false
  ) => {
    const cleaned = queryText.trim();
    if (!settings.xquikKey || cleaned.length < 5) {
      setViralTweets([]);
      setViralThreads([]);
      setViralLoading(false);
      return { tweets: [] as TweetSearchResult[], threads: [] as ThreadResult[] };
    }

    const requestId = ++viralRequestIdRef.current;
    setViralLoading(true);

    try {
      const queryVariants = buildTopicSearchQueries(cleaned);
      const langs = buildTopicSearchLanguages(cleaned);
      const queryPlan = Array.from(new Set([
        queryVariants[0] || cleaned,
        queryVariants[1] || '',
      ])).slice(0, force ? 2 : 1);
      const langPlan = [langs[0] || 'tr'];
      const tweetMap = new Map<string, TweetSearchResult>();

      // İlk deneme: min 20 beğeni
      for (const queryVariant of queryPlan) {
        for (const lang of langPlan) {
          const batch = await xquikApi.searchTweets(settings.xquikKey, queryVariant, {
            minFaves: 20,
            lang,
            hours: inspirationHours,
            limit: 25,
          });
          batch.forEach((tweet) => {
            const key = tweet.id || tweet.url || `${tweet.authorHandle}:${tweet.text}`;
            if (!tweetMap.has(key)) tweetMap.set(key, tweet);
          });
        }
      }

      // Yeterli sonuç yoksa bir kez daha filtresiz dene
      if (tweetMap.size < 5) {
        const fallback = await xquikApi.searchTweets(settings.xquikKey, queryPlan[0], {
          minFaves: 0,
          lang: langPlan[0],
          hours: inspirationHours,
          limit: 25,
        });
        fallback.forEach((tweet) => {
          const key = tweet.id || tweet.url || `${tweet.authorHandle}:${tweet.text}`;
          if (!tweetMap.has(key)) tweetMap.set(key, tweet);
        });
      }

      const engScore = (t: TweetSearchResult) =>
        (t.likes || 0) + (t.replies || 0) * 5 + (t.retweets || 0) * 2 + Math.round((t.views || 0) / 100);

      const bestTweets = rankContextualTweets([...tweetMap.values()], cleaned)
        .filter((t) => (t.likes || 0) >= 1)
        .sort((a, b) => engScore(b) - engScore(a))
        .slice(0, 20);

      if (requestId !== viralRequestIdRef.current) {
        return { tweets: bestTweets, threads: [] };
      }

      setViralTweets(bestTweets);
      setViralThreads([]);
      return { tweets: bestTweets, threads: [] };
    } finally {
      if (requestId === viralRequestIdRef.current) {
        setViralLoading(false);
      }
    }
  }, [settings.xquikKey, inspirationHours]);

  useEffect(() => {
    let cancelled = false;
    loadPersonaById(personaId)
      .then((data) => {
        if (!cancelled) setPersona(data);
      })
      .catch(() => {
        if (!cancelled) setPersona(null);
      });
    return () => {
      cancelled = true;
    };
  }, [personaId]);

  useEffect(() => {
    const onPersonaUpdate = (event: Event) => {
      const detail = (event as CustomEvent<{ personaId?: string }>).detail;
      if (detail?.personaId === personaId) {
        loadPersonaById(personaId).then((data) => setPersona(data)).catch(() => setPersona(null));
      }
    };

    window.addEventListener('persona-cache-updated', onPersonaUpdate);
    return () => window.removeEventListener('persona-cache-updated', onPersonaUpdate);
  }, [personaId]);

  const personaForPrompt = useMemo(
    () => (persona ? enrichPersonaWithTweets(persona, userTweets) : null),
    [persona, userTweets]
  );
  const personaLearningKeyRef = useRef('');

  useEffect(() => {
    const signature = personaForPrompt?.learning_summary?.learning_signature || '';
    if (!personaId || !signature) return;

    const cacheKey = `${personaId}:${signature}`;
    if (personaLearningKeyRef.current === cacheKey) return;

    personaLearningKeyRef.current = cacheKey;
    persistEnrichedPersona(personaId, personaForPrompt);
  }, [personaId, personaForPrompt]);

  useEffect(() => {
    if (settings.xquikKey) {
      xquikApi.getRadar(settings.xquikKey, 8).then(setRadarItems).catch(() => {});
      xquikApi.getAlgoData(settings.xquikKey, effectiveSettings.niche || 'general').then(setAlgoData).catch(() => {});
      xquikApi.getExternalTrends(settings.xquikKey).then(setExternalTrends).catch(() => {});
      if (effectiveSettings.twitterUsername) {
        xquikApi.getUserTweets(settings.xquikKey, effectiveSettings.twitterUsername, 20)
          .then(setUserTweets)
          .catch(() => {});
      }
    }
  }, [activeProfileId, settings.xquikKey, effectiveSettings.niche, effectiveSettings.twitterUsername]);

  // State'i sessionStorage'a persist et — sayfa değişince kaybolmasın
  useEffect(() => { sessionStorage.setItem('gen_topic', topic); }, [topic]);
  useEffect(() => { sessionStorage.setItem('gen_type', impressionType); }, [impressionType]);
  useEffect(() => { sessionStorage.setItem('gen_angle', angle); }, [angle]);
  useEffect(() => { sessionStorage.setItem('gen_media', mediaMode); }, [mediaMode]);
  useEffect(() => { sessionStorage.setItem('gen_length', length); }, [length]);
  useEffect(() => { sessionStorage.setItem('gen_goal', goal); }, [goal]);
  useEffect(() => { sessionStorage.setItem('gen_vars', String(variations)); }, [variations]);
  useEffect(() => { sessionStorage.setItem('gen_inspiration_hours', String(inspirationHours)); }, [inspirationHours]);
  useEffect(() => { sessionStorage.setItem('gen_persona', personaId); }, [personaId]);
  // Profil değişince personaId sıfırla
  useEffect(() => {
    setPersonaId(effectiveSettings.defaultPersona || 'hurricane');
  }, [activeProfileId]);

  // Viral tweet fetch — konu değişince debounce ile tetikle
  useEffect(() => {
    if (viralDebounceRef.current) clearTimeout(viralDebounceRef.current);
    if (!topic.trim() || topic.length < 5 || !settings.xquikKey) {
      setShowInspirationRail(false);
      setViralTweets([]);
      setViralThreads([]);
      return;
    }

    setShowInspirationRail(false);
    viralDebounceRef.current = setTimeout(async () => {
      const result = await loadTopicInspiration(topic, true);
      console.info('[viralTweets] çekilen:', result.tweets.length);
    }, 650);

    return () => {
      if (viralDebounceRef.current) clearTimeout(viralDebounceRef.current);
      setViralLoading(false);
    };
  }, [topic, settings.xquikKey, loadTopicInspiration]);

  useEffect(() => {
    if (!viralTweets.length) {
      viralSelectionSeedRef.current = '';
      setSelectedViralTweetIds([]);
      return;
    }

    const signature = viralTweets.map((tweet) => tweet.id).join('|');
    setSelectedViralTweetIds((prev) => {
      const valid = prev.filter((id) => viralTweets.some((tweet) => tweet.id === id));
      if (valid.length > 0) return valid.slice(0, 5);
      if (viralSelectionSeedRef.current === signature) return prev;
      viralSelectionSeedRef.current = signature;
      return viralTweets.slice(0, Math.min(4, viralTweets.length)).map((tweet) => tweet.id);
    });
  }, [viralTweets]);

  useEffect(() => {
    sessionStorage.setItem('gen_viral_selected_ids', JSON.stringify(selectedViralTweetIds));
  }, [selectedViralTweetIds]);

  const selectedViralTweets = useMemo(() => (
    selectedViralTweetIds.length > 0
      ? viralTweets.filter((tweet) => selectedViralTweetIds.includes(tweet.id))
      : []
  ), [viralTweets, selectedViralTweetIds]);

  const promptInspirationTweets = selectedViralTweets.length > 0 ? selectedViralTweets : viralTweets;

  useEffect(() => {
    if (!personaForPrompt) return;
    const sys = buildSystemPrompt(personaForPrompt, effectiveSettings, algoData, db.getTweets());
    const user = buildUserMessage({
      topic: topic || '(konu girilmedi)',
      persona: personaForPrompt, settings: effectiveSettings,
      recentTweets: db.getTweets(),
      xUserTweets: userTweets,
      radarItems, impressionType, angle, mediaMode, length, goal, variations,
      viralTweets: promptInspirationTweets, externalTrends,
    });
    setCopyPrompt(buildCopyPrompt(sys, user, personaForPrompt, effectiveSettings, algoData, length));
  }, [topic, personaForPrompt, impressionType, angle, mediaMode, length, goal, variations, radarItems, algoData, userTweets, promptInspirationTweets, activeProfileId, effectiveSettings, externalTrends]);

  // ── Prompt al — API'siz, sadece kopyala ────────────────────────────────────
  const handleCopyPrompt = useCallback(async () => {
    if (!topic.trim()) return;
    const inspiration = settings.xquikKey && topic.length >= 5 && promptInspirationTweets.length === 0 && !viralLoading
      ? await loadTopicInspiration(topic, true)
      : { tweets: promptInspirationTweets, threads: [] as ThreadResult[] };
    const promptTweets = inspiration.tweets.length > 0 ? inspiration.tweets : promptInspirationTweets;
    const sys = buildSystemPrompt(personaForPrompt, effectiveSettings, algoData, db.getTweets());
    const user = buildUserMessage({
      topic: topic || '(konu girilmedi)',
      persona: personaForPrompt,
      settings: effectiveSettings,
      recentTweets: db.getTweets(),
      xUserTweets: userTweets,
      radarItems,
      impressionType,
      angle,
      mediaMode,
      length,
      goal,
      variations,
      viralTweets: promptTweets,
      externalTrends,
    });
    await navigator.clipboard.writeText(buildCopyPrompt(sys, user, personaForPrompt, effectiveSettings, algoData, length));
    setPromptCopied(true);
    setTimeout(() => setPromptCopied(false), 3000);
  }, [topic, personaForPrompt, effectiveSettings, algoData, userTweets, radarItems, impressionType, angle, mediaMode, length, goal, variations, externalTrends, settings.xquikKey, promptInspirationTweets, viralLoading]);

  // ── Direkt üret — Claude API ile ────────────────────────────────────────────
  const handleGenerate = useCallback(async () => {
    if (!topic.trim() || !settings.claudeKey) return;
    setLoading(true); setError(''); setResults([]); setThread(null);
    setShowInspirationRail(true);

    const sys = buildSystemPrompt(personaForPrompt, effectiveSettings, algoData, db.getTweets());
    const inspiration = settings.xquikKey && topic.length >= 5
      ? await loadTopicInspiration(topic, true)
      : { tweets: promptInspirationTweets, threads: [] as ThreadResult[] };
    const promptTweets = inspiration.tweets.length > 0 ? inspiration.tweets : promptInspirationTweets;
    const promptThreads = inspiration.threads.length > 0 ? inspiration.threads : [];
    console.info('[generate] viralTweets sayısı:', promptTweets.length, '| mod:', mode, '| seçili:', selectedViralTweets.length);

    if (mode === 'thread') {
      const user = buildThreadMessage({
        topic,
        persona: personaForPrompt,
        settings: effectiveSettings,
        recentTweets: db.getTweets(),
        xUserTweets: userTweets,
        radarItems,
        impressionType,
        angle,
        mediaMode,
        length,
        goal,
        variations,
        viralTweets: promptTweets,
        viralThreads: promptThreads,
      });
      console.info('[thread] viralBlock var mı:', promptTweets.length > 0, '| prompt uzunluğu:', user.length);
      try {
        const generatedThread = await claudeApi.generateThread(settings.claudeKey, sys, user);
        setThread(settings.xquikKey && generatedThread ? await scoreThreadWithXquik(settings.xquikKey, generatedThread) : generatedThread);
      }
      catch (e: any) { setError(e.message || 'Claude API hatası.'); }
    } else {
    const user = buildUserMessage({ topic, persona: personaForPrompt, settings: effectiveSettings, recentTweets: db.getTweets(), xUserTweets: userTweets, radarItems, impressionType, angle, mediaMode, length, goal, variations, viralTweets: promptTweets, externalTrends });
      try {
        const generated = await claudeApi.generateTweets(settings.claudeKey, sys, user, variations);
        setResults(settings.xquikKey ? await scoreGeneratedVariations(settings.xquikKey, generated) : generated);
      }
      catch (e: any) { setError(e.message || 'Claude API hatası.'); }
    }
    setLoading(false);
  }, [topic, personaForPrompt, effectiveSettings, settings.claudeKey, settings.xquikKey, radarItems, impressionType, angle, mediaMode, length, goal, variations, mode, algoData, userTweets, promptInspirationTweets, selectedViralTweets.length]);

  const handleSaveTweet = (tweet: TweetVariation) => {
    db.saveTweet({
      text: tweet.text, topic, persona: personaId,
      impressionType,
      score: tweet.total_score, scores: tweet.scores, scoreReason: tweet.score_reason,
      engagement: { like: 0, reply: 0, rt: 0, quote: 0 },
      xquikScore: tweet.xquikScore?.total,
    });
    if (settings.xquikKey) xquikApi.saveDraft(settings.xquikKey, tweet.text, topic);
  };

  const toggleInspirationTweet = useCallback((tweetId: string) => {
    setSelectedViralTweetIds((prev) => {
      if (prev.includes(tweetId)) return prev.filter((id) => id !== tweetId);
      if (prev.length >= 5) return prev;
      return [...prev, tweetId];
    });
  }, []);

  const selectTopInspirationTweets = useCallback(() => {
    setSelectedViralTweetIds(viralTweets.slice(0, Math.min(4, viralTweets.length)).map((tweet) => tweet.id));
  }, [viralTweets]);

  const clearInspirationSelection = useCallback(() => {
    setSelectedViralTweetIds([]);
  }, []);

  return (
    <div className="page-shell flex h-full flex-col gap-3 p-3 overflow-y-auto 2xl:overflow-hidden">
      <PageHeader
        compact
        kicker="ÜRETİM MASASI"
        title="Tweet ve thread workbench"
        subtitle="Konu, persona, format ve canlı sinyalleri tek yerde toparla. Solda ayarla, sağda çıktıyı gör."
        actions={<TimingBadge />}
        chips={[
          { label: mode === 'thread' ? 'Thread modu' : 'Tweet modu', tone: 'accent' },
          { label: `Persona: ${personaId}`, tone: 'neutral' },
          { label: `Tip: ${IMPRESSION_TYPES.find((t) => t.id === impressionType)?.label || 'Genel'}`, tone: 'neutral' },
          { label: `Açı: ${ANGLES.find((t) => t.id === angle)?.label || 'Otomatik'}`, tone: 'neutral' },
          { label: `Medya: ${MEDIA_MODES.find((t) => t.id === mediaMode)?.label || 'Otomatik'}`, tone: 'neutral' },
          { label: 'Sıralama: views ↓ + relevance', tone: 'neutral' },
          { label: `${variations} varyasyon`, tone: 'neutral' },
          { label: `İlham: ${promptInspirationTweets.length || viralTweets.length || 0}`, tone: promptInspirationTweets.length > 0 ? 'green' : 'neutral' },
        ]}
      />

      <div className="flex flex-1 min-h-0 flex-col 2xl:flex-row gap-3">
      {/* ── Sol panel ─────────────────────────────────────────────── */}
      <div
        style={{ ['--panel-width' as any]: `${panelWidth}px` } as any}
        className="responsive-resizable-panel premium-panel-strong w-full 2xl:shrink-0 p-4 space-y-4 overflow-y-auto bg-[#0c0c0f]/80"
      >

        {/* Hesap Profili Seçici */}
        {profiles.length > 0 && (
          <div>
            <label className="text-[10px] font-semibold text-[#4a4a55] uppercase tracking-wider mb-1.5 block">
              Hesap
            </label>
            <div className="flex flex-wrap gap-1.5">
              <button
                onClick={() => { setActiveProfileId(''); db.saveSettings({ activeProfileId: '' }); }}
                className={`text-[10px] px-2.5 py-1 rounded-lg transition-all font-medium ${
                  !activeProfileId
                    ? 'bg-accent/15 text-accent border border-accent/30'
                    : 'bg-white/[0.04] text-[#6b6b72] border border-white/[0.07] hover:text-[#e8e8e0]'
                }`}
              >
                Varsayılan
              </button>
              {profiles.map((p) => (
                <button
                  key={p.id}
                  onClick={() => { setActiveProfileId(p.id); db.saveSettings({ activeProfileId: p.id }); }}
                  className={`text-[10px] px-2.5 py-1 rounded-lg transition-all font-medium ${
                    activeProfileId === p.id
                      ? 'bg-accent/15 text-accent border border-accent/30'
                      : 'bg-white/[0.04] text-[#6b6b72] border border-white/[0.07] hover:text-[#e8e8e0]'
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>
            {activeProfile && (
              <p className="text-[10px] text-[#4a4a55] mt-1">
                @{activeProfile.twitterUsername || '—'} · {activeProfile.niche || 'niche yok'}
              </p>
            )}
          </div>
        )}

        {/* Konu */}
        <div>
          <label className="text-[11px] font-semibold text-[#7a7a85] uppercase tracking-wider mb-1.5 block">Konu</label>
          <textarea
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            placeholder="Ne hakkında tweet atacaksın?"
            rows={4}
            className="w-full bg-[#111113] border border-white/[0.1] rounded-xl px-3 py-2.5 text-base text-[#e8e8e0] placeholder-[#5a5a6a] resize-none focus:border-accent/40 focus:bg-[#111115] transition-all"
          />
        </div>

        {/* ── Bölüm ayracı: İçerik → Format ──── */}

        {/* ── FORMAT bölümü ─── */}
        <div className="flex items-center gap-2 pt-1">
          <div className="h-px flex-1 bg-white/[0.05]" />
          <span className="text-[9px] font-bold text-[#3a3a48] uppercase tracking-widest">Format</span>
          <div className="h-px flex-1 bg-white/[0.05]" />
        </div>

        {/* Mod */}
        <div>
          <label className="text-[11px] font-semibold text-[#7a7a85] uppercase tracking-wider mb-1.5 block flex items-center">
            Mod
            <Tooltip text="Tek Tweet: en yüksek skorlu varyasyonu seç. Thread 🧵: Hook→İçerik→CTA zinciri, dwell time 3x artırır." />
          </label>
          <div className="flex gap-1.5 p-0.5 bg-white/[0.04] rounded-xl">
            {(['tweet', 'thread'] as const).map((m) => (
              <button
                key={m}
                onClick={() => { setMode(m); setResults([]); setThread(null); setError(''); setShowInspirationRail(false); }}
                className={`flex-1 text-xs py-1.5 rounded-lg transition-all font-medium ${
                  mode === m ? 'bg-accent text-white shadow-lg shadow-accent/20' : 'text-[#6b6b72] hover:text-[#e8e8e0]'
                }`}
              >
                {m === 'tweet' ? 'Tek Tweet' : 'Thread 🧵'}
              </button>
            ))}
          </div>
        {mode === 'thread' && (
          <p className="text-[10px] text-accent/70 mt-1.5 pl-1">
            Hook → 2-3 içerik → CTA · %300 daha fazla dwell time
          </p>
        )}
        </div>

        {/* Saat */}
        <div>
          <label className="text-[11px] font-semibold text-[#7a7a85] uppercase tracking-wider mb-1.5 block flex items-center">
            Saat
            <Tooltip text="İlham tweetleri son kaç saat içinden çekilsin." />
          </label>
          <div className="flex flex-wrap gap-1.5">
            {INSPIRATION_HOURS_OPTS.map((hours) => (
              <button
                key={hours}
                onClick={() => setInspirationHours(hours)}
                className={`text-xs px-2.5 py-1 rounded-full transition-all font-medium ${
                  inspirationHours === hours
                    ? 'bg-accent-green text-white shadow-sm shadow-accent-green/20'
                    : 'bg-white/[0.05] text-[#6b6b72] hover:text-[#e8e8e0] hover:bg-white/[0.08]'
                }`}
              >
                Son {hours} saat
              </button>
            ))}
          </div>
          <p className="text-[10px] text-[#4a4a55] mt-1.5 pl-0.5">
            İlham havuzu yalnızca seçtiğin zaman aralığından çekilir.
          </p>
        </div>

        {/* Tip */}
        <div>
          <label className="text-[11px] font-semibold text-[#7a7a85] uppercase tracking-wider mb-1.5 block flex items-center">
            Tip
            <Tooltip text="İçerik formatı. Data ve Edu bookmark alır. Hot Take reply patlatır ama negatif sinyal riski var. Story dwell time artırır." />
          </label>
          <div className="flex flex-wrap gap-1.5">
            {IMPRESSION_TYPES.map((t) => (
              <button
                key={t.id}
                onClick={() => setImpressionType(t.id)}
                title={t.tip}
                className={`text-xs px-2.5 py-1 rounded-full transition-all font-medium ${
                  impressionType === t.id
                    ? 'bg-accent text-white shadow-sm shadow-accent/20'
                    : 'bg-white/[0.05] text-[#6b6b72] hover:text-[#e8e8e0] hover:bg-white/[0.08]'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
          <p className="text-[10px] text-[#4a4a55] mt-1.5 pl-0.5">
            {IMPRESSION_TYPES.find(t => t.id === impressionType)?.tip}
          </p>
        </div>

        {/* Açı */}
        <div>
          <label className="text-[11px] font-semibold text-[#7a7a85] uppercase tracking-wider mb-1.5 block flex items-center">
            Açı
            <Tooltip text="Metnin tavrı. Sivri, nüanslı, soru bazlı veya karşı görüş gibi küçük ama etkili bir daraltma." />
          </label>
          <div className="flex flex-wrap gap-1.5">
            {ANGLES.map((a) => (
              <button
                key={a.id}
                onClick={() => setAngle(a.id)}
                title={a.tip}
                className={`text-xs px-2.5 py-1 rounded-full transition-all font-medium ${
                  angle === a.id
                    ? 'bg-accent text-white shadow-sm shadow-accent/20'
                    : 'bg-white/[0.05] text-[#6b6b72] hover:text-[#e8e8e0] hover:bg-white/[0.08]'
                }`}
              >
                {a.label}
              </button>
            ))}
          </div>
          <p className="text-[10px] text-[#4a4a55] mt-1.5 pl-0.5">
            {ANGLES.find((a) => a.id === angle)?.tip}
          </p>
        </div>

        {/* Medya */}
        <div>
          <label className="text-[11px] font-semibold text-[#7a7a85] uppercase tracking-wider mb-1.5 block flex items-center">
            Medya
            <Tooltip text="Metni hangi medya hissine göre yazacağımızı daraltır. Video, görsel, quote ya da saf metin." />
          </label>
          <div className="flex flex-wrap gap-1.5">
            {MEDIA_MODES.map((m) => (
              <button
                key={m.id}
                onClick={() => setMediaMode(m.id)}
                title={m.tip}
                className={`text-xs px-2.5 py-1 rounded-full transition-all font-medium ${
                  mediaMode === m.id
                    ? 'bg-accent-green text-white shadow-sm shadow-accent-green/20'
                    : 'bg-white/[0.05] text-[#6b6b72] hover:text-[#e8e8e0] hover:bg-white/[0.08]'
                }`}
              >
                {m.label}
              </button>
            ))}
          </div>
          <p className="text-[10px] text-[#4a4a55] mt-1.5 pl-0.5">
            {MEDIA_MODES.find((m) => m.id === mediaMode)?.tip}
          </p>
        </div>

        {/* Uzunluk */}
        <div>
          <label className="text-[11px] font-semibold text-[#7a7a85] uppercase tracking-wider mb-1.5 block flex items-center">
            Uzunluk
            <Tooltip text="Kısa: tek güçlü cümle. Standart: Grok'un favori alanı. Uzun: dwell time +10 puan ama Premium gerekir." />
          </label>
          <div className="flex gap-1.5 p-0.5 bg-white/[0.04] rounded-xl">
            {LENGTHS.map((l) => (
              <button
                key={l.id}
                onClick={() => setLength(l.id)}
                title={l.tip}
                className={`flex-1 text-xs py-1.5 rounded-lg transition-all font-medium ${
                  length === l.id
                    ? 'bg-[#1e1e24] text-[#e8e8e0] shadow-sm'
                    : 'text-[#6b6b72] hover:text-[#e8e8e0]'
                }`}
              >
                {l.label}
              </button>
            ))}
          </div>
        </div>

        {/* ── STRATEJİ bölümü ─── */}
        <div className="flex items-center gap-2 pt-1">
          <div className="h-px flex-1 bg-white/[0.05]" />
          <span className="text-[9px] font-bold text-[#3a3a48] uppercase tracking-widest">Strateji</span>
          <div className="h-px flex-1 bg-white/[0.05]" />
        </div>

        {/* Hedef */}
        <div>
          <label className="text-[11px] font-semibold text-[#7a7a85] uppercase tracking-wider mb-1.5 block flex items-center">
            Hedef
            <Tooltip text="Engagement: reply/bookmark çek. Followers: değer ver, follow bıraktır. Authority: uzun vadeli güven inşa et." />
          </label>
          <div className="flex gap-1.5 p-0.5 bg-white/[0.04] rounded-xl">
            {GOALS.map((g) => (
              <button
                key={g.id}
                onClick={() => setGoal(g.id)}
                title={g.tip}
                className={`flex-1 text-xs py-1.5 rounded-lg transition-all font-medium ${
                  goal === g.id
                    ? 'bg-[#1e1e24] text-[#e8e8e0] shadow-sm'
                    : 'text-[#6b6b72] hover:text-[#e8e8e0]'
                }`}
              >
                {g.label}
              </button>
            ))}
          </div>
        </div>

        {/* Varyasyon */}
        {mode === 'tweet' && (
          <div>
            <label className="text-[11px] font-semibold text-[#7a7a85] uppercase tracking-wider mb-1.5 block flex items-center">
              Varyasyon
              <Tooltip text="3 üret, en yüksek skorluyu at. Sistem geçmiş engagement'larından öğreniyor — zamanla daha iyi önerir." />
            </label>
            <div className="flex gap-1.5 p-0.5 bg-white/[0.04] rounded-xl">
              {VARIATIONS_OPTS.map((v) => (
                <button
                  key={v}
                  onClick={() => setVariations(v)}
                  className={`flex-1 text-xs py-1.5 rounded-lg transition-all font-medium ${
                    variations === v
                      ? 'bg-[#1e1e24] text-[#e8e8e0] shadow-sm'
                      : 'text-[#6b6b72] hover:text-[#e8e8e0]'
                  }`}
                >
                  {v}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Persona */}
        <div>
          <label className="text-[11px] font-semibold text-[#7a7a85] uppercase tracking-wider mb-1.5 block flex items-center">
            Persona
            <Tooltip text="Her persona farklı ton ve dil kullanır. Hurricane: bold+soru. Edu: öğretici. Controversial: tartışma açan. Casual: sohbet." />
          </label>
          <select
            value={personaId}
            onChange={(e) => setPersonaId(e.target.value)}
            className="w-full bg-[#111113] border border-white/[0.07] rounded-xl px-3 py-2 text-sm text-[#e8e8e0] focus:border-accent/40 transition-colors"
          >
            {personaList.map((p) => (
              <option key={p} value={p} className="bg-[#18181c]">{p}</option>
            ))}
          </select>
          {persona && (
            <p className="text-[10px] text-[#4a4a55] mt-1.5 pl-0.5">{persona.tone}</p>
          )}
        </div>

        {/* ── KAYNAKLAR bölümü ─── */}
        <div className="flex items-center gap-2 pt-1">
          <div className="h-px flex-1 bg-white/[0.05]" />
          <span className="text-[9px] font-bold text-[#3a3a48] uppercase tracking-widest">Kaynaklar</span>
          <div className="h-px flex-1 bg-white/[0.05]" />
        </div>

        {/* Context preview */}
        <ContextPreview prompt={copyPrompt} />

        {/* Hesap Durumu + Feedback Loop */}
        <AccountHealth settings={effectiveSettings} userTweets={userTweets} />

        {/* Algo kaynak badge */}
        <div className="flex items-center gap-1.5 px-1">
          <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${algoData ? 'bg-accent-green' : 'bg-[#3a3a45]'}`} />
          <span className="text-[10px] text-[#4a4a55]">
            {algoData ? 'Grok canlı veri aktif' : 'Statik veri (skill.ts)'}
          </span>
        </div>

        {/* Butonlar */}
        <div className="space-y-2 pb-2">

          {/* ── Claude: Direkt Üret ── */}
          <button
            onClick={handleGenerate}
            disabled={!topic.trim() || loading || !settings.claudeKey}
            className="w-full py-3 rounded-xl bg-accent hover:bg-accent/90 disabled:opacity-30 disabled:cursor-not-allowed text-white text-sm font-bold transition-all shadow-lg shadow-accent/20 hover:shadow-xl hover:shadow-accent/30 active:scale-[0.98]"
          >
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Claude üretiyor...
              </span>
            ) : (
              <span className="flex items-center justify-center gap-2">
                <span>⚡</span>
                {mode === 'thread' ? 'Claude ile Thread Üret' : 'Claude ile Üret'}
              </span>
            )}
          </button>

          {/* ── Prompt Al ── */}
          <button
            onClick={handleCopyPrompt}
            disabled={!topic.trim()}
            className={`w-full py-2 rounded-xl border disabled:opacity-30 disabled:cursor-not-allowed text-xs font-medium transition-all ${
              promptCopied
                ? 'border-accent-green/50 bg-accent-green/10 text-accent-green'
                : 'border-white/[0.08] hover:bg-white/[0.03] hover:border-white/[0.14] text-[#6b6b72]'
            }`}
          >
            {promptCopied
              ? '✓ Kopyalandı — claude.ai\'a yapıştır'
              : <span className="flex items-center justify-center gap-2"><span>📋</span>Prompt Al</span>
            }
          </button>

        </div>
      </div>

      {/* ── Resize handle ─────────────────────────────────────────── */}
      <div
        onMouseDown={(e) => {
          isDragging.current = true;
          dragStartX.current = e.clientX;
          dragStartWidth.current = panelWidth;
          document.body.style.cursor = 'col-resize';
          document.body.style.userSelect = 'none';
          e.preventDefault();
        }}
        className="hidden 2xl:block w-1 shrink-0 hover:bg-accent/30 active:bg-accent/50 cursor-col-resize transition-colors group relative"
        title="Sürükle"
      >
        <div className="absolute inset-y-0 -left-1 -right-1" />
      </div>

      {/* ── Sağ panel ─────────────────────────────────────────────── */}
      <div className="flex-1 min-w-0 p-5 overflow-y-auto">

        {/* Timing + header */}
        <div className="flex items-center justify-between mb-5">
          <TimingBadge />
          <div className="flex items-center gap-2">
            {(results.length > 0 || thread) && (
              <button
                onClick={() => { setResults([]); setThread(null); setError(''); setShowInspirationRail(false); }}
                className="text-[10px] text-[#4a4a55] hover:text-[#8b8b96] transition-colors px-2 py-0.5 rounded-lg hover:bg-white/[0.04]"
              >
                ✕ Temizle
              </button>
            )}
            {results.length > 0 && <span className="text-xs text-[#6b6b72]">{results.length} varyasyon</span>}
          </div>
        </div>

        {/* Hata */}
        {error && (
          <div className="mb-4 flex items-start gap-3 px-4 py-3 rounded-xl bg-accent-red/[0.08] border border-accent-red/25">
            <span className="text-accent-red text-base shrink-0 mt-0.5">✗</span>
            <p className="text-sm text-[#e8e8e0] leading-relaxed flex-1">{error}</p>
            <button onClick={() => setError('')} className="text-[#4a4a55] hover:text-[#8b8b96] transition-colors shrink-0 text-lg leading-none">×</button>
          </div>
        )}

        {/* xquik loading */}
        {/* Loading skeletons */}
        {loading && (
          <div className="space-y-3">
            {[...Array(mode === 'thread' ? 4 : variations)].map((_, i) => (
              <SkeletonCard key={i} />
            ))}
          </div>
        )}

        {/* Tweet sonuçları */}
        {!loading && results.length > 0 && (
          <div className="space-y-3">
            <MediaSuggestion impressionType={impressionType} />
            {results.map((tweet, i) => (
              <TweetCard
                key={i}
                tweet={tweet}
                onSave={handleSaveTweet}
                maxLength={length === 'extended' ? 500 : 280}
                hasPremium={effectiveSettings.hasPremium}
                xquikKey={settings.xquikKey}
                twitterUsername={effectiveSettings.twitterUsername}
                claudeKey={settings.claudeKey}
                impressionType={impressionType}
              />
            ))}
          </div>
        )}

        {/* Thread sonucu */}
        {!loading && thread && (
          <div className="space-y-2.5">
            <div className="flex items-center justify-between mb-1">
              <div className="flex items-center gap-2.5">
                <span className="text-sm font-semibold text-[#e8e8e0]">🧵 Thread</span>
                <span className="text-xs text-[#6b6b72] bg-white/[0.05] px-2 py-0.5 rounded-full">
                  {thread.tweets.length} tweet
                </span>
              </div>
              <div className="flex items-center gap-2">
                {thread.xquikScore && (
                  <span className={`text-xs font-semibold px-2.5 py-0.5 rounded-full border ${
                    thread.xquikScore.passed ? 'text-accent-green bg-accent-green/10 border-accent-green/30'
                    : 'text-accent-yellow bg-accent-yellow/10 border-accent-yellow/30'
                  }`}>
                    Grok {thread.xquikScore.total}/100
                  </span>
                )}
                <span className={`text-xs font-semibold px-2.5 py-0.5 rounded-full border ${
                  thread.total_score >= 85 ? 'text-accent-green bg-accent-green/10 border-accent-green/30'
                  : thread.total_score >= 70 ? 'text-accent-yellow bg-accent-yellow/10 border-accent-yellow/30'
                  : 'text-accent-orange bg-accent-orange/10 border-accent-orange/30'
                }`}>
                  {thread.total_score}/100
                </span>
              </div>
            </div>
            {thread.score_reason && (
              <p className="text-[11px] text-[#6b6b72] italic pl-1 mb-2">{thread.score_reason}</p>
            )}
            {thread.tweets.map((t, i) => {
              const badge: Record<string, string> = {
                hook:    'text-accent-green bg-accent-green/10 border-accent-green/20',
                content: 'text-[#8b8b96] bg-white/[0.04] border-white/[0.07]',
                cta:     'text-accent bg-accent/10 border-accent/20',
              };
              return (
                <div key={i} className={`relative bg-card border rounded-xl p-4 ${
                  t.type === 'hook' ? 'border-accent-green/25' : t.type === 'cta' ? 'border-accent/25' : 'border-white/[0.07]'
                }`}>
                  {i < thread.tweets.length - 1 && (
                    <div className="absolute left-6 -bottom-2.5 w-px h-2.5 bg-white/[0.12]" />
                  )}
                  <div className="flex items-center justify-between gap-2 mb-2.5">
                    <span className={`text-[10px] px-2 py-0.5 rounded-full border font-medium ${badge[t.type] || badge.content}`}>
                      {t.position}. {t.type === 'hook' ? 'Hook' : t.type === 'cta' ? 'CTA' : 'İçerik'}
                    </span>
                    <span className="text-[10px] text-[#4a4a55]">{t.text.length}/280</span>
                  </div>
                  <p className="text-sm text-[#e8e8e0] leading-relaxed whitespace-pre-wrap">{t.text}</p>
                  <button
                    onClick={() => navigator.clipboard.writeText(t.text)}
                    className="mt-2.5 text-[10px] text-[#6b6b72] hover:text-[#e8e8e0] transition-colors"
                  >
                    Kopyala
                  </button>
                </div>
              );
            })}
            <button
              onClick={() => navigator.clipboard.writeText(thread.tweets.map((t, i) => `${i + 1}/ ${t.text}`).join('\n\n'))}
              className="w-full mt-1 text-xs py-2.5 rounded-xl border border-white/[0.08] hover:bg-white/[0.04] text-[#8b8b96] transition-all"
            >
              Tüm Thread'i Kopyala
            </button>
          </div>
        )}

        {/* Boş ekran — örnek tweet vitrini veya kısa durum kartı */}
        {!loading && results.length === 0 && !thread && !error && (
          <div className="space-y-3">
            {viralTweets.length > 0 ? (
              <InspirationSpotlight
                topic={topic}
                tweets={viralTweets}
                selectedIds={selectedViralTweetIds}
                onToggleSelect={toggleInspirationTweet}
                onSelectTop={selectTopInspirationTweets}
                onClear={clearInspirationSelection}
                onUseAsTopic={(text) => setTopic(text.slice(0, 200))}
              />
            ) : (
              <EmptyState algoData={algoData} />
            )}
          </div>
        )}
      </div>

      {/* ── İlham Paneli — viral tweetler ─────────────────────────── */}
      {showInspirationRail && (viralLoading || viralTweets.length > 0) && (
        <div className="w-full 2xl:w-[360px] 2xl:shrink-0 border-t 2xl:border-t-0 2xl:border-l border-white/[0.06] bg-[#0a0a0d] flex flex-col overflow-hidden">
          {/* Header */}
          <div className="px-3.5 py-3 border-b border-white/[0.05] flex items-start justify-between gap-3 shrink-0">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-semibold text-[#8b8b96]">İlham Tweetleri</span>
                <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-accent/10 text-accent border border-accent/20">
                  xquik
                </span>
                {viralTweets.length > 0 && (
                  <span className="text-[9px] text-[#4a4a55]">{viralTweets.length}</span>
                )}
                {selectedViralTweets.length > 0 && (
                  <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-accent-green/10 text-accent-green border border-accent-green/20">
                    seçili {selectedViralTweets.length}
                  </span>
                )}
              </div>
              <p className="text-[9px] text-[#4a4a55] leading-relaxed">
                Sıcak tweetler. 3-5 tanesini seç, promptu daralt, kendi sesinle yeniden yaz.
              </p>
            </div>
            {viralLoading && (
              <span className="w-3 h-3 border border-accent/30 border-t-accent rounded-full animate-spin shrink-0" />
            )}
          </div>

          {viralTweets.length > 0 && (
            <div className="px-3.5 py-2 border-b border-white/[0.04] shrink-0 flex flex-wrap items-center gap-2">
              <button
                onClick={selectTopInspirationTweets}
                className="text-[10px] px-2 py-1 rounded-full bg-white/[0.05] hover:bg-white/[0.09] text-[#e8e8e0] transition-colors"
              >
                İlk 4
              </button>
              <button
                onClick={clearInspirationSelection}
                className="text-[10px] px-2 py-1 rounded-full bg-white/[0.05] hover:bg-white/[0.09] text-[#6b6b72] transition-colors"
              >
                Temizle
              </button>
              <span className="text-[9px] text-[#4a4a55]">
                En iyi akış için 3-5 seçili tweet yeterli.
              </span>
            </div>
          )}

          {/* Scrollable tweet listesi */}
          <div className="flex-1 overflow-y-auto divide-y divide-white/[0.04]">
            {viralLoading && viralTweets.length === 0 && (
              <div className="px-3.5 py-4 space-y-3">
                {[...Array(4)].map((_, i) => (
                  <div key={i} className="space-y-1.5">
                    <div className="h-2.5 w-24 animate-shimmer rounded" />
                    <div className="h-2 w-full animate-shimmer rounded" />
                    <div className="h-2 w-4/5 animate-shimmer rounded" />
                  </div>
                ))}
              </div>
            )}
            {viralTweets.map((vt, idx) => (
              <div
                key={vt.id}
                className={`px-3.5 py-3 hover:bg-white/[0.02] transition-colors group border-l-2 ${
                  selectedViralTweetIds.includes(vt.id)
                    ? 'border-accent-green bg-accent-green/[0.03]'
                    : 'border-transparent'
                }`}
              >
                <div className="flex items-center gap-1.5 mb-1.5">
                  <span className="text-[9px] font-bold text-[#3a3a48] w-4 shrink-0">{idx + 1}</span>
                  <span className="text-[10px] font-semibold text-[#8b8b96] truncate">@{vt.authorHandle}</span>
                  {vt.createdAt && (
                    <span className="text-[9px] text-[#4a4a55] ml-auto shrink-0">
                      {(() => {
                        const diff = (Date.now() - new Date(vt.createdAt).getTime()) / 60000;
                        if (diff < 60) return `${Math.round(diff)}dk`;
                        if (diff < 1440) return `${Math.round(diff / 60)}sa`;
                        return `${Math.round(diff / 1440)}g`;
                      })()}
                    </span>
                  )}
                </div>

                {vt.mediaPreviewUrl && (
                  <div className="mb-2 overflow-hidden rounded-xl border border-white/[0.08] bg-white/[0.02]">
                    <div className="relative aspect-[16/9] w-full">
                      <img
                        src={vt.mediaPreviewUrl}
                        alt={vt.text.slice(0, 60)}
                        loading="lazy"
                        className="h-full w-full object-cover"
                      />
                      {vt.isVideo && (
                        <div className="absolute inset-0 flex items-center justify-center bg-black/20">
                          <span className="rounded-full bg-black/50 px-3 py-1 text-[10px] text-white border border-white/20">
                            Video
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {vt.quotedText && (
                  <div className="mb-2 rounded-xl border border-white/[0.06] bg-white/[0.03] p-2.5">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="rounded-full bg-white/[0.05] px-1.5 py-0.5 text-[9px] text-[#8b8b96]">
                        Alıntı
                      </span>
                      {vt.quotedAuthorHandle && (
                        <span className="text-[9px] text-[#4a4a55] truncate">@{vt.quotedAuthorHandle}</span>
                      )}
                    </div>
                    <p className="text-[10px] text-[#8b8b96] leading-relaxed">{vt.quotedText}</p>
                    {vt.quotedMediaPreviewUrl && (
                      <div className="mt-2 overflow-hidden rounded-lg border border-white/[0.06]">
                        <img
                          src={vt.quotedMediaPreviewUrl}
                          alt={vt.quotedText.slice(0, 50)}
                          loading="lazy"
                          className="h-24 w-full object-cover"
                        />
                      </div>
                    )}
                  </div>
                )}

                <p className="text-[11px] text-[#7a7a85] leading-relaxed group-hover:text-[#a8a8b0] transition-colors">
                  {vt.text}
                </p>

                {/* Engagement */}
                <div className="flex items-center gap-2 mt-1.5">
                  {vt.views != null && vt.views > 0 && (
                    <span className="text-[9px] text-accent font-semibold">👁 {vt.views >= 1000 ? `${(vt.views/1000).toFixed(1)}k` : vt.views}</span>
                  )}
                  {vt.likes > 0 && (
                    <span className="text-[9px] text-[#6b6b72]">❤ {vt.likes >= 1000 ? `${(vt.likes/1000).toFixed(1)}k` : vt.likes}</span>
                  )}
                  {(vt.replies || 0) > 0 && (
                    <span className="text-[9px] text-[#6b6b72]">💬 {vt.replies}</span>
                  )}
                </div>

                {/* Aksiyonlar */}
                <div className="flex items-center gap-2 mt-2">
                  <button
                    onClick={() => setTopic(vt.text.slice(0, 200))}
                    className="text-[9px] text-accent/50 hover:text-accent transition-colors font-medium"
                  >
                    Konuya ekle →
                  </button>
                  <button
                    onClick={() => navigator.clipboard.writeText(vt.text)}
                    className="text-[9px] text-[#3a3a48] hover:text-[#6b6b72] transition-colors ml-auto"
                  >
                    Kopyala
                  </button>
                  <button
                    onClick={() => toggleInspirationTweet(vt.id)}
                    className={`text-[9px] px-1.5 py-0.5 rounded-full border transition-colors ${
                      selectedViralTweetIds.includes(vt.id)
                        ? 'bg-accent-green/10 text-accent-green border-accent-green/20'
                        : 'bg-white/[0.03] text-[#6b6b72] border-white/[0.06] hover:text-[#e8e8e0] hover:bg-white/[0.06]'
                    }`}
                  >
                    {selectedViralTweetIds.includes(vt.id) ? 'seçili' : 'seç'}
                  </button>
                </div>
              </div>
            ))}
          </div>

          {/* Footer notu */}
          {viralTweets.length > 0 && (
            <div className="px-3.5 py-2.5 border-t border-white/[0.04] shrink-0">
              <p className="text-[9px] text-[#3a3a48] leading-relaxed">
                Sıralama: konu alakası + görüntülenme · seçilen örnekler promptu daraltır · niş: {effectiveSettings.niche || 'general'}
              </p>
            </div>
          )}
        </div>
      )}
    </div>
    </div>
  );
}
