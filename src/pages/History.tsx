import { useState, useEffect } from 'react';
import { db } from '../lib/db';
import type { TweetEntry } from '../lib/db';
import { SCORING_CRITERIA } from '../lib/skill';
import { scoreColorSimple as scoreColor } from '../lib/utils';

function EngagementInput({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <div className="flex flex-col items-center gap-0.5">
      <span className="text-[10px] text-[#6b6b72]">{label}</span>
      <input
        type="number"
        min={0}
        value={value}
        onChange={(e) => onChange(parseInt(e.target.value) || 0)}
        className="w-14 text-center text-xs bg-elevated border border-white/[0.07] rounded-lg px-1 py-1 text-[#e8e8e0] focus:border-accent/50 transition-colors"
      />
    </div>
  );
}

export function History() {
  const [tweets, setTweets] = useState<TweetEntry[]>([]);
  const analytics = db.getAnalytics();

  useEffect(() => {
    setTweets(db.getTweets());
  }, []);

  const refresh = () => setTweets(db.getTweets());

  const updateEngagement = (
    id: number,
    field: keyof TweetEntry['engagement'],
    value: number
  ) => {
    const tweet = tweets.find((t) => t.id === id);
    if (!tweet) return;
    const engagement = { ...tweet.engagement, [field]: value };
    db.updateTweet(id, { engagement });
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

  return (
    <div className="p-4 space-y-4 overflow-y-auto h-full">
      {/* Analytics bar */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: 'Toplam', value: analytics.total },
          { label: 'Atilan', value: analytics.posted },
          { label: 'Ort. Skor', value: analytics.avgScore },
        ].map((stat) => (
          <div
            key={stat.label}
            className="bg-card border border-white/[0.07] rounded-xl p-3 text-center"
          >
            <div className="text-xl font-semibold text-[#e8e8e0]">
              {stat.value}
            </div>
            <div className="text-[11px] text-[#6b6b72] mt-0.5">{stat.label}</div>
          </div>
        ))}
      </div>

      {tweets.length === 0 && (
        <div className="text-center py-16 text-[#6b6b72] text-sm">
          Henuz kayitli tweet yok.
        </div>
      )}

      {/* Tweet list */}
      <div className="space-y-3">
        {tweets.map((tweet) => (
          <div
            key={tweet.id}
            className="bg-card border border-white/[0.07] rounded-xl p-4 space-y-3"
          >
            {/* Header */}
            <div className="flex items-start justify-between gap-2">
              <p className="text-sm text-[#e8e8e0] leading-relaxed whitespace-pre-wrap flex-1">
                {tweet.text}
              </p>
              <span
                className={`text-xs font-semibold px-2 py-0.5 rounded-full shrink-0 ${scoreColor(tweet.score)}`}
              >
                {tweet.score}
              </span>
            </div>

            {/* Meta */}
            <div className="flex gap-3 text-[11px] text-[#6b6b72]">
              <span>{tweet.persona}</span>
              <span>{tweet.topic.slice(0, 30)}</span>
              <span>{new Date(tweet.createdAt).toLocaleDateString('tr-TR')}</span>
              {tweet.postedAt && (
                <span className="text-accent-green">Atildi</span>
              )}
            </div>

            {/* Score bars */}
            <div className="grid grid-cols-3 gap-x-4 gap-y-1.5">
              {Object.entries(SCORING_CRITERIA).map(([key, crit]) => {
                const val = tweet.scores?.[key] ?? 0;
                const pct = Math.round((val / crit.weight) * 100);
                return (
                  <div key={key} className="flex items-center gap-1.5">
                    <span className="text-[10px] text-[#6b6b72] w-20 shrink-0 truncate">
                      {crit.label}
                    </span>
                    <div className="flex-1 h-1 bg-white/[0.06] rounded-full overflow-hidden">
                      <div
                        className="h-full bg-accent/60 rounded-full"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Engagement inputs */}
            <div className="flex items-center gap-3 pt-1 border-t border-white/[0.05]">
              <span className="text-[11px] text-[#6b6b72]">Engagement:</span>
              {(['like', 'reply', 'rt', 'quote'] as const).map((field) => (
                <EngagementInput
                  key={field}
                  label={field}
                  value={tweet.engagement[field]}
                  onChange={(v) => updateEngagement(tweet.id, field, v)}
                />
              ))}
            </div>

            {/* Actions */}
            <div className="flex gap-2">
              {!tweet.postedAt && (
                <button
                  onClick={() => markPosted(tweet.id)}
                  className="text-xs px-3 py-1.5 rounded-lg bg-accent-green/10 hover:bg-accent-green/20 text-accent-green transition-colors"
                >
                  Atildi olarak isaretle
                </button>
              )}
              <button
                onClick={() =>
                  navigator.clipboard.writeText(tweet.text)
                }
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
        ))}
      </div>
    </div>
  );
}
