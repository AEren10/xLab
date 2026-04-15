import { useState } from 'react';
import { Generate } from './pages/Generate';
import { History } from './pages/History';
import { Replies } from './pages/Replies';
import { Settings } from './pages/Settings';
import { Analytics } from './pages/Analytics';
import { Explore } from './pages/Explore';
import { Guide } from './pages/Guide';
import { db } from './lib/db';

type Page = 'generate' | 'history' | 'replies' | 'analytics' | 'explore' | 'guide' | 'settings';

const NAV_MAIN: { id: Page; label: string; icon: string; desc: string }[] = [
  { id: 'generate',  label: 'Üret',             icon: '⚡', desc: 'Tweet & thread üret' },
  { id: 'replies',   label: 'Reply Fırsatları', icon: '↩',  desc: 'Viral tweetlere reply at' },
  { id: 'history',   label: 'Arşiv',            icon: '◈',  desc: 'Geçmiş + engagement' },
  { id: 'analytics', label: 'Zamanlama',        icon: '📅', desc: 'En iyi paylaşım saati' },
  { id: 'explore',   label: 'Keşfet',           icon: '🔭', desc: 'Trendler, timeline, style' },
];

const NAV_BOTTOM: { id: Page; label: string; icon: string; desc: string }[] = [
  { id: 'guide',    label: 'Rehber',  icon: '📖', desc: 'Nasıl kullanılır, ipuçları' },
  { id: 'settings', label: 'Ayarlar', icon: '⊙',  desc: 'API key, persona, ton' },
];

function NavItem({ item, active, onClick }: {
  item: { id: Page; label: string; icon: string; desc: string };
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      title={item.desc}
      className={`
        relative w-full text-left px-3.5 py-3 rounded-2xl text-sm transition-all duration-200
        flex items-center gap-2.5 group overflow-hidden border border-transparent
        ${active
          ? 'bg-gradient-to-r from-accent/[0.18] via-white/[0.03] to-accent/[0.06] text-[#f4f4ee] border-white/[0.08] shadow-[0_12px_30px_rgba(0,0,0,0.22)]'
          : 'text-[#6b6b76] hover:text-[#f0f0e8] hover:bg-white/[0.045] hover:border-white/[0.06]'
        }
      `}
    >
      {/* Active left border glow */}
      {active && (
        <span className="absolute left-0 top-2 bottom-2 w-0.5 rounded-full bg-gradient-to-b from-accent to-accent-green shadow-[0_0_12px_rgba(138,124,255,0.75)]" />
      )}
      <span className={`text-base w-5 text-center shrink-0 transition-transform duration-200 group-hover:scale-110 ${active ? 'drop-shadow-[0_0_8px_rgba(138,124,255,0.7)]' : ''}`}>
        {item.icon}
      </span>
      <span className="font-medium text-[13px] tracking-tight">{item.label}</span>
    </button>
  );
}

export default function App() {
  const [page, setPage] = useState<Page>('generate');
  const settings = db.getSettings();

  const statusLevel =
    settings.claudeKey && settings.xquikKey ? 'full' :
    settings.xquikKey ? 'radar' :
    settings.claudeKey ? 'claude' : 'none';

  const statusInfo = {
    full:   { dot: 'bg-accent-green shadow-[0_0_6px_#4ade80]', label: 'Tam mod', sub: 'Claude + xquik', color: 'text-accent-green' },
    radar:  { dot: 'bg-accent-green shadow-[0_0_6px_#4ade80]', label: 'Radar modu', sub: 'xquik aktif', color: 'text-accent-green' },
    claude: { dot: 'bg-accent shadow-[0_0_6px_#7c6af7]', label: 'Claude modu', sub: 'xquik yok', color: 'text-accent' },
    none:   { dot: 'bg-accent-orange shadow-[0_0_6px_#fb923c]', label: 'Manuel mod', sub: 'API key yok', color: 'text-accent-orange' },
  }[statusLevel];

  return (
    <div className="app-shell p-3 sm:p-4">
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -left-24 top-[-6rem] h-80 w-80 rounded-full bg-accent/10 blur-3xl" />
        <div className="absolute right-[-4rem] top-24 h-72 w-72 rounded-full bg-accent-green/8 blur-3xl" />
        <div className="absolute bottom-[-7rem] left-1/3 h-80 w-80 rounded-full bg-[#6b8cff]/6 blur-3xl" />
      </div>

      <div className="relative flex h-full flex-col lg:flex-row overflow-hidden rounded-[32px] border border-white/[0.06] bg-white/[0.02] shadow-[0_30px_110px_rgba(0,0,0,0.42)] ring-1 ring-white/[0.03] backdrop-blur-2xl">

      {/* Sidebar */}
      <aside className="w-full lg:w-[248px] shrink-0 flex flex-col relative bg-[#0b0e14]/90 backdrop-blur-xl max-h-[42vh] lg:max-h-none overflow-y-auto lg:overflow-visible"
        style={{
          background: 'linear-gradient(180deg, rgba(13,15,22,0.96) 0%, rgba(9,10,14,0.94) 100%)',
          borderRight: '1px solid rgba(255,255,255,0.07)',
        }}
      >
        {/* Subtle top glow */}
        <div className="absolute top-0 left-0 right-0 h-32 pointer-events-none"
          style={{ background: 'radial-gradient(ellipse at 50% 0%, rgba(138,124,255,0.12) 0%, transparent 72%)' }}
        />

        {/* Logo */}
        <div className="relative px-4 pt-5 pb-4">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl flex items-center justify-center text-sm shrink-0"
              style={{
                background: 'linear-gradient(135deg, rgba(138,124,255,0.28) 0%, rgba(138,124,255,0.08) 100%)',
                border: '1px solid rgba(138,124,255,0.32)',
                boxShadow: '0 0 18px rgba(138,124,255,0.16)',
              }}
            >
              ⚡
            </div>
            <div>
              <p className="text-[14px] font-bold text-[#f0f0e8] tracking-tight leading-none">TweetLab</p>
              <p className="text-[9px] text-[#4a4a55] mt-1 tracking-wider uppercase">Grok · xquik</p>
            </div>
          </div>
        </div>

        {/* Divider */}
        <div className="mx-4 mb-3 h-px" style={{ background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.06), transparent)' }} />

        {/* Main nav */}
        <nav className="flex-1 px-2.5 space-y-0.5 overflow-y-auto">
          <p className="text-[9px] font-semibold text-[#3a3a45] uppercase tracking-wider px-3 py-1.5">Araçlar</p>
          {NAV_MAIN.map((item) => (
            <NavItem key={item.id} item={item} active={page === item.id} onClick={() => setPage(item.id)} />
          ))}
        </nav>

        {/* Bottom nav */}
        <div className="px-2.5 pb-2 space-y-0.5">
          <div className="mx-1 mb-2 h-px" style={{ background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.05), transparent)' }} />
          {NAV_BOTTOM.map((item) => (
            <NavItem key={item.id} item={item} active={page === item.id} onClick={() => setPage(item.id)} />
          ))}
        </div>

        {/* Status */}
        <div className="mx-3 mb-3 rounded-2xl px-3 py-3 space-y-1.5 border"
          style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}
        >
          <div className="flex items-center gap-2">
            <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${statusInfo.dot}`} />
            <span className={`text-[11px] font-semibold ${statusInfo.color}`}>{statusInfo.label}</span>
          </div>
          <p className="text-[10px] text-[#4a4a55] leading-snug">{statusInfo.sub}</p>
          {statusLevel === 'none' && (
            <button
              onClick={() => setPage('settings')}
              className="text-[10px] text-accent hover:text-accent/80 transition-colors font-medium"
            >
              API key ekle →
            </button>
          )}
        </div>

      </aside>

      {/* Main content */}
      <main className="relative flex-1 min-h-0 overflow-hidden bg-transparent">
        {page === 'generate'  && <Generate />}
        {page === 'replies'   && <Replies />}
        {page === 'history'   && <History />}
        {page === 'analytics' && <Analytics />}
        {page === 'explore'   && <Explore />}
        {page === 'guide'     && <Guide />}
        {page === 'settings'  && <Settings />}
      </main>
      </div>

    </div>
  );
}
