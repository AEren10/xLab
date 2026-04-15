import { useState, useEffect } from 'react';
import { xquikApi } from '../lib/xquik';
import type { RadarItem } from '../lib/xquik';

interface RadarPanelProps {
  apiKey: string;
  onSelect?: (topic: string) => void;
  featured?: boolean;
}

export function RadarPanel({ apiKey, onSelect, featured = false }: RadarPanelProps) {
  const [items, setItems] = useState<RadarItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(true);
  const [error, setError] = useState('');

  const load = async () => {
    if (!apiKey) {
      setError('Ayarlar > Xquik API Key ekle');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const data = await xquikApi.getRadar(apiKey, 8);
      if (data.length === 0) setError('Sonuç bulunamadı.');
      setItems(data);
    } catch {
      setError('Radar yüklenemedi.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (items.length === 0 && apiKey) load();
  }, [apiKey]);

  return (
    <div className={`premium-panel overflow-hidden ${featured ? 'border-white/[0.08]' : ''}`}>
      <button
        onClick={() => setOpen((v) => !v)}
        className={`w-full flex items-start justify-between gap-3 hover:bg-white/[0.03] transition-colors ${
          featured ? 'px-5 py-4' : 'px-4 py-3.5'
        }`}
      >
        <div className="space-y-1 text-left">
          <div className="flex items-center gap-2">
            <span className={`${featured ? 'text-sm' : 'text-xs'} font-medium text-[#e8e8e0]`}>X Radar Başlıkları</span>
            {!apiKey && (
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-accent-orange/20 text-accent-orange">
                key yok
              </span>
            )}
          </div>
          <p className={`text-[9px] text-[#6b6b72] leading-relaxed ${featured ? 'max-w-md' : ''}`}>
            xquik radarının verdiği ham konu başlıkları. Tıkla, Generate'de kullan.
          </p>
        </div>
        <span className={`text-[#6b6b72] ${featured ? 'text-sm' : 'text-xs'}`}>{open ? '▲' : '▼'}</span>
      </button>

      {open && (
        <div className={`${featured ? 'px-5 pb-4' : 'px-4 pb-3.5'} space-y-2 border-t border-white/[0.05]`}>
          {loading && (
            <div className="space-y-1.5 pt-2">
              {[...Array(4)].map((_, i) => (
                <div
                  key={i}
                  className={`bg-white/[0.04] rounded animate-pulse ${featured ? 'h-9' : 'h-7'}`}
                />
              ))}
            </div>
          )}

          {error && !loading && (
            <p className="text-xs text-[#6b6b72] pt-2">{error}</p>
          )}

          {!loading && items.length > 0 && (
            <div className="pt-2 space-y-1">
              {items.map((item, i) => (
                <button
                  key={i}
                  onClick={() => onSelect?.(item.title)}
                  className={`w-full text-left px-3 rounded-lg bg-white/[0.03] hover:bg-accent/10 hover:text-accent text-[#e8e8e0] transition-colors flex items-center gap-2 ${
                    featured ? 'py-3 text-sm' : 'py-2 text-xs'
                  }`}
                >
                  <span className="text-[#6b6b72]">{i + 1}.</span>
                  <span className="truncate">{item.title}</span>
                  {item.volume && (
                    <span className={`ml-auto text-[10px] text-[#6b6b72] shrink-0 ${featured ? 'font-medium' : ''}`}>
                      {item.volume.toLocaleString()}
                    </span>
                  )}
                </button>
              ))}
            </div>
          )}

          <button
            onClick={load}
            className="w-full text-xs py-1.5 text-[#6b6b72] hover:text-[#e8e8e0] transition-colors mt-1"
          >
            Yenile
          </button>
        </div>
      )}
    </div>
  );
}
