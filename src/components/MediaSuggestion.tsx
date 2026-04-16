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
export function MediaSuggestion({ impressionType }: { impressionType: string }) {
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
