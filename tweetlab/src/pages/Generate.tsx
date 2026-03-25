import { useState, useEffect, useCallback } from 'react';
import { TweetCard } from '../components/TweetCard';
import { RadarPanel } from '../components/RadarPanel';
import { ContextPreview } from '../components/ContextPreview';
import { db } from '../lib/db';
import { xquikApi } from '../lib/xquik';
import type { RadarItem } from '../lib/xquik';
import { claudeApi } from '../lib/claude';
import type { TweetVariation } from '../lib/claude';
import {
  buildSystemPrompt,
  buildUserMessage,
  buildCopyPrompt,
} from '../lib/contextBuilder';
import { getCurrentSlot } from '../lib/skill';

const IMPRESSION_TYPES = [
  { id: 'Data', label: 'Data' },
  { id: 'Story', label: 'Story' },
  { id: 'Hot Take', label: 'Hot Take' },
  { id: 'Edu', label: 'Edu' },
  { id: 'Inspire', label: 'Inspire' },
  { id: 'Humor', label: 'Humor' },
];

const LENGTHS = [
  { id: 'short', label: 'Kısa' },
  { id: 'standard', label: 'Standart' },
  { id: 'extended', label: 'Uzun' },
];

const GOALS = [
  { id: 'Engagement', label: 'Engagement' },
  { id: 'Followers', label: 'Followers' },
  { id: 'Authority', label: 'Authority' },
];

const VARIATIONS_OPTS = [1, 2, 3];

function TimingBadge() {
  const slot = getCurrentSlot();
  const colors = {
    best: 'text-accent-green bg-accent-green/10 border-accent-green/30',
    good: 'text-accent-green bg-accent-green/10 border-accent-green/20',
    medium: 'text-accent-yellow bg-accent-yellow/10 border-accent-yellow/30',
    ok: 'text-[#6b6b72] bg-white/[0.04] border-white/[0.07]',
    weak: 'text-accent-red bg-accent-red/10 border-accent-red/30',
  };
  const icons = { best: '🟢', good: '🟢', medium: '🟡', ok: '🔵', weak: '🔴' };
  return (
    <div className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs ${colors[slot.quality]}`}>
      <span>{icons[slot.quality]}</span>
      <span className="font-medium">{slot.label}</span>
      <span className="text-[10px] opacity-70">— {slot.tip}</span>
    </div>
  );
}

function SkeletonCard() {
  return (
    <div className="bg-card border border-white/[0.07] rounded-xl p-4 space-y-3 animate-pulse">
      <div className="h-4 bg-white/[0.06] rounded w-full" />
      <div className="h-4 bg-white/[0.06] rounded w-4/5" />
      <div className="h-4 bg-white/[0.06] rounded w-3/5" />
      <div className="flex gap-2 mt-2">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="h-1.5 flex-1 bg-white/[0.06] rounded-full" />
        ))}
      </div>
    </div>
  );
}

export function Generate() {
  const settings = db.getSettings();
  const [topic, setTopic] = useState('');
  const [impressionType, setImpressionType] = useState('Data');
  const [length, setLength] = useState('standard');
  const [goal, setGoal] = useState('Engagement');
  const [variations, setVariations] = useState(3);
  const [persona, setPersona] = useState<any>(null);
  const [personaId, setPersonaId] = useState(settings.defaultPersona || 'hurricane');
  const personaList = ['hurricane', 'tr_educational', 'tr_controversial', 'tr_casual'];
  const [radarItems, setRadarItems] = useState<RadarItem[]>([]);
  const [results, setResults] = useState<TweetVariation[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [copyPrompt, setCopyPrompt] = useState('');

  // Load persona JSON
  useEffect(() => {
    fetch(`/personas/${personaId}.json`)
      .then((r) => r.json())
      .then((data) => setPersona(data))
      .catch(() => setPersona(null));
  }, [personaId]);

  // Load radar items in background when xquik key exists
  useEffect(() => {
    if (settings.xquikKey) {
      xquikApi.getRadar(settings.xquikKey, 8).then(setRadarItems).catch(() => {});
    }
  }, []);

  // Rebuild copy prompt whenever inputs change
  useEffect(() => {
    if (!persona) return;
    const sys = buildSystemPrompt(persona, settings);
    const user = buildUserMessage({
      topic: topic || '(konu girilmedi)',
      persona,
      settings,
      recentTweets: db.getTweets(),
      radarItems,
      impressionType,
      length,
      goal,
      variations,
    });
    setCopyPrompt(buildCopyPrompt(sys, user));
  }, [topic, persona, impressionType, length, goal, variations, radarItems]);

  const handleGenerate = useCallback(async () => {
    if (!topic.trim()) return;
    setLoading(true);
    setError('');
    setResults([]);

    const sys = buildSystemPrompt(persona, settings);
    const user = buildUserMessage({
      topic,
      persona,
      settings,
      recentTweets: db.getTweets(),
      radarItems,
      impressionType,
      length,
      goal,
      variations,
    });

    if (settings.claudeKey) {
      try {
        const tweets = await claudeApi.generateTweets(
          settings.claudeKey,
          sys,
          user,
          variations
        );
        setResults(tweets);
      } catch (e: any) {
        setError(e.message || 'Claude API hatası.');
      }
    } else {
      // No API key — copy prompt automatically
      const full = buildCopyPrompt(sys, user);
      await navigator.clipboard.writeText(full).catch(() => {});
      setError('Claude API key yok. Prompt panoya kopyalandı. claude.ai\'a yapıştırabilirsin.');
    }

    setLoading(false);
  }, [topic, persona, settings, radarItems, impressionType, length, goal, variations]);

  const handleSaveTweet = (tweet: TweetVariation) => {
    db.saveTweet({
      text: tweet.text,
      topic,
      persona: personaId,
      score: tweet.total_score,
      scores: tweet.scores,
      scoreReason: tweet.score_reason,
      engagement: { like: 0, reply: 0, rt: 0, quote: 0 },
    });
  };

  return (
    <div className="flex h-full gap-0">
      {/* Left panel */}
      <div className="w-80 shrink-0 border-r border-white/[0.07] p-4 space-y-4 overflow-y-auto">
        {/* Topic */}
        <div>
          <label className="text-xs text-[#6b6b72] mb-1.5 block">Konu</label>
          <textarea
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            placeholder="Ne hakkında tweet atacaksın?"
            rows={3}
            className="w-full bg-elevated border border-white/[0.07] rounded-xl px-3 py-2.5 text-sm text-[#e8e8e0] placeholder-[#6b6b72] resize-none focus:border-accent/50 transition-colors"
          />
        </div>

        {/* Impression type */}
        <div>
          <label className="text-xs text-[#6b6b72] mb-1.5 block">Tip</label>
          <div className="flex flex-wrap gap-1.5">
            {IMPRESSION_TYPES.map((t) => (
              <button
                key={t.id}
                onClick={() => setImpressionType(t.id)}
                className={`text-xs px-2.5 py-1 rounded-full transition-colors ${
                  impressionType === t.id
                    ? 'bg-accent text-white'
                    : 'bg-white/[0.05] text-[#6b6b72] hover:text-[#e8e8e0]'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>

        {/* Length */}
        <div>
          <label className="text-xs text-[#6b6b72] mb-1.5 block">Uzunluk</label>
          <div className="flex gap-1.5">
            {LENGTHS.map((l) => (
              <button
                key={l.id}
                onClick={() => setLength(l.id)}
                className={`flex-1 text-xs py-1.5 rounded-lg transition-colors ${
                  length === l.id
                    ? 'bg-accent text-white'
                    : 'bg-white/[0.05] text-[#6b6b72] hover:text-[#e8e8e0]'
                }`}
              >
                {l.label}
              </button>
            ))}
          </div>
        </div>

        {/* Goal */}
        <div>
          <label className="text-xs text-[#6b6b72] mb-1.5 block">Hedef</label>
          <div className="flex gap-1.5">
            {GOALS.map((g) => (
              <button
                key={g.id}
                onClick={() => setGoal(g.id)}
                className={`flex-1 text-xs py-1.5 rounded-lg transition-colors ${
                  goal === g.id
                    ? 'bg-accent text-white'
                    : 'bg-white/[0.05] text-[#6b6b72] hover:text-[#e8e8e0]'
                }`}
              >
                {g.label}
              </button>
            ))}
          </div>
        </div>

        {/* Variations */}
        <div>
          <label className="text-xs text-[#6b6b72] mb-1.5 block">Varyasyon</label>
          <div className="flex gap-1.5">
            {VARIATIONS_OPTS.map((v) => (
              <button
                key={v}
                onClick={() => setVariations(v)}
                className={`flex-1 text-xs py-1.5 rounded-lg transition-colors ${
                  variations === v
                    ? 'bg-accent text-white'
                    : 'bg-white/[0.05] text-[#6b6b72] hover:text-[#e8e8e0]'
                }`}
              >
                {v}
              </button>
            ))}
          </div>
        </div>

        {/* Persona */}
        <div>
          <label className="text-xs text-[#6b6b72] mb-1.5 block">Persona</label>
          <select
            value={personaId}
            onChange={(e) => setPersonaId(e.target.value)}
            className="w-full bg-elevated border border-white/[0.07] rounded-xl px-3 py-2 text-sm text-[#e8e8e0] focus:border-accent/50 transition-colors"
          >
            {personaList.map((p) => (
              <option key={p} value={p} className="bg-[#18181c]">
                {p}
              </option>
            ))}
          </select>
          {persona && (
            <p className="text-[11px] text-[#6b6b72] mt-1">{persona.tone}</p>
          )}
        </div>

        {/* Radar */}
        <RadarPanel
          apiKey={settings.xquikKey}
          onSelect={(t) => setTopic(t)}
        />

        {/* Context preview */}
        <ContextPreview prompt={copyPrompt} />

        {/* Action buttons */}
        <div className="space-y-2 pb-2">
          <button
            onClick={handleGenerate}
            disabled={!topic.trim() || loading}
            className="w-full py-2.5 rounded-xl bg-accent hover:bg-accent/90 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-medium transition-colors"
          >
            {loading
              ? 'Uretiliyor...'
              : settings.claudeKey
              ? 'Simdi Uret'
              : 'Uret + Promptu Kopyala'}
          </button>

          <button
            onClick={async () => {
              await navigator.clipboard.writeText(copyPrompt);
            }}
            disabled={!topic.trim()}
            className="w-full py-2.5 rounded-xl border border-white/[0.07] hover:bg-white/[0.04] disabled:opacity-40 disabled:cursor-not-allowed text-[#e8e8e0] text-sm transition-colors"
          >
            Sadece Promptu Kopyala
          </button>
        </div>
      </div>

      {/* Right panel */}
      <div className="flex-1 p-4 overflow-y-auto">
        {/* Timing indicator */}
        <div className="mb-4">
          <TimingBadge />
        </div>

        {error && (
          <div className="mb-4 p-3 rounded-xl bg-accent-orange/10 border border-accent-orange/30 text-accent-orange text-xs">
            {error}
          </div>
        )}

        {loading && (
          <div className="space-y-3">
            {[...Array(variations)].map((_, i) => (
              <SkeletonCard key={i} />
            ))}
          </div>
        )}

        {!loading && results.length > 0 && (
          <div className="space-y-3">
            {results.map((tweet, i) => (
              <TweetCard key={i} tweet={tweet} onSave={handleSaveTweet} />
            ))}
          </div>
        )}

        {!loading && results.length === 0 && !error && (
          <div className="h-full flex flex-col items-center justify-center text-center py-20">
            <div className="text-4xl mb-3">⚡</div>
            <p className="text-[#e8e8e0] text-sm font-medium mb-1">
              TweetLab hazır
            </p>
            <p className="text-[#6b6b72] text-xs max-w-48">
              Konu gir, uret. Ya da promptu kopyalayip claude.ai'a yapistir.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
