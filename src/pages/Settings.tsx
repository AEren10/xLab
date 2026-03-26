import { useState } from 'react';
import { db } from '../lib/db';
import type { Settings as SettingsType } from '../lib/db';

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-[10px] font-semibold text-[#4a4a55] uppercase tracking-widest mb-3">{title}</p>
      <div className="space-y-4">{children}</div>
    </div>
  );
}

function Field({ label, badge, hint, children }: {
  label: string;
  badge?: { text: string; color: string };
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="text-xs font-medium text-[#8b8b96] mb-1.5 flex items-center gap-1.5">
        {label}
        {badge && (
          <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${badge.color}`}>
            {badge.text}
          </span>
        )}
      </label>
      {children}
      {hint && <p className="text-[10px] text-[#4a4a55] mt-1.5 leading-relaxed">{hint}</p>}
    </div>
  );
}

export function Settings() {
  const [saved, setSaved] = useState(false);
  const [settings, setSettings] = useState<SettingsType>(db.getSettings());

  const update = (key: keyof SettingsType, val: string | boolean) =>
    setSettings((prev) => ({ ...prev, [key]: val }));

  const handleSave = () => {
    db.saveSettings(settings);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const inputCls = "w-full bg-[#111113] border border-white/[0.07] rounded-xl px-3 py-2.5 text-sm text-[#e8e8e0] placeholder-[#3a3a45] focus:border-accent/40 focus:bg-[#111115] transition-all";

  return (
    <div className="p-6 max-w-xl overflow-y-auto h-full space-y-8">

      {/* Başlık */}
      <div>
        <h1 className="text-base font-semibold text-[#e8e8e0]">Ayarlar</h1>
        <p className="text-xs text-[#4a4a55] mt-0.5">Tüm veriler tarayıcında, hiçbir yere gönderilmiyor</p>
      </div>

      {/* ── API Bağlantıları ── */}
      <Section title="API Bağlantıları">
        <Field
          label="xquik API Key"
          badge={{ text: 'Radar + Grok', color: 'text-accent-green bg-accent-green/10' }}
          hint="xquik.com → Dashboard → API Key. Radar trendleri + Reply Fırsatları + canlı Grok verisi için gerekli. /radar ve /compose endpoint'leri ücretsiz."
        >
          <input
            type="password"
            value={settings.xquikKey}
            onChange={(e) => update('xquikKey', e.target.value)}
            placeholder="xq_..."
            className={inputCls}
          />
        </Field>

        <Field
          label="Claude API Key"
          badge={{ text: 'Opsiyonel', color: 'text-[#6b6b72] bg-white/[0.06]' }}
          hint="Yoksa copy-paste mod devreye girer: prompt panoya kopyalanır, claude.ai'a yapıştırırsın. Varsa: tweet başına ~$0.001 (Haiku). 20$'la binlerce tweet."
        >
          <input
            type="password"
            value={settings.claudeKey}
            onChange={(e) => update('claudeKey', e.target.value)}
            placeholder="sk-ant-..."
            className={inputCls}
          />
        </Field>
      </Section>

      <div className="h-px bg-white/[0.05]" />

      {/* ── Hesap & İçerik ── */}
      <Section title="Hesap & İçerik">
        <Field
          label="Niche"
          hint="Her prompt'a 'Bu niş hakkında yaz' olarak ekleniyor. Reply Fırsatları sayfasında default arama terimi olarak da kullanılır."
        >
          <input
            type="text"
            value={settings.niche}
            onChange={(e) => update('niche', e.target.value)}
            placeholder="örn: yazılım, kripto, üretkenlik..."
            className={inputCls}
          />
        </Field>

        <Field
          label="Varsayılan Persona"
          hint="Üret sayfasında açılışta seçili olacak. Her persona farklı dil tonu ve hook pattern'ı kullanır."
        >
          <select
            value={settings.defaultPersona}
            onChange={(e) => update('defaultPersona', e.target.value)}
            className={inputCls}
          >
            <option value="hurricane" className="bg-[#18181c]">hurricane — Bold, soru sorduran, cesur</option>
            <option value="tr_educational" className="bg-[#18181c]">tr_educational — Öğretici, adım adım</option>
            <option value="tr_controversial" className="bg-[#18181c]">tr_controversial — Tartışma açan</option>
            <option value="tr_casual" className="bg-[#18181c]">tr_casual — Sohbet tonu, samimi</option>
          </select>
        </Field>

        <Field
          label="Ekstra Ton Notu"
          badge={{ text: 'ÖNCE BU olarak ekleniyor', color: 'text-accent bg-accent/10' }}
          hint="Claude bu notu sistem prompt'un en üstüne alıyor — en yüksek öncelik. 'daha cesur yaz', 'her tweeti soru ile bitir', 'rakam kullan' gibi direktifler işe yarıyor."
        >
          <textarea
            value={settings.toneProfile}
            onChange={(e) => update('toneProfile', e.target.value)}
            placeholder="örn: daha cesur yaz, her tweeti soru ile bitir, rakam ve stat kullan..."
            rows={2}
            className={`${inputCls} resize-none`}
          />
        </Field>
      </Section>

      <div className="h-px bg-white/[0.05]" />

      {/* ── X Hesap Ayarları ── */}
      <Section title="X Hesap Ayarları">
        <Field
          label="Twitter / X Kullanıcı Adı"
          badge={{ text: 'Feedback loop', color: 'text-accent-green bg-accent-green/10' }}
          hint="xquik ile son 20 tweetini çeker, hangi formatın tuttuğunu öğrenir. Yüksek engagement'lı tweetlerin tipini prompt'a besler. (Yakında otomatik aktif olacak)"
        >
          <input
            type="text"
            value={settings.twitterUsername}
            onChange={(e) => update('twitterUsername', e.target.value)}
            placeholder="@kullanici_adi"
            className={inputCls}
          />
        </Field>

        <div className="flex items-center justify-between py-1">
          <div className="flex-1 pr-4">
            <p className="text-xs font-medium text-[#8b8b96]">X Premium var</p>
            <p className="text-[10px] text-[#4a4a55] mt-1 leading-relaxed">
              Free hesapta tweet içi link = %30-50 reach kaybı (Mart 2026 itibaren).
              Premium yoksa prompt'a "link tweet içine yazma" kuralı ekleniyor + TweetCard'da uyarı çıkıyor.
            </p>
          </div>
          <button
            onClick={() => update('hasPremium', !settings.hasPremium)}
            className={`relative w-11 h-6 rounded-full transition-all shrink-0 ${
              settings.hasPremium ? 'bg-accent shadow-lg shadow-accent/30' : 'bg-white/[0.1]'
            }`}
          >
            <span className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-transform shadow-sm ${
              settings.hasPremium ? 'translate-x-6' : 'translate-x-1'
            }`} />
          </button>
        </div>
      </Section>

      <div className="h-px bg-white/[0.05]" />

      {/* Kaydet butonu */}
      <button
        onClick={handleSave}
        className={`w-full py-3 rounded-xl text-sm font-semibold transition-all ${
          saved
            ? 'bg-accent-green/20 text-accent-green border border-accent-green/30'
            : 'bg-accent hover:bg-accent/90 text-white shadow-lg shadow-accent/20'
        }`}
      >
        {saved ? '✓ Kaydedildi' : 'Kaydet'}
      </button>

      {/* Copy-paste kılavuz */}
      <div className="border border-white/[0.07] rounded-xl overflow-hidden">
        <div className="px-4 py-3 bg-white/[0.02] border-b border-white/[0.05]">
          <p className="text-xs font-semibold text-[#8b8b96]">Claude API key olmadan nasıl kullanılır?</p>
        </div>
        <ol className="px-4 py-3 space-y-2">
          {[
            'Konu gir, "Üret + Promptu Kopyala" butonuna bas',
            'Prompt otomatik panoya kopyalanır',
            'claude.ai\'i aç, yapıştır, gönder',
            'Gelen tweetlerden beğendiğini "Kaydet" ile arşivle',
            'Attıktan sonra Arşiv\'den engagement gir — sistem öğrenir',
          ].map((step, i) => (
            <li key={i} className="flex items-start gap-2.5 text-[11px] text-[#6b6b72]">
              <span className="w-4 h-4 rounded-full bg-white/[0.06] text-[9px] flex items-center justify-center shrink-0 font-medium text-[#8b8b96] mt-0.5">
                {i + 1}
              </span>
              {step}
            </li>
          ))}
        </ol>
      </div>

      {/* Algoritma özeti */}
      <div className="border border-accent/15 rounded-xl overflow-hidden bg-accent/[0.03]">
        <div className="px-4 py-3 border-b border-accent/10">
          <p className="text-xs font-semibold text-accent">Grok Algoritması — Hızlı Özet</p>
        </div>
        <ul className="px-4 py-3 space-y-2">
          {[
            ['⚡', 'Attıktan sonra hemen 2-3 kendi reply\'ını yaz — en kritik sinyal (ağırlık: 75)'],
            ['⏱', 'İlk 30-60 dk her şeyden önemli — velocity kuralı'],
            ['🚫', 'Hashtag ve emoji kullanma — Grok nötr/negatif değerlendiriyor'],
            ['🔗', 'Link reply\'a yaz, tweet içine değil — Free hesapta reach sıfırlanır'],
            ['📊', 'Like tek başına anlamsız — reply ve bookmark kazandırır'],
          ].map(([icon, text]) => (
            <li key={text} className="flex items-start gap-2.5 text-[11px] text-[#6b6b72]">
              <span className="shrink-0 text-sm">{icon}</span>
              {text}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
