/**
 * skill.ts — X algoritması kuralları ve scoring sistemi
 *
 * ALGORITHM_RULES:
 *   Statik fallback. xquik key yoksa veya /compose endpoint boş dönerse bu kullanılır.
 *   Kaynak: xai-org/x-algorithm (Ocak 2026) + Hurricane @hrrcnes doğrulaması (59B impression)
 *   Güncelleme: xquik compose API'den canlı veri gelince contextBuilder bu bloğu bypass eder.
 *
 * SCORING_CRITERIA:
 *   Claude tweet üretirken her kategoriye puan verir.
 *   Ağırlıklar toplamı = 100. TweetCard ve History bu verileri bar chart olarak gösterir.
 *
 * TIMING_SLOTS:
 *   Istanbul UTC+3 saatine göre. TimingBadge bileşeni bunu kullanır.
 *   "best" slot = akşam peak (20:00-22:30) — Türk kullanıcı trafiğinin zirvesi.
 */
// Source: xai-org/x-algorithm (Jan 2026) + Hurricane @hrrcnes verified intel (59B impressions)
// Last updated: March 2026

export const ALGORITHM_RULES = `
## X Algorithm Rules (Grok Transformer System) — March 2026

### Architecture
X artik klasik algoritma kullanmiyor. Ocak 2026'dan itibaren tam Grok sistemi:
- Grok tabanli transformer model — hand engineered feature sifir, makine ogreniyor
- Pipeline: Candidate Pipeline → Thunder (post storage) → Grok Ranking → Home Mixer
- ~30-40 modul paralel calisiyor, Grok bunlarin kontrolcusu
- final_score = toplam(agirlik x olasilik) — "bu kullanici bunu gorurse ne yapar?" tahmini
- NOT: "Phoenix" eski mimari adiydi, Ocak 2026'da Grok transformer'a tam gecis yapildi

### Engagement Signal Weights
POZITIF (yuksekten dusuge):
- reply_engaged_by_author: 75 — EN KRITIK: kendi reply chain'ini ac (like'in 150 kati)
- reply: 13.5 (like'in 27 kati)
- profile_click: 12 (like'in 12 kati)
- click: 11 — tweet'e tiklanmak
- dwell_time_2min: 10 — 2+ dakika okuma (P(dwell) Grok'un model outputlarindan biri)
- bookmark: 10 — "kaydet" sinyali, paylasim kadar guclu
- share_via_dm: 9 — DM ile paylasim = yuksek deger icerigi sinyali
- share_via_copy_link: 8 — link kopyalama
- follow_author: 5 — tweetden follow = en guclu buyume sinyali
- share: 4 — genel paylasim menüsü
- quote: 3 — quote tweet ayri olculuyor
- quoted_click: 2.5 — aliyntilanan tweete tiklanmak
- photo_expand: 2 — resim genisletme
- vqv: 2 — video quality view (minimum sure esigini gecen izleme)
- retweet: 1
- like: 0.5 — tek basina anlamsiz, baska sinyal olmadan hicbir sey ifade etmez

NEGATIF (KACIN):
- report: -369 — KATASTROFIK (like'in 738 kati negatif)
- not_interested: -74
- mute_author: -74
- block_author: -50

### TweetCred (TweepCred) Sistemi
- Hesap skorlama: 0-100 arasi, PageRank benzeri yaklasim
- KRITIK ESIK: 65 — bu altinda sadece 3 tweet dagitim icin seciliyor
- 65 uzerinde: tum tweetler dagitim icin uygun
- Default baslangic: -128
- Mavi tik: otomatik +100 → -28'den baslar → daha hizli 65'e cikiyor
- Etki eden faktorler: hesap yasi, takipci/takip orani, paylasim kalitesi, yuksek kaliteli hesaplarla etkilesim
- Yeni hesapsa: sabirl ol, TweepCred zamanla yukseliyor

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

// Toplam ağırlık = 100
// dwell_potential: P(dwell) Grok'un model outputlarından biri — 2+ dakika okutan içerik +10 puan
export const SCORING_CRITERIA = {
  hook:            { weight: 22, label: 'Hook Gücü',         description: 'İlk cümle scroll durduruyor mu? 3 saniye kuralı.' },
  information:     { weight: 18, label: 'Bilgi Değeri',       description: 'Spesifik insight, stat veya taze bakış açısı var mı?' },
  reply_potential: { weight: 15, label: 'Reply Potansiyeli',  description: 'Soru veya açık uç var mı? reply_engaged = like\'ın 150 katı.' },
  dwell_potential: { weight: 10, label: 'Dwell Time',         description: '2+ dakika okutabilir mi? Scroll pass riski nedir?' },
  algorithm:       { weight: 12, label: 'Algoritma Uyumu',    description: 'Hashtag/emoji yok, AI dili yok, link reply\'da mı?' },
  persona:         { weight: 12, label: 'Persona Eşleşmesi',  description: 'Seçilen persona tonu ve diline uyuyor mu?' },
  originality:     { weight: 11, label: 'Özgünlük',           description: 'Taze açı mı? Klişe mi? Bookmark alır mı?' },
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
