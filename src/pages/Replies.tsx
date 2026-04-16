/**
 * Reply Fırsatları
 *
 * Mantık: Büyük hesaplara kaliteli reply atmak = juice transfer (trustscore aktarımı).
 * xquik search ile nişe göre yüksek engagement'lı tweetleri bulur.
 * Her tweet için "Reply Üret" butonu var; Claude API ile reply üretir.
 */

import { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import { db } from '../lib/db';
import { xquikApi } from '../lib/xquik';
import type { TweetSearchResult, UserTweet } from '../lib/xquik';
import { claudeApi } from '../lib/claude';
import { buildReplyPrompt } from '../lib/contextBuilder';
import { enrichPersonaWithTweets, loadPersonaById, persistEnrichedPersona } from '../lib/persona';
import { rankContextualTweets } from '../lib/promptHeuristics';
import { PageHeader } from '../components/PageHeader';
import {
  formatNum,
  timeAgo,
  engScore,
  replyScoreColor as scoreColor,
  normalizeText,
  shouldRetryReply,
  type ReplyLength,
} from '../lib/utils';

const REPLY_LENGTHS = [
  { id: 'short', label: 'Kısa', hint: 'Tek cümle, hızlı reaksiyon' },
  { id: 'standard', label: 'Standart', hint: 'Dengeli, feed içi cevap' },
  { id: 'long', label: 'Uzun', hint: 'İki cümleye kadar, nüanslı' },
] as const;

const REPLY_RETRY_MODES = [
  { id: 'same', label: 'Aynı uzunluk', note: 'Mevcut bantta tekrar dene, özü tekrar etme.' },
  { id: 'shorter', label: 'Daha kısa', note: 'Kısalt, tek vurguda kal, açıklamayı kes.' },
  { id: 'stronger', label: 'Daha sert', note: 'Daha sivri bir reaksiyon kur, daha net stance ver.' },
  { id: 'natural', label: 'Daha doğal', note: 'Daha insan gibi, daha gündelik yaz.' },
  { id: 'funny', label: 'Daha mizahi', note: 'Küçük iğneleme veya hafif mizah ekle.' },
] as const;

type ReplyRetryMode = typeof REPLY_RETRY_MODES[number]['id'];


interface ReplyResult {
  tweetId: string;
  text: string;
  loading: boolean;
  result: string;
  copied: boolean;
  archived: boolean;
  scoring: boolean;
  xquikScore?: number;
  topSuggestion?: string;
}

const LIKE_PRESETS = [50, 100, 250, 500, 1000, 2000, 5000];

export function Replies() {
  const settings = db.getSettings();
  const hasXquik = Boolean(settings.xquikKey);
  const activeProfile = db.getActiveProfile();
  // Aktif profilin ayarları global settings'in üzerine yazar
  const effectiveSettings = {
    ...settings,
    niche: activeProfile.niche || settings.niche,
    defaultPersona: activeProfile.defaultPersona || settings.defaultPersona,
    toneProfile: activeProfile.toneProfile || settings.toneProfile,
    twitterUsername: activeProfile.twitterUsername || settings.twitterUsername,
    hasPremium: activeProfile.hasPremium ?? settings.hasPremium,
  };
  const [personaId, setPersonaId] = useState(
    () => sessionStorage.getItem('replies_persona') || activeProfile.defaultPersona || settings.defaultPersona || 'hurricane'
  );
  const [persona, setPersona] = useState<any>(null);
  const [personaTweets, setPersonaTweets] = useState<UserTweet[]>([]);
  const [replyLength, setReplyLength] = useState<ReplyLength>(
    () => (sessionStorage.getItem('replies_length') as ReplyLength) || 'standard'
  );
  const PERSONA_LIST = [
    { value: 'alperk55',         label: 'alperk55 — Tarafsız, ima yüklü' },
    { value: 'alperk55_fener',   label: 'alperk55 Fener — Fenerbahçe ima' },
    { value: 'alperk55_gs',      label: 'alperk55 GS — Galatasaray ima' },
    { value: 'hurricane',        label: 'hurricane — Direkt, cesur' },
    { value: 'tr_controversial', label: 'tr_controversial — Tartışma açan' },
    { value: 'tr_casual',        label: 'tr_casual — Samimi, sohbet' },
    { value: 'tr_educational',   label: 'tr_educational — Öğretici' },
  ];

  const [panelWidth, setPanelWidth] = useState(() =>
    Number(localStorage.getItem('replies_panel_width') || 200)
  );

  const handleResizeStart = (e: React.MouseEvent) => {
    e.preventDefault();
    const startX = e.clientX;
    const startW = panelWidth;
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';

    const onMove = (ev: MouseEvent) => {
      const next = Math.min(520, Math.max(200, startW + (ev.clientX - startX)));
      setPanelWidth(next);
      localStorage.setItem('replies_panel_width', String(next));
    };
    const onUp = () => {
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  };

  const [query, setQuery] = useState(() =>
    sessionStorage.getItem('replies_query') || ''
  );
  const [hours, setHours] = useState(4);
  const [minFaves, setMinFaves] = useState(500);
  const [minFavesCustom, setMinFavesCustom] = useState('');
  const [minRetweets, setMinRetweets] = useState(0);
  const [tweets, setTweets] = useState<TweetSearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [searchErr, setSearchErr] = useState('');
  const [priorityAccounts, setPriorityAccounts] = useState('');
  const [sortBy, setSortBy] = useState<'views' | 'engagement' | 'likes'>('views');

  const [replies, setReplies] = useState<Record<string, ReplyResult>>({});

  const [activeTab, setActiveTab] = useState<'search' | 'monitor'>('search');
  const [monitoredAccounts, setMonitoredAccounts] = useState<string[]>(settings.monitoredAccounts || []);
  const [newAccountInput, setNewAccountInput] = useState('');
  const [monitorTweets, setMonitorTweets] = useState<TweetSearchResult[]>([]);
  const [monitorLoading, setMonitorLoading] = useState(false);
  const [monitorHours, setMonitorHours] = useState(4);

  const effectiveMinFaves = minFavesCustom ? Number(minFavesCustom) : minFaves;

  useEffect(() => {
    let cancelled = false;
    loadPersonaById(personaId)
      .then((data) => {
        if (!cancelled) setPersona(data);
      })
      .catch(() => {
        if (!cancelled) setPersona(null);
      });
    return () => {
      cancelled = true;
    };
  }, [personaId]);

  useEffect(() => {
    sessionStorage.setItem('replies_length', replyLength);
  }, [replyLength]);

  useEffect(() => {
    let cancelled = false;
    if (!hasXquik || !activeProfile.twitterUsername) {
      setPersonaTweets([]);
      return;
    }

    xquikApi.getUserTweets(settings.xquikKey, activeProfile.twitterUsername, 20)
      .then((tweets) => {
        if (!cancelled) setPersonaTweets(tweets);
      })
      .catch(() => {
        if (!cancelled) setPersonaTweets([]);
      });

    return () => {
      cancelled = true;
    };
  }, [hasXquik, activeProfile.twitterUsername, settings.xquikKey]);

  useEffect(() => {
    const onPersonaUpdate = (event: Event) => {
      const detail = (event as CustomEvent<{ personaId?: string }>).detail;
      if (detail?.personaId === personaId) {
        loadPersonaById(personaId).then((data) => setPersona(data)).catch(() => setPersona(null));
      }
    };

    window.addEventListener('persona-cache-updated', onPersonaUpdate);
    return () => window.removeEventListener('persona-cache-updated', onPersonaUpdate);
  }, [personaId]);

  const personaForPrompt = useMemo(
    () => (persona ? enrichPersonaWithTweets(persona, personaTweets) : null),
    [persona, personaTweets]
  );
  const personaLearningKeyRef = useRef('');

  useEffect(() => {
    const signature = personaForPrompt?.learning_summary?.learning_signature || '';
    if (!personaId || !signature) return;

    const cacheKey = `${personaId}:${signature}`;
    if (personaLearningKeyRef.current === cacheKey) return;

    personaLearningKeyRef.current = cacheKey;
    persistEnrichedPersona(personaId, personaForPrompt);
  }, [personaId, personaForPrompt]);

  const handleSearch = useCallback(async () => {
    if (!query.trim() || !hasXquik) return;
    setSearching(true);
    setSearchErr('');
    setTweets([]);

    const accounts = priorityAccounts
      .split(/[,\s]+/)
      .map((a) => a.replace('@', '').trim())
      .filter(Boolean);
    const accountFilter = accounts.length
      ? ' (' + accounts.map((a) => `from:${a}`).join(' OR ') + ')'
      : '';

    const thresholds = effectiveMinFaves > 0
      ? [effectiveMinFaves, Math.max(50, Math.floor(effectiveMinFaves / 2)), 25, 0]
      : [0];

    try {
      let results: TweetSearchResult[] = [];
      for (const threshold of thresholds) {
        let q = query + accountFilter;
        if (threshold > 0) q += ` min_faves:${threshold}`;
        if (minRetweets > 0) q += ` min_retweets:${minRetweets}`;

        const attempt = await xquikApi.searchTweets(settings.xquikKey, q, {
          lang: 'tr',
          hours,
          limit: 15,
          minFaves: threshold,
          minRetweets,
        });

        if (attempt.length > 0) {
          results = attempt;
          break;
        }
      }

      if (results.length === 0) {
        setSearchErr('Sonuç bulunamadı. Filtreleri gevşet veya farklı konu dene.');
      }

      // Sıralama
      const sorted = [...results].sort((a, b) => {
        if (sortBy === 'views') return (b.views || 0) - (a.views || 0);
        if (sortBy === 'engagement') return engScore(b) - engScore(a);
        return b.likes - a.likes;
      });

      setTweets(sorted);
    } finally {
      setSearching(false);
    }
  }, [query, hours, effectiveMinFaves, minRetweets, hasXquik, priorityAccounts, settings.xquikKey, sortBy]);

  const handleGenerateReply = useCallback(
    async (tweet: TweetSearchResult, options?: { attempt?: number; retryNote?: string; replyLengthOverride?: ReplyLength }) => {
      const attempt = options?.attempt ?? 1;
      const effectiveReplyLength = options?.replyLengthOverride ?? replyLength;
      setReplies((prev) => ({
        ...prev,
        [tweet.id]: { tweetId: tweet.id, text: '', loading: true, result: '', copied: false, archived: false, scoring: false },
      }));
      const inspirationTweets = rankContextualTweets(
        [...tweets].filter((candidate) => candidate.id !== tweet.id),
        `${query} ${tweet.text}`
      ).slice(0, 4);
      const replyPrompt = buildReplyPrompt({
        tweet,
        persona: personaForPrompt,
        settings: effectiveSettings,
        query,
        inspirationTweets,
        ownTweets: personaTweets,
        replyLength: effectiveReplyLength,
        attempt,
        retryNote: options?.retryNote,
      });

      let result = '';

      if (!settings.claudeKey) {
        await navigator.clipboard.writeText(replyPrompt).catch(() => {});
        result = '(Claude API key yok — Ayarlar\'dan ekle)';
      } else {
        try {
          result = await claudeApi.generateReply(settings.claudeKey, replyPrompt);
          if (!result) {
            await navigator.clipboard.writeText(replyPrompt).catch(() => {});
            result = '(Boş yanıt geldi — prompt panoya kopyalandı)';
          }
          if (attempt === 1 && shouldRetryReply(tweet, result, effectiveReplyLength)) {
            return handleGenerateReply(tweet, {
              attempt: 2,
              retryNote: 'İlk cevap tweeti fazla özetledi veya tweeti tekrar etti. Daha doğal, daha kısa, daha az açıklayıcı yaz.',
              replyLengthOverride: effectiveReplyLength === 'long' ? 'standard' : 'short',
            });
          }
        } catch (e: any) {
          await navigator.clipboard.writeText(replyPrompt).catch(() => {});
          result = `(API Hatası: ${e.message || 'bilinmeyen hata'} — prompt panoya kopyalandı)`;
        }
      }

      setReplies((prev) => ({
        ...prev,
        [tweet.id]: { tweetId: tweet.id, text: result, loading: false, result, copied: false, archived: false, scoring: false },
      }));

      if (result && !result.startsWith('(') && settings.xquikKey) {
        setReplies((prev) => ({ ...prev, [tweet.id]: { ...prev[tweet.id], scoring: true } }));
        const score = await xquikApi.scoreTweet(settings.xquikKey, result);
        setReplies((prev) => ({
          ...prev,
          [tweet.id]: {
            ...prev[tweet.id],
            scoring: false,
            xquikScore: score?.total ?? undefined,
            topSuggestion: score?.topSuggestion || undefined,
          },
        }));
      }
    },
    [settings, personaForPrompt, tweets, query, personaTweets, replyLength]
  );

  const retryReply = useCallback((tweet: TweetSearchResult, mode: ReplyRetryMode, currentLength: ReplyLength) => {
    const lengthOverride: ReplyLength =
      mode === 'shorter'
        ? 'short'
        : currentLength;

    const noteByMode: Record<ReplyRetryMode, string> = {
      same: 'Aynı uzunlukta tekrar dene. Özeti kır, feed içi tepki ver.',
      shorter: 'Daha kısa yaz. Tek bir vurguya in, açıklamayı kes.',
      stronger: 'Daha sert ve net yaz. Cevap daha sivri olsun.',
      natural: 'Daha doğal, daha gündelik ve insan gibi yaz.',
      funny: 'Daha mizahi yaz. Hafif iğneleme veya küçük twist ekle.',
    };

    handleGenerateReply(tweet, {
      attempt: 2,
      retryNote: noteByMode[mode],
      replyLengthOverride: lengthOverride,
    });
  }, [handleGenerateReply]);

  const renderRetryButtons = (tweet: TweetSearchResult, replyState: ReplyResult) => {
    if (!replyState.result || replyState.loading || replyState.result.startsWith('(')) return null;

    return (
      <div className="flex flex-wrap gap-1.5">
        <span className="text-[9px] text-[#4a4a55] self-center mr-1">Tekrar dene:</span>
        {REPLY_RETRY_MODES.map((mode) => (
          <button
            key={mode.id}
            onClick={() => retryReply(tweet, mode.id, replyLength)}
            className="text-[9px] px-2 py-1 rounded-full bg-white/[0.04] hover:bg-white/[0.08] text-[#6b6b72] hover:text-[#e8e8e0] transition-colors border border-white/[0.07]"
            title={mode.note}
          >
            {mode.label}
          </button>
        ))}
      </div>
    );
  };

  const handleMonitorRefresh = useCallback(async () => {
    if (!monitoredAccounts.length || !hasXquik) return;
    setMonitorLoading(true);
    try {
      const allTweets: TweetSearchResult[] = [];
      for (const account of monitoredAccounts) {
        const results = await xquikApi.searchTweets(settings.xquikKey, `from:${account}`, {
          lang: 'tr',
          hours: monitorHours,
          limit: 5,
        });
        allTweets.push(...results);
      }
      allTweets.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      setMonitorTweets(allTweets);
    } finally {
      setMonitorLoading(false);
    }
  }, [monitoredAccounts, hasXquik, settings.xquikKey, monitorHours]);

  const addMonitoredAccount = () => {
    const handle = newAccountInput.replace('@', '').trim().toLowerCase();
    if (!handle || monitoredAccounts.includes(handle)) return;
    const updated = [...monitoredAccounts, handle];
    setMonitoredAccounts(updated);
    db.saveSettings({ monitoredAccounts: updated });
    setNewAccountInput('');
  };

  const removeMonitoredAccount = (handle: string) => {
    const updated = monitoredAccounts.filter((a) => a !== handle);
    setMonitoredAccounts(updated);
    db.saveSettings({ monitoredAccounts: updated });
  };

  const handleCopyReply = async (tweetId: string, text: string) => {
    await navigator.clipboard.writeText(text).catch(() => {});
    setReplies((prev) => ({ ...prev, [tweetId]: { ...prev[tweetId], copied: true } }));
    setTimeout(() => {
      setReplies((prev) => ({ ...prev, [tweetId]: { ...prev[tweetId], copied: false } }));
    }, 2000);
  };

  const handleArchive = (tweet: TweetSearchResult, replyText: string, xquikScore?: number) => {
    db.saveTweet({
      text: replyText,
      topic: query,
      persona: 'reply',
      impressionType: undefined,
      score: xquikScore ?? 0,
      scores: {},
      scoreReason: 'Reply arşivi',
      engagement: { like: 0, reply: 0, rt: 0, quote: 0 },
      entryType: 'reply',
      replyTo: {
        author: tweet.author || tweet.authorHandle,
        handle: tweet.authorHandle,
        tweetId: tweet.id,
        text: tweet.text.slice(0, 120),
      },
      xquikScore,
    });
    setReplies((prev) => ({ ...prev, [tweet.id]: { ...prev[tweet.id], archived: true } }));
  };

  if (!hasXquik) {
    return (
      <div className="h-full flex flex-col items-center justify-center text-center p-8">
        <div className="text-3xl mb-3">🔑</div>
        <p className="text-[#e8e8e0] text-sm font-medium mb-1">xquik API key gerekli</p>
        <p className="text-[#6b6b72] text-xs max-w-52">
          Ayarlar'a git, xquik key gir. Tweet arama ve reply fırsatları aktif olur.
        </p>
      </div>
    );
  }

  return (
    <div className="page-shell flex h-full flex-col gap-3 p-3 overflow-y-auto 2xl:overflow-hidden">
      <PageHeader
        kicker="REPLY WORKBENCH"
        title="Reply fırsatları ve monitor"
        subtitle="Yüksek görünürlükte, düşük rekabetli tweetleri bulup daha iyi reply'lar üretmek için kullan."
        chips={[
          { label: `Persona: ${personaId}`, tone: 'accent' },
          { label: `Reply: ${replyLength}`, tone: 'neutral' },
          { label: `Arama sonuçları: ${tweets.length || 0}`, tone: 'neutral' },
          { label: `İzlenen hesap: ${monitoredAccounts.length}`, tone: 'neutral' },
        ]}
      />

    <div className="flex min-h-0 flex-1 flex-col">
      {/* Tab bar */}
      <div className="flex gap-1 px-3 pt-2 pb-0 border-b border-white/[0.07] shrink-0">
        {[
          { id: 'search', label: '🔍 Fırsat Ara' },
          { id: 'monitor', label: `👁 İzlenen Hesaplar${monitoredAccounts.length ? ` (${monitoredAccounts.length})` : ''}` },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className={`text-xs px-3 py-1.5 rounded-t-lg transition-colors border-b-2 ${
              activeTab === tab.id
                ? 'text-accent border-accent bg-accent/5'
                : 'text-[#6b6b72] border-transparent hover:text-[#e8e8e0]'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="flex flex-1 gap-0 overflow-hidden flex-col 2xl:flex-row">
      {/* Sol panel — filtreler */}
      <div
        style={{ ['--panel-width' as any]: `${panelWidth}px` } as any}
        className="responsive-resizable-panel premium-panel-strong w-full 2xl:shrink-0 p-3 space-y-3 overflow-y-auto bg-[#0c0c0f]/80"
      >
      {/* Persona seçici — her iki sekmede görünür */}
      <div>
        <label className="text-xs text-[#6b6b72] mb-1.5 block">Persona</label>
        <select
          value={personaId}
          onChange={(e) => {
            setPersonaId(e.target.value);
            sessionStorage.setItem('replies_persona', e.target.value);
          }}
          className="w-full bg-elevated border border-white/[0.07] rounded-xl px-3 py-2 text-xs text-[#e8e8e0] focus:border-accent/50 transition-colors"
        >
          {PERSONA_LIST.map((p) => (
            <option key={p.value} value={p.value}>{p.label}</option>
          ))}
        </select>
      </div>

      <div>
        <label className="text-xs text-[#6b6b72] mb-1.5 block">Reply uzunluğu</label>
        <div className="flex gap-1.5 flex-wrap">
          {REPLY_LENGTHS.map((mode) => (
            <button
              key={mode.id}
              onClick={() => setReplyLength(mode.id)}
              className={`px-2.5 py-1 rounded-lg text-[10px] transition-colors ${
                replyLength === mode.id
                  ? 'bg-accent text-white'
                  : 'bg-white/[0.05] text-[#6b6b72] hover:text-[#e8e8e0]'
              }`}
              title={mode.hint}
            >
              {mode.label}
            </button>
          ))}
        </div>
        <p className="text-[10px] text-[#4a4a55] mt-1.5 leading-relaxed">
          {REPLY_LENGTHS.find((mode) => mode.id === replyLength)?.hint}
        </p>
      </div>

      {activeTab === 'search' && (<>
        <div>
          <label className="text-xs text-[#6b6b72] mb-1.5 block">Arama konusu / niche</label>
          <input
            type="text"
            value={query}
            onChange={(e) => { setQuery(e.target.value); sessionStorage.setItem('replies_query', e.target.value); }}
            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
            placeholder="orn: yazılım, kripto, futbol..."
            className="w-full bg-elevated border border-white/[0.07] rounded-xl px-3 py-2.5 text-sm text-[#e8e8e0] placeholder-[#6b6b72] focus:border-accent/50 transition-colors"
          />
        </div>

        <div>
          <label className="text-xs text-[#6b6b72] mb-1.5 block">Öncelikli hesaplar <span className="text-[#4a4a55]">(opsiyonel)</span></label>
          <input
            type="text"
            value={priorityAccounts}
            onChange={(e) => setPriorityAccounts(e.target.value)}
            placeholder="@kullanici1, @kullanici2..."
            className="w-full bg-elevated border border-white/[0.07] rounded-xl px-3 py-2.5 text-sm text-[#e8e8e0] placeholder-[#6b6b72] focus:border-accent/50 transition-colors"
          />
        </div>

        {/* Filtre ayarları */}
        <div className="border border-white/[0.07] rounded-xl p-3 space-y-3">
          <p className="text-[11px] font-medium text-[#8b8b96] uppercase tracking-wider">Filtreler</p>

          {/* Son N saat */}
          <div>
            <label className="text-[11px] text-[#6b6b72] mb-1 block">Son kaç saat</label>
            <div className="flex gap-1.5 flex-wrap">
              {[1, 2, 4, 8, 24, 48].map((h) => (
                <button
                  key={h}
                  onClick={() => setHours(h)}
                  className={`text-[10px] px-2.5 py-1 rounded-lg transition-colors ${
                    hours === h
                      ? 'bg-accent text-white'
                      : 'bg-white/[0.05] text-[#6b6b72] hover:text-[#e8e8e0]'
                  }`}
                >
                  {h}sa
                </button>
              ))}
            </div>
          </div>

          {/* Min beğeni */}
          <div>
            <label className="text-[11px] text-[#6b6b72] mb-1 block">Min. beğeni</label>
            <div className="flex gap-1.5 flex-wrap mb-1.5">
              {LIKE_PRESETS.map((f) => (
                <button
                  key={f}
                  onClick={() => { setMinFaves(f); setMinFavesCustom(''); }}
                  className={`text-[10px] px-2 py-1 rounded-lg transition-colors ${
                    !minFavesCustom && minFaves === f
                      ? 'bg-accent text-white'
                      : 'bg-white/[0.05] text-[#6b6b72] hover:text-[#e8e8e0]'
                  }`}
                >
                  {f >= 1000 ? `${f / 1000}k` : f}+
                </button>
              ))}
            </div>
            <input
              type="number"
              value={minFavesCustom}
              onChange={(e) => setMinFavesCustom(e.target.value)}
              placeholder="Özel sayı gir..."
              className="w-full bg-[#0d0d10] border border-white/[0.07] rounded-lg px-2.5 py-1.5 text-xs text-[#e8e8e0] placeholder-[#4a4a55] focus:border-accent/50 transition-colors"
            />
          </div>

          {/* Min retweet */}
          <div>
            <label className="text-[11px] text-[#6b6b72] mb-1 block">Min. retweet <span className="text-[#4a4a55]">(0 = filtre yok)</span></label>
            <div className="flex gap-1.5 flex-wrap">
              {[0, 10, 50, 100, 500].map((r) => (
                <button
                  key={r}
                  onClick={() => setMinRetweets(r)}
                  className={`text-[10px] px-2.5 py-1 rounded-lg transition-colors ${
                    minRetweets === r
                      ? 'bg-accent text-white'
                      : 'bg-white/[0.05] text-[#6b6b72] hover:text-[#e8e8e0]'
                  }`}
                >
                  {r === 0 ? 'hepsi' : `${r}+`}
                </button>
              ))}
            </div>
          </div>

          {/* Sıralama */}
          <div>
            <label className="text-[11px] text-[#6b6b72] mb-1 block">Sıralama</label>
            <div className="flex gap-1.5">
              {[
                { id: 'views', label: 'Görüntülenme' },
                { id: 'engagement', label: 'Etkileşim' },
                { id: 'likes', label: 'Beğeni' },
              ].map((s) => (
                <button
                  key={s.id}
                  onClick={() => setSortBy(s.id as any)}
                  className={`text-[10px] px-2.5 py-1 rounded-lg transition-colors ${
                    sortBy === s.id
                      ? 'bg-accent text-white'
                      : 'bg-white/[0.05] text-[#6b6b72] hover:text-[#e8e8e0]'
                  }`}
                >
                  {s.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        <button
          onClick={handleSearch}
          disabled={!query.trim() || searching}
          className="w-full py-2.5 rounded-xl bg-accent hover:bg-accent/90 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-medium transition-colors"
        >
          {searching ? 'Aranıyor...' : 'Fırsatları Bul'}
        </button>

        <div className="border border-white/[0.07] rounded-xl p-3">
          <p className="text-[11px] font-medium text-[#e8e8e0] mb-1">Neden reply?</p>
          <p className="text-[10px] text-[#6b6b72] leading-relaxed">
            Büyük hesaplara kaliteli reply = juice transfer. reply_engaged_by_author sinyal ağırlığı 75 — en kritik sinyal.
          </p>
        </div>
      </>)}

      {activeTab === 'monitor' && (<>
        <p className="text-xs font-medium text-[#e8e8e0]">İzlenen Hesaplar</p>

        {/* Hesap ekleme */}
        <div className="flex gap-1.5">
          <input
            type="text"
            value={newAccountInput}
            onChange={(e) => setNewAccountInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && addMonitoredAccount()}
            placeholder="@kullanici"
            className="flex-1 bg-elevated border border-white/[0.07] rounded-lg px-2.5 py-1.5 text-xs text-[#e8e8e0] placeholder-[#4a4a55] focus:border-accent/50 transition-colors"
          />
          <button
            onClick={addMonitoredAccount}
            className="px-2.5 py-1.5 bg-accent/10 hover:bg-accent/20 text-accent text-xs rounded-lg transition-colors"
          >
            +
          </button>
        </div>

        {/* Hesap listesi */}
        <div className="space-y-1">
          {monitoredAccounts.length === 0 && (
            <p className="text-[10px] text-[#4a4a55]">Henüz hesap eklenmedi.</p>
          )}
          {monitoredAccounts.map((acc) => (
            <div key={acc} className="flex items-center justify-between bg-elevated rounded-lg px-2.5 py-1.5">
              <span className="text-xs text-[#e8e8e0]">@{acc}</span>
              <button
                onClick={() => removeMonitoredAccount(acc)}
                className="text-[10px] text-[#4a4a55] hover:text-accent-red transition-colors"
              >
                ✕
              </button>
            </div>
          ))}
        </div>

        {/* Son kaç saat */}
        <div>
          <label className="text-[11px] text-[#6b6b72] mb-1 block">Son kaç saat</label>
          <div className="flex gap-1.5 flex-wrap">
            {[1, 2, 4, 8, 24, 48].map((h) => (
              <button
                key={h}
                onClick={() => setMonitorHours(h)}
                className={`text-[10px] px-2.5 py-1 rounded-lg transition-colors ${
                  monitorHours === h
                    ? 'bg-accent text-white'
                    : 'bg-white/[0.05] text-[#6b6b72] hover:text-[#e8e8e0]'
                }`}
              >
                {h}s
              </button>
            ))}
          </div>
        </div>

        <button
          onClick={handleMonitorRefresh}
          disabled={!monitoredAccounts.length || monitorLoading}
          className="w-full py-2.5 rounded-xl bg-accent hover:bg-accent/90 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-medium transition-colors"
        >
          {monitorLoading ? 'Yükleniyor...' : 'Yenile'}
        </button>
      </>)}
      </div>

      {/* Resize handle */}
      <div
        onMouseDown={handleResizeStart}
        className="hidden 2xl:flex w-3 shrink-0 cursor-col-resize items-center justify-center group hover:bg-accent/10 active:bg-accent/20 transition-colors"
        title="Sürükle"
      >
        <div className="w-0.5 h-10 rounded-full bg-white/[0.15] group-hover:bg-accent/60 group-active:bg-accent transition-colors" />
      </div>

      {/* Sağ panel — sonuçlar */}
      <div className="flex-1 min-w-0 p-4 overflow-y-auto">

        {/* Monitor tab içeriği */}
        {activeTab === 'monitor' && (
          <>
            {monitorLoading && (
              <div className="animate-pulse space-y-3">
                {[1,2,3].map(i => <div key={i} className="h-24 bg-white/[0.04] rounded-xl" />)}
              </div>
            )}
            {!monitorLoading && monitorTweets.length === 0 && (
              <div className="h-full flex flex-col items-center justify-center text-center py-20">
                <div className="text-4xl mb-3">👁</div>
                <p className="text-[#e8e8e0] text-sm font-medium mb-1">İzlenen Hesaplar</p>
                <p className="text-[#6b6b72] text-xs max-w-52">
                  Sol panelden hesap ekle, "Yenile"ye bas — son postlar burada görünür, reply üret.
                </p>
              </div>
            )}
            {monitorTweets.length > 0 && (
              <p className="text-[10px] text-[#4a4a55] mb-3">{monitorTweets.length} post · son {monitorHours}s</p>
            )}
            <div className="space-y-3">
              {monitorTweets.map((tweet) => {
                const replyState = replies[tweet.id];
                const eng = engScore(tweet);
                return (
                  <div key={tweet.id} className="bg-card border border-white/[0.07] rounded-xl p-4 space-y-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1.5">
                          <span className="text-xs font-medium text-[#e8e8e0]">{tweet.author || tweet.authorHandle}</span>
                          <span className="text-[10px] text-[#6b6b72]">@{tweet.authorHandle}</span>
                          <span className="text-[10px] text-[#6b6b72]">{timeAgo(tweet.createdAt)}</span>
                        </div>
                        <p className="text-sm text-[#e8e8e0] leading-relaxed">{tweet.text}</p>
                      </div>
                      <div className="shrink-0 text-right">
                        {tweet.views != null ? (
                          <><div className="text-[10px] text-[#4a4a55]">görüntülenme</div><div className="text-sm font-bold text-accent">{formatNum(tweet.views)}</div></>
                        ) : (
                          <><div className="text-[10px] text-[#4a4a55]">eng</div><div className="text-sm font-bold text-accent">{formatNum(eng)}</div></>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs text-[#e8e8e0] bg-white/[0.05] px-2 py-0.5 rounded-full">❤ {formatNum(tweet.likes)}</span>
                      <span className="text-xs text-[#e8e8e0] bg-white/[0.05] px-2 py-0.5 rounded-full">💬 {formatNum(tweet.replies || 0)}</span>
                      <span className="text-xs text-[#e8e8e0] bg-white/[0.05] px-2 py-0.5 rounded-full">🔁 {formatNum(tweet.retweets || 0)}</span>
                      <a href={tweet.url} target="_blank" rel="noopener noreferrer" className="ml-auto text-[10px] text-accent/60 hover:text-accent transition-colors">X'te aç ↗</a>
                    </div>
                    {!replyState && (
                      <button onClick={() => handleGenerateReply(tweet)} className="w-full text-xs py-1.5 rounded-lg bg-accent/10 hover:bg-accent/20 text-accent transition-colors">
                        Reply Üret
                      </button>
                    )}
                    {replyState?.loading && <div className="animate-pulse h-8 bg-white/[0.04] rounded-lg" />}
                    {replyState && !replyState.loading && replyState.result && (
                      <div className="bg-elevated border border-white/[0.07] rounded-lg p-3">
                        <p className="text-xs text-[#e8e8e0] leading-relaxed whitespace-pre-wrap">{replyState.result}</p>
                        <button onClick={() => handleCopyReply(tweet.id, replyState.result)} className="mt-2 text-[10px] text-accent/70 hover:text-accent transition-colors">
                          {replyState.copied ? '✓ Kopyalandı' : 'Kopyala'}
                        </button>
                        {renderRetryButtons(tweet, replyState)}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </>
        )}

        {/* Search tab içeriği */}
        {activeTab === 'search' && (<>
        {searchErr && (
          <div className="mb-4 p-3 rounded-xl bg-accent-orange/10 border border-accent-orange/30 text-accent-orange text-xs">
            {searchErr}
          </div>
        )}

        {tweets.length === 0 && !searching && !searchErr && (
          <div className="h-full flex flex-col items-center justify-center text-center py-20">
            <div className="text-4xl mb-3">🎯</div>
            <p className="text-[#e8e8e0] text-sm font-medium mb-1">Reply Fırsatları</p>
            <p className="text-[#6b6b72] text-xs max-w-52">
              Niche gir, filtreleri ayarla — viral tweetlere reply yaz, büy.
            </p>
          </div>
        )}

        {tweets.length > 0 && (
          <p className="text-[10px] text-[#4a4a55] mb-3">
            {tweets.length} sonuç · {sortBy === 'views' ? 'görüntülenmeye' : sortBy === 'engagement' ? 'etkileşime' : 'beğeniye'} göre sıralı
          </p>
        )}

        <div className="space-y-3">
          {tweets.map((tweet) => {
            const replyState = replies[tweet.id];
            const eng = engScore(tweet);
            return (
              <div
                key={tweet.id}
                className="bg-card border border-white/[0.07] rounded-xl p-4 space-y-3"
              >
                {/* Tweet header */}
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1.5">
                      <span className="text-xs font-medium text-[#e8e8e0]">
                        {tweet.author || tweet.authorHandle}
                      </span>
                      <span className="text-[10px] text-[#6b6b72]">@{tweet.authorHandle}</span>
                      <span className="text-[10px] text-[#6b6b72]">{timeAgo(tweet.createdAt)}</span>
                    </div>
                    <p className="text-sm text-[#e8e8e0] leading-relaxed">{tweet.text}</p>
                  </div>
                  {/* Görüntülenme badge */}
                  <div className="shrink-0 text-right">
                    {tweet.views != null ? (
                      <>
                        <div className="text-[10px] text-[#4a4a55]">görüntülenme</div>
                        <div className="text-sm font-bold text-accent">{formatNum(tweet.views)}</div>
                      </>
                    ) : (
                      <>
                        <div className="text-[10px] text-[#4a4a55]">eng</div>
                        <div className="text-sm font-bold text-accent">{formatNum(eng)}</div>
                      </>
                    )}
                  </div>
                </div>

                {/* Engagement stats */}
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="flex items-center gap-1 text-xs font-medium text-[#e8e8e0] bg-white/[0.05] px-2 py-0.5 rounded-full">
                    ❤ {formatNum(tweet.likes)}
                  </span>
                  <span className="flex items-center gap-1 text-xs font-medium text-[#e8e8e0] bg-white/[0.05] px-2 py-0.5 rounded-full">
                    💬 {formatNum(tweet.replies || 0)}
                  </span>
                  <span className="flex items-center gap-1 text-xs font-medium text-[#e8e8e0] bg-white/[0.05] px-2 py-0.5 rounded-full">
                    🔁 {formatNum(tweet.retweets || 0)}
                  </span>
                  {tweet.views != null && (
                    <span className="flex items-center gap-1 text-xs text-[#6b6b72] bg-white/[0.03] px-2 py-0.5 rounded-full">
                      👁 {formatNum(tweet.views)}
                    </span>
                  )}
                  <a
                    href={tweet.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="ml-auto text-[10px] text-accent/60 hover:text-accent transition-colors"
                  >
                    X'te aç ↗
                  </a>
                </div>

                {/* Reply üret butonu */}
                {!replyState && (
                  <button
                    onClick={() => handleGenerateReply(tweet)}
                    className="w-full text-xs py-1.5 rounded-lg bg-accent/10 hover:bg-accent/20 text-accent transition-colors"
                  >
                    Bu Tweete Reply Üret
                  </button>
                )}

                {replyState?.loading && (
                  <div className="animate-pulse h-8 bg-white/[0.04] rounded-lg" />
                )}

                    {replyState && !replyState.loading && replyState.result && (
                      <div className="space-y-2">
                    <div className="bg-elevated border border-white/[0.07] rounded-lg p-3">
                      <div className="flex items-start justify-between gap-2 mb-1.5">
                        <p className="text-xs text-[#e8e8e0] leading-relaxed whitespace-pre-wrap flex-1">
                          {replyState.result}
                        </p>
                        {replyState.scoring && (
                          <span className="text-[9px] text-[#4a4a55] shrink-0 animate-pulse">Skor...</span>
                        )}
                        {!replyState.scoring && replyState.xquikScore !== undefined && (
                          <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border shrink-0 ${scoreColor(replyState.xquikScore)}`}>
                            {replyState.xquikScore}
                          </span>
                        )}
                      </div>
                      {replyState.topSuggestion && (
                        <p className="text-[10px] text-accent-yellow/80 mt-1 leading-relaxed border-t border-white/[0.05] pt-1.5">
                          💡 {replyState.topSuggestion}
                        </p>
                      )}
                    </div>

                    <div className="flex gap-2">
                      <button
                        onClick={() => handleCopyReply(tweet.id, replyState.result)}
                        className="flex-1 text-xs py-1.5 rounded-lg bg-white/[0.05] hover:bg-white/[0.09] text-[#e8e8e0] transition-colors"
                      >
                        {replyState.copied ? 'Kopyalandı!' : 'Kopyala'}
                      </button>
                      <a
                        href={tweet.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="px-3 text-xs py-1.5 rounded-lg bg-white/[0.05] hover:bg-white/[0.09] text-[#6b6b72] transition-colors"
                      >
                        X'te Reply At
                      </a>
                      <button
                        onClick={() => handleGenerateReply(tweet, { attempt: 2, retryNote: 'Daha doğal, daha kısa ve tweeti tekrar etmeyen bir ikinci deneme yap.' })}
                        className="px-3 text-xs py-1.5 rounded-lg bg-white/[0.05] hover:bg-white/[0.09] text-[#6b6b72] transition-colors"
                      >
                        Tekrar Dene
                      </button>
                      {!replyState.result.startsWith('(') && (
                        <button
                          onClick={() => handleArchive(tweet, replyState.result, replyState.xquikScore)}
                          disabled={replyState.archived}
                          className={`px-3 text-xs py-1.5 rounded-lg transition-colors ${
                            replyState.archived
                              ? 'bg-accent-green/10 text-accent-green cursor-default'
                              : 'bg-white/[0.05] hover:bg-white/[0.09] text-[#6b6b72]'
                          }`}
                        >
                          {replyState.archived ? '✓ Arşiv' : 'Arşivle'}
                        </button>
                      )}
                    </div>
                    {renderRetryButtons(tweet, replyState)}
                  </div>
                )}
              </div>
            );
          })}
        </div>
        </>)}
      </div>
      </div>
    </div>
    </div>
  );
}
