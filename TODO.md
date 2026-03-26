# TweetLab — Yapılacaklar & Yol Haritası
> Son güncelleme: Mart 2026

---

## 💬 Konuşma Notları & Kararlar

### Grok / Phoenix Meselesi
- skill.ts'teki "Phoenix sistemi" referansı artık yanlış — Ocak 2026'da X, Grok transformer'a geçti
- Engagement ağırlıkları (reply=13.5, like=0.5 vs) hâlâ geçerli, mimari değişti
- xquik `/api/v1/compose` endpoint'i **ücretsiz** ve xAI GitHub'undan canlı Grok verisi çekiyor
- Çözüm: statik skill.ts yerine contextBuilder her prompt öncesi xquik'e bir istek atar

### Para Durumu
- xquik subscription: 20$ (zaten var)
- Claude API: şu an yok, copy-paste modunda çalışıyor
- Claude Haiku: tweet başına ~$0.001 — 20$'la binlerce tweet, abonelik değil kullandıkça öde
- Önce xquik ile mevcut sistemi ilerlet, Claude API sonraya bırakılabilir

### Reply + Thread Stratejisi (bak aşağıya)
- xquik tweet search ücretsiz değil (subscription gerekli) ama xquik zaten 20$'lık alındı
- Reply fırsatı bulmak için `minFaves: 50+`, son 2 saat, Türkçe filtresi yeterli
- Thread mantığı: Claude API olmadan da yapılabilir, prompt yapısı değişecek

---

## 🔍 Rakip Analizi — Tweet Hunter & Hypefury

### Tweet Hunter ($49-99/ay) — En Yakın Rakip
**Ne yapıyor:**
- 3M+ viral tweet kütüphanesi — "bu niche'te tutmuş tweetler" gösteriyor
- AI Writer: kendi sesine göre tweet üretiyor (kişiselleştirilmiş)
- Tweet Predict: atmadan önce performans tahmini yapıyor
- CRM: takipçileri ve potansiyel müşterileri takip ediyor
- Auto-plug: tweet viral olunca otomatik link reply atıyor
- Hook Generator: sadece ilk cümle için özel AI

**TweetLab'da ne eksik (Tweet Hunter'a kıyasla):**
- ❌ Viral tweet kütüphanesi yok — "bu konuda tutmuş ne var?" sorusunu cevaplayamıyor
- ❌ Tweet atmadan önce skor tahmini sadece AI'ya güveniyor, gerçek data yok
- ❌ Auto-plug yok — viral olunca otomatik aksiyon yok
- ❌ CRM yok — takipçi/lead takibi yok

### Hypefury ($18-49/ay)
**Ne yapıyor:**
- Evergreen recycling: en iyi tweetleri otomatik yeniden paylaşıyor
- Auto-retweet: kendi tweetini otomatik RT'liyor
- Cross-platform: aynı içeriği Instagram/LinkedIn'e çeviriyor
- Inspiration bank: başkalarının iyi tweetlerinden ilham alıyor

**TweetLab'da ne eksik (Hypefury'e kıyasla):**
- ❌ Evergreen recycling yok — iyi tweetleri geri getirme yok
- ❌ Cross-platform yok

### OutreachGuy — Farklı Açı
**Ne yapıyor:** İçerik üretmiyor, sadece engagement otomasyonu yapıyor. Senin niche'indeki canlı konuşmaları buluyor, otomatik reply atıyor.

**Bu çok önemli:** Tweet Hunter ve Hypefury "broadcast" araçları — iyi içerik üret, at, bekle. OutreachGuy ise tam tersine aktif olarak konuşmalara giriyor. İkisi birlikte çok daha güçlü.

### TweetLab'ın Şu Anki Avantajı
- ✅ Türkçe odaklı (rakiplerin hepsi İngilizce ağırlıklı)
- ✅ Persona sistemi — rakiplerde yok
- ✅ Grok tabanlı algorithm verisi (xquik ile)
- ✅ Scoring sistemi detaylı

---

## 🔴 KRİTİK — Şu An Eksik

### 1. Grok Tabanlı Algorithm Verisi (skill.ts güncelleme)
**Sorun:** skill.ts'teki "Phoenix sistemi" artık eski. Ocak 2026'da X, Grok transformer'a geçti.
**Çözüm:** xquik'in `/api/v1/compose` endpoint'i canlı Grok kaynaklı algorithm verisi döndürüyor.
**Yapılacak:**
- [x] `xquik.ts`'e `getAlgoData(apiKey, topic)` fonksiyonu eklendi — `/api/v1/compose` endpoint'i çağırıyor
- [x] `contextBuilder.ts` güncellendi — `algoData` parametresi alıyor, canlı veri gelince statik kuralların önüne geçiyor, statik `ALGORITHM_RULES` fallback olarak altta kalıyor
- [x] `Generate.tsx`'te sayfa açılınca xquik'ten algo data fetch ediliyor, her prompt build'ine geçiliyor
- [ ] `skill.ts` içindeki statik `ALGORITHM_RULES` temizlenebilir (şimdilik fallback olarak durdu — endpoint çalıştığı doğrulandıktan sonra silinebilir)

**Neden önemli:** xquik compose API tamamen ücretsiz, GitHub'daki xAI kaynak kodundan çekiyor. Statik veri yerine canlı veri = daha iyi tweetler.

---

### 2. Feedback Loop — Kendi Tweetlerinden Öğrenme
**Sorun:** Sistem şu an kör. Tweet atıyorsun ama ne tuttuğunu bilmiyor.
**Çözüm:** xquik ile kendi profilini çek, engagement verisi sisteme dönsün.

**Yapılacak:**
- [x] Settings'e Twitter/X kullanıcı adı alanı eklendi (`twitterUsername` field)
- [x] `xquik.ts`'e `getUserTweets(apiKey, username, limit)` eklendi — `from:username` query'si ile son N tweeti çekiyor
- [x] `db.ts`'e `twitterUsername` field eklendi
- [ ] Generate.tsx'te sayfa açılınca `getUserTweets` ile son 20 tweet çekilsin, `recentPerf` bloğu gerçek engagement verisiyle beslensin
- [ ] "En iyi performanslı 3 tweet tipin: Data (%82 avg score) > Hot Take > Story" gibi insight üretilsin
- [x] History sayfasına engagement girme ekranı var (manuel fallback) — **TAMAMLANDI**

---

### 3. Reply Bulma — Büyük Hesaplara Reply Stratejisi
**Sorun:** Algorithm'da "büyük hesaplara reply at = juice transfer" var ama sistem bunu desteklemiyor.
**Çözüm:** Niche'e göre viral tweetleri bul, reply fırsatı sun.

**Yapılacak:**
- [x] Yeni sekme: **"Reply Fırsatları"** — `src/pages/Replies.tsx` oluşturuldu, App.tsx nav'a eklendi
- [x] xquik `searchTweets(apiKey, query, { minFaves, minReplies, lang, hours })` eklendi
- [x] Her tweet için "Bu Tweete Reply Üret" butonu — Claude API veya copy-paste modunda çalışıyor
- [x] Reply prompt: 180 karakter max, değer ekleyen, soru ile biten, insan gibi
- [x] Öncelikli hesaplar alanı — Settings'den değil, Replies sayfasında direkt yazılıyor (daha pratik)

---

## 🟡 ÖNEMLİ — Kısa Vadeli

### 4. Thread Üretimi
**Neden:** Thread'ler standalone tweet'e göre 3x daha fazla toplam engagement alıyor (2026 verisi).
**Yapılacak:**
- [x] Generate sayfasına "Mod" seçeneği eklendi: **Tek Tweet / Thread 🧵**
- [x] Thread modu: `claude.ts`'e `generateThread()` ve `TweetThread` interface eklendi
- [x] `contextBuilder.ts`'e `buildThreadMessage()` eklendi — Hook→İçerik→CTA yapısı, her tweet 180-260 karakter
- [x] Thread display: Her tweet pozisyon badge'iyle (Hook/İçerik/CTA), aralarında connector çizgi, "Tüm Thread'i Kopyala" butonu
- [x] Thread modunda Varyasyon seçeneği gizleniyor

---

### 5. Premium Flag
**Neden:** Free hesap için link içeren tweet = sıfır reach (Mart 2026'dan itibaren).
**Yapılacak:**
- [x] Settings'e "X Premium var mı?" toggle eklendi — `hasPremium: boolean` field
- [x] `contextBuilder.ts` güncellendi: Premium false ise prompt'a "HESAP FREE: link tweet içine yazma" kuralı ekleniyor
- [x] `TweetCard.tsx`: Tweet metninde link tespit edilirse ve premium false ise turuncu uyarı banner gösteriyor
- [x] Karakter sayacı düzeltmesi: extended=500, diğerleri=280
- [ ] Scoring'de `algorithm` skorunu premium durumuna göre ayarla (küçük iyileştirme, sonraya bırakıldı)

---

### 6. Görsel Öneri Sistemi
**Neden:** Görsel içerik text-only'e göre 2-3x daha fazla engagement alıyor.
**Yapılacak:**
- [ ] Her üretilen tweet için "Önerilen görsel tipi" alanı ekle
  - Örnek: "Data tweet → infografik", "Story → kişisel fotoğraf", "Hot Take → sadece metin"
- [ ] Görseli xquik media upload ile tweet'e ekleyebilme (subscription gerekli)

---

## 🟢 UZUN VADELİ

### 7. Claude API Entegrasyonu
**Durum:** Şu an copy-paste modunda çalışıyor.
**Yapılacak:**
- [x] Settings'e Claude API key alanı var — çalışıyor
- [ ] `claude-haiku-3-5` kullan yerine sonnet — tweet başına ~$0.001, 20$'la binlerce tweet (claude.ts model değişikliği)
- [ ] API yoksa xquik compose pipeline'ı kullan (fallback — Item 8)

---

### 8. xquik Compose Pipeline (Claude API Alternatifi)
**Neden:** xquik'in 3 adımlı compose flow'u zaten var ve ücretsiz.
`compose → refine → score`
**Yapılacak:**
- [x] `xquik.ts`'e `getAlgoData(step: 'algo')` ve `scoreTweet(step: 'score')` eklendi
- [ ] `refine` step eklenmedi — sonraya bırakıldı
- [ ] Claude API key yokken xquik compose pipeline ile tweet üretimi (şu an copy-paste mod devreye giriyor)

---

### 9. Otonom Monitoring
**Neden:** Seni tweet atmaya "hazır" duruma getiren sistem.
**Yapılacak:**
- [ ] xquik monitor ile kendi hesabını izle (`tweet.new`, `tweet.reply` event'leri)
- [ ] Yeni reply gelince bildirim → "Bu reply'a cevap ver" önerisi üret
- [ ] Golden Hour (ilk 1 saat) içindeyken alert: "Tweet atıldı, şimdi aktif ol"

---

## 🐛 Kod Borçları (Bulunan Buglar)

> Claude tarafından kodda tespit edildi — ilerlerken düzeltilebilir

- [x] **`toneProfile` kaydediliyor ama kullanılmıyordu** — `contextBuilder.ts`'e "Özel Ton Notu (ÖNCE BU)" bloğu olarak eklendi. Artık her prompt'a yansıyor.
- [x] **`xquikApi.saveDraft()` hiç çağrılmıyordu** — `Generate.tsx` handleSaveTweet'e bağlandı, tweet kaydedilince arka planda xquik'e gönderiliyor.
- [x] **`algo_tips.json` ölü dosya** — Silindi.
- [x] **`scoreColor` fonksiyonu duplicate** — `src/lib/utils.ts`'e taşındı, her iki component oradan import ediyor.
- [x] **Karakter sayacı hatalıydı** — `maxLength` prop eklendi, extended mod 500 gösteriyor.

---

## 📊 Mevcut Sistem Durumu

| Özellik | Durum |
|---|---|
| Algoritma kuralları (statik fallback) | ✅ Var |
| Grok canlı algo data (xquik compose) | ✅ Entegre — varsa statik'in önüne geçiyor |
| Persona sistemi | ✅ Çalışıyor |
| toneProfile aktif | ✅ Düzeltildi — prompt'a yansıyor |
| Timing badge | ✅ Çalışıyor |
| Radar (trend) | ✅ Çalışıyor |
| Scoring | ✅ Çalışıyor |
| Claude API key alanı (Settings) | ✅ Var |
| Claude API ile üretim | ✅ Çalışıyor (key varsa) |
| Copy-paste modu | ✅ Çalışıyor |
| Manuel engagement girişi (History) | ✅ Var |
| saveDraft (xquik sync) | ✅ Bağlandı |
| Thread üretimi | ✅ Eklendi — Hook/İçerik/CTA |
| Reply Fırsatları sekmesi | ✅ Eklendi |
| Premium flag + link uyarısı | ✅ Eklendi |
| Twitter kullanıcı adı (Settings) | ✅ Alan eklendi |
| xquik getUserTweets / searchTweets | ✅ xquik.ts'e eklendi |
| Feedback loop (xquik ile otomatik) | ⏳ Alan hazır, Generate'e bağlanmadı |
| xquik compose fallback pipeline | ⏳ Kısmen — algo data çekiliyor, tweet üretimi yok |

---

## 🚀 Önerilen Sıra — Güncellendi

### ✅ Tamamlananlar (bu session)
1. ~~toneProfile bug düzeltmesi~~
2. ~~Karakter sayacı 280→500 (extended mod)~~
3. ~~saveDraft() bağlantısı~~
4. ~~scoreColor deduplication → lib/utils.ts~~
5. ~~algo_tips.json silindi~~
6. ~~xquik.ts genişletildi (compose/score/searchTweets/getUserTweets)~~
7. ~~db.ts + Settings: twitterUsername + hasPremium~~
8. ~~contextBuilder canlı Grok verisi entegrasyonu~~
9. ~~Reply Fırsatları sekmesi~~
10. ~~Thread üretim modu~~
11. ~~Premium flag + TweetCard link uyarısı~~

### ⏳ Sıradakiler
1. **Sonraki:** Feedback loop tamamlama — `Generate.tsx`'te `getUserTweets` çağır, `recentPerf` bloğunu gerçek engagement ile besle
2. **Sonraki:** `claude-haiku-3-5` model değişikliği — maliyet düşürme
3. **Sonra:** xquik compose fallback pipeline (Claude API yokken tweet üretimi)
4. **Uzun vade:** Monitoring + otonom sistem
5. **Uzun vade:** Görsel öneri sistemi
