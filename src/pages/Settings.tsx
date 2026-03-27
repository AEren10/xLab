import { useState } from 'react';
import { db } from '../lib/db';
import type { Settings as SettingsType, AccountProfile } from '../lib/db';
import { claudeApi } from '../lib/claude';
import { xquikApi } from '../lib/xquik';

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

const PERSONA_OPTIONS = [
  { value: 'hurricane',       label: 'hurricane — Bold, soru sorduran, cesur' },
  { value: 'tr_educational',  label: 'tr_educational — Öğretici, adım adım' },
  { value: 'tr_controversial',label: 'tr_controversial — Tartışma açan' },
  { value: 'tr_casual',       label: 'tr_casual — Sohbet tonu, samimi' },
];

function newProfile(): AccountProfile {
  return {
    id: `profile_${Date.now()}`,
    label: 'Yeni Hesap',
    niche: '',
    defaultPersona: 'hurricane',
    toneProfile: '',
    twitterUsername: '',
    hasPremium: false,
  };
}

function ProfileCard({
  profile,
  isActive,
  onSelect,
  onSave,
  onDelete,
}: {
  profile: AccountProfile;
  isActive: boolean;
  onSelect: () => void;
  onSave: (p: AccountProfile) => void;
  onDelete: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<AccountProfile>(profile);
  const inputCls = "w-full bg-[#111113] border border-white/[0.07] rounded-xl px-3 py-2 text-sm text-[#e8e8e0] placeholder-[#3a3a45] focus:border-accent/40 transition-all";

  const handleSave = () => {
    onSave(draft);
    setEditing(false);
  };

  return (
    <div className={`rounded-xl border p-3.5 transition-all ${isActive ? 'border-accent/40 bg-accent/[0.04]' : 'border-white/[0.07] bg-white/[0.02]'}`}>
      {!editing ? (
        // Özet görünüm
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {isActive && (
                <span className="w-1.5 h-1.5 rounded-full bg-accent-green shrink-0" />
              )}
              <span className="text-xs font-semibold text-[#e8e8e0]">{profile.label}</span>
              {profile.twitterUsername && (
                <span className="text-[10px] text-[#6b6b72]">@{profile.twitterUsername.replace('@', '')}</span>
              )}
            </div>
            <div className="flex gap-1.5">
              {!isActive && (
                <button
                  onClick={onSelect}
                  className="text-[10px] px-2.5 py-1 rounded-lg bg-accent/10 hover:bg-accent/20 text-accent transition-colors"
                >
                  Seç
                </button>
              )}
              <button
                onClick={() => { setDraft(profile); setEditing(true); }}
                className="text-[10px] px-2.5 py-1 rounded-lg bg-white/[0.05] hover:bg-white/[0.09] text-[#8b8b96] transition-colors"
              >
                Düzenle
              </button>
              <button
                onClick={onDelete}
                className="text-[10px] px-2.5 py-1 rounded-lg bg-accent-red/10 hover:bg-accent-red/20 text-accent-red transition-colors"
              >
                Sil
              </button>
            </div>
          </div>
          <div className="flex flex-wrap gap-2 text-[10px] text-[#6b6b72]">
            {profile.niche && <span>Niche: {profile.niche}</span>}
            <span>Persona: {profile.defaultPersona}</span>
            {profile.hasPremium && <span className="text-accent-green">Premium ✓</span>}
          </div>
          {isActive && (
            <p className="text-[10px] text-accent/70">Aktif hesap — Generate bu profili kullanıyor</p>
          )}
        </div>
      ) : (
        // Düzenleme formu
        <div className="space-y-3">
          <div className="flex items-center justify-between mb-1">
            <p className="text-xs font-semibold text-[#e8e8e0]">Profil Düzenle</p>
          </div>

          <div>
            <label className="text-[10px] text-[#6b6b72] mb-1 block">Hesap Adı</label>
            <input
              type="text"
              value={draft.label}
              onChange={(e) => setDraft({ ...draft, label: e.target.value })}
              placeholder="Ana Hesap, Kripto, Yazılım..."
              className={inputCls}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[10px] text-[#6b6b72] mb-1 block">Twitter Kullanıcı Adı</label>
              <input
                type="text"
                value={draft.twitterUsername}
                onChange={(e) => setDraft({ ...draft, twitterUsername: e.target.value })}
                placeholder="@kullanici"
                className={inputCls}
              />
            </div>
            <div>
              <label className="text-[10px] text-[#6b6b72] mb-1 block">Niche</label>
              <input
                type="text"
                value={draft.niche}
                onChange={(e) => setDraft({ ...draft, niche: e.target.value })}
                placeholder="kripto, yazılım..."
                className={inputCls}
              />
            </div>
          </div>

          <div>
            <label className="text-[10px] text-[#6b6b72] mb-1 block">Persona</label>
            <select
              value={draft.defaultPersona}
              onChange={(e) => setDraft({ ...draft, defaultPersona: e.target.value })}
              className={inputCls}
            >
              {PERSONA_OPTIONS.map((p) => (
                <option key={p.value} value={p.value} className="bg-[#18181c]">{p.label}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-[10px] text-[#6b6b72] mb-1 block">Ton Notu</label>
            <textarea
              value={draft.toneProfile}
              onChange={(e) => setDraft({ ...draft, toneProfile: e.target.value })}
              placeholder="daha cesur yaz, rakam kullan..."
              rows={2}
              className={`${inputCls} resize-none`}
            />
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-[10px] text-[#8b8b96]">X Premium</span>
              <button
                onClick={() => setDraft({ ...draft, hasPremium: !draft.hasPremium })}
                className={`relative w-9 h-5 rounded-full transition-all ${
                  draft.hasPremium ? 'bg-accent shadow-lg shadow-accent/30' : 'bg-white/[0.1]'
                }`}
              >
                <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform shadow-sm ${
                  draft.hasPremium ? 'translate-x-4' : 'translate-x-0.5'
                }`} />
              </button>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setEditing(false)}
                className="text-[10px] px-3 py-1.5 rounded-lg bg-white/[0.05] hover:bg-white/[0.09] text-[#6b6b72] transition-colors"
              >
                İptal
              </button>
              <button
                onClick={handleSave}
                className="text-[10px] px-3 py-1.5 rounded-lg bg-accent hover:bg-accent/90 text-white transition-colors"
              >
                Kaydet
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export function Settings() {
  const [saved, setSaved] = useState(false);
  const [settings, setSettings] = useState<SettingsType>(db.getSettings());
  const [profiles, setProfiles] = useState<AccountProfile[]>(db.getProfiles());
  const [claudeTest, setClaudeTest] = useState<{ status: 'idle' | 'loading' | 'ok' | 'error'; msg?: string }>({ status: 'idle' });
  const [xquikTest, setXquikTest] = useState<{ status: 'idle' | 'loading' | 'ok' | 'error'; msg?: string }>({ status: 'idle' });

  const testClaude = async () => {
    if (!settings.claudeKey) return;
    setClaudeTest({ status: 'loading' });
    const r = await claudeApi.testKey(settings.claudeKey);
    setClaudeTest(r.ok ? { status: 'ok', msg: 'Bağlantı başarılı' } : { status: 'error', msg: r.error });
  };

  const testXquik = async () => {
    if (!settings.xquikKey) return;
    setXquikTest({ status: 'loading' });
    try {
      const ok = await xquikApi.testKey(settings.xquikKey);
      setXquikTest(ok ? { status: 'ok', msg: 'Bağlantı başarılı' } : { status: 'error', msg: 'Geçersiz key' });
    } catch (e: any) {
      setXquikTest({ status: 'error', msg: e.message });
    }
  };

  const update = (key: keyof SettingsType, val: string | boolean) =>
    setSettings((prev) => ({ ...prev, [key]: val }));

  const handleSave = () => {
    db.saveSettings(settings);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const handleSaveProfile = (profile: AccountProfile) => {
    db.saveProfile(profile);
    setProfiles(db.getProfiles());
  };

  const handleDeleteProfile = (id: string) => {
    db.deleteProfile(id);
    if (settings.activeProfileId === id) {
      db.saveSettings({ activeProfileId: '' });
      setSettings((prev) => ({ ...prev, activeProfileId: '' }));
    }
    setProfiles(db.getProfiles());
  };

  const handleSelectProfile = (id: string) => {
    db.saveSettings({ activeProfileId: id });
    setSettings((prev) => ({ ...prev, activeProfileId: id }));
  };

  const handleAddProfile = () => {
    const p = newProfile();
    db.saveProfile(p);
    setProfiles(db.getProfiles());
  };

  const inputCls = "w-full bg-[#111113] border border-white/[0.07] rounded-xl px-3 py-2.5 text-sm text-[#e8e8e0] placeholder-[#3a3a45] focus:border-accent/40 focus:bg-[#111115] transition-all";

  return (
    <div className="p-6 max-w-xl overflow-y-auto h-full space-y-8">

      <div>
        <h1 className="text-base font-semibold text-[#e8e8e0]">Ayarlar</h1>
        <p className="text-xs text-[#4a4a55] mt-0.5">Tüm veriler tarayıcında, hiçbir yere gönderilmiyor</p>
      </div>

      {/* ── API Bağlantıları ── */}
      <Section title="API Bağlantıları">
        <Field
          label="xquik API Key"
          badge={{ text: 'Radar + Grok', color: 'text-accent-green bg-accent-green/10' }}
          hint="xquik.com → Dashboard → API Key. Radar + Reply Fırsatları + canlı Grok verisi için gerekli."
        >
          <input
            type="password"
            value={settings.xquikKey}
            onChange={(e) => { update('xquikKey', e.target.value); setXquikTest({ status: 'idle' }); }}
            placeholder="xq_..."
            className={inputCls}
          />
          <div className="flex items-center gap-2 mt-2">
            <button
              onClick={testXquik}
              disabled={!settings.xquikKey || xquikTest.status === 'loading'}
              className="text-[10px] px-3 py-1.5 rounded-lg bg-accent-green/10 hover:bg-accent-green/20 text-accent-green disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              {xquikTest.status === 'loading' ? 'Test ediliyor...' : 'Bağlantıyı Test Et'}
            </button>
            {xquikTest.status === 'ok' && (
              <span className="text-[10px] text-accent-green">✓ {xquikTest.msg}</span>
            )}
            {xquikTest.status === 'error' && (
              <span className="text-[10px] text-accent-red">✗ {xquikTest.msg}</span>
            )}
          </div>
        </Field>

        <Field
          label="Claude API Key"
          badge={{ text: 'Opsiyonel', color: 'text-[#6b6b72] bg-white/[0.06]' }}
          hint="Yoksa copy-paste mod devreye girer. Varsa: tweet başına ~$0.001 (Haiku). 20$'la binlerce tweet."
        >
          <input
            type="password"
            value={settings.claudeKey}
            onChange={(e) => { update('claudeKey', e.target.value); setClaudeTest({ status: 'idle' }); }}
            placeholder="sk-ant-..."
            className={inputCls}
          />
          <div className="flex items-center gap-2 mt-2">
            <button
              onClick={testClaude}
              disabled={!settings.claudeKey || claudeTest.status === 'loading'}
              className="text-[10px] px-3 py-1.5 rounded-lg bg-accent/10 hover:bg-accent/20 text-accent disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              {claudeTest.status === 'loading' ? 'Test ediliyor...' : 'Bağlantıyı Test Et'}
            </button>
            {claudeTest.status === 'ok' && (
              <span className="text-[10px] text-accent-green">✓ {claudeTest.msg}</span>
            )}
            {claudeTest.status === 'error' && (
              <span className="text-[10px] text-accent-red">✗ {claudeTest.msg}</span>
            )}
          </div>
        </Field>
      </Section>

      <div className="h-px bg-white/[0.05]" />

      {/* ── Hesap Profilleri ── */}
      <Section title="Hesap Profilleri">
        <p className="text-[11px] text-[#6b6b72] -mt-2 leading-relaxed">
          Her hesap için ayrı niche, persona ve ton ayarı. Generate sayfasında istediğin profili seçebilirsin.
        </p>

        {profiles.length === 0 && (
          <div className="text-center py-6 border border-dashed border-white/[0.07] rounded-xl">
            <p className="text-xs text-[#4a4a55] mb-3">Henüz profil yok</p>
            <p className="text-[10px] text-[#4a4a55] mb-4 max-w-52 mx-auto leading-relaxed">
              API key'leri paylaşırken her hesap kendi niche ve tonunu kullanır
            </p>
          </div>
        )}

        <div className="space-y-2">
          {profiles.map((profile) => (
            <ProfileCard
              key={profile.id}
              profile={profile}
              isActive={settings.activeProfileId === profile.id}
              onSelect={() => handleSelectProfile(profile.id)}
              onSave={handleSaveProfile}
              onDelete={() => handleDeleteProfile(profile.id)}
            />
          ))}
        </div>

        <button
          onClick={handleAddProfile}
          className="w-full py-2.5 rounded-xl border border-dashed border-white/[0.1] text-xs text-[#6b6b72] hover:text-[#e8e8e0] hover:border-white/[0.2] transition-all"
        >
          + Yeni Hesap Profili Ekle
        </button>

        {/* Profil yokken legacy ayarlar */}
        {profiles.length === 0 && (
          <div className="border-t border-white/[0.05] pt-4 space-y-4">
            <p className="text-[10px] text-[#4a4a55]">
              Profil kullanmak istemiyorsan aşağıdan tek hesap için ayarla:
            </p>
            <Field label="Niche">
              <input
                type="text"
                value={settings.niche}
                onChange={(e) => update('niche', e.target.value)}
                placeholder="yazılım, kripto, üretkenlik..."
                className={inputCls}
              />
            </Field>
            <Field label="Varsayılan Persona">
              <select
                value={settings.defaultPersona}
                onChange={(e) => update('defaultPersona', e.target.value)}
                className={inputCls}
              >
                {PERSONA_OPTIONS.map((p) => (
                  <option key={p.value} value={p.value} className="bg-[#18181c]">{p.label}</option>
                ))}
              </select>
            </Field>
            <Field
              label="Ekstra Ton Notu"
              badge={{ text: 'ÖNCE BU olarak ekleniyor', color: 'text-accent bg-accent/10' }}
            >
              <textarea
                value={settings.toneProfile}
                onChange={(e) => update('toneProfile', e.target.value)}
                placeholder="daha cesur yaz, rakam kullan..."
                rows={2}
                className={`${inputCls} resize-none`}
              />
            </Field>
            <Field
              label="Twitter / X Kullanıcı Adı"
              badge={{ text: 'Feedback loop', color: 'text-accent-green bg-accent-green/10' }}
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
              <div>
                <p className="text-xs font-medium text-[#8b8b96]">X Premium var</p>
                <p className="text-[10px] text-[#4a4a55] mt-0.5">
                  Free hesapta link tweet içi = %30-50 reach kaybı.
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
          </div>
        )}
      </Section>

      <div className="h-px bg-white/[0.05]" />

      {/* Kaydet */}
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
