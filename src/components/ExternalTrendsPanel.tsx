import { useState } from 'react';
import type { ExternalTrends } from '../lib/xquik';

interface Props {
  trends: ExternalTrends;
  onSelect: (topic: string) => void;
}

const SOURCE_CONFIG = {
  reddit:     { label: 'Reddit',    icon: '📡', color: 'text-orange-400',   bg: 'bg-orange-400/10',  border: 'border-orange-400/20' },
  hackernews: { label: 'HN',        icon: '🔶', color: 'text-amber-400',    bg: 'bg-amber-400/10',   border: 'border-amber-400/20'  },
  google:     { label: 'Google',    icon: '🌍', color: 'text-blue-400',     bg: 'bg-blue-400/10',    border: 'border-blue-400/20'   },
} as const;

export function ExternalTrendsPanel({ trends, onSelect }: Props) {
  const [open, setOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'reddit' | 'hackernews' | 'google'>('reddit');

  const totalCount =
    trends.reddit.length + trends.hackernews.length + trends.google.length;
  if (totalCount === 0) return null;

  const tabs = (
    Object.keys(SOURCE_CONFIG) as Array<keyof typeof SOURCE_CONFIG>
  ).filter((k) => (k === 'google' ? trends.google.length > 0 : trends[k].length > 0));

  const cfg = SOURCE_CONFIG[activeTab];

  return (
    <div className="rounded-xl border border-white/[0.07] overflow-hidden">
      {/* Header */}
      <button
        onClick={() => setOpen(!open)}
        className="w-full px-3.5 py-2.5 flex items-center justify-between hover:bg-white/[0.02] transition-colors"
      >
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-medium text-[#8b8b96]">Dünya Gündemi</span>
          <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-blue-400/10 text-blue-400 border border-blue-400/20">
            {totalCount} trend
          </span>
        </div>
        <span className="text-[10px] text-[#4a4a55]">{open ? '▲' : '▼'}</span>
      </button>

      {open && (
        <div className="border-t border-white/[0.05]">
          {/* Tab bar */}
          <div className="flex border-b border-white/[0.05]">
            {tabs.map((tab) => {
              const c = SOURCE_CONFIG[tab];
              return (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`flex-1 py-2 text-[10px] font-medium transition-all flex items-center justify-center gap-1 ${
                    activeTab === tab
                      ? `${c.color} border-b-2 ${c.border.replace('border-', 'border-b-')}`
                      : 'text-[#4a4a55] hover:text-[#8b8b96]'
                  }`}
                >
                  <span>{c.icon}</span>
                  {c.label}
                </button>
              );
            })}
          </div>

          {/* İçerik */}
          <div className="p-2 space-y-1 max-h-48 overflow-y-auto">
            {activeTab === 'google'
              ? trends.google.map((item, i) => (
                  <button
                    key={i}
                    onClick={() => onSelect(item.keyword)}
                    className={`w-full text-left px-2.5 py-1.5 rounded-lg text-[10px] text-[#c8c8d0] hover:text-[#e8e8e0] ${cfg.bg} hover:opacity-80 transition-all flex items-center justify-between gap-2`}
                  >
                    <span className="truncate">{item.keyword}</span>
                    {item.interest != null && (
                      <span className={`shrink-0 text-[9px] ${cfg.color}`}>
                        {item.interest}%
                      </span>
                    )}
                  </button>
                ))
              : (trends[activeTab] as Array<{ title: string; url?: string; score?: number; subreddit?: string; comments?: number }>).map((item, i) => (
                  <button
                    key={i}
                    onClick={() => onSelect(item.title)}
                    className={`w-full text-left px-2.5 py-1.5 rounded-lg text-[10px] text-[#c8c8d0] hover:text-[#e8e8e0] hover:${cfg.bg} transition-all`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <span className="leading-relaxed line-clamp-2">{item.title}</span>
                      {item.score != null && (
                        <span className={`shrink-0 text-[9px] ${cfg.color} mt-0.5`}>
                          ▲{item.score}
                        </span>
                      )}
                    </div>
                    {'subreddit' in item && item.subreddit && (
                      <span className="text-[9px] text-[#4a4a55] mt-0.5 block">
                        r/{item.subreddit}
                      </span>
                    )}
                  </button>
                ))}
          </div>
          <p className="text-[9px] text-[#3a3a45] text-center pb-2">
            tıkla → konuya ekle
          </p>
        </div>
      )}
    </div>
  );
}
