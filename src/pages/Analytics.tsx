/**
 * Analytics — En iyi paylaşım saati / günü analizi.
 *
 * Veri kaynağı: History'e kaydedilmiş + postedAt dolu + engagement > 0 olan tweetler.
 * Zaman: Istanbul UTC+3.
 *
 * Görünüm:
 *   - Gün × Saat heatmap (7 × 24) — hover'da avg eng skoru
 *   - En iyi 3 saat + en iyi 3 gün kartları
 *   - Saat dilimi yorumu (sabah / öğle / akşam peak / gece nişi)
 *   - Veri yoksa → nasıl kullanılacağına dair yönlendirme
 */

import { useMemo } from 'react';
import { db } from '../lib/db';

const DAY_LABELS = ['Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt', 'Paz'];
const DAY_FULL   = ['Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi', 'Pazar'];

// Saati "09:00" formatında döndür
const fmtHour = (h: number) => `${String(h).padStart(2, '0')}:00`;

// Engagement değerine göre heatmap rengi (CSS class değil, inline style)
function engColor(avg: number, max: number): string {
  if (max === 0 || avg === 0) return 'rgba(255,255,255,0.04)';
  const ratio = avg / max;
  if (ratio >= 0.8) return 'rgba(52, 211, 153, 0.75)';  // accent-green yoğun
  if (ratio >= 0.6) return 'rgba(52, 211, 153, 0.50)';
  if (ratio >= 0.4) return 'rgba(52, 211, 153, 0.30)';
  if (ratio >= 0.2) return 'rgba(52, 211, 153, 0.15)';
  return 'rgba(255,255,255,0.06)';
}

function engTextColor(avg: number, max: number): string {
  if (max === 0 || avg === 0) return 'transparent';
  const ratio = avg / max;
  if (ratio >= 0.6) return '#e8e8e0';
  if (ratio >= 0.3) return '#8b8b96';
  return 'transparent';
}

// Saati yorumla
function hourZone(h: number): string {
  if (h >= 7 && h < 9)   return 'Sabah commute — motivasyon içerik';
  if (h >= 9 && h < 12)  return 'Sabah iş saati — orta trafik';
  if (h >= 12 && h < 14) return 'Öğle molası — kısa içerik, hot take';
  if (h >= 14 && h < 18) return 'Öğleden sonra — düşük trafik';
  if (h >= 18 && h < 20) return 'Akşam öncesi — trafik artıyor';
  if (h >= 20 && h < 23) return 'Peak saat — Türk kitlenin zirvesi';
  if (h >= 23 || h < 2)  return 'Gece nişi — düşük rekabet, niş kitle';
  return 'Düşük trafik';
}

export function Analytics() {
  const { byHour, byDay, bestHour, bestDay, heatmap, totalPosted } = useMemo(
    () => db.getTimeAnalytics(),
    []
  );

  const maxHourEng = Math.max(...byHour.map((h) => h.avgEng));
  const maxDayEng  = Math.max(...byDay.map((d) => d.avgEng));
  const maxHeatmap = Math.max(...heatmap.flatMap((row) => row.map((c) => c.avgEng)));

  // En iyi 3 saat (veri olan)
  const top3Hours = [...byHour]
    .map((h, i) => ({ ...h, hour: i }))
    .filter((h) => h.count > 0)
    .sort((a, b) => b.avgEng - a.avgEng)
    .slice(0, 3);

  // En iyi 3 gün
  const top3Days = [...byDay]
    .map((d, i) => ({ ...d, day: i }))
    .filter((d) => d.count > 0)
    .sort((a, b) => b.avgEng - a.avgEng)
    .slice(0, 3);

  // Veri yok durumu
  if (totalPosted === 0) {
    return (
      <div className="h-full flex flex-col items-center justify-center text-center p-8 space-y-4">
        <div className="text-4xl">📅</div>
        <p className="text-sm font-medium text-[#e8e8e0]">Henüz yeterli veri yok</p>
        <p className="text-xs text-[#6b6b72] max-w-64 leading-relaxed">
          Tweet üret → Arşiv'de "Atıldı" işaretle → Engagement gir veya "X'ten Güncelle" kullan.
          Yeterli veri biriktikçe en iyi saatler burada görünür.
        </p>
        <div className="border border-white/[0.07] rounded-xl p-4 text-left max-w-sm space-y-2 mt-4">
          <p className="text-xs font-medium text-[#8b8b96]">Statik öneri (Hurricane @hrrcnes verisi)</p>
          {[
            ['20:00–22:30', 'En iyi slot', 'text-accent-green'],
            ['07:30–09:00', 'Sabah commute', 'text-accent'],
            ['12:00–13:30', 'Öğle peak', 'text-accent'],
            ['23:00–00:30', 'Gece nişi', 'text-[#6b6b72]'],
          ].map(([time, label, color]) => (
            <div key={time} className="flex items-center justify-between">
              <span className={`text-xs font-mono ${color}`}>{time}</span>
              <span className="text-[11px] text-[#6b6b72]">{label}</span>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 space-y-5 overflow-y-auto h-full max-w-5xl mx-auto">

      {/* Başlık */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-sm font-semibold text-[#e8e8e0]">Paylaşım Zamanı Analizi</h1>
          <p className="text-[11px] text-[#4a4a55] mt-0.5">
            {totalPosted} atılmış tweet · Istanbul UTC+3
          </p>
        </div>
        {bestHour >= 0 && bestDay >= 0 && (
          <div className="text-right">
            <p className="text-[10px] text-[#6b6b72]">Senin için en iyi an</p>
            <p className="text-sm font-semibold text-accent-green">
              {DAY_FULL[bestDay]}, {fmtHour(bestHour)}
            </p>
          </div>
        )}
      </div>

      {/* Özet kartlar */}
      <div className="grid grid-cols-2 gap-3">
        {/* En iyi saatler */}
        <div className="bg-card border border-white/[0.07] rounded-xl p-4">
          <p className="text-[10px] font-semibold text-[#4a4a55] uppercase tracking-wider mb-3">
            En İyi Saatler
          </p>
          <div className="space-y-2">
            {top3Hours.length === 0 && (
              <p className="text-[11px] text-[#4a4a55]">Veri yok</p>
            )}
            {top3Hours.map((h, rank) => (
              <div key={h.hour} className="flex items-center gap-3">
                <span className={`text-[9px] w-4 font-bold ${rank === 0 ? 'text-accent-green' : 'text-[#4a4a55]'}`}>
                  #{rank + 1}
                </span>
                <span className="font-mono text-sm text-[#e8e8e0] w-14">{fmtHour(h.hour)}</span>
                <div className="flex-1 h-1.5 bg-white/[0.05] rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full bg-accent-green/60"
                    style={{ width: `${Math.round((h.avgEng / maxHourEng) * 100)}%` }}
                  />
                </div>
                <span className="text-[10px] text-[#8b8b96] w-16 text-right">avg {h.avgEng}</span>
              </div>
            ))}
          </div>
          {top3Hours[0] && (
            <p className="text-[10px] text-accent/70 mt-3 leading-relaxed">
              {hourZone(top3Hours[0].hour)}
            </p>
          )}
        </div>

        {/* En iyi günler */}
        <div className="bg-card border border-white/[0.07] rounded-xl p-4">
          <p className="text-[10px] font-semibold text-[#4a4a55] uppercase tracking-wider mb-3">
            En İyi Günler
          </p>
          <div className="space-y-2">
            {top3Days.length === 0 && (
              <p className="text-[11px] text-[#4a4a55]">Veri yok</p>
            )}
            {top3Days.map((d, rank) => (
              <div key={d.day} className="flex items-center gap-3">
                <span className={`text-[9px] w-4 font-bold ${rank === 0 ? 'text-accent-green' : 'text-[#4a4a55]'}`}>
                  #{rank + 1}
                </span>
                <span className="text-sm text-[#e8e8e0] w-14">{DAY_FULL[d.day]}</span>
                <div className="flex-1 h-1.5 bg-white/[0.05] rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full bg-accent/60"
                    style={{ width: `${Math.round((d.avgEng / maxDayEng) * 100)}%` }}
                  />
                </div>
                <span className="text-[10px] text-[#8b8b96] w-16 text-right">avg {d.avgEng}</span>
              </div>
            ))}
          </div>
          {top3Days[0] && (
            <p className="text-[10px] text-[#6b6b72] mt-3 leading-relaxed">
              {d3Days0note(top3Days[0].day)}
            </p>
          )}
        </div>
      </div>

      {/* Heatmap */}
      <div className="bg-card border border-white/[0.07] rounded-xl p-4">
        <div className="flex items-center justify-between mb-4">
          <p className="text-xs font-semibold text-[#e8e8e0]">Gün × Saat Haritası</p>
          <div className="flex items-center gap-2 text-[10px] text-[#4a4a55]">
            <span>Düşük</span>
            <div className="flex gap-0.5">
              {['rgba(255,255,255,0.06)', 'rgba(52,211,153,0.15)', 'rgba(52,211,153,0.30)', 'rgba(52,211,153,0.50)', 'rgba(52,211,153,0.75)'].map((c) => (
                <div key={c} className="w-3 h-3 rounded-sm" style={{ background: c }} />
              ))}
            </div>
            <span>Yüksek</span>
          </div>
        </div>

        <div className="overflow-x-auto">
          <div className="min-w-[700px]">
            {/* Saat başlıkları */}
            <div className="flex items-center mb-1">
              <div className="w-8 shrink-0" />
              {Array.from({ length: 24 }, (_, h) => (
                <div key={h} className="flex-1 text-center text-[8px] text-[#4a4a55] font-mono">
                  {h % 3 === 0 ? String(h).padStart(2, '0') : ''}
                </div>
              ))}
            </div>

            {/* Her gün için satır */}
            {heatmap.map((row, dayIdx) => (
              <div key={dayIdx} className="flex items-center mb-0.5 group">
                <div className="w-8 shrink-0 text-[9px] text-[#6b6b72] font-medium">
                  {DAY_LABELS[dayIdx]}
                </div>
                {row.map((cell, hour) => (
                  <div
                    key={hour}
                    className="flex-1 mx-px rounded-sm relative"
                    style={{
                      height: '22px',
                      background: engColor(cell.avgEng, maxHeatmap),
                    }}
                    title={cell.count > 0 ? `${DAY_FULL[dayIdx]} ${fmtHour(hour)} — avg eng: ${cell.avgEng} (${cell.count} tweet)` : ''}
                  >
                    {cell.count > 0 && (
                      <span
                        className="absolute inset-0 flex items-center justify-center text-[7px] font-bold leading-none"
                        style={{ color: engTextColor(cell.avgEng, maxHeatmap) }}
                      >
                        {cell.avgEng > 0 ? cell.avgEng : ''}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>
        <p className="text-[10px] text-[#4a4a55] mt-3">
          Hücre üzerine gel → gün, saat ve ortalama engagement skoru. Skor = like + reply×5 + rt×2 + quote×3 (Grok ağırlıkları).
        </p>
      </div>

      {/* Saat dilimi açıklama tablosu */}
      <div className="bg-card border border-white/[0.07] rounded-xl p-4">
        <p className="text-xs font-semibold text-[#e8e8e0] mb-3">Saat Dilimi Rehberi</p>
        <div className="grid grid-cols-2 gap-2">
          {[
            { range: '07:30–09:00', label: 'Sabah commute', note: 'Motivasyon & insight — telefon yoğun', color: 'text-accent' },
            { range: '12:00–13:30', label: 'Öğle molası',   note: 'Kısa içerik, hot take işe yarıyor',   color: 'text-accent' },
            { range: '20:00–22:30', label: 'Akşam peak',    note: 'Türk kitlesi zirvesi — reply chain başlat', color: 'text-accent-green' },
            { range: '23:00–00:30', label: 'Gece nişi',     note: 'Düşük rekabet, niş kitleye ulaş',     color: 'text-[#8b8b96]' },
          ].map((slot) => (
            <div key={slot.range} className="flex items-start gap-3 p-2.5 rounded-lg bg-white/[0.02] border border-white/[0.05]">
              <span className={`font-mono text-[11px] shrink-0 ${slot.color}`}>{slot.range}</span>
              <div>
                <p className="text-[11px] font-medium text-[#e8e8e0]">{slot.label}</p>
                <p className="text-[10px] text-[#4a4a55] mt-0.5">{slot.note}</p>
              </div>
            </div>
          ))}
        </div>
        <p className="text-[10px] text-[#4a4a55] mt-3">
          Kaynak: Hurricane @hrrcnes · 59B impression analizi · Türk kitlesi için optimize.
          Haritada kendi hesabın için en iyi zamanlar yukarıda hesaplanıyor.
        </p>
      </div>

    </div>
  );
}

// Gün yorumu
function d3Days0note(day: number): string {
  const notes: Record<number, string> = {
    0: 'Pazartesi — haftanın en aktif başlangıcı, motivasyon içerik tutuyor',
    1: 'Salı — engagement tutarlılık açısından en dengeli gün',
    2: 'Çarşamba — hafta ortası, data ve edu içerik iyi çalışıyor',
    3: 'Perşembe — hafta sonu öncesi, hot take ve tartışma açan içerik tutuyor',
    4: 'Cuma — akşam saatleri güçlü, gündüz düşük',
    5: 'Cumartesi — niş kitleye ulaşmak için iyi, genel trafik daha düşük',
    6: 'Pazar — sabah erken ve gece nişi slot çalışıyor',
  };
  return notes[day] ?? '';
}
