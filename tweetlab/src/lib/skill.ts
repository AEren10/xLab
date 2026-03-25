// Source: xai-org/x-algorithm (Jan 2026) + Hurricane @hrrcnes verified intel (59B impressions)
// Last updated: March 2026

export const ALGORITHM_RULES = `
## X Algorithm Rules (Phoenix / Grok System) — March 2026

### Architecture
X artik klasik algoritma kullanmiyor. Phoenix sistemi var:
- Grok tabanli transformer model — hand engineered feature sifir, makine ogreniyor
- Pipeline: Candidate Pipeline → Thunder (post storage) → Phoenix (Grok ranking) → Home Mixer
- ~30-40 modul paralel calisiyor, Grok bunlarin kontrolcusu
- final_score = toplam(agirlik x olasilik) — "bu kullanici bunu gorurse ne yapar?" tahmini

### Engagement Signal Weights
POZITIF (yuksekten dusuge):
- reply_engaged_by_author: 75 — EN KRITIK: kendi reply chain'ini ac
- reply: 13.5
- profile_click: 12
- click: 11
- dwell_time_2min: 10
- bookmark: 10
- share_via_dm: 9
- share_via_copy_link: 8
- follow_author: 5
- retweet: 1
- like: 0.5 — tek basina anlamsiz

NEGATIF (KACIN):
- report: -369 — KATASTROFIK
- not_interested: -74
- mute_author: -74
- block_author: -50

### TweetCred System
- Default baslangic: -128
- Minimum erisim icin: +17 gerekli
- Mavi tik: otomatik +100 → -28'den baslar
- Bio, takip ettiklerin, takip/takipci orani, dil, uslup hepsi etkiler

### Engagement Debt (Cold Start Suppression)
- Ilk 100 post'ta %0.5'ten dusuk like/impression → skor kalici -50 duser
- Debt aktifse: normalde 1000 kisiye gidecek post → 100 kisiye gider
- Yeni hesapsa sabirl ol, tweetcred zamanla yukseliyor

### Dwell Time
- 2+ dakika okuma: +10 puan
- 3 saniyeden az (scroll pass): quality multiplier -%15-20
- Multi-line format, satirlar arasi bosluk dwell time arttirir
- Uzun soluklu ama degerli icerik — okutan, durduran sey yaz

### Golden Hour (Ilk 1 Saat — EN KRITIK)
- Ilk 1 saatte iyi performans → genis dagitime aciliyorsun
- Ilk 1 saatte kotu performans → post olu doguyor
- Velocity kurali: 15 dakikada 10 reply >> 24 saatte 10 reply
- Her 6 saatte ~%50 visibility kaybi
- Tweet atinca hemen kendi tweetine 2-3 reply yaz
- Gelen her reply'a hemen cevap ver (en degerli sinyal)

### Author Diversity Penalty
- Gunde max 2 post (buyuk hesaplar icin)
- Aralarinda mesafe birak
- Rapid fire posting = automation sinyali = penalti

### Content Rules
YAPMA:
- Hashtag kullanma (algorima icin notr/negatif)
- Emoji kullanma
- Em dash (—) veya en dash (–) kullanma
- External link tweet icinde (30-50% reach azalir)
- Rapid fire tweet
- Trolluk, kavga, negativity — Grok sentiment analizi yapiyor
- Copy-paste/duplicate content — spam chain olarak etiketleniyor
- Obvious engagement bait ("like if agree") — tespit edilip bastiriliyor

YAP:
- Ilk cumle hook olsun — scroll durduracak
- Soru veya acik ucla bitir — reply cek
- Hemen kendi reply chain'ini ac
- Gelen her reply'a cevap ver
- Link varsa reply'a yaz, tweet icine degil
- Kisa cumleler, nefes al, ritim kur

### Anti-AI Language — YASAK
Kelimeler: delve, tapestry, multifaceted, nuanced, it's worth noting, furthermore, moreover, in conclusion, "son derece", "oldukca", "gercekten cok"
Yapilar: em dash, bullet list halinde tweet, "Oncelikle X, ardindan Y, son olarak Z", her cumle ayni uzunlukta, asiri kibar ton

### Insan Gibi Yaz
- Kisa cumle gucludur. Sonra biraz uzun. Yine kisa.
- Kucuk harf baslangic daha samimi
- "..." ile dramatik duraklama
- Asla "Ben" ile baslatma

### Timing (TR/Istanbul UTC+3)
- 07:30-09:00: Sabah commute — motivasyon, egitici
- 12:00-13:30: Ogle molasi — hot take, veri
- 20:00-22:30: PEAK ENGAGEMENT — tartisma, soru, reply chain
- 23:00-00:30: Gece niche — derin gozlem, dusuk rekabet
- Haftanin en iyi gunu: Carsamba-Persembe aksam

### Buyume Stratejisi (Hurricane verified — 59B impressions)
1. Kaliteli icerik uret — reply, repost, share aldiran icerik
2. Gunde 2 post max — aralarinda mesafe birak
3. Negatif aksiyon aldirma — trolluk yapma, kavga etme
4. Ilk 1 saat aktif kal — yorumlara cevap ver
5. Dwell time kas — uzun okutan, durduran icerik yap
6. Yeni hesapsan sabirl ol — tweetcred zamanla yukseliyor
7. Buyuk hesaplara reply at — juice transfer al (trustscore aktarimi)
8. Crew olustur — birbirinizi boostlayin
`;

export const SCORING_CRITERIA = {
  hook: { weight: 25, label: 'Hook Gücü', description: 'İlk cümle scroll durduruyor mu?' },
  information: { weight: 20, label: 'Bilgi Değeri', description: 'Spesifik insight/stat var mı?' },
  reply_potential: { weight: 15, label: 'Reply Potansiyeli', description: 'Yorum tetikliyor mu?' },
  algorithm: { weight: 15, label: 'Algoritma Uyumu', description: 'Kurallara uyuyor mu?' },
  persona: { weight: 15, label: 'Persona Eşleşmesi', description: 'Seçilen tarzda mı?' },
  originality: { weight: 10, label: 'Özgünlük', description: 'Taze açı var mı?' },
};

export const TIMING_SLOTS = [
  { start: 7.5, end: 9, label: 'Sabah commute', quality: 'good', tip: 'Motivasyon veya eğitici içerik' },
  { start: 12, end: 13.5, label: 'Öğle molası', quality: 'medium', tip: 'Hot take veya veri' },
  { start: 20, end: 22.5, label: 'Akşam peak', quality: 'best', tip: 'Tartışma, soru, reply chain için ideal' },
  { start: 23, end: 24.5, label: 'Gece niche', quality: 'ok', tip: 'Derin gözlem, düşük rekabet' },
];

export function getCurrentSlot(): { quality: 'best' | 'good' | 'medium' | 'ok' | 'weak'; label: string; tip: string } {
  const now = new Date();
  // Convert to Istanbul time (UTC+3)
  const utc = now.getTime() + now.getTimezoneOffset() * 60000;
  const istanbul = new Date(utc + 3 * 3600000);
  const hour = istanbul.getHours() + istanbul.getMinutes() / 60;

  for (const slot of TIMING_SLOTS) {
    const end = slot.end > 24 ? slot.end - 24 : slot.end;
    if (hour >= slot.start && hour < end) {
      return { quality: slot.quality as any, label: slot.label, tip: slot.tip };
    }
  }
  return { quality: 'weak', label: 'Zayıf slot', tip: 'En iyi: akşam 20:00-22:30' };
}
