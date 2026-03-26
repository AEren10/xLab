import { useState } from 'react';
import { Generate } from './pages/Generate';
import { History } from './pages/History';
import { Replies } from './pages/Replies';
import { Settings } from './pages/Settings';
import { db } from './lib/db';

type Page = 'generate' | 'history' | 'replies' | 'settings';

const NAV: { id: Page; label: string; icon: string; desc: string }[] = [
  { id: 'generate',  label: 'Üret',             icon: '⚡', desc: 'Tweet & thread üret' },
  { id: 'replies',   label: 'Reply Fırsatları', icon: '↩',  desc: 'Viral tweetlere reply at' },
  { id: 'history',   label: 'Arşiv',            icon: '◈',  desc: 'Geçmiş + engagement' },
  { id: 'settings',  label: 'Ayarlar',          icon: '⊙',  desc: 'API key, persona, ton' },
];

export default function App() {
  const [page, setPage] = useState<Page>('generate');
  const settings = db.getSettings();

  // Sistem durumunu tek string olarak özetle
  const statusLevel =
    settings.claudeKey && settings.xquikKey ? 'full' :
    settings.xquikKey ? 'radar' :
    settings.claudeKey ? 'claude' : 'none';

  const statusInfo = {
    full:   { dot: 'bg-accent-green', label: 'Tam mod', sub: 'Claude + xquik aktif' },
    radar:  { dot: 'bg-accent-green', label: 'Radar modu', sub: 'xquik aktif, Claude yok' },
    claude: { dot: 'bg-accent',       label: 'Claude modu', sub: 'xquik yok, radar çalışmaz' },
    none:   { dot: 'bg-accent-orange',label: 'Copy-paste', sub: 'API key yok — manuel mod' },
  }[statusLevel];

  return (
    <div className="flex h-screen bg-[#0a0a0b] text-[#e8e8e0] overflow-hidden">
      {/* Sidebar */}
      <aside className="w-52 shrink-0 border-r border-white/[0.06] flex flex-col bg-[#0d0d0f]">

        {/* Logo */}
        <div className="px-5 py-5 border-b border-white/[0.06]">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-accent/20 flex items-center justify-center text-sm">
              ⚡
            </div>
            <div>
              <p className="text-sm font-semibold text-[#e8e8e0] tracking-tight">TweetLab</p>
              <p className="text-[10px] text-[#6b6b72] leading-none mt-0.5">Grok · {new Date().getFullYear()}</p>
            </div>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-2.5 py-3 space-y-0.5">
          {NAV.map((item) => (
            <button
              key={item.id}
              onClick={() => setPage(item.id)}
              title={item.desc}
              className={`
                w-full text-left px-3 py-2.5 rounded-xl text-sm transition-all duration-150
                flex items-center gap-2.5 group
                ${page === item.id
                  ? 'bg-accent/[0.12] text-accent'
                  : 'text-[#6b6b72] hover:text-[#e8e8e0] hover:bg-white/[0.04]'
                }
              `}
            >
              <span className={`text-base w-5 text-center shrink-0 transition-transform group-hover:scale-110 ${page === item.id ? 'text-accent' : ''}`}>
                {item.icon}
              </span>
              <span className="font-medium">{item.label}</span>
            </button>
          ))}
        </nav>

        {/* Status block */}
        <div className="mx-2.5 mb-3 rounded-xl bg-white/[0.03] border border-white/[0.06] px-3 py-3 space-y-1.5">
          <div className="flex items-center gap-2">
            <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${statusInfo.dot}`} />
            <span className="text-[11px] font-medium text-[#e8e8e0]">{statusInfo.label}</span>
          </div>
          <p className="text-[10px] text-[#6b6b72] leading-relaxed">{statusInfo.sub}</p>
          {statusLevel === 'none' && (
            <button
              onClick={() => setPage('settings')}
              className="text-[10px] text-accent hover:text-accent/80 transition-colors"
            >
              API key ekle →
            </button>
          )}
        </div>

      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-hidden">
        {page === 'generate' && <Generate />}
        {page === 'replies'  && <Replies />}
        {page === 'history'  && <History />}
        {page === 'settings' && <Settings />}
      </main>
    </div>
  );
}
