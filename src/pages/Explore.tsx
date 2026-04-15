/**
 * Keşfet — xquik Starter $20/ay özelliklerini tam kullanan merkez panel.
 * Tabs: Trendler | Timeline | Style Analizi | İzlemeler
 */
import { useState, useEffect } from 'react';
import { db } from '../lib/db';
import { xquikApi } from '../lib/xquik';
import type { TrendItem, TweetSearchResult, StylePerformance, Monitor, UserProfile } from '../lib/xquik';
import type { ExternalTrends } from '../lib/xquik';
import { RadarPanel } from '../components/RadarPanel';
import { ExternalTrendsPanel } from '../components/ExternalTrendsPanel';
import { PageHeader } from '../components/PageHeader';

type Tab = 'trends' | 'timeline' | 'style' | 'monitors' | 'draws';

const MONITOR_EVENT_TYPES = [
  { id: 'tweet.new',     label: 'Yeni Tweet' },
  { id: 'tweet.reply',   label: 'Reply' },
  { id: 'tweet.quote',   label: 'Quote' },
  { id: 'tweet.retweet', label: 'Retweet' },
  { id: 'follower.gained', label: 'Yeni Takipçi' },
  { id: 'follower.lost',   label: 'Takipçi Kaybı' },
];

function fmtNum(n?: number) {
  if (!n) return '0';
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

function timeAgo(iso: string) {
  if (!iso) return '';
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'az önce';
  if (m < 60) return `${m}d`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}s`;
  return `${Math.floor(h / 24)}g`;
}

// ─── Trendler Tab ─────────────────────────────────────────────────────────────

function TrendsTab({ apiKey }: { apiKey: string }) {
  const [trends, setTrends] = useState<TrendItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);
  const [externalTrends, setExternalTrends] = useState<ExternalTrends>({
    reddit: [],
    hackernews: [],
    google: [],
  });
  const [externalLoading, setExternalLoading] = useState(false);

  useEffect(() => {
    if (!apiKey) return;
    setLoading(true);
    xquikApi.getTrends(apiKey, 30).then((data) => {
      setTrends(data);
      setLoading(false);
    });
  }, [apiKey]);

  useEffect(() => {
    if (!apiKey) return;
    setExternalLoading(true);
    xquikApi.getExternalTrends(apiKey).then((data) => {
      setExternalTrends(data);
      setExternalLoading(false);
    });
  }, [apiKey]);

  const copyTrend = async (name: string) => {
    await navigator.clipboard.writeText(name);
    setCopied(name);
    setTimeout(() => setCopied(null), 1500);
  };

  if (!apiKey) return <NoKey />;

  return (
    <div className="space-y-4">
      {copied && (
        <div className="text-[10px] text-accent-green bg-accent-green/[0.06] border border-accent-green/20 rounded-xl px-3 py-2">
          Kopyalandı: <span className="font-medium text-[#e8e8e0]">{copied}</span>
        </div>
      )}

      <div className="grid gap-3 xl:grid-cols-[1.05fr_0.95fr]">
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-sm font-semibold text-[#e8e8e0]">X Radar Başlıkları</h2>
              <p className="text-[11px] text-[#6b6b72] mt-0.5">
                xquik'in radarından gelen ham konu başlıkları. Bağlamı daraltmak için seç.
              </p>
            </div>
            <span className="text-[10px] text-[#4a4a55] bg-white/[0.03] px-2 py-1 rounded-full border border-white/[0.06]">
              xquik
            </span>
          </div>
          <RadarPanel apiKey={apiKey} onSelect={copyTrend} featured />
        </div>

        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-sm font-semibold text-[#e8e8e0]">Dünya Gündemi</h2>
              <p className="text-[11px] text-[#6b6b72] mt-0.5">
                Reddit, HN ve Google sıcaklıkları. Geniş bağlam almak için iyi.
              </p>
            </div>
            <span className="text-[10px] text-[#4a4a55] bg-white/[0.03] px-2 py-1 rounded-full border border-white/[0.06]">
              3 kaynak
            </span>
          </div>
          {externalLoading ? (
            <LoadingSpinner label="Dünya gündemi yükleniyor..." />
          ) : (
            <ExternalTrendsPanel
              trends={externalTrends}
              onSelect={copyTrend}
              defaultOpen
              featured
            />
          )}
        </div>
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-sm font-semibold text-[#e8e8e0]">X Trendleri</h2>
            <p className="text-[11px] text-[#6b6b72] mt-0.5">Şu an X'te gündemde olan resmi trend başlıkları.</p>
          </div>
          {!loading && trends.length > 0 && (
            <span className="text-[10px] text-[#4a4a55] bg-white/[0.03] px-2 py-1 rounded-full border border-white/[0.06]">
              {trends.length} trend
            </span>
          )}
        </div>

        {loading ? (
          <LoadingSpinner label="Trendler yükleniyor..." />
        ) : trends.length === 0 ? (
          <EmptyState
            icon="📡"
            title="Trend verisi yok"
            sub="xquik'ten trend çekilemedi. Hesabın bağlı mı kontrol et."
          />
        ) : (
          <div className="grid gap-1.5">
            {trends.map((trend, i) => (
              <button
                key={i}
                onClick={() => copyTrend(trend.name)}
                className="w-full text-left group flex items-start gap-3 px-3.5 py-3 rounded-xl bg-white/[0.02] border border-white/[0.05] hover:bg-white/[0.05] hover:border-accent/20 transition-all"
              >
                <span className="text-[11px] text-[#4a4a55] w-6 shrink-0 pt-0.5 text-right font-mono">
                  {trend.rank ?? i + 1}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-[#e8e8e0] group-hover:text-accent transition-colors truncate">
                    {trend.name}
                  </p>
                  {trend.description && (
                    <p className="text-[10px] text-[#6b6b72] mt-0.5 truncate">{trend.description}</p>
                  )}
                </div>
                <span className="text-[10px] text-[#4a4a55] group-hover:text-accent/60 transition-colors shrink-0 mt-0.5">
                  {copied === trend.name ? '✓ kopyalandı' : 'kopyala →'}
                </span>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Timeline Tab ─────────────────────────────────────────────────────────────

function TimelineTab({ apiKey }: { apiKey: string }) {
  const [tweets, setTweets] = useState<TweetSearchResult[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!apiKey) return;
    setLoading(true);
    xquikApi.getTimeline(apiKey).then((data) => {
      setTweets(data);
      setLoading(false);
    });
  }, [apiKey]);

  if (!apiKey) return <NoKey />;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-sm font-semibold text-[#e8e8e0]">Ana Sayfa Timeline</h2>
          <p className="text-[11px] text-[#6b6b72] mt-0.5">Bağlı hesabının güncel akışı</p>
        </div>
        <button
          onClick={() => {
            setLoading(true);
            xquikApi.getTimeline(apiKey).then((data) => {
              setTweets(data);
              setLoading(false);
            });
          }}
          className="text-[10px] text-[#4a4a55] hover:text-accent transition-colors px-2 py-1 rounded-lg hover:bg-accent/[0.06]"
        >
          yenile
        </button>
      </div>

      {loading ? (
        <LoadingSpinner label="Timeline yükleniyor..." />
      ) : tweets.length === 0 ? (
        <EmptyState
          icon="🌊"
          title="Timeline boş"
          sub="xquik hesabına X hesabının bağlı olması gerekiyor."
        />
      ) : (
        <div className="space-y-2">
          {tweets.map((t) => (
            <TweetRow key={t.id} tweet={t} />
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Style Analizi Tab ───────────────────────────────────────────────────────

function StyleTab({ apiKey }: { apiKey: string }) {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [performance, setPerformance] = useState<StylePerformance | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const username = db.getActiveProfile().twitterUsername;

  useEffect(() => {
    if (!apiKey || !username) return;
    setLoading(true);
    setError('');
    Promise.all([
      xquikApi.getUserProfile(apiKey, username),
      xquikApi.getStylePerformance(apiKey, username),
    ]).then(([prof, perf]) => {
      setProfile(prof);
      setPerformance(perf);
      if (!perf) setError('Style analizi verisi bulunamadı. xquik panelinden önce stil analizi yaptırman gerekiyor.');
      setLoading(false);
    });
  }, [apiKey, username]);

  if (!apiKey) return <NoKey />;

  if (!username) return (
    <EmptyState
      icon="👤"
      title="Twitter kullanıcı adı gerekli"
      sub="Ayarlar > Hesap Profili bölümünden Twitter kullanıcı adını ekle."
    />
  );

  return (
    <div className="space-y-4">
      {/* Profil başlığı */}
      {profile && (
        <div className="flex items-start gap-3 p-3.5 rounded-xl bg-white/[0.02] border border-white/[0.06]">
          <div className="w-10 h-10 rounded-full bg-accent/10 flex items-center justify-center text-accent font-semibold text-sm shrink-0">
            {profile.name?.[0] || '@'}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-[#e8e8e0]">{profile.name || username}</p>
            <p className="text-[11px] text-[#6b6b72]">@{profile.username}</p>
            {profile.description && (
              <p className="text-[10px] text-[#8b8b96] mt-1 leading-relaxed line-clamp-2">{profile.description}</p>
            )}
            <div className="flex gap-4 mt-2">
              <div>
                <span className="text-xs font-semibold text-[#e8e8e0]">{fmtNum(profile.followers)}</span>
                <span className="text-[10px] text-[#6b6b72] ml-1">takipçi</span>
              </div>
              <div>
                <span className="text-xs font-semibold text-[#e8e8e0]">{fmtNum(profile.following)}</span>
                <span className="text-[10px] text-[#6b6b72] ml-1">takip</span>
              </div>
            </div>
          </div>
          {profile.verified && (
            <span className="text-[10px] text-accent bg-accent/[0.08] px-2 py-0.5 rounded-full border border-accent/20 shrink-0">
              ✓ Premium
            </span>
          )}
        </div>
      )}

      {loading ? (
        <LoadingSpinner label="Style analizi yükleniyor..." />
      ) : error ? (
        <EmptyState icon="📊" title="Veri yok" sub={error} />
      ) : performance && performance.tweets.length > 0 ? (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-semibold text-[#e8e8e0]">En İyi Performans Gösteren Tweetler</h3>
            <span className="text-[10px] text-[#4a4a55]">{performance.tweetCount} tweet analiz edildi</span>
          </div>

          {/* Özet metrikler */}
          {performance.tweets.length > 0 && (() => {
            const tweets = performance.tweets;
            const avgLike = Math.round(tweets.reduce((a, t) => a + t.likeCount, 0) / tweets.length);
            const avgRT = Math.round(tweets.reduce((a, t) => a + t.retweetCount, 0) / tweets.length);
            const topTweet = [...tweets].sort((a, b) => b.likeCount - a.likeCount)[0];
            return (
              <div className="grid grid-cols-3 gap-2">
                <MetricCard label="Ort. Like" value={fmtNum(avgLike)} />
                <MetricCard label="Ort. RT" value={fmtNum(avgRT)} />
                <MetricCard label="En İyi" value={fmtNum(topTweet?.likeCount)} sub="like" />
              </div>
            );
          })()}

          {/* Tweet listesi */}
          <div className="space-y-2">
            {[...performance.tweets]
              .sort((a, b) => b.likeCount - a.likeCount)
              .slice(0, 10)
              .map((tweet, i) => (
                <div key={tweet.id || i} className="p-3 rounded-xl bg-white/[0.02] border border-white/[0.05] space-y-2">
                  <p className="text-[11px] text-[#e8e8e0] leading-relaxed line-clamp-3">{tweet.text}</p>
                  <div className="flex items-center gap-3">
                    <EngBadge icon="♥" value={tweet.likeCount} color="text-rose-400" />
                    <EngBadge icon="↩" value={tweet.replyCount} color="text-accent" />
                    <EngBadge icon="↺" value={tweet.retweetCount} color="text-accent-green" />
                    {tweet.viewCount ? <EngBadge icon="👁" value={tweet.viewCount} color="text-[#6b6b72]" /> : null}
                    {tweet.bookmarkCount ? <EngBadge icon="🔖" value={tweet.bookmarkCount} color="text-accent-yellow" /> : null}
                    {tweet.createdAt && (
                      <span className="ml-auto text-[9px] text-[#4a4a55]">{timeAgo(tweet.createdAt)}</span>
                    )}
                  </div>
                </div>
              ))}
          </div>
        </div>
      ) : !loading && !profile ? (
        <LoadingSpinner label="Profil yükleniyor..." />
      ) : null}
    </div>
  );
}

// ─── Monitors Tab ─────────────────────────────────────────────────────────────

function MonitorsTab({ apiKey }: { apiKey: string }) {
  const [monitors, setMonitors] = useState<Monitor[]>([]);
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newUsername, setNewUsername] = useState('');
  const [selectedTypes, setSelectedTypes] = useState<string[]>(['tweet.new']);
  const [showForm, setShowForm] = useState(false);

  useEffect(() => {
    if (!apiKey) return;
    setLoading(true);
    xquikApi.getMonitors(apiKey).then((data) => {
      setMonitors(data);
      setLoading(false);
    });
  }, [apiKey]);

  const handleCreate = async () => {
    if (!newUsername.trim() || selectedTypes.length === 0) return;
    setCreating(true);
    const result = await xquikApi.createMonitor(apiKey, newUsername.trim(), selectedTypes);
    if (result) {
      setMonitors((prev) => [result, ...prev]);
      setNewUsername('');
      setSelectedTypes(['tweet.new']);
      setShowForm(false);
    }
    setCreating(false);
  };

  const handleDelete = async (id: string) => {
    const ok = await xquikApi.deleteMonitor(apiKey, id);
    if (ok) setMonitors((prev) => prev.filter((m) => m.id !== id));
  };

  const toggleType = (type: string) => {
    setSelectedTypes((prev) =>
      prev.includes(type) ? prev.filter((t) => t !== type) : [...prev, type]
    );
  };

  if (!apiKey) return <NoKey />;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-sm font-semibold text-[#e8e8e0]">İzlemeler</h2>
          <p className="text-[11px] text-[#6b6b72] mt-0.5">Hesap & keyword izle, olayları takip et</p>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className="text-[10px] px-3 py-1.5 rounded-lg bg-accent/[0.1] text-accent hover:bg-accent/[0.18] transition-colors border border-accent/20"
        >
          + Yeni İzleme
        </button>
      </div>

      {/* Create form */}
      {showForm && (
        <div className="p-3.5 rounded-xl bg-white/[0.03] border border-white/[0.08] space-y-3">
          <p className="text-[11px] font-medium text-[#e8e8e0]">Yeni İzleme Oluştur</p>
          <input
            type="text"
            value={newUsername}
            onChange={(e) => setNewUsername(e.target.value)}
            placeholder="@kullanici veya kelime"
            className="w-full bg-white/[0.04] border border-white/[0.1] rounded-lg px-3 py-2 text-xs text-[#e8e8e0] placeholder-[#4a4a55] focus:outline-none focus:border-accent/40"
          />
          <div className="grid grid-cols-2 gap-1.5">
            {MONITOR_EVENT_TYPES.map((et) => (
              <button
                key={et.id}
                onClick={() => toggleType(et.id)}
                className={`text-left px-2.5 py-1.5 rounded-lg text-[10px] border transition-all ${
                  selectedTypes.includes(et.id)
                    ? 'bg-accent/[0.1] border-accent/30 text-accent'
                    : 'bg-white/[0.02] border-white/[0.06] text-[#6b6b72] hover:border-white/[0.12]'
                }`}
              >
                {et.label}
              </button>
            ))}
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleCreate}
              disabled={creating || !newUsername.trim() || selectedTypes.length === 0}
              className="flex-1 text-xs py-1.5 rounded-lg bg-accent/[0.12] text-accent hover:bg-accent/[0.2] disabled:opacity-40 transition-colors"
            >
              {creating ? 'Oluşturuluyor...' : 'İzlemeye Başla'}
            </button>
            <button
              onClick={() => setShowForm(false)}
              className="px-3 text-xs py-1.5 rounded-lg bg-white/[0.04] text-[#6b6b72] hover:bg-white/[0.08] transition-colors"
            >
              İptal
            </button>
          </div>
        </div>
      )}

      {loading ? (
        <LoadingSpinner label="İzlemeler yükleniyor..." />
      ) : monitors.length === 0 ? (
        <EmptyState
          icon="📡"
          title="İzleme yok"
          sub="Bir hesap veya anahtar kelime için izleme başlat. Yeni tweet, reply, takipçi değişimlerini takip et."
        />
      ) : (
        <div className="space-y-2">
          {monitors.map((m) => (
            <div
              key={m.id}
              className={`flex items-start gap-3 p-3 rounded-xl border transition-all ${
                m.isActive
                  ? 'bg-white/[0.02] border-white/[0.06]'
                  : 'bg-white/[0.01] border-white/[0.04] opacity-60'
              }`}
            >
              <div className={`w-1.5 h-1.5 rounded-full mt-1.5 shrink-0 ${m.isActive ? 'bg-accent-green' : 'bg-[#4a4a55]'}`} />
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-[#e8e8e0]">@{m.xUsername}</p>
                <div className="flex flex-wrap gap-1 mt-1">
                  {m.eventTypes.map((et) => (
                    <span key={et} className="text-[9px] px-1.5 py-0.5 rounded-full bg-white/[0.04] text-[#6b6b72] border border-white/[0.07]">
                      {MONITOR_EVENT_TYPES.find((e) => e.id === et)?.label || et}
                    </span>
                  ))}
                </div>
                <p className="text-[9px] text-[#4a4a55] mt-1">{timeAgo(m.createdAt)}</p>
              </div>
              <button
                onClick={() => handleDelete(m.id)}
                className="text-[10px] text-[#4a4a55] hover:text-accent-red transition-colors px-2 py-1 rounded-lg hover:bg-accent-red/[0.06]"
              >
                sil
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Çekiliş (Giveaway Draws) Tab ────────────────────────────────────────────

interface DrawWinner {
  position: number;
  authorUsername: string;
  tweetId: string;
  isBackup: boolean;
}

interface DrawResult {
  id: string;
  tweetUrl: string;
  totalEntries: number;
  validEntries: number;
  winners: DrawWinner[];
}

function DrawsTab({ apiKey }: { apiKey: string }) {
  const [tweetUrl, setTweetUrl] = useState('');
  const [winnerCount, setWinnerCount] = useState(1);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<DrawResult | null>(null);
  const [error, setError] = useState('');
  const [history, setHistory] = useState<DrawResult[]>([]);

  const handleDraw = async () => {
    if (!tweetUrl.trim() || loading) return;
    setLoading(true);
    setError('');
    setResult(null);
    try {
      const res = await fetch('https://xquik.com/api/v1/draws', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey },
        body: JSON.stringify({ tweetUrl: tweetUrl.trim(), winnerCount }),
      });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        setError(errData.error || `Hata: ${res.status}`);
      } else {
        const data = await res.json();
        const draw: DrawResult = {
          id: data.id || '',
          tweetUrl: tweetUrl.trim(),
          totalEntries: data.totalEntries || 0,
          validEntries: data.validEntries || 0,
          winners: data.winners || [],
        };
        setResult(draw);
        setHistory((prev) => [draw, ...prev.slice(0, 4)]);
        setTweetUrl('');
      }
    } catch {
      setError('Bağlantı hatası. Tekrar dene.');
    }
    setLoading(false);
  };

  if (!apiKey) return <NoKey />;

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-sm font-semibold text-[#e8e8e0]">Çekiliş Aracı</h2>
        <p className="text-[11px] text-[#6b6b72] mt-0.5">
          "RT + takip et" tweetindeki katılımcılar arasından kazanan çek
        </p>
      </div>

      {/* Bilgi kutusu */}
      <div className="p-3 rounded-xl bg-accent/[0.05] border border-accent/20 space-y-1">
        <p className="text-[10px] text-accent font-medium">Nasıl çalışır?</p>
        <p className="text-[10px] text-[#8b8b96] leading-relaxed">
          "Takip et + RT'le kazanmak için!" gibi bir tweet at. Çekiliş bitince tweet URL'ini yapıştır,
          xquik RT eden katılımcılar arasından rastgele kazananı seçer.
          Gleam veya Retweet Picker'a gerek yok.
        </p>
      </div>

      {/* Form */}
      <div className="space-y-3 p-3.5 rounded-xl bg-white/[0.02] border border-white/[0.06]">
        <div className="space-y-1.5">
          <label className="text-[10px] text-[#6b6b72] font-medium">Tweet URL</label>
          <input
            type="text"
            value={tweetUrl}
            onChange={(e) => setTweetUrl(e.target.value)}
            placeholder="https://x.com/kullanici/status/1234567890"
            className="w-full bg-white/[0.04] border border-white/[0.1] rounded-lg px-3 py-2 text-xs text-[#e8e8e0] placeholder-[#4a4a55] focus:outline-none focus:border-accent/40"
          />
        </div>
        <div className="space-y-1.5">
          <label className="text-[10px] text-[#6b6b72] font-medium">Kazanan Sayısı</label>
          <div className="flex gap-1.5">
            {[1, 2, 3, 5, 10].map((n) => (
              <button
                key={n}
                onClick={() => setWinnerCount(n)}
                className={`px-3 py-1.5 rounded-lg text-[10px] border transition-all ${
                  winnerCount === n
                    ? 'bg-accent/[0.12] border-accent/30 text-accent'
                    : 'bg-white/[0.02] border-white/[0.08] text-[#6b6b72] hover:border-white/[0.15]'
                }`}
              >
                {n}
              </button>
            ))}
          </div>
        </div>
        <button
          onClick={handleDraw}
          disabled={loading || !tweetUrl.trim()}
          className="w-full py-2 rounded-xl bg-accent/[0.12] text-accent text-xs font-medium hover:bg-accent/[0.2] disabled:opacity-40 transition-colors border border-accent/20"
        >
          {loading ? (
            <span className="flex items-center justify-center gap-2">
              <span className="w-3 h-3 border border-accent/40 border-t-accent rounded-full animate-spin" />
              Katılımcılar çekiliyor...
            </span>
          ) : '🎁 Kazananı Çek'}
        </button>
        {error && (
          <p className="text-[10px] text-accent-red text-center">{error}</p>
        )}
      </div>

      {/* Sonuç */}
      {result && (
        <div className="p-3.5 rounded-xl bg-accent-green/[0.05] border border-accent-green/20 space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold text-accent-green">🎉 Çekiliş Tamamlandı!</p>
            <div className="text-right">
              <p className="text-[10px] text-[#6b6b72]">
                <span className="text-[#e8e8e0] font-medium">{result.validEntries}</span> geçerli katılım
              </p>
              <p className="text-[9px] text-[#4a4a55]">{result.totalEntries} toplam</p>
            </div>
          </div>
          <div className="space-y-2">
            {result.winners.map((w) => (
              <div
                key={w.position}
                className={`flex items-center gap-3 p-2.5 rounded-lg border ${
                  w.isBackup
                    ? 'bg-white/[0.02] border-white/[0.06] opacity-70'
                    : 'bg-accent-green/[0.06] border-accent-green/20'
                }`}
              >
                <span className={`text-base shrink-0 ${w.isBackup ? '' : ''}`}>
                  {w.position === 1 ? '🥇' : w.position === 2 ? '🥈' : w.position === 3 ? '🥉' : `#${w.position}`}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-[#e8e8e0]">@{w.authorUsername}</p>
                  {w.isBackup && <p className="text-[9px] text-[#4a4a55]">yedek kazanan</p>}
                </div>
                <a
                  href={`https://x.com/${w.authorUsername}`}
                  target="_blank"
                  rel="noreferrer"
                  className="text-[9px] text-accent hover:text-accent/70 transition-colors"
                >
                  profil →
                </a>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Geçmiş çekilişler */}
      {history.length > 1 && (
        <div className="space-y-2">
          <p className="text-[10px] text-[#4a4a55] font-medium">Önceki Çekilişler</p>
          {history.slice(1).map((draw, i) => (
            <div key={i} className="flex items-center gap-2 px-3 py-2 rounded-lg bg-white/[0.02] border border-white/[0.05]">
              <span className="text-[10px] text-[#6b6b72] flex-1 truncate">{draw.tweetUrl}</span>
              <span className="text-[9px] text-[#4a4a55] shrink-0">{draw.winners.length} kazanan</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Shared Components ────────────────────────────────────────────────────────

function TweetRow({ tweet }: { tweet: TweetSearchResult }) {
  return (
    <div className="group p-3 rounded-xl bg-white/[0.02] border border-white/[0.05] hover:border-white/[0.1] transition-all space-y-2">
      <div className="flex items-center gap-2">
        <span className="w-6 h-6 rounded-full bg-accent/10 flex items-center justify-center text-[10px] text-accent font-semibold shrink-0">
          {(tweet.author?.[0] || '?').toUpperCase()}
        </span>
        <div className="flex-1 min-w-0">
          <span className="text-[11px] font-medium text-[#e8e8e0] truncate">{tweet.author}</span>
          {tweet.authorHandle && (
            <span className="text-[10px] text-[#4a4a55] ml-1">@{tweet.authorHandle}</span>
          )}
        </div>
        <span className="text-[9px] text-[#4a4a55] shrink-0">{timeAgo(tweet.createdAt)}</span>
      </div>
      <p className="text-[11px] text-[#8b8b96] leading-relaxed line-clamp-3">{tweet.text}</p>
      <div className="flex items-center gap-3">
        <EngBadge icon="♥" value={tweet.likes} color="text-rose-400" />
        <EngBadge icon="↩" value={tweet.replies} color="text-accent" />
        <EngBadge icon="↺" value={tweet.retweets} color="text-accent-green" />
        {tweet.views ? <EngBadge icon="👁" value={tweet.views} color="text-[#6b6b72]" /> : null}
        <a
          href={tweet.url}
          target="_blank"
          rel="noreferrer"
          className="ml-auto text-[9px] text-[#4a4a55] hover:text-accent transition-colors"
        >
          aç →
        </a>
      </div>
    </div>
  );
}

function EngBadge({ icon, value, color }: { icon: string; value: number; color: string }) {
  return (
    <span className={`flex items-center gap-1 text-[9px] ${color}`}>
      <span>{icon}</span>
      <span>{fmtNum(value)}</span>
    </span>
  );
}

function MetricCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="p-2.5 rounded-xl bg-white/[0.03] border border-white/[0.06] text-center">
      <p className="text-base font-semibold text-[#e8e8e0]">{value}</p>
      {sub && <p className="text-[9px] text-[#4a4a55]">{sub}</p>}
      <p className="text-[9px] text-[#6b6b72] mt-0.5">{label}</p>
    </div>
  );
}

function LoadingSpinner({ label }: { label: string }) {
  return (
    <div className="flex items-center justify-center gap-2 py-12 text-[#4a4a55]">
      <span className="w-4 h-4 border border-[#4a4a55] border-t-accent rounded-full animate-spin" />
      <span className="text-xs">{label}</span>
    </div>
  );
}

function EmptyState({ icon, title, sub }: { icon: string; title: string; sub: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-12 gap-2 text-center">
      <span className="text-2xl">{icon}</span>
      <p className="text-sm font-medium text-[#6b6b72]">{title}</p>
      <p className="text-[11px] text-[#4a4a55] max-w-xs leading-relaxed">{sub}</p>
    </div>
  );
}

function NoKey() {
  return (
    <EmptyState
      icon="🔑"
      title="xquik API key gerekli"
      sub="Ayarlar sayfasından xquik API key'ini ekle. $20/ay Starter planda bu özellikler dahil."
    />
  );
}

// ─── Ana sayfa ────────────────────────────────────────────────────────────────

const TABS: { id: Tab; label: string; icon: string }[] = [
  { id: 'trends',   label: 'Keşif',        icon: '🧭' },
  { id: 'timeline', label: 'Timeline',      icon: '🌊' },
  { id: 'style',    label: 'Style',         icon: '📊' },
  { id: 'monitors', label: 'İzlemeler',     icon: '📡' },
  { id: 'draws',    label: 'Çekiliş',       icon: '🎁' },
];

export function Explore() {
  const [tab, setTab] = useState<Tab>('trends');
  const settings = db.getSettings();
  const apiKey = settings.xquikKey;

  return (
    <div className="page-shell flex h-full flex-col gap-3 p-3 overflow-hidden">
      <PageHeader
        kicker="KEŞFET"
        title="Gündem, radar ve araçlar"
        subtitle="X radar başlıkları, dünya gündemi ve izleme araçlarını tek merkezde kullan."
        chips={[
          { label: apiKey ? 'xquik aktif' : 'xquik kapalı', tone: apiKey ? 'green' : 'orange' },
          { label: 'Radar', tone: 'neutral' },
          { label: 'Dünya', tone: 'neutral' },
          { label: 'Araçlar', tone: 'accent' },
        ]}
      />

      {/* Tabs */}
      <div className="premium-panel px-3 pt-2 pb-0 shrink-0">
        <div className="flex gap-0.5 border-b border-white/[0.06]">
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`flex items-center gap-1.5 px-3.5 py-2.5 text-[11px] font-medium border-b-2 transition-all -mb-px ${
                tab === t.id
                  ? 'border-accent text-accent bg-white/[0.03]'
                  : 'border-transparent text-[#6b6b72] hover:text-[#e8e8e0]'
              }`}
            >
              <span>{t.icon}</span>
              <span>{t.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-6 py-4">
        {tab === 'trends'   && <TrendsTab   apiKey={apiKey} />}
        {tab === 'timeline' && <TimelineTab apiKey={apiKey} />}
        {tab === 'style'    && <StyleTab    apiKey={apiKey} />}
        {tab === 'monitors' && <MonitorsTab apiKey={apiKey} />}
        {tab === 'draws'    && <DrawsTab    apiKey={apiKey} />}
      </div>
    </div>
  );
}
