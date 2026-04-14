/**
 * Rehber — TweetLab nasıl kullanılır, Twitter/X algoritması nedir, pro ipuçları.
 */
import { useState } from 'react';

type GuideTab = 'start' | 'howit' | 'generate' | 'reply' | 'algo' | 'explore' | 'tips';

const TABS: { id: GuideTab; icon: string; label: string }[] = [
  { id: 'start',    icon: '🚀', label: 'Başlangıç'    },
  { id: 'howit',    icon: '🔄', label: 'Nasıl Çalışır' },
  { id: 'generate', icon: '⚡', label: 'Tweet Üretimi' },
  { id: 'reply',    icon: '↩',  label: 'Reply Stratejisi' },
  { id: 'algo',     icon: '🧠', label: 'Grok Algoritması' },
  { id: 'explore',  icon: '🔭', label: 'Keşfet & Araçlar' },
  { id: 'tips',     icon: '💡', label: 'Pro İpuçları'  },
];

// ─── Alt bileşenler ───────────────────────────────────────────────────────────

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-3">
      <h3 className="text-sm font-bold text-[#e8e8e0] uppercase tracking-wider">{title}</h3>
      {children}
    </div>
  );
}

function InfoBox({ color, icon, title, children }: {
  color: 'accent' | 'green' | 'yellow' | 'orange' | 'red';
  icon: string;
  title?: string;
  children: React.ReactNode;
}) {
  const styles = {
    accent:  'bg-[#7c6af7]/[0.07] border-[#7c6af7]/25 text-[#7c6af7]',
    green:   'bg-[#4ade80]/[0.07] border-[#4ade80]/25 text-[#4ade80]',
    yellow:  'bg-[#facc15]/[0.07] border-[#facc15]/25 text-[#facc15]',
    orange:  'bg-[#fb923c]/[0.07] border-[#fb923c]/25 text-[#fb923c]',
    red:     'bg-[#f87171]/[0.07] border-[#f87171]/25 text-[#f87171]',
  }[color];
  return (
    <div className={`rounded-xl border px-4 py-4 space-y-2 ${styles}`}>
      {title && (
        <p className="text-sm font-bold flex items-center gap-2">
          <span>{icon}</span>{title}
        </p>
      )}
      <div className="text-sm leading-relaxed text-[#c0c0cc]">{children}</div>
    </div>
  );
}

function Step({ n, title, children }: { n: number; title: string; children?: React.ReactNode }) {
  return (
    <div className="flex gap-3.5">
      <div className="w-7 h-7 rounded-full bg-[#7c6af7]/[0.15] border border-[#7c6af7]/30 flex items-center justify-center text-xs font-bold text-[#7c6af7] shrink-0 mt-0.5">
        {n}
      </div>
      <div className="flex-1 pb-5 border-b border-white/[0.04] last:border-0 last:pb-0">
        <p className="text-sm font-semibold text-[#e8e8e0]">{title}</p>
        {children && <div className="text-sm text-[#8b8b96] mt-1.5 leading-relaxed">{children}</div>}
      </div>
    </div>
  );
}

// ─── Tab içerikleri ───────────────────────────────────────────────────────────

function HowItWorksTab() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-[#e8e8e0] mb-2">Nasıl Çalışır?</h2>
        <p className="text-sm text-[#6b6b72] leading-relaxed">
          TweetLab'in arka planda nasıl çalıştığına dair görsel akış ve veri mimarisi.
        </p>
      </div>

      {/* Flow Diagram */}
      <div className="space-y-2">

        {/* Step 1 — Kullanıcı */}
        <div className="rounded-xl border border-[#7c6af7]/30 bg-[#7c6af7]/[0.08] px-4 py-3 text-center">
          <p className="text-base mb-1">👤</p>
          <p className="text-sm font-semibold text-[#7c6af7]">Kullanıcı</p>
          <p className="text-xs text-[#8b8b96] mt-0.5">Konu girer, içerik tipi seçer</p>
        </div>

        {/* Arrow */}
        <div className="flex justify-center">
          <div className="flex flex-col items-center gap-0.5">
            <div className="w-px h-3 bg-white/[0.12]" />
            <div className="w-0 h-0 border-l-[4px] border-r-[4px] border-t-[6px] border-l-transparent border-r-transparent border-t-white/20" />
          </div>
        </div>

        {/* Step 2 — Parallel APIs */}
        <div className="grid grid-cols-2 gap-2">
          <div className="rounded-xl border border-[#7c6af7]/30 bg-[#7c6af7]/[0.06] px-3 py-3">
            <p className="text-base mb-1">🧠</p>
            <p className="text-xs font-semibold text-[#7c6af7]">Claude API</p>
            <p className="text-xs text-[#8b8b96] mt-1 leading-relaxed">Tweet metni üretir, Hook + içerik + CTA yazar</p>
          </div>
          <div className="rounded-xl border border-[#4ade80]/30 bg-[#4ade80]/[0.06] px-3 py-3">
            <p className="text-base mb-1">📡</p>
            <p className="text-xs font-semibold text-[#4ade80]">xquik API</p>
            <p className="text-xs text-[#8b8b96] mt-1 leading-relaxed">Grok verisi çeker, viral tweetler bulur, Grok skoru hesaplar</p>
          </div>
        </div>

        {/* Arrow */}
        <div className="flex justify-center">
          <div className="flex flex-col items-center gap-0.5">
            <div className="w-px h-3 bg-white/[0.12]" />
            <div className="w-0 h-0 border-l-[4px] border-r-[4px] border-t-[6px] border-l-transparent border-r-transparent border-t-white/20" />
          </div>
        </div>

        {/* Step 3 — Tweet Variations */}
        <div className="rounded-xl border border-[#7c6af7]/25 bg-[#7c6af7]/[0.05] px-4 py-3 text-center">
          <p className="text-base mb-1">⚡</p>
          <p className="text-sm font-semibold text-[#e8e8e0]">Tweet Varyasyonları</p>
          <p className="text-xs text-[#8b8b96] mt-0.5">1-3 varyasyon, her biri 0-100 Grok skoru ile</p>
        </div>

        {/* Arrow */}
        <div className="flex justify-center">
          <div className="flex flex-col items-center gap-0.5">
            <div className="w-px h-3 bg-white/[0.12]" />
            <div className="w-0 h-0 border-l-[4px] border-r-[4px] border-t-[6px] border-l-transparent border-r-transparent border-t-white/20" />
          </div>
        </div>

        {/* Step 4 — Parallel paths */}
        <div className="grid grid-cols-2 gap-2">
          <div className="rounded-xl border border-white/[0.1] bg-white/[0.02] px-3 py-3">
            <p className="text-base mb-1">📦</p>
            <p className="text-xs font-semibold text-[#e8e8e0]">Arşivle</p>
            <p className="text-xs text-[#8b8b96] mt-1 leading-relaxed">History'ye gider, engagement takibi</p>
          </div>
          <div className="rounded-xl border border-[#4ade80]/25 bg-[#4ade80]/[0.04] px-3 py-3">
            <p className="text-base mb-1">🚀</p>
            <p className="text-xs font-semibold text-[#4ade80]">Direkt Paylaş</p>
            <p className="text-xs text-[#8b8b96] mt-1 leading-relaxed">xquik üzerinden Twitter'a direkt</p>
          </div>
        </div>

        {/* Arrow */}
        <div className="flex justify-center">
          <div className="flex flex-col items-center gap-0.5">
            <div className="w-px h-3 bg-white/[0.12]" />
            <div className="w-0 h-0 border-l-[4px] border-r-[4px] border-t-[6px] border-l-transparent border-r-transparent border-t-white/20" />
          </div>
        </div>

        {/* Step 5 — Analytics Loop */}
        <div className="rounded-xl border border-[#facc15]/30 bg-[#facc15]/[0.06] px-4 py-3 text-center">
          <p className="text-base mb-1">🔄</p>
          <p className="text-sm font-semibold text-[#facc15]">Analytics Döngüsü</p>
          <p className="text-xs text-[#8b8b96] mt-0.5">Zamanlama analizi, style performance, feedback loop</p>
        </div>
      </div>

      {/* Why These Tools */}
      <Section title="Neden Bu Araçlar?">
        <div className="space-y-2">
          <div className="flex gap-3 p-3 rounded-xl border border-[#7c6af7]/20 bg-[#7c6af7]/[0.05]">
            <span className="text-base shrink-0">🧠</span>
            <div>
              <p className="text-sm font-semibold text-[#7c6af7]">Claude</p>
              <p className="text-xs text-[#8b8b96] mt-0.5 leading-relaxed">En iyi tweet yazma modeli — hook, yapı, CTA konusunda öne çıkıyor.</p>
            </div>
          </div>
          <div className="flex gap-3 p-3 rounded-xl border border-[#4ade80]/20 bg-[#4ade80]/[0.05]">
            <span className="text-base shrink-0">📡</span>
            <div>
              <p className="text-sm font-semibold text-[#4ade80]">xquik</p>
              <p className="text-xs text-[#8b8b96] mt-0.5 leading-relaxed">xAI Grok algoritması verilerine erişim sağlar. $20/ay Starter planla tüm özellikler aktif.</p>
            </div>
          </div>
          <div className="flex gap-3 p-3 rounded-xl border border-[#facc15]/20 bg-[#facc15]/[0.05]">
            <span className="text-base shrink-0">⚡</span>
            <div>
              <p className="text-sm font-semibold text-[#facc15]">Birlikte</p>
              <p className="text-xs text-[#8b8b96] mt-0.5 leading-relaxed">Grok'un sevdiği içerik + doğru zamanlama + büyüme döngüsü. Tek araçla ikisi birden.</p>
            </div>
          </div>
        </div>
      </Section>

      {/* Data Flow */}
      <Section title="Veri Akışı">
        <div className="space-y-2">
          {[
            {
              label: 'Input',
              color: 'border-[#7c6af7]/20 bg-[#7c6af7]/[0.04]',
              labelColor: 'text-[#7c6af7]',
              items: ['Konu', 'İçerik tipi', 'Persona', 'Ton profili'],
            },
            {
              label: 'Claude Processing',
              color: 'border-white/[0.08] bg-white/[0.02]',
              labelColor: 'text-[#e8e8e0]',
              items: [
                'System prompt (Grok kuralları + persona + hesap geçmişi)',
                'Tweet varyasyonları üretir',
              ],
            },
            {
              label: 'xquik Processing',
              color: 'border-[#4ade80]/20 bg-[#4ade80]/[0.04]',
              labelColor: 'text-[#4ade80]',
              items: [
                '/compose — Grok algo skor',
                '/x/tweets/search — viral örnekler',
                '/compose score — checklist',
              ],
            },
            {
              label: 'Output',
              color: 'border-[#facc15]/20 bg-[#facc15]/[0.04]',
              labelColor: 'text-[#facc15]',
              items: [
                'Skorlu tweet (0-100 Grok)',
                'Grok checklist — neyin eksik olduğu',
                'Arşiv / paylaşım seçeneği',
              ],
            },
          ].map((row) => (
            <div key={row.label} className={`rounded-xl border px-3.5 py-3 space-y-1.5 ${row.color}`}>
              <p className={`text-xs font-semibold uppercase tracking-wider ${row.labelColor}`}>{row.label}</p>
              <ul className="space-y-1">
                {row.items.map((item, i) => (
                  <li key={i} className="flex gap-2 text-xs text-[#8b8b96] leading-relaxed">
                    <span className="text-[#4a4a55] shrink-0 mt-0.5">›</span>
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </Section>
    </div>
  );
}

function StartTab() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-[#e8e8e0] mb-2">TweetLab'e Hoş Geldin</h2>
        <p className="text-sm text-[#6b6b72] leading-relaxed">
          Grok algoritması verilerini kullanarak X/Twitter'da daha hızlı büyümek için tasarlanmış içerik üretim aracı.
          Kurulum 3 adımda tamamlanıyor.
        </p>
      </div>

      <Section title="Kurulum">
        <Step n={1} title="xquik API Key al">
          <a href="https://xquik.com" target="_blank" rel="noreferrer" className="text-[#7c6af7] hover:underline">xquik.com</a>'a git → Sign Up → API Keys → Create Key.
          $20/ay Starter plan ile tüm özellikler aktif olur. Ücretsiz tier de var ama sınırlı.
        </Step>
        <Step n={2} title="Claude API Key al (opsiyonel)">
          <a href="https://console.anthropic.com" target="_blank" rel="noreferrer" className="text-[#7c6af7] hover:underline">console.anthropic.com</a>'a git → API Keys → Create Key.
          Tweet üretimi için gerekli. xquik key olmadan da çalışır ama Grok verisi olmaz.
        </Step>
        <Step n={3} title="Ayarlar'a gir, keyleri ekle">
          Sol menüden ⊙ Ayarlar → API keyleri yapıştır → Twitter kullanıcı adını ekle → Kaydet.
          Hesap profili oluşturuyorsan nişini ve tonunu da doldur.
        </Step>
      </Section>

      <Section title="Çalışma Modu">
        <div className="grid grid-cols-2 gap-2">
          {[
            { icon: '⚡', label: 'Tam Mod', sub: 'Claude + xquik — tweet üret + Grok verisi', color: 'border-[#4ade80]/30 bg-[#4ade80]/[0.04]' },
            { icon: '🧠', label: 'Claude Modu', sub: 'Sadece Claude — tweet üret, Grok yok', color: 'border-[#7c6af7]/30 bg-[#7c6af7]/[0.04]' },
            { icon: '📡', label: 'Radar Modu', sub: 'Sadece xquik — trend + skor, üretim yok', color: 'border-[#facc15]/30 bg-[#facc15]/[0.04]' },
            { icon: '✋', label: 'Manuel Mod', sub: 'API yok — sadece araçlar ve arşiv', color: 'border-white/[0.08] bg-white/[0.02]' },
          ].map((m) => (
            <div key={m.label} className={`rounded-xl border p-3 ${m.color}`}>
              <p className="text-sm mb-1">{m.icon}</p>
              <p className="text-sm font-semibold text-[#e8e8e0]">{m.label}</p>
              <p className="text-xs text-[#6b6b72] mt-0.5 leading-snug">{m.sub}</p>
            </div>
          ))}
        </div>
      </Section>

      <Section title="Üret Sayfası Göstergeleri">
        {[
          { badge: '⚡ Tam mod Claude + xquik', color: 'text-[#4ade80]', desc: 'Her iki API key de bağlı. Radar trendleri, viral tweet analizi ve Grok algoritma verisi Claude\'a besleniyor.' },
          { badge: '🧠 Grok canlı veri aktif', color: 'text-[#7c6af7]', desc: 'xquik\'in /compose endpoint\'i üzerinden Grok\'un güncel algoritma kuralları çekildi. Claude bu kurallara göre tweet yazıyor — statik kurallar yerine canlı veri.' },
          { badge: '📡 Radar Gündem', color: 'text-[#facc15]', desc: 'xquik radar\'dan gelen 8 gündem konusu. Bunlar Claude\'un context\'ine giriyor — konunla ilgiliyse Claude bağlantı kuruyor.' },
          { badge: '🔥 İlham Paneli (sağ)', color: 'text-accent', desc: 'Konunda son 72 saatte yüksek etkileşim alan tweetler. Claude bunları analiz ediyor: hook nasıl kurulmuş, hangi duyguya dokunuyor. Benzer enerjiyle yeni yazıyor.' },
        ].map((item) => (
          <div key={item.badge} className="flex gap-3 p-3 rounded-xl bg-white/[0.02] border border-white/[0.06]">
            <div>
              <p className={`text-xs font-semibold font-mono ${item.color}`}>{item.badge}</p>
              <p className="text-xs text-[#6b6b72] mt-1 leading-relaxed">{item.desc}</p>
            </div>
          </div>
        ))}
      </Section>

      <InfoBox color="accent" icon="💬" title="Temel Akış">
        Konu yaz → içerik tipi seç → Claude ile üret → Grok skoru al → arşivle veya direkt paylaş.
        Viral tweetlere reply atarak hesabın büyür.
      </InfoBox>
    </div>
  );
}

function GenerateTab() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-[#e8e8e0] mb-2">Tweet Üretimi</h2>
        <p className="text-sm text-[#6b6b72] leading-relaxed">
          ⚡ Üret sekmesinin tüm özellikleri ve nasıl kullanılır.
        </p>
      </div>

      <Section title="Adım Adım">
        <Step n={1} title="Konu gir">
          5+ karakter yazınca xquik bu konuyla viral olan tweetleri otomatik çeker.
          Referans olarak kullanabilirsin — ne tür içerik tutmuş görürsün.
        </Step>
        <Step n={2} title="İçerik Tipi seç">
          Her tip farklı bir hook + yapı kullanır. Algoritmada en iyi çalışan tipe göre seç.
        </Step>
        <Step n={3} title="Uzunluk ve Persona seç">
          Thread &gt; uzun tweet &gt; kısa tweet — dwell time açısından. Persona ise yazı tonunu belirler.
        </Step>
        <Step n={4} title="Üret ve skor al">
          Claude üretir, istersen Grok Canlı Skor al — checklist formatında neyin eksik olduğunu söyler.
        </Step>
        <Step n={5} title="Arşivle veya Paylaş">
          Kaydet → Arşiv sekmesine gider. Ya da Twitter kullanıcı adın varsa direkt paylaş.
        </Step>
      </Section>

      <Section title="İçerik Tipleri">
        <div className="space-y-1.5">
          {[
            { type: 'Data', desc: 'Sayı + istatistik temelli. "X araştırmasına göre..." formatı. Güvenilirlik sinyali.', icon: '📊' },
            { type: 'Story', desc: 'Kişisel deneyim veya vaka. "Geçen hafta X yaptım ve..." Yüksek dwell time.', icon: '📖' },
            { type: 'Hot Take', desc: 'Karşı görüş veya tartışmalı iddia. Reply magnet. Dikkat: gerçekten karşı çıkılan bir şey olmalı.', icon: '🔥' },
            { type: 'Inspire', desc: 'Motivasyon + eylem çağrısı. Quote card materyali. Save + share oranı yüksek.', icon: '✨' },
            { type: 'Humor', desc: 'Meme veya gözlem. Retweet oranı en yüksek tip. Ama nişle alakalı olmalı.', icon: '😂' },
            { type: 'Edu', desc: 'Öğretici içerik. "X şeyi hakkında bilmediğin 5 şey" formatı. Bookmark = güçlü sinyal.', icon: '🎓' },
          ].map((t) => (
            <div key={t.type} className="flex gap-3 p-2.5 rounded-lg bg-white/[0.02] border border-white/[0.05]">
              <span className="text-base shrink-0">{t.icon}</span>
              <div>
                <span className="text-sm font-semibold text-[#e8e8e0]">{t.type}</span>
                <p className="text-xs text-[#6b6b72] mt-0.5 leading-relaxed">{t.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </Section>

      <InfoBox color="yellow" icon="⚠" title="Dikkat">
        Üretilen tweeti olduğu gibi kullanma. Kendi sesinle düzenle.
        Claude bir iskelet çizer, sen inşa edersin.
      </InfoBox>
    </div>
  );
}

function ReplyTab() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-[#e8e8e0] mb-2">Reply Stratejisi</h2>
        <p className="text-sm text-[#6b6b72] leading-relaxed">
          X'te büyümenin en hızlı yolu viral tweetlere kaliteli reply atmaktır.
          Bu bir hack değil, algoritmanın tasarımı böyle.
        </p>
      </div>

      <InfoBox color="green" icon="⚡" title="Neden Reply bu kadar önemli?">
        Grok'ta <strong className="text-[#4ade80]">reply_engaged_by_author = 75 ağırlık</strong>.
        Like sadece 0.5. Yani birinin kendi tweetine reply atması, like'ın 150 katı değerinde sinyal.
        Viral bir tweete attığın reply, o tweetin "juice"ını sana transfer eder.
      </InfoBox>

      <Section title="Reply Fırsatları Nasıl Kullanılır">
        <Step n={1} title="↩ Reply Fırsatları sekmesine gir">
          Niş veya konu yaz → xquik son 48 saatte viral olan tweetleri bulur.
        </Step>
        <Step n={2} title="Doğru tweet seç">
          Like sayısı yüksek ama reply sayısı düşük olanları hedefle.
          Yüksek like = görünürlük, düşük reply = rekabet az.
        </Step>
        <Step n={3} title="Claude ile reply üret">
          Context'e tweet metnini koy, persona ve ton seç, üret.
          Grok kalite skoru al — 70+ almadan gönderme.
        </Step>
        <Step n={4} title="Reply'ı arşivle">
          Arşivle butonu → History'ye gider, reply olarak işaretlenir.
          Engagement takibi yapabilirsin.
        </Step>
      </Section>

      <Section title="İyi Reply Nasıl Olmalı">
        <div className="space-y-2">
          {[
            { icon: '✅', label: 'Değer katar', desc: 'Orijinal tweete bir şey ekle — veri, deneyim, karşı görüş.' },
            { icon: '✅', label: 'Kısa & keskin', desc: '1-3 cümle ideal. Uzun reply kimse okumaz.' },
            { icon: '✅', label: 'CTA içerir', desc: 'Soru sor veya yorum iste. "Siz ne düşünüyorsunuz?" gibi.' },
            { icon: '❌', label: 'Sadece "katılıyorum"', desc: 'Değer üretmeyen reply = görünmez kalırsın.' },
            { icon: '❌', label: 'Kendi hesabını promote etme', desc: '"Ben de bunu yazdım, bak →" = spam filtre.' },
            { icon: '❌', label: 'Hashtag kullan', desc: 'Grok\'ta hashtag negatif sinyal. -1 ağırlık.' },
          ].map((r) => (
            <div key={r.label} className="flex gap-2.5 text-[11px]">
              <span className="shrink-0">{r.icon}</span>
              <div>
                <span className={`font-medium ${r.icon === '✅' ? 'text-[#4ade80]' : 'text-[#f87171]'}`}>{r.label}</span>
                <span className="text-[#6b6b72]"> — {r.desc}</span>
              </div>
            </div>
          ))}
        </div>
      </Section>

      <InfoBox color="accent" icon="⏰" title="Golden Hour">
        Tweet attıktan sonraki ilk 1 saat kritik. Kendi tweetine 2-3 self-reply yaz,
        gelen her reply'a hemen cevap ver. <strong className="text-[#7c6af7]">reply_engaged_by_author</strong> sinyali devreye girer
        ve Grok tweeti algoritmaya iter.
      </InfoBox>
    </div>
  );
}

function AlgoTab() {
  const signals = [
    { label: 'reply_engaged_by_author', value: 75,  bar: 100, color: 'bg-[#4ade80]',  tag: 'yeşil' },
    { label: 'bookmark',                value: 10,  bar: 13,  color: 'bg-[#7c6af7]',  tag: 'mor' },
    { label: 'quote_tweet',             value: 4,   bar: 5.3, color: 'bg-[#7c6af7]',  tag: 'mor' },
    { label: 'retweet',                 value: 3,   bar: 4,   color: 'bg-[#facc15]',  tag: 'sarı' },
    { label: 'like',                    value: 0.5, bar: 0.7, color: 'bg-[#fb923c]',  tag: 'turuncu' },
    { label: 'profile_click',           value: 0.2, bar: 0.3, color: 'bg-[#6b6b72]',  tag: 'gri' },
    { label: 'hashtag_kullanımı',       value: -1,  bar: 1.3, color: 'bg-[#f87171]',  tag: 'kırmızı' },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-[#e8e8e0] mb-2">Grok Algoritması</h2>
        <p className="text-sm text-[#6b6b72] leading-relaxed">
          X'in ranking algoritması Grok, tweetleri bu ağırlıklarla skorlar.
          Bu veriler xAI'nin GitHub'ında açık kaynak olarak yayınlanmış.
        </p>
      </div>

      <Section title="Engagement Ağırlıkları">
        <div className="space-y-2">
          {signals.map((s) => (
            <div key={s.label} className="space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-xs font-mono text-[#8b8b96]">{s.label}</span>
                <span className={`text-[10px] font-bold ${s.value < 0 ? 'text-[#f87171]' : 'text-[#e8e8e0]'}`}>
                  {s.value > 0 ? '+' : ''}{s.value}
                </span>
              </div>
              <div className="h-1.5 bg-white/[0.05] rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all ${s.color}`}
                  style={{ width: `${Math.min(s.bar, 100)}%` }}
                />
              </div>
            </div>
          ))}
        </div>
        <p className="text-[11px] text-[#4a4a55] mt-1">Kaynak: xAI GitHub — twitter-algorithm / SimCluster weights</p>
      </Section>

      <Section title="İçerik Kuralları">
        <div className="space-y-1.5">
          {[
            { rule: 'Hashtag kullanma', why: 'Grok\'ta -1 ağırlık. Spam filtresiyle aynı muamele.', bad: true },
            { rule: 'Link tweet içinde olmasın', why: 'Özellikle free hesapta: link = reach sıfır. Linki reply\'a taşı.', bad: true },
            { rule: 'Dwell time 2+ dakika', why: 'dwell_time_2min = +10. Grok uzun okunan içeriği değerli görür.', bad: false },
            { rule: 'İlk tweete self-reply yaz', why: 'Thread oluşturur, dwell time artar, author engagement sinyali tetiklenir.', bad: false },
            { rule: 'Doğrudan CTA ekle', why: '"Ne düşünüyorsunuz?" gibi soru sormak reply oranını artırır.', bad: false },
            { rule: 'Media (görsel/video) ekle', why: 'Media presence = görünürlük boost. Özellikle infografik eğitim içeriğinde.', bad: false },
          ].map((r) => (
            <div key={r.rule} className={`flex gap-2.5 p-2.5 rounded-lg border ${r.bad ? 'bg-[#f87171]/[0.04] border-[#f87171]/15' : 'bg-[#4ade80]/[0.04] border-[#4ade80]/15'}`}>
              <span className={`text-sm shrink-0 ${r.bad ? 'text-[#f87171]' : 'text-[#4ade80]'}`}>{r.bad ? '✗' : '✓'}</span>
              <div>
                <p className={`text-sm font-semibold ${r.bad ? 'text-[#f87171]' : 'text-[#4ade80]'}`}>{r.rule}</p>
                <p className="text-xs text-[#6b6b72] mt-0.5 leading-relaxed">{r.why}</p>
              </div>
            </div>
          ))}
        </div>
      </Section>

      <Section title="TweepCred Skoru">
        <InfoBox color="accent" icon="🏆">
          xquik'in hesapladığı güvenilirlik skoru. <strong className="text-[#7c6af7]">65 üzeri</strong> hedefle.
          Buna giriş için: hesap yaşı, engagement oranı, takipçi kalitesi, içerik tutarlılığı.
          Yeni hesaplarda düşük olması normal — zamanla artar.
        </InfoBox>
      </Section>

      <Section title="Viral Büyüme Döngüsü">
        <div className="relative pl-4">
          {['Kaliteli tweet at', 'İlk 1 saatte self-reply + engagement', 'Viral tweetlere değer katan reply at', 'Takipçiler büyür → güvenilirlik artar', 'Grok daha geniş kitleye iter', 'Döngü tekrar başlar'].map((step, i, arr) => (
            <div key={i} className="flex gap-3 mb-3 last:mb-0">
              <div className="relative flex flex-col items-center">
                <div className="w-5 h-5 rounded-full bg-[#7c6af7]/20 border border-[#7c6af7]/40 flex items-center justify-center text-[9px] font-bold text-[#7c6af7] shrink-0">
                  {i + 1}
                </div>
                {i < arr.length - 1 && <div className="w-px flex-1 bg-[#7c6af7]/20 mt-1" />}
              </div>
              <p className="text-sm text-[#8b8b96] leading-relaxed pt-0.5">{step}</p>
            </div>
          ))}
        </div>
      </Section>
    </div>
  );
}

function ExploreTab() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-[#e8e8e0] mb-2">Keşfet & Araçlar</h2>
        <p className="text-sm text-[#6b6b72] leading-relaxed">
          xquik $20/ay Starter'ın tüm özelliklerini arayüzden kullanabilirsin.
        </p>
      </div>

      <div className="space-y-3">
        {[
          {
            icon: '📈', title: 'Trendler',
            desc: 'X\'te anlık olarak trend olan başlıklar. Kopyala → Üret sekmesinde konu olarak kullan. Timing kritik — trend başladıktan sonraki ilk 2 saat.',
          },
          {
            icon: '🌊', title: 'Timeline',
            desc: 'Bağlı xquik hesabının ana sayfa akışı. Niş içinde ne konuşuluyor görürsün. İçerik fikirleri için referans.',
          },
          {
            icon: '📊', title: 'Style Analizi',
            desc: 'Ayarlarda Twitter kullanıcı adın varsa, geçmiş tweetlerinin hangi stilinin en çok engagement aldığını gösterir. Like, RT, reply, görüntülenme bazlı.',
          },
          {
            icon: '📡', title: 'İzlemeler',
            desc: 'Hesap veya keyword izle. Yeni tweet, reply, quote, RT, takipçi değişimlerinde xquik seni haberdar eder. Rakip hesapları veya niş keywordlerini izle.',
          },
          {
            icon: '🎁', title: 'Çekiliş Aracı',
            desc: '"Takip et + RT\'le kazan" tweetinin URL\'ini yapıştır → xquik katılımcılar arasından rastgele kazanan seçer. Gleam veya Retweet Picker\'a gerek yok.',
          },
        ].map((item) => (
          <div key={item.title} className="flex gap-3 p-3.5 rounded-xl bg-white/[0.02] border border-white/[0.06]">
            <span className="text-xl shrink-0">{item.icon}</span>
            <div>
              <p className="text-xs font-semibold text-[#e8e8e0]">{item.title}</p>
              <p className="text-xs text-[#6b6b72] mt-1 leading-relaxed">{item.desc}</p>
            </div>
          </div>
        ))}
      </div>

      <Section title="Direkt Paylaşım">
        <InfoBox color="green" icon="🚀">
          Üret sekmesinde Twitter kullanıcı adın ve xquik key'in varsa her TweetCard'da
          <strong className="text-[#4ade80]"> "Direkt Paylaş"</strong> butonu çıkar.
          xquik üzerinden hesabına direkt tweet atar — tarayıcı sekmesine gerek kalmaz.
          Kullanmadan önce xquik panelinden X hesabını bağladığından emin ol.
        </InfoBox>
      </Section>
    </div>
  );
}

function TipsTab() {
  const tips = [
    {
      category: 'Zamanlama',
      color: 'text-[#7c6af7]',
      bg: 'bg-[#7c6af7]/[0.05] border-[#7c6af7]/20',
      items: [
        'Sabah 8-10 arası: "commute" kitlesi (iş yolculuğu)',
        'Öğle 12-13: kısa mola, hızlı tüketim içeriği',
        'Akşam 20-23: peak engagement, uzun içerik işe yarar',
        'Pazartesi & Salı thread için en iyi gün',
        'Zamanlama Analitik sekmesini kullan — kendi verilerini gör',
      ],
    },
    {
      category: 'İçerik',
      color: 'text-[#4ade80]',
      bg: 'bg-[#4ade80]/[0.05] border-[#4ade80]/20',
      items: [
        'Thread > uzun tweet > kısa tweet (dwell time açısından)',
        'İlk cümle en önemli — scroll durduran hook',
        'Sayılar ve spesifik veriler hook gücünü artırır',
        'Sorular reply oranını 2-3x artırır',
        'Liste formatı (1/ 2/ 3/) kolay okunur = dwell artış',
      ],
    },
    {
      category: 'Büyüme',
      color: 'text-[#facc15]',
      bg: 'bg-[#facc15]/[0.05] border-[#facc15]/20',
      items: [
        'Tutarlılık > kalite. Her gün 1 tweet > haftada 7',
        'Büyük hesaplara kaliteli reply = kısa yoldan görünürlük',
        'Nişin dışına çıkma — algoritma kafa karışıklığına düşer',
        'İlk 500 takipçi en zor. Reply stratejisini bu dönemde uygula',
        'Arşiv sekmesinden engagement verilerini düzenli takip et',
      ],
    },
    {
      category: 'Kaçınılacaklar',
      color: 'text-[#f87171]',
      bg: 'bg-[#f87171]/[0.05] border-[#f87171]/20',
      items: [
        'Hashtag kullanma — Grok\'ta negatif sinyal',
        'Tweet içine link koyma (free hesap) — reach sıfır',
        'Follow/unfollow taktiklerinden uzak dur',
        'Toplu DM / spam — hesap ban riski',
        'Çok fazla retweet yapma — kendi içeriğin gömülür',
      ],
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-[#e8e8e0] mb-2">Pro İpuçları</h2>
        <p className="text-sm text-[#6b6b72] leading-relaxed">
          Deneyimden çıkan kısayollar ve algoritmanın sevdiği davranışlar.
        </p>
      </div>

      {tips.map((section) => (
        <div key={section.category} className={`rounded-xl border p-4 space-y-2.5 ${section.bg}`}>
          <p className={`text-xs font-bold ${section.color}`}>{section.category}</p>
          <ul className="space-y-1.5">
            {section.items.map((tip, i) => (
              <li key={i} className="flex gap-2 text-sm text-[#8b8b96] leading-relaxed">
                <span className={`shrink-0 mt-0.5 ${section.color}`}>›</span>
                {tip}
              </li>
            ))}
          </ul>
        </div>
      ))}

      <InfoBox color="accent" icon="🎯" title="Özet Formül">
        <strong className="text-[#7c6af7]">Grok'un sevdiği hesap:</strong> Tutarlı niş + yüksek dwell time içerik +
        viral tweetlere kaliteli reply + golden hour engagement + hashtag yok + link reply'da.
        Bunu 30 gün uygula, fark görürsün.
      </InfoBox>
    </div>
  );
}

// ─── Ana Bileşen ──────────────────────────────────────────────────────────────

export function Guide() {
  const [tab, setTab] = useState<GuideTab>('start');

  return (
    <div className="flex h-full overflow-hidden">
      {/* Sol mini nav */}
      <div className="w-52 shrink-0 border-r border-white/[0.05] flex flex-col py-5 px-2.5 gap-0.5">
        <p className="text-[10px] font-bold text-[#3a3a48] uppercase tracking-widest px-3 mb-3">Rehber</p>
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`w-full text-left flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${
              tab === t.id
                ? 'bg-[#7c6af7]/[0.12] text-[#7c6af7]'
                : 'text-[#5a5a68] hover:text-[#e8e8e0] hover:bg-white/[0.04]'
            }`}
          >
            <span className="text-base">{t.icon}</span>
            <span>{t.label}</span>
          </button>
        ))}
      </div>

      {/* İçerik */}
      <div className="flex-1 overflow-y-auto px-10 py-7">
        <div className="max-w-2xl">
          {tab === 'start'    && <StartTab />}
          {tab === 'howit'    && <HowItWorksTab />}
          {tab === 'generate' && <GenerateTab />}
          {tab === 'reply'    && <ReplyTab />}
          {tab === 'algo'     && <AlgoTab />}
          {tab === 'explore'  && <ExploreTab />}
          {tab === 'tips'     && <TipsTab />}
        </div>
      </div>
    </div>
  );
}
