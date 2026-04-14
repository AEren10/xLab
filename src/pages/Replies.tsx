/**
 * Reply Fırsatları
 *
 * Mantık: Büyük hesaplara kaliteli reply atmak = juice transfer (trustscore aktarımı).
 * xquik search ile nişe göre yüksek engagement'lı tweetleri bulur.
 * Her tweet için "Reply Üret" butonu var; Claude API ile reply üretir.
 */

import { useState, useCallback } from 'react';
import { db } from '../lib/db';
import { xquikApi } from '../lib/xquik';
import type { TweetSearchResult } from '../lib/xquik';
import { claudeApi } from '../lib/claude';

function formatNum(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return String(n);
}

function timeAgo(dateStr: string): string {
  if (!dateStr) return '';
  const diff = (Date.now() - new Date(dateStr).getTime()) / 60000;
  if (diff < 60) return `${Math.round(diff)}dk önce`;
  return `${Math.round(diff / 60)}sa önce`;
}

function engScore(t: TweetSearchResult): number {
  return t.likes + (t.replies || 0) * 5 + (t.retweets || 0) * 2 + (t.views ? Math.round(t.views / 100) : 0);
}

function scoreColor(score: number): string {
  if (score >= 75) return 'text-accent-green bg-accent-green/10 border-accent-green/30';
  if (score >= 50) return 'text-accent-yellow bg-accent-yellow/10 border-accent-yellow/30';
  return 'text-accent-red bg-accent-red/10 border-accent-red/30';
}

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

  const [panelWidth, setPanelWidth] = useState(200);

  const handleResizeStart = (e: React.MouseEvent) => {
    e.preventDefault();
    const startX = e.clientX;
    const startW = panelWidth;
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';

    const onMove = (ev: MouseEvent) => {
      const next = Math.min(520, Math.max(200, startW + (ev.clientX - startX)));
      setPanelWidth(next);
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

  const [query, setQuery] = useState(settings.niche || '');
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

  const effectiveMinFaves = minFavesCustom ? Number(minFavesCustom) : minFaves;

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

    let q = query + accountFilter;
    if (effectiveMinFaves > 0) q += ` min_faves:${effectiveMinFaves}`;
    if (minRetweets > 0) q += ` min_retweets:${minRetweets}`;

    const results = await xquikApi.searchTweets(settings.xquikKey, q, {
      lang: 'tr',
      hours,
      limit: 15,
    });

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
    setSearching(false);
  }, [query, hours, effectiveMinFaves, minRetweets, hasXquik, priorityAccounts, settings.xquikKey, sortBy]);

  const handleGenerateReply = useCallback(
    async (tweet: TweetSearchResult) => {
      setReplies((prev) => ({
        ...prev,
        [tweet.id]: { tweetId: tweet.id, text: '', loading: true, result: '', copied: false, archived: false, scoring: false },
      }));

      const replyPrompt = `Sen deneyimli bir Twitter kullanıcısısın. Aşağıdaki tweete güçlü bir reply yaz.

KURAL:
- Maksimum 180 karakter
- Değer ekle veya ilginç bir açı getir
- Soru veya açık uç ile bitir — diyaloğu sürdür
- İnsan gibi yaz (em dash yok, bullet yok)
- Türkçe, hashtag ve emoji yok

HEDEF TWEET (${formatNum(tweet.likes)} beğeni, ${formatNum(tweet.replies || 0)} reply):
@${tweet.authorHandle}: ${tweet.text}

Sadece reply metnini döndür, açıklama yapma.`;

      let result = '';

      if (settings.claudeKey) {
        try {
          result = await claudeApi.generateReply(settings.claudeKey, tweet.text, tweet.authorHandle || 'user');
        } catch {
          result = '';
        }
      }

      if (!result) {
        await navigator.clipboard.writeText(replyPrompt).catch(() => {});
        result = '(Claude API key yok — Ayarlar\'dan ekle)';
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
    [settings]
  );

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
    <div className="flex h-full gap-0">
      {/* Sol panel — filtreler */}
      <div
        style={{ width: panelWidth, minWidth: 160, maxWidth: 400 }}
        className="shrink-0 border-r border-white/[0.07] p-3 space-y-3 overflow-y-auto"
      >
        <div>
          <label className="text-xs text-[#6b6b72] mb-1.5 block">Arama konusu / niche</label>
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
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
      </div>

      {/* Resize handle */}
      <div
        onMouseDown={handleResizeStart}
        className="w-3 shrink-0 cursor-col-resize flex items-center justify-center group hover:bg-accent/10 active:bg-accent/20 transition-colors"
        title="Sürükle"
      >
        <div className="w-0.5 h-10 rounded-full bg-white/[0.15] group-hover:bg-accent/60 group-active:bg-accent transition-colors" />
      </div>

      {/* Sağ panel — sonuçlar */}
      <div className="flex-1 p-4 overflow-y-auto">
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
                        onClick={() => handleGenerateReply(tweet)}
                        className="px-3 text-xs py-1.5 rounded-lg bg-white/[0.05] hover:bg-white/[0.09] text-[#6b6b72] transition-colors"
                      >
                        Yenile
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
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
