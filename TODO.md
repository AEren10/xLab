# xMaker - Yapilacaklar
> Son guncelleme: Nisan 2026

---

## Sistem Mantigi

Bu urun artik sadece "tweet ureten" bir arac degil. Kendi kendini besleyen bir loop calistiriyor:

- Konu giriliyor.
- xquik konu baglamini genisletiyor.
- Viral ornekler konu yakinligi ve hook tipine gore seciliyor.
- Claude tweet, reply veya thread uretiyor.
- xquik dis skor veriyor ve zayif sonuclar asagi itiliyor.
- Kendi hesabi uzerinden gelen en iyi performansli tweetler persona hafizasina yaziliyor.
- Reply tarafinda uzunluk modu, otomatik retry ve skor kontrolu calisiyor.
- Kaydedilen iyi sonuclar History ve Analytics tarafinda geri izlenebiliyor.

**Stil:** alperk55 tabani, mizahi ve hafif alayci. Amac tarafsiz gorunup yorum cektirmek.

**Teknik yigin:** React + TypeScript + Vite + Tailwind. Claude API ve xquik API birlikte calisiyor. localStorage ve sessionStorage ile kalici hafiza var.

**Algoritma:** Grok tabanli. reply_engaged_by_author en kritik sinyal. Bookmark, dwell time, reply ve author engagement birlikte dusunuluyor.

---

## Guncel Akis

### Generate

- `Generate.tsx`
  - konu expansion
  - ilham tweetlerinde topic + hook kilidi
  - xquik skoruna gore yeniden siralama
  - thread icin dis skor gostergesi
- Kendi hesabindan gelen son tweetler persona icine karisiyor.
- Persona refresh yapildiginda en iyi performansli ilk 5 tweet baz aliniyor.

### Replies

- `Replies.tsx`
  - reply uzunluk modu: kisa / standart / uzun
  - otomatik tekrar deneme
  - konuya yakin ilham tweet secimi
  - persona cache ile kalici ses ogrenmesi
- Reply ilk denemede tweeti ozetliyorsa tekrar dener.
- Konudan cok "brief" mantigi var: reaksiyon, nuans, karsi gorus, mizah gibi.

### Persona

- `persona.ts`
  - en iyi performansli ilk 5 tweetten ogrenme
  - learning signature ile gereksiz cache yazmayi engelleme
- `buildPersonaFromTweets` artik top 5 tweet uzerinden calisiyor.

### Guide

- `Guide.tsx`
  - guncel sistem akisi
  - reply uzunluk / retry mantigi
  - persona yenile akisi

---

## Tamamlananlar

- Persona sistemi (hurricane + ozel JSON'lar)
- Claude API entegrasyonu + copy-paste fallback
- xquik algo data (canli Grok verisi, static fallback)
- Thread uretimi (Hook -> Icerik -> CTA)
- Reply Firsatlari sekmesi - niche'e gore viral tweet arama, reply uretme
- Izlenen Hesaplar sekmesi - hesap ekle/cikar, son N saatte postlari getir, reply uret
- Scoring sistemi (hook 20, reply_potential 25, dwell 18, info 15, algo 12, persona 10)
- Feedback loop - getUserTweets -> recentPerf
- AccountHealth bileseni - TweepCred tahmini, avg eng, top tweet
- MediaSuggestion - impressionType'a gore gorsel tipi
- Grok canli skor (xquik checklist)
- Premium flag + link uyarisi
- dwell_potential scoring + TweetCard badge
- Panel width localStorage persistence (Replies)
- sessionStorage ile Replies query persist
- topic query expansion + hook kilidi
- persona cache persist ve refresh akisi
- reply length + retry akisi
- responsive shell ve panel stack guncellemesi

---

## Responsive Denetim

- App shell mobilde `flex-col`, desktop'ta `lg:flex-row`.
- `Generate`, `Replies`, `Guide` sayfalarinda panel yapisi mobilde ust uste akiyor.
- Sabit genislikli resize paneli desktop'ta calisiyor, mobilde gizleniyor.
- Guide yan menusu mobilde yatay kaydirilabilir hale geldi.
- Uret / Reply ekranlarinda ana icerik `min-w-0` ile tasmayi azaltiyor.
- Bir sonraki manuel kontrol: iPhone boyutunda Generate, Replies ve Guide ekranlarinda yatay scroll kaliyor mu?

---

## Kritik - Siradaki

### 1. Oto feedback loop - daha da kuvvetli hale getir
- Kullanici tweet attiktan sonra gercek performansi cek.
- Tutmus tweetleri otomatik persona cache'e geri yaz.
- Ama bunu sadece "attim" bazinda degil, "tuttu" bazinda yap.

### 2. Izlenen Hesaplar - Oto Monitor
- Manuel refresh var.
- Ileri asamada arka planda periyodik kontrol ekle.
- Yeni tweet gelince in-app bildirim gosterebiliriz.

### 3. Ilham tweet alakasizligi
- Viral tweetler konuya gore cekiliyor ama bazen genel populerlik baskin geliyor.
- Topic yakinligi + hook tipi birlikte agirliklansin.

### 4. Ilham tweet time filter - Generate sayfasi
- Viral tweet fetch su an saat bazli filtreye bagli.
- Kullaniciya 24s / 48s / 72s secimi ver.

---

## Onemli

### 5. Persona Builder - Coklu hesap blend
- Kullanici 2-3 hesap girsin.
- Her hesabin top tweet'leri cekilsin.
- Claude bunlari blend edip yeni persona uretsin.

### 6. xquik Compose fallback
- Claude yokken xquik compose -> refine -> score pipeline calissin.

### 7. skill.ts temizleme
- Static ALGORITHM_RULES su an fallback.
- xquik dogrulandiysa daha sonra statik kismi sadeleştirebiliriz.

---

## Uzun Vade

### 8. Monitoring - Golden Hour
- Kendi tweet'in atilinca ilk 1 saat icinde aktif kalma bildirimi.
- "Tweet atildi, simdi reply al, like birak" uyarisi.

### 9. Viral Tweet Kutuphanesi
- "Bu konuda tutmus ne var?" sorusuna kalici cevap.
- Basarili tweetleri db'ye kaydet, nis bazli filtrele.

### 10. Cross-Platform
- Ayni tweet'i LinkedIn / Instagram formatina cevir.
