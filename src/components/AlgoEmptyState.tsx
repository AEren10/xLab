import { useState } from 'react';

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
export function AlgoEmptyState({ algoData }: { algoData: any }) {
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
