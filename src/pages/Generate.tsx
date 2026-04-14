import { useState, useEffect, useCallback, useRef, useLayoutEffect } from 'react';
import { TweetCard } from '../components/TweetCard';
import { RadarPanel } from '../components/RadarPanel';
import { ExternalTrendsPanel } from '../components/ExternalTrendsPanel';
import { ContextPreview } from '../components/ContextPreview';
import { Tooltip } from '../components/Tooltip';
import { db } from '../lib/db';
import type { AccountProfile } from '../lib/db';
import { xquikApi } from '../lib/xquik';
import type { RadarItem, ComposeAlgoData, UserTweet, TweetSearchResult, ExternalTrends, ThreadResult } from '../lib/xquik';
import { claudeApi } from '../lib/claude';
import type { TweetVariation, TweetThread } from '../lib/claude';
import {
  buildSystemPrompt,
  buildUserMessage,
  buildThreadMessage,
  buildCopyPrompt,
} from '../lib/contextBuilder';
import { getCurrentSlot } from '../lib/skill';

const IMPRESSION_TYPES = [
  { id: 'Data',     label: 'Veri',      tip: 'Stat, rakam, araştırma. Güvenilirlik yüksek, bookmark alan içerik.' },
  { id: 'Story',    label: 'Hikaye',    tip: 'Kişisel deneyim. Dwell time artırır — okutturan içerik.' },
  { id: 'Hot Take', label: 'Cesur Fikir', tip: 'Tartışma açar, reply patlar. Dikkatli kullan, negatif sinyal riski var.' },
  { id: 'Edu',      label: 'Eğitici',   tip: 'Öğretici. "Bunu bilmiyordum" bookmark oranı yüksek.' },
  { id: 'Inspire',  label: 'İlham',     tip: 'Motivasyon, bakış açısı. RT ve quote alır, reply az.' },
  { id: 'Humor',    label: 'Mizah',     tip: 'Bağlam gerektirir. Yanlış zamanda atılırsa sıfır reach.' },
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
  const effectiveSettings = activeProfile
    ? { ...settings, niche: activeProfile.niche, defaultPersona: activeProfile.defaultPersona, toneProfile: activeProfile.toneProfile, twitterUsername: activeProfile.twitterUsername, hasPremium: activeProfile.hasPremium }
    : settings;

  const ss = sessionStorage;
  const [topic, setTopic] = useState(() => ss.getItem('gen_topic') || '');
  const [impressionType, setImpressionType] = useState(() => ss.getItem('gen_type') || 'Data');
  const [length, setLength] = useState(() => ss.getItem('gen_length') || 'standard');
  const [goal, setGoal] = useState(() => ss.getItem('gen_goal') || 'Engagement');
  const [variations, setVariations] = useState(() => Number(ss.getItem('gen_vars')) || 3);
  const [persona, setPersona] = useState<any>(null);
  const [personaId, setPersonaId] = useState(() => ss.getItem('gen_persona') || effectiveSettings.defaultPersona || 'hurricane');
  const personaList = ['hurricane', 'tr_educational', 'tr_controversial', 'tr_casual'];
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
  const viralDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Viral thread'ler — thread modu için ilham
  const [viralThreads, setViralThreads] = useState<ThreadResult[]>([]);
  // Dış trendler (Reddit / HN / Google)
  const [externalTrends, setExternalTrends] = useState<ExternalTrends>({ reddit: [], hackernews: [], google: [] });

  useEffect(() => {
    fetch(`/personas/${personaId}.json`)
      .then((r) => r.json())
      .then((data) => setPersona(data))
      .catch(() => setPersona(null));
  }, [personaId]);

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
  useEffect(() => { sessionStorage.setItem('gen_length', length); }, [length]);
  useEffect(() => { sessionStorage.setItem('gen_goal', goal); }, [goal]);
  useEffect(() => { sessionStorage.setItem('gen_vars', String(variations)); }, [variations]);
  useEffect(() => { sessionStorage.setItem('gen_persona', personaId); }, [personaId]);

  // Profil değişince personaId sıfırla
  useEffect(() => {
    setPersonaId(effectiveSettings.defaultPersona || 'hurricane');
  }, [activeProfileId]);

  // Viral tweet fetch — topic değişince debounce ile tetikle
  useEffect(() => {
    if (viralDebounceRef.current) clearTimeout(viralDebounceRef.current);
    if (!topic.trim() || topic.length < 5 || !settings.xquikKey) {
      setViralTweets([]);
      return;
    }
    viralDebounceRef.current = setTimeout(async () => {
      setViralLoading(true);
      const [tweets, threads] = await Promise.all([
        xquikApi.searchTweets(settings.xquikKey, topic, {
          minFaves: 100, lang: 'tr', hours: 72, limit: 10,
        }),
        xquikApi.searchThreads(settings.xquikKey, topic, {
          lang: 'tr', hours: 72, limit: 3,
        }),
      ]);
      console.info('[viralTweets] çekilen:', tweets.length, tweets.map(t => `❤${t.likes} "${t.text?.slice(0,60)}"`));
      setViralTweets(tweets);
      setViralThreads(threads);
      setViralLoading(false);
    }, 1200);
    return () => {
      if (viralDebounceRef.current) clearTimeout(viralDebounceRef.current);
      setViralLoading(false);
    };
  }, [topic, settings.xquikKey]);

  useEffect(() => {
    if (!persona) return;
    const sys = buildSystemPrompt(persona, effectiveSettings, algoData, db.getTweets());
    const user = buildUserMessage({
      topic: topic || '(konu girilmedi)',
      persona, settings: effectiveSettings,
      recentTweets: db.getTweets(),
      xUserTweets: userTweets,
      radarItems, impressionType, length, goal, variations,
      viralTweets, externalTrends,
    });
    setCopyPrompt(buildCopyPrompt(sys, user, persona, effectiveSettings, algoData, viralTweets));
  }, [topic, persona, impressionType, length, goal, variations, radarItems, algoData, userTweets, viralTweets, activeProfileId]);

  // ── Prompt al — API'siz, sadece kopyala ────────────────────────────────────
  const handleCopyPrompt = useCallback(async () => {
    if (!topic.trim()) return;
    await navigator.clipboard.writeText(copyPrompt);
    setPromptCopied(true);
    setTimeout(() => setPromptCopied(false), 3000);
  }, [topic, copyPrompt]);

  // ── Direkt üret — Claude API ile ────────────────────────────────────────────
  const handleGenerate = useCallback(async () => {
    if (!topic.trim() || !settings.claudeKey) return;
    setLoading(true); setError(''); setResults([]); setThread(null);

    const sys = buildSystemPrompt(persona, effectiveSettings, algoData, db.getTweets());
    console.info('[generate] viralTweets sayısı:', viralTweets.length, '| mod:', mode);

    if (mode === 'thread') {
      const user = buildThreadMessage({ topic, persona, settings: effectiveSettings, recentTweets: db.getTweets(), xUserTweets: userTweets, radarItems, impressionType, length, goal, variations, viralTweets });
      console.info('[thread] viralBlock var mı:', viralTweets.length > 0, '| prompt uzunluğu:', user.length);
      try { setThread(await claudeApi.generateThread(settings.claudeKey, sys, user)); }
      catch (e: any) { setError(e.message || 'Claude API hatası.'); }
    } else {
      const user = buildUserMessage({ topic, persona, settings: effectiveSettings, recentTweets: db.getTweets(), xUserTweets: userTweets, radarItems, impressionType, length, goal, variations, viralTweets, externalTrends });
      try { setResults(await claudeApi.generateTweets(settings.claudeKey, sys, user, variations)); }
      catch (e: any) { setError(e.message || 'Claude API hatası.'); }
    }
    setLoading(false);
  }, [topic, persona, effectiveSettings, settings.claudeKey, radarItems, impressionType, length, goal, variations, mode, algoData, userTweets, viralTweets]);

  const handleSaveTweet = (tweet: TweetVariation) => {
    db.saveTweet({
      text: tweet.text, topic, persona: personaId,
      impressionType,
      score: tweet.total_score, scores: tweet.scores, scoreReason: tweet.score_reason,
      engagement: { like: 0, reply: 0, rt: 0, quote: 0 },
    });
    if (settings.xquikKey) xquikApi.saveDraft(settings.xquikKey, tweet.text, topic);
  };

  return (
    <div className="flex h-full">
      {/* ── Sol panel ─────────────────────────────────────────────── */}
      <div
        style={{ width: panelWidth, minWidth: 260, maxWidth: 600 }}
        className="shrink-0 border-r border-white/[0.06] p-4 space-y-4 overflow-y-auto bg-[#0c0c0f]"
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
                onClick={() => { setMode(m); setResults([]); setThread(null); setError(''); }}
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

        {/* Radar */}
        <RadarPanel apiKey={settings.xquikKey} onSelect={(t) => setTopic(t)} />

        {/* Dış Trendler (Reddit / HN / Google) */}
        {(externalTrends.reddit.length > 0 || externalTrends.hackernews.length > 0 || externalTrends.google.length > 0) && (
          <ExternalTrendsPanel trends={externalTrends} onSelect={(t) => setTopic(t)} />
        )}

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
        className="w-1 shrink-0 hover:bg-accent/30 active:bg-accent/50 cursor-col-resize transition-colors group relative"
        title="Sürükle"
      >
        <div className="absolute inset-y-0 -left-1 -right-1" />
      </div>

      {/* ── Sağ panel ─────────────────────────────────────────────── */}
      <div className="flex-1 p-5 overflow-y-auto">

        {/* Timing + header */}
        <div className="flex items-center justify-between mb-5">
          <TimingBadge />
          <div className="flex items-center gap-2">
            {(results.length > 0 || thread) && (
              <button
                onClick={() => { setResults([]); setThread(null); setError(''); }}
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
              <span className={`text-xs font-semibold px-2.5 py-0.5 rounded-full border ${
                thread.total_score >= 85 ? 'text-accent-green bg-accent-green/10 border-accent-green/30'
                : thread.total_score >= 70 ? 'text-accent-yellow bg-accent-yellow/10 border-accent-yellow/30'
                : 'text-accent-orange bg-accent-orange/10 border-accent-orange/30'
              }`}>
                {thread.total_score}/100
              </span>
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

        {/* Boş ekran — algo ipuçları */}
        {!loading && results.length === 0 && !thread && !error && (
          <EmptyState algoData={algoData} />
        )}
      </div>

      {/* ── İlham Paneli — viral tweetler ─────────────────────────── */}
      {(viralLoading || viralTweets.length > 0) && (
        <div className="w-[270px] shrink-0 border-l border-white/[0.06] bg-[#0a0a0d] flex flex-col overflow-hidden">
          {/* Header */}
          <div className="px-3.5 py-3 border-b border-white/[0.05] flex items-center justify-between shrink-0">
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-semibold text-[#8b8b96]">İlham Kaynakları</span>
              <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-accent/10 text-accent border border-accent/20">
                xquik
              </span>
              {viralTweets.length > 0 && (
                <span className="text-[9px] text-[#4a4a55]">{viralTweets.length}</span>
              )}
            </div>
            {viralLoading && (
              <span className="w-3 h-3 border border-accent/30 border-t-accent rounded-full animate-spin shrink-0" />
            )}
          </div>

          {/* Açıklama */}
          <div className="px-3.5 py-2 border-b border-white/[0.04] shrink-0">
            <p className="text-[9px] text-[#4a4a55] leading-relaxed">
              Claude bu tweetleri analiz ederek senin için içerik üretiyor. Hangisi tutmuş, neden?
            </p>
          </div>

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
              <div key={vt.id} className="px-3.5 py-3 hover:bg-white/[0.02] transition-colors group">
                {/* Sıra + yazar */}
                <div className="flex items-center gap-1.5 mb-1.5">
                  <span className="text-[9px] font-bold text-[#3a3a48] w-4 shrink-0">{idx + 1}</span>
                  <span className="text-[10px] font-semibold text-[#8b8b96] truncate">@{vt.authorHandle}</span>
                  <div className="flex items-center gap-1 ml-auto shrink-0">
                    {vt.likes > 0 && (
                      <span className="text-[9px] text-accent-red/70">
                        ♥ {vt.likes >= 1000 ? `${(vt.likes / 1000).toFixed(1)}k` : vt.likes}
                      </span>
                    )}
                    {vt.replies > 0 && (
                      <span className="text-[9px] text-accent/60">
                        · 💬 {vt.replies}
                      </span>
                    )}
                  </div>
                </div>

                {/* Tweet metni — tam, scrollable değil çünkü panel zaten scroll ediliyor */}
                <p className="text-[11px] text-[#7a7a85] leading-relaxed group-hover:text-[#a8a8b0] transition-colors">
                  {vt.text}
                </p>

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
                </div>
              </div>
            ))}
          </div>

          {/* Footer notu */}
          {viralTweets.length > 0 && (
            <div className="px-3.5 py-2.5 border-t border-white/[0.04] shrink-0">
              <p className="text-[9px] text-[#3a3a48] leading-relaxed">
                Son 2 saatte ≥50 like alan tweetler · niş: {effectiveSettings.niche || 'general'}
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
