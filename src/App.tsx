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
        relative w-full text-left px-3 py-2.5 rounded-xl text-sm transition-all duration-150
        flex items-center gap-2.5 group overflow-hidden
        ${active
          ? 'bg-gradient-to-r from-accent/[0.15] to-accent/[0.05] text-accent'
          : 'text-[#5a5a65] hover:text-[#c8c8c0] hover:bg-white/[0.05]'
        }
      `}
    >
      {/* Active left border glow */}
      {active && (
        <span className="absolute left-0 top-2 bottom-2 w-0.5 rounded-full bg-accent shadow-[0_0_8px_#7c6af7]" />
      )}
      <span className={`text-base w-5 text-center shrink-0 transition-transform duration-150 group-hover:scale-110 ${active ? 'drop-shadow-[0_0_6px_rgba(124,106,247,0.7)]' : ''}`}>
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
    <div className="flex h-screen bg-[#09090b] text-[#e8e8e0] overflow-hidden">

      {/* Sidebar */}
      <aside className="w-[230px] shrink-0 flex flex-col relative"
        style={{
          background: 'linear-gradient(180deg, #0f0f12 0%, #0c0c0e 100%)',
          borderRight: '1px solid rgba(255,255,255,0.055)',
        }}
      >
        {/* Subtle top glow */}
        <div className="absolute top-0 left-0 right-0 h-32 pointer-events-none"
          style={{ background: 'radial-gradient(ellipse at 50% 0%, rgba(124,106,247,0.08) 0%, transparent 70%)' }}
        />

        {/* Logo */}
        <div className="relative px-4 pt-5 pb-4">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl flex items-center justify-center text-sm shrink-0"
              style={{
                background: 'linear-gradient(135deg, rgba(124,106,247,0.25) 0%, rgba(124,106,247,0.1) 100%)',
                border: '1px solid rgba(124,106,247,0.3)',
                boxShadow: '0 0 12px rgba(124,106,247,0.15)',
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
        <div className="mx-3 mb-3 rounded-xl px-3 py-2.5 space-y-1.5"
          style={{ background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.055)' }}
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
      <main className="flex-1 overflow-hidden bg-[#09090b]">
        {page === 'generate'  && <Generate />}
        {page === 'replies'   && <Replies />}
        {page === 'history'   && <History />}
        {page === 'analytics' && <Analytics />}
        {page === 'explore'   && <Explore />}
        {page === 'guide'     && <Guide />}
        {page === 'settings'  && <Settings />}
      </main>

    </div>
  );
}
