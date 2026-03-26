import { useState } from 'react';
import type { TweetVariation } from '../lib/claude';
import { SCORING_CRITERIA } from '../lib/skill';
import { scoreColor } from '../lib/utils';
import { xquikApi } from '../lib/xquik';
import type { XquikScore } from '../lib/xquik';

interface TweetCardProps {
  tweet: TweetVariation;
  onSave?: (tweet: TweetVariation) => void;
  maxLength?: number;
  hasPremium?: boolean; // false ise link içeren tweet'te uyarı göster
  xquikKey?: string;    // varsa "Canlı Skor Al" butonu görünür
}

function scoreBarColor(score: number, max: number) {
  const pct = (score / max) * 100;
  if (pct >= 80) return 'bg-accent-green';
  if (pct >= 60) return 'bg-accent-yellow';
  if (pct >= 40) return 'bg-accent-orange';
  return 'bg-accent-red';
}

/**
 * Dwell time tahmini — kelime sayısına göre yaklaşık okuma süresi.
 * Ortalama okuma hızı: 200 kelime/dakika (Türkçe için biraz düşük — ~180)
 * Grok'ta dwell_time_2min = +10 puan, yani 2+ dakika okunacak içerik hedef.
 */
function estimateDwellTime(text: string): { minutes: number; label: string; tip: string } {
  const words = text.trim().split(/\s+/).length;
  const minutes = words / 180; // Türkçe okuma hızı ~180 kelime/dk
  if (minutes >= 2) return {
    minutes,
    label: `~${Math.round(minutes)} dk`,
    tip: 'Dwell time +10 puan bölgesi. Grok bu tweetin değerli olduğuna karar verir.',
  };
  if (minutes >= 1) return {
    minutes,
    label: `~${Math.round(minutes * 60)} sn`,
    tip: 'Orta dwell. 2 dakikayı geçmek için biraz daha içerik ekle veya thread yap.',
  };
  return {
    minutes,
    label: `~${Math.round(minutes * 60)} sn`,
    tip: 'Kısa içerik — scroll pass riski var. Hook çok güçlü olmalı.',
  };
}

export function TweetCard({ tweet, onSave, maxLength = 280, hasPremium = true, xquikKey }: TweetCardProps) {
  const [copied, setCopied] = useState(false);
  const [saved, setSaved] = useState(false);
  const [showGoldenHour, setShowGoldenHour] = useState(false);
  const [liveScore, setLiveScore] = useState<XquikScore | null>(null);
  const [scoreLoading, setScoreLoading] = useState(false);
  const [showChecklist, setShowChecklist] = useState(false);

  const charCount = tweet.text.length;
  const hasLink = /https?:\/\/\S+/i.test(tweet.text);
  const showLinkWarning = !hasPremium && hasLink;
  const dwell = estimateDwellTime(tweet.text);

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

  const handleLiveScore = async () => {
    if (!xquikKey || scoreLoading) return;
    setScoreLoading(true);
    const result = await xquikApi.scoreTweet(xquikKey, tweet.text);
    setLiveScore(result);
    setShowChecklist(true);
    setScoreLoading(false);
  };

  return (
    <div className="bg-card border border-white/[0.07] rounded-xl p-4 space-y-3">
      {/* Tweet text */}
      <p className="text-[#e8e8e0] text-sm leading-relaxed whitespace-pre-wrap">
        {tweet.text}
      </p>

      {/* Score + char count + dwell badge */}
      <div className="flex items-center justify-between gap-2">
        <span
          className={`text-xs font-semibold px-2 py-0.5 rounded-full border ${scoreColor(tweet.total_score)}`}
        >
          {tweet.total_score}/100
        </span>

        {/* Dwell time tahmini */}
        <span
          className={`text-[10px] px-2 py-0.5 rounded-full border cursor-default ${
            dwell.minutes >= 2
              ? 'text-accent-green bg-accent-green/10 border-accent-green/20'
              : dwell.minutes >= 1
              ? 'text-accent-yellow bg-accent-yellow/10 border-accent-yellow/20'
              : 'text-[#6b6b72] bg-white/[0.04] border-white/[0.07]'
          }`}
          title={dwell.tip}
        >
          {dwell.label} okuma
        </span>

        <span className={`text-xs ${charCount > maxLength ? 'text-accent-red' : 'text-[#6b6b72]'}`}>
          {charCount}/{maxLength}
        </span>
      </div>

      {/* Mini score bars */}
      <div className="space-y-1.5">
        {Object.entries(SCORING_CRITERIA).map(([key, crit]) => {
          const val = tweet.scores[key as keyof typeof tweet.scores] ?? 0;
          const pct = Math.round((val / crit.weight) * 100);
          return (
            <div key={key} className="flex items-center gap-2" title={crit.description}>
              <span className="text-[10px] text-[#6b6b72] w-28 shrink-0 truncate">
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

      {/* Canlı xquik skor */}
      {xquikKey && (
        <div className="border-t border-white/[0.05] pt-2">
          {!liveScore ? (
            <button
              onClick={handleLiveScore}
              disabled={scoreLoading}
              className="w-full text-[10px] py-1.5 rounded-lg border border-accent/20 text-accent/70 hover:text-accent hover:border-accent/40 hover:bg-accent/[0.04] transition-all disabled:opacity-50"
            >
              {scoreLoading ? (
                <span className="flex items-center justify-center gap-1.5">
                  <span className="w-2.5 h-2.5 border border-accent/40 border-t-accent rounded-full animate-spin" />
                  Grok Skor Alınıyor...
                </span>
              ) : '⚡ Grok Canlı Skor Al'}
            </button>
          ) : (
            <div className="space-y-2">
              {/* Skor özeti */}
              <div className="flex items-center justify-between">
                <span className="text-[10px] text-[#6b6b72]">Grok Checklist</span>
                <div className="flex items-center gap-2">
                  <span className={`text-[10px] font-semibold ${liveScore.passed ? 'text-accent-green' : 'text-accent-orange'}`}>
                    {liveScore.passedCount}/{liveScore.totalChecks} geçti
                  </span>
                  <button
                    onClick={() => setShowChecklist(!showChecklist)}
                    className="text-[10px] text-[#4a4a55] hover:text-[#8b8b96] transition-colors"
                  >
                    {showChecklist ? 'gizle' : 'göster'}
                  </button>
                </div>
              </div>

              {/* Top suggestion */}
              {liveScore.topSuggestion && (
                <p className="text-[10px] text-accent-yellow bg-accent-yellow/[0.06] border border-accent-yellow/20 rounded-lg px-2.5 py-1.5 leading-relaxed">
                  {liveScore.topSuggestion}
                </p>
              )}

              {/* Checklist detay */}
              {showChecklist && liveScore.checklist.length > 0 && (
                <div className="space-y-1 bg-white/[0.02] rounded-lg p-2">
                  {liveScore.checklist.map((item, i) => (
                    <div key={i} className="flex items-start gap-2">
                      <span className={`text-[10px] shrink-0 mt-0.5 ${item.passed ? 'text-accent-green' : 'text-accent-red'}`}>
                        {item.passed ? '✓' : '✗'}
                      </span>
                      <div className="flex-1 min-w-0">
                        <span className={`text-[10px] ${item.passed ? 'text-[#6b6b72]' : 'text-[#e8e8e0]'}`}>
                          {item.factor}
                        </span>
                        {item.suggestion && (
                          <p className="text-[9px] text-[#6b6b72] mt-0.5 leading-relaxed">
                            {item.suggestion}
                          </p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Tekrar skor */}
              <button
                onClick={() => { setLiveScore(null); setShowChecklist(false); }}
                className="text-[9px] text-[#4a4a55] hover:text-[#6b6b72] transition-colors"
              >
                tekrar skor al
              </button>
            </div>
          )}
        </div>
      )}

      {/* Premium uyarısı */}
      {showLinkWarning && (
        <div className="bg-accent-orange/10 border border-accent-orange/30 rounded-lg px-3 py-2 text-[11px] text-accent-orange">
          ⚠ Free hesap: Link tweet içinde = sıfır reach. Linki reply'a taşı.
        </div>
      )}

      {/* Golden Hour reminder */}
      {showGoldenHour && (
        <div className="bg-accent-green/10 border border-accent-green/30 rounded-lg px-3 py-2.5 space-y-1">
          <p className="text-xs font-semibold text-accent-green">⚡ Ilk 1 saat kritik!</p>
          <p className="text-[11px] text-[#e8e8e0]">
            Simdi kendi tweetine 2-3 reply yaz. Gelen her reply'a hemen cevap ver.
          </p>
          <p className="text-[10px] text-[#6b6b72]">
            reply_engaged_by_author = 75 agirlik — like'in 150 kati. En guclu sinyal bu.
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
