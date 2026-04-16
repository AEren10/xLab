import { getCurrentSlot } from '../lib/skill';

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
export function TimingBadge() {
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
