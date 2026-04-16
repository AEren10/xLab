import { useState, useEffect } from 'react';
import { db } from '../lib/db';
import type { TweetEntry } from '../lib/db';
import { SCORING_CRITERIA } from '../lib/skill';
import { scoreColorSimple as scoreColor } from '../lib/utils';
import { xquikApi } from '../lib/xquik';
import { PageHeader } from '../components/PageHeader';

/**
 * History — Kaydedilen tweetler + reply'lar + feedback loop.
 *
 * Filtreler: Tümü / Tweetler / Reply'lar
 * Reply girişleri: "Yanıt → @handle" bağlamı gösterir
 */

const TYPE_COLORS: Record<string, string> = {
  'Data':     'text-accent bg-accent/10 border-accent/20',
  'Story':    'text-accent-green bg-accent-green/10 border-accent-green/20',
  'Hot Take': 'text-accent-red bg-accent-red/10 border-accent-red/20',
  'Edu':      'text-accent-yellow bg-accent-yellow/10 border-accent-yellow/20',
  'Inspire':  'text-accent bg-accent/10 border-accent/20',
  'Humor':    'text-accent-orange bg-accent-orange/10 border-accent-orange/20',
  'Diğer':    'text-[#6b6b72] bg-white/[0.04] border-white/[0.07]',
};

function EngagementInput({
  label, value, onChange,
}: {
  label: string; value: number; onChange: (v: number) => void;
}) {
  return (
    <div className="flex flex-col items-center gap-0.5">
      <span className="text-[10px] text-[#6b6b72]">{label}</span>
      <input
        type="number" min={0} value={value}
        onChange={(e) => onChange(parseInt(e.target.value) || 0)}
        className="w-14 text-center text-xs bg-elevated border border-white/[0.07] rounded-lg px-1 py-1 text-[#e8e8e0] focus:border-accent/50 transition-colors"
      />
    </div>
  );
}

type FilterType = 'all' | 'tweet' | 'reply';

export function History() {
  const settings = db.getSettings();
  const activeProfileId = settings.activeProfileId || undefined;
  const [allTweets, setAllTweets] = useState<TweetEntry[]>([]);
  const [filter, setFilter] = useState<FilterType>('all');
  const [syncing, setSyncing] = useState(false);
  const [syncMsg, setSyncMsg] = useState('');

  const analytics = db.getAnalytics(activeProfileId);

  useEffect(() => { setAllTweets(db.getTweets(activeProfileId)); }, [activeProfileId]);
  const refresh = () => setAllTweets(db.getTweets(activeProfileId));

  // Filtrelenmiş liste
  const tweets = allTweets.filter((t) => {
    if (filter === 'tweet') return !t.entryType || t.entryType === 'tweet';
    if (filter === 'reply') return t.entryType === 'reply';
    return true;
  });

  const tweetCount = allTweets.filter((t) => !t.entryType || t.entryType === 'tweet').length;
  const replyCount = allTweets.filter((t) => t.entryType === 'reply').length;

  const updateEngagement = (id: number, field: keyof TweetEntry['engagement'], value: number) => {
    const tweet = allTweets.find((t) => t.id === id);
    if (!tweet) return;
    db.updateTweet(id, { engagement: { ...tweet.engagement, [field]: value } });
    refresh();
  };

  const markPosted = (id: number) => {
    db.updateTweet(id, { postedAt: new Date().toISOString() });
    refresh();
  };

  const deleteTweet = (id: number) => {
    db.deleteTweet(id);
    refresh();
  };

  const syncFromX = async () => {
    if (!settings.xquikKey || !settings.twitterUsername) {
      setSyncMsg('Settings\'e xquik API key ve Twitter kullanıcı adı ekle.');
      return;
    }
    setSyncing(true);
    setSyncMsg('X\'ten tweetler çekiliyor...');

    const xTweets = await xquikApi.getUserTweets(settings.xquikKey, settings.twitterUsername, 100);

    if (xTweets.length === 0) {
      setSyncMsg('X\'ten tweet çekilemedi. API key veya kullanıcı adını kontrol et.');
      setSyncing(false);
      return;
    }

    const normalize = (s: string) => s.toLowerCase().replace(/\s+/g, ' ').trim().slice(0, 60);
    const saved = db.getTweets(activeProfileId);
    let updated = 0;

    for (const saved_tweet of saved) {
      const normalSaved = normalize(saved_tweet.text);
      const match = xTweets.find(x => normalize(x.text).startsWith(normalSaved.slice(0, 40)));
      if (match) {
        db.updateTweet(saved_tweet.id, {
          engagement: {
            like: match.likes,
            reply: match.replies,
            rt: match.retweets,
            quote: saved_tweet.engagement.quote,
          },
          xSynced: true,
          postedAt: saved_tweet.postedAt || match.createdAt,
        });
        updated++;
      }
    }

    setSyncMsg(`${updated} tweet güncellendi (${xTweets.length} X tweeti tarandı)`);
    refresh();
    setSyncing(false);
    setTimeout(() => setSyncMsg(''), 4000);
  };

  // Tip analizi — sadece tweetler için
  const typeStats = Object.entries(analytics.byType)
    .sort((a, b) => b[1].avgEng - a[1].avgEng);

  return (
    <div className="page-shell p-3 space-y-3 overflow-y-auto h-full max-w-6xl mx-auto">
      <PageHeader
        kicker="ARŞİV"
        title="Tweet geçmişi ve performans döngüsü"
        subtitle="Kaydedilen tweetleri, reply arşivini ve X verisiyle senkronize edilen performansı tek ekranda gör."
        chips={[
          { label: `Toplam: ${analytics.total}`, tone: 'neutral' },
          { label: `Atılan: ${analytics.posted}`, tone: 'green' },
          { label: `Ort. skor: ${analytics.avgScore}`, tone: 'accent' },
        ]}
        actions={
          <button
            onClick={syncFromX}
            disabled={syncing}
            className="primary-button"
          >
            {syncing ? 'Senkronize...' : "X'ten güncelle"}
          </button>
        }
      />

      {/* ── Üst bar ── */}
      <div className="flex items-start gap-3">
        <div className="grid grid-cols-3 gap-3 flex-1">
          {[
            { label: 'Toplam', value: analytics.total },
            { label: 'Atılan', value: analytics.posted },
            { label: 'Ort. Skor', value: analytics.avgScore },
          ].map((stat) => (
            <div key={stat.label} className="bg-card border border-white/[0.07] rounded-xl p-3 text-center">
              <div className="text-xl font-semibold text-[#e8e8e0]">{stat.value}</div>
              <div className="text-[11px] text-[#6b6b72] mt-0.5">{stat.label}</div>
            </div>
          ))}
        </div>

        <div className="flex flex-col gap-2 shrink-0">
          <button
            onClick={syncFromX}
            disabled={syncing}
            className="flex items-center gap-2 text-xs px-4 py-2.5 rounded-xl bg-accent/10 hover:bg-accent/20 border border-accent/20 text-accent transition-all disabled:opacity-50"
          >
            {syncing ? (
              <span className="w-3 h-3 border border-accent/40 border-t-accent rounded-full animate-spin" />
            ) : '↻'}
            X'ten Güncelle
          </button>
          {syncMsg && (
            <p className="text-[10px] text-[#8b8b96] max-w-[160px] leading-relaxed">{syncMsg}</p>
          )}
        </div>
      </div>

      {/* ── Filtre sekmeler ── */}
      <div className="flex items-center gap-1 p-0.5 bg-white/[0.04] rounded-xl w-fit">
        {([
          { key: 'all',   label: `Tümü (${allTweets.length})` },
          { key: 'tweet', label: `Tweet (${tweetCount})` },
          { key: 'reply', label: `Reply (${replyCount})` },
        ] as { key: FilterType; label: string }[]).map((f) => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            className={`text-xs px-4 py-1.5 rounded-lg transition-all font-medium ${
              filter === f.key
                ? 'bg-accent text-white shadow-lg shadow-accent/20'
                : 'text-[#6b6b72] hover:text-[#e8e8e0]'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* ── Tip Analizi (sadece tweet filtresi aktif değilken / hepsi görünürken) ── */}
      {filter !== 'reply' && typeStats.length > 0 && (
        <div className="bg-card border border-white/[0.07] rounded-xl p-4">
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs font-semibold text-[#e8e8e0]">İçerik Tipi Analizi</p>
            <p className="text-[10px] text-[#4a4a55]">
              Skor = like + reply×5 + rt×2 (Grok ağırlıkları)
            </p>
          </div>
          <div className="space-y-2">
            {typeStats.map(([type, stats]) => {
              const maxEng = typeStats[0][1].avgEng || 1;
              const pct = Math.round((stats.avgEng / maxEng) * 100);
              const colorClass = TYPE_COLORS[type] || TYPE_COLORS['Diğer'];
              return (
                <div key={type} className="flex items-center gap-3">
                  <span className={`text-[9px] px-2 py-0.5 rounded-full border font-medium shrink-0 w-20 text-center ${colorClass}`}>
                    {type}
                  </span>
                  <div className="flex-1 h-1.5 bg-white/[0.05] rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full bg-accent/50 transition-all"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <span className="text-[10px] text-[#8b8b96] shrink-0 w-20 text-right">
                    avg {stats.avgEng} · {stats.count} tweet
                  </span>
                </div>
              );
            })}
          </div>
          <p className="text-[10px] text-[#4a4a55] mt-3 leading-relaxed">
            Bu analiz Claude'un promptuna giriyor — en çok çalışan tip için daha fazla üretim önerisi alırsın.
          </p>
        </div>
      )}

      {tweets.length === 0 && (
        <div className="text-center py-16 text-[#6b6b72] text-sm">
          {filter === 'reply'
            ? 'Arşivlenmiş reply yok. Reply Fırsatları\'nda "Arşivle" butonunu kullan.'
            : 'Henüz kayıtlı tweet yok. Generate\'te "Kaydet" butonuna bas.'
          }
        </div>
      )}

      {/* ── Liste ── */}
      <div className="space-y-3">
        {tweets.map((tweet) => {
          const isReply = tweet.entryType === 'reply';
          const engScore = tweet.engagement.like + tweet.engagement.reply * 5 + tweet.engagement.rt * 2 + tweet.engagement.quote * 3;
          return (
            <div key={tweet.id} className="bg-card border border-white/[0.07] rounded-xl p-4 space-y-3">

              {/* Reply bağlamı */}
              {isReply && tweet.replyTo && (
                <div className="flex items-start gap-2 px-2.5 py-2 bg-white/[0.03] border border-white/[0.05] rounded-lg">
                  <span className="text-[10px] text-accent/60 shrink-0 mt-0.5">↩ Yanıt →</span>
                  <div className="flex-1 min-w-0">
                    <span className="text-[10px] font-medium text-accent/80">@{tweet.replyTo.handle}</span>
                    <p className="text-[10px] text-[#4a4a55] leading-relaxed truncate mt-0.5">
                      {tweet.replyTo.text}
                    </p>
                  </div>
                  <a
                    href={`https://x.com/i/web/status/${tweet.replyTo.tweetId}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[9px] text-accent/40 hover:text-accent/70 shrink-0 transition-colors"
                  >
                    ↗
                  </a>
                </div>
              )}

              {/* Header */}
              <div className="flex items-start justify-between gap-2">
                <p className="text-sm text-[#e8e8e0] leading-relaxed whitespace-pre-wrap flex-1">
                  {tweet.text}
                </p>
                {tweet.score > 0 && (
                  <span className={`text-xs font-semibold px-2 py-0.5 rounded-full shrink-0 ${scoreColor(tweet.score)}`}>
                    {tweet.score}
                  </span>
                )}
              </div>

              {/* Meta */}
              <div className="flex flex-wrap gap-2 text-[11px] text-[#6b6b72]">
                {isReply && (
                  <span className="text-[9px] px-2 py-0.5 rounded-full border font-medium text-accent/70 bg-accent/[0.06] border-accent/20">
                    Reply
                  </span>
                )}
                {tweet.impressionType && (
                  <span className={`text-[9px] px-2 py-0.5 rounded-full border font-medium ${TYPE_COLORS[tweet.impressionType] || TYPE_COLORS['Diğer']}`}>
                    {tweet.impressionType}
                  </span>
                )}
                {!isReply && <span>{tweet.persona}</span>}
                <span className="truncate max-w-[120px]">{tweet.topic}</span>
                <span>{new Date(tweet.createdAt).toLocaleDateString('tr-TR')}</span>
                {tweet.postedAt && <span className="text-accent-green">Atıldı</span>}
                {tweet.xSynced && <span className="text-accent/70">✓ X verisi</span>}
                {tweet.xquikScore !== undefined && (
                  <span className={`text-[9px] px-1.5 py-0.5 rounded-full border font-medium ${
                    tweet.xquikScore >= 75 ? 'text-accent-green border-accent-green/20 bg-accent-green/10' :
                    tweet.xquikScore >= 50 ? 'text-accent-yellow border-accent-yellow/20 bg-accent-yellow/10' :
                    'text-accent-red border-accent-red/20 bg-accent-red/10'
                  }`}>
                    Grok {tweet.xquikScore}
                  </span>
                )}
              </div>

              {/* Score bars — sadece tweetler için */}
              {!isReply && tweet.scores && Object.keys(tweet.scores).length > 0 && (
                <div className="grid grid-cols-3 gap-x-4 gap-y-1.5">
                  {Object.entries(SCORING_CRITERIA).map(([key, crit]) => {
                    const val = tweet.scores?.[key] ?? 0;
                    const pct = Math.round((val / crit.weight) * 100);
                    return (
                      <div key={key} className="flex items-center gap-1.5">
                        <span className="text-[10px] text-[#6b6b72] w-20 shrink-0 truncate">{crit.label}</span>
                        <div className="flex-1 h-1 bg-white/[0.06] rounded-full overflow-hidden">
                          <div className="h-full bg-accent/60 rounded-full" style={{ width: `${pct}%` }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Engagement */}
              <div className="flex items-center gap-3 pt-1 border-t border-white/[0.05]">
                <span className="text-[11px] text-[#6b6b72]">Engagement:</span>
                {tweet.xSynced ? (
                  <div className="flex gap-4 text-[11px]">
                    {(['like', 'reply', 'rt'] as const).map(f => (
                      <span key={f} className="text-[#8b8b96]">
                        <span className="text-[#6b6b72]">{f} </span>{tweet.engagement[f]}
                      </span>
                    ))}
                    <span className="text-[10px] text-accent/50 ml-1">← X'ten</span>
                  </div>
                ) : (
                  <div className="flex items-center gap-3">
                    {(['like', 'reply', 'rt', 'quote'] as const).map((field) => (
                      <EngagementInput
                        key={field} label={field}
                        value={tweet.engagement[field]}
                        onChange={(v) => updateEngagement(tweet.id, field, v)}
                      />
                    ))}
                  </div>
                )}
                {engScore > 0 && (
                  <span className={`ml-auto text-[11px] font-semibold ${engScore >= 50 ? 'text-accent-green' : engScore >= 20 ? 'text-accent-yellow' : 'text-[#6b6b72]'}`}>
                    algo: {engScore}
                  </span>
                )}
              </div>

              {/* Actions */}
              <div className="flex gap-2">
                {!tweet.postedAt && (
                  <button
                    onClick={() => markPosted(tweet.id)}
                    className="text-xs px-3 py-1.5 rounded-lg bg-accent-green/10 hover:bg-accent-green/20 text-accent-green transition-colors"
                  >
                    Atıldı
                  </button>
                )}
                <button
                  onClick={() => navigator.clipboard.writeText(tweet.text)}
                  className="text-xs px-3 py-1.5 rounded-lg bg-white/[0.05] hover:bg-white/[0.09] text-[#e8e8e0] transition-colors"
                >
                  Kopyala
                </button>
                <button
                  onClick={() => deleteTweet(tweet.id)}
                  className="text-xs px-3 py-1.5 rounded-lg bg-accent-red/10 hover:bg-accent-red/20 text-accent-red transition-colors ml-auto"
                >
                  Sil
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
