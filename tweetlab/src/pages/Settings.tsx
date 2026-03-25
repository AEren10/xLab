import { useState } from 'react';
import { db } from '../lib/db';
import type { Settings as SettingsType } from '../lib/db';

export function Settings() {
  const [saved, setSaved] = useState(false);
  const [settings, setSettings] = useState<SettingsType>(db.getSettings());

  const update = (key: keyof SettingsType, val: string) => {
    setSettings((prev) => ({ ...prev, [key]: val }));
  };

  const handleSave = () => {
    db.saveSettings(settings);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div className="p-4 max-w-lg space-y-6 overflow-y-auto h-full">
      <div>
        <h2 className="text-sm font-medium text-[#e8e8e0] mb-4">Ayarlar</h2>

        <div className="space-y-4">
          {/* Xquik API Key */}
          <div>
            <label className="text-xs text-[#6b6b72] mb-1.5 block">
              Xquik API Key{' '}
              <span className="text-accent-green">(radar icin)</span>
            </label>
            <input
              type="password"
              value={settings.xquikKey}
              onChange={(e) => update('xquikKey', e.target.value)}
              placeholder="xq_..."
              className="w-full bg-elevated border border-white/[0.07] rounded-xl px-3 py-2.5 text-sm text-[#e8e8e0] placeholder-[#6b6b72] focus:border-accent/50 transition-colors"
            />
            <p className="text-[11px] text-[#6b6b72] mt-1">
              Xquik radar ucretsiz. xquik.com'dan al.
            </p>
          </div>

          {/* Claude API Key */}
          <div>
            <label className="text-xs text-[#6b6b72] mb-1.5 block">
              Claude API Key{' '}
              <span className="text-[#6b6b72]">(opsiyonel, direkt uretim)</span>
            </label>
            <input
              type="password"
              value={settings.claudeKey}
              onChange={(e) => update('claudeKey', e.target.value)}
              placeholder="sk-ant-..."
              className="w-full bg-elevated border border-white/[0.07] rounded-xl px-3 py-2.5 text-sm text-[#e8e8e0] placeholder-[#6b6b72] focus:border-accent/50 transition-colors"
            />
            <p className="text-[11px] text-[#6b6b72] mt-1">
              Olmadan da calisir: prompt panoya kopyalanir, claude.ai'a yapistirirsin.
            </p>
          </div>

          {/* Niche */}
          <div>
            <label className="text-xs text-[#6b6b72] mb-1.5 block">Niche</label>
            <input
              type="text"
              value={settings.niche}
              onChange={(e) => update('niche', e.target.value)}
              placeholder="orn: yazilim, para, uretkenlik..."
              className="w-full bg-elevated border border-white/[0.07] rounded-xl px-3 py-2.5 text-sm text-[#e8e8e0] placeholder-[#6b6b72] focus:border-accent/50 transition-colors"
            />
          </div>

          {/* Default persona */}
          <div>
            <label className="text-xs text-[#6b6b72] mb-1.5 block">
              Varsayilan Persona
            </label>
            <select
              value={settings.defaultPersona}
              onChange={(e) => update('defaultPersona', e.target.value)}
              className="w-full bg-elevated border border-white/[0.07] rounded-xl px-3 py-2.5 text-sm text-[#e8e8e0] focus:border-accent/50 transition-colors"
            >
              <option value="hurricane" className="bg-[#18181c]">hurricane</option>
              <option value="tr_educational" className="bg-[#18181c]">tr_educational</option>
              <option value="tr_controversial" className="bg-[#18181c]">tr_controversial</option>
              <option value="tr_casual" className="bg-[#18181c]">tr_casual</option>
            </select>
          </div>

          {/* Tone profile */}
          <div>
            <label className="text-xs text-[#6b6b72] mb-1.5 block">
              Ekstra Ton Notu{' '}
              <span className="text-[#6b6b72]">(opsiyonel)</span>
            </label>
            <textarea
              value={settings.toneProfile}
              onChange={(e) => update('toneProfile', e.target.value)}
              placeholder="orn: daha cesur yaz, her tweeti soru ile bitir..."
              rows={2}
              className="w-full bg-elevated border border-white/[0.07] rounded-xl px-3 py-2.5 text-sm text-[#e8e8e0] placeholder-[#6b6b72] resize-none focus:border-accent/50 transition-colors"
            />
          </div>

          {/* Save */}
          <button
            onClick={handleSave}
            className="w-full py-2.5 rounded-xl bg-accent hover:bg-accent/90 text-white text-sm font-medium transition-colors"
          >
            {saved ? 'Kaydedildi!' : 'Kaydet'}
          </button>
        </div>
      </div>

      {/* Instructions */}
      <div className="border border-white/[0.07] rounded-xl p-4 space-y-2">
        <h3 className="text-xs font-medium text-[#e8e8e0]">
          API key olmadan nasil kullanilir?
        </h3>
        <ol className="space-y-1.5 text-[11px] text-[#6b6b72] list-decimal list-inside">
          <li>Konu gir, uret butonuna bas</li>
          <li>Prompt otomatik panoya kopyalanir</li>
          <li>claude.ai'i ac, yapistir, gonder</li>
          <li>Gelen tweetlerden begendigini buraya kaydet</li>
          <li>Atinca engagement gir — sistem ogrensin</li>
        </ol>
      </div>

      {/* Algo tip */}
      <div className="border border-accent/20 rounded-xl p-4 space-y-2 bg-accent/5">
        <h3 className="text-xs font-medium text-accent">Algoritma Hatirlatici</h3>
        <ul className="space-y-1 text-[11px] text-[#6b6b72]">
          <li>Attiktan sonra hemen 2-3 reply at (en kritik sinyal)</li>
          <li>Ilk 30-60 dk engagement her seyden onemli</li>
          <li>Hashtag, emoji kullanma</li>
          <li>Link tweet icine degil, reply'a</li>
        </ul>
      </div>
    </div>
  );
}
