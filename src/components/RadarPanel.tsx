import { useState, useEffect } from 'react';
import { xquikApi } from '../lib/xquik';
import type { RadarItem } from '../lib/xquik';

interface RadarPanelProps {
  apiKey: string;
  onSelect?: (topic: string) => void;
}

export function RadarPanel({ apiKey, onSelect }: RadarPanelProps) {
  const [items, setItems] = useState<RadarItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
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
    if (open && items.length === 0) load();
  }, [open]);

  return (
    <div className="border border-white/[0.07] rounded-xl overflow-hidden">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-white/[0.03] transition-colors"
      >
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium text-[#e8e8e0]">Radar Gundem</span>
          {!apiKey && (
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-accent-orange/20 text-accent-orange">
              key yok
            </span>
          )}
        </div>
        <span className="text-[#6b6b72] text-xs">{open ? '▲' : '▼'}</span>
      </button>

      {open && (
        <div className="px-4 pb-3 space-y-2 border-t border-white/[0.05]">
          {loading && (
            <div className="space-y-1.5 pt-2">
              {[...Array(4)].map((_, i) => (
                <div
                  key={i}
                  className="h-7 bg-white/[0.04] rounded animate-pulse"
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
                  className="w-full text-left text-xs px-3 py-2 rounded-lg bg-white/[0.03] hover:bg-accent/10 hover:text-accent text-[#e8e8e0] transition-colors flex items-center gap-2"
                >
                  <span className="text-[#6b6b72]">{i + 1}.</span>
                  <span className="truncate">{item.title}</span>
                  {item.volume && (
                    <span className="ml-auto text-[10px] text-[#6b6b72] shrink-0">
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
