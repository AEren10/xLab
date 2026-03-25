import { useState } from 'react';
import type { TweetVariation } from '../lib/claude';
import { SCORING_CRITERIA } from '../lib/skill';

interface TweetCardProps {
  tweet: TweetVariation;
  onSave?: (tweet: TweetVariation) => void;
}

function scoreColor(score: number) {
  if (score >= 85) return 'text-accent-green bg-accent-green/10 border-accent-green/30';
  if (score >= 70) return 'text-accent-yellow bg-accent-yellow/10 border-accent-yellow/30';
  if (score >= 50) return 'text-accent-orange bg-accent-orange/10 border-accent-orange/30';
  return 'text-accent-red bg-accent-red/10 border-accent-red/30';
}

function scoreBarColor(score: number, max: number) {
  const pct = (score / max) * 100;
  if (pct >= 80) return 'bg-accent-green';
  if (pct >= 60) return 'bg-accent-yellow';
  if (pct >= 40) return 'bg-accent-orange';
  return 'bg-accent-red';
}

export function TweetCard({ tweet, onSave }: TweetCardProps) {
  const [copied, setCopied] = useState(false);
  const [saved, setSaved] = useState(false);
  const [showGoldenHour, setShowGoldenHour] = useState(false);

  const charCount = tweet.text.length;

  const handleCopy = async () => {
    await navigator.clipboard.writeText(tweet.text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSave = () => {
    onSave?.(tweet);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const handleOpenX = () => {
    const encoded = encodeURIComponent(tweet.text);
    window.open(`https://twitter.com/intent/tweet?text=${encoded}`, '_blank');
    setShowGoldenHour(true);
  };

  return (
    <div className="bg-card border border-white/[0.07] rounded-xl p-4 space-y-3">
      {/* Tweet text */}
      <p className="text-[#e8e8e0] text-sm leading-relaxed whitespace-pre-wrap">
        {tweet.text}
      </p>

      {/* Score + char count row */}
      <div className="flex items-center justify-between">
        <span
          className={`text-xs font-semibold px-2 py-0.5 rounded-full border ${scoreColor(tweet.total_score)}`}
        >
          {tweet.total_score}/100
        </span>
        <span className={`text-xs ${charCount > 280 ? 'text-accent-red' : 'text-[#6b6b72]'}`}>
          {charCount}/280
        </span>
      </div>

      {/* Mini score bars */}
      <div className="space-y-1.5">
        {Object.entries(SCORING_CRITERIA).map(([key, crit]) => {
          const val = tweet.scores[key as keyof typeof tweet.scores] ?? 0;
          const pct = Math.round((val / crit.weight) * 100);
          return (
            <div key={key} className="flex items-center gap-2">
              <span className="text-[10px] text-[#6b6b72] w-24 shrink-0 truncate">
                {crit.label}
              </span>
              <div className="flex-1 h-1 bg-white/[0.06] rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all ${scoreBarColor(val, crit.weight)}`}
                  style={{ width: `${pct}%` }}
                />
              </div>
              <span className="text-[10px] text-[#6b6b72] w-8 text-right">
                {val}/{crit.weight}
              </span>
            </div>
          );
        })}
      </div>

      {/* Score reason */}
      {tweet.score_reason && (
        <p className="text-[11px] text-[#6b6b72] italic border-t border-white/[0.05] pt-2">
          {tweet.score_reason}
        </p>
      )}

      {/* Golden Hour reminder */}
      {showGoldenHour && (
        <div className="bg-accent-green/10 border border-accent-green/30 rounded-lg px-3 py-2.5 space-y-1">
          <p className="text-xs font-semibold text-accent-green">⚡ Ilk 1 saat kritik!</p>
          <p className="text-[11px] text-[#e8e8e0]">
            Simdi kendi tweetine 2-3 reply yaz. Gelen her reply'a hemen cevap ver.
          </p>
          <p className="text-[10px] text-[#6b6b72]">
            reply_engaged_by_author = 75 agirlik — en guclu sinyal bu.
          </p>
          <button
            onClick={() => setShowGoldenHour(false)}
            className="text-[10px] text-[#6b6b72] hover:text-[#e8e8e0] mt-1"
          >
            kapat
          </button>
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-2 pt-1">
        <button
          onClick={handleCopy}
          className="flex-1 text-xs py-1.5 rounded-lg bg-white/[0.05] hover:bg-white/[0.09] text-[#e8e8e0] transition-colors"
        >
          {copied ? 'Kopyalandı!' : 'Tweet Kopyala'}
        </button>
        <button
          onClick={handleSave}
          className="flex-1 text-xs py-1.5 rounded-lg bg-accent/10 hover:bg-accent/20 text-accent transition-colors"
        >
          {saved ? 'Kaydedildi!' : 'Kaydet'}
        </button>
        <button
          onClick={handleOpenX}
          className="px-3 text-xs py-1.5 rounded-lg bg-white/[0.05] hover:bg-white/[0.09] text-[#6b6b72] transition-colors"
          title="X'te Aç"
        >
          X
        </button>
      </div>
    </div>
  );
}
