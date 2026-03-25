import { useState } from 'react';
import { Generate } from './pages/Generate';
import { History } from './pages/History';
import { Settings } from './pages/Settings';
import { db } from './lib/db';

type Page = 'generate' | 'history' | 'settings';

const NAV = [
  { id: 'generate' as Page, label: 'Uret' },
  { id: 'history' as Page, label: 'Arsiv' },
  { id: 'settings' as Page, label: 'Ayarlar' },
];

export default function App() {
  const [page, setPage] = useState<Page>('generate');
  const settings = db.getSettings();

  return (
    <div className="flex h-screen bg-[#0a0a0b] text-[#e8e8e0] overflow-hidden">
      {/* Sidebar */}
      <aside className="w-48 shrink-0 border-r border-white/[0.07] flex flex-col">
        {/* Logo */}
        <div className="px-4 py-4 border-b border-white/[0.07]">
          <div className="flex items-center gap-2">
            <span className="text-accent font-bold text-lg">TweetLab</span>
            <span className="text-accent text-lg">⚡</span>
          </div>
          <p className="text-[10px] text-[#6b6b72] mt-0.5">tweet uretim asistani</p>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-2 py-3 space-y-0.5">
          {NAV.map((item) => (
            <button
              key={item.id}
              onClick={() => setPage(item.id)}
              className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors ${
                page === item.id
                  ? 'bg-accent/10 text-accent'
                  : 'text-[#6b6b72] hover:text-[#e8e8e0] hover:bg-white/[0.04]'
              }`}
            >
              {item.label}
            </button>
          ))}
        </nav>

        {/* Status indicator */}
        <div className="px-4 py-3 border-t border-white/[0.07]">
          <div className="flex items-center gap-2">
            <div
              className={`w-2 h-2 rounded-full ${
                settings.xquikKey ? 'bg-accent-green' : 'bg-accent-orange'
              }`}
            />
            <span className="text-[11px] text-[#6b6b72]">
              {settings.xquikKey
                ? settings.claudeKey
                  ? 'Tam mod'
                  : 'Radar aktif'
                : 'Key yok'}
            </span>
          </div>
          {settings.claudeKey && (
            <div className="flex items-center gap-2 mt-1">
              <div className="w-2 h-2 rounded-full bg-accent" />
              <span className="text-[11px] text-[#6b6b72]">Claude aktif</span>
            </div>
          )}
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-hidden">
        {page === 'generate' && <Generate />}
        {page === 'history' && <History />}
        {page === 'settings' && <Settings />}
      </main>
    </div>
  );
}
