/**
 * Reply Fırsatları — TODO Item 3
 *
 * Mantık: Büyük hesaplara kaliteli reply atmak = juice transfer (trustscore aktarımı).
 * Bu sayfa xquik search ile nişe göre son 2 saatte atılmış, yüksek engagement'lı
 * tweetleri bulur. Her tweet için "Reply Üret" butonu var; Claude API veya copy-paste
 * modunda reply prompt'u hazırlar.
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

interface ReplyResult {
  tweetId: string;
  text: string;
  loading: boolean;
  result: string;
  copied: boolean;
}

export function Replies() {
  const settings = db.getSettings();
  const hasXquik = Boolean(settings.xquikKey);

  const [query, setQuery] = useState(settings.niche || '');
  const [hours, setHours] = useState(2);
  const [minFaves, setMinFaves] = useState(100);
  const [tweets, setTweets] = useState<TweetSearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [searchErr, setSearchErr] = useState('');
  const [priorityAccounts, setPriorityAccounts] = useState('');

  // Her tweet için ayrı reply üretim state'i
  const [replies, setReplies] = useState<Record<string, ReplyResult>>({});

  const handleSearch = useCallback(async () => {
    if (!query.trim() || !hasXquik) return;
    setSearching(true);
    setSearchErr('');
    setTweets([]);

    // Priority accounts eklenmişse query'ye OR olarak ekle
    const accounts = priorityAccounts
      .split(/[,\s]+/)
      .map((a) => a.replace('@', '').trim())
      .filter(Boolean);
    const accountFilter = accounts.length
      ? ' (' + accounts.map((a) => `from:${a}`).join(' OR ') + ')'
      : '';

    const results = await xquikApi.searchTweets(settings.xquikKey, query + accountFilter, {
      minFaves,
      minReplies: 5,
      lang: 'tr',
      hours,
      limit: 12,
    });

    if (results.length === 0) {
      setSearchErr("Sonuç bulunamadı. Query'yi genişlet veya minFaves'i düşür.");
    }
    setTweets(results);
    setSearching(false);
  }, [query, hours, minFaves, hasXquik, priorityAccounts, settings.xquikKey]);

  const handleGenerateReply = useCallback(
    async (tweet: TweetSearchResult) => {
      setReplies((prev) => ({
        ...prev,
        [tweet.id]: { tweetId: tweet.id, text: '', loading: true, result: '', copied: false },
      }));

      // Reply prompt — kısa, değer ekleyen, soru ile biten
      const replyPrompt = `Sen deneyimli bir Twitter kullanıcısısın. Aşağıdaki tweete güçlü bir reply yaz.

KURAL:
- Maksimum 180 karakter
- Değer ekle veya ilginç bir açı getir
- Soru veya açık uç ile bitir — diyaloğu sürdür
- İnsan gibi yaz (em dash yok, bullet yok, "aslında" yok)
- Türkçe
- Hashtag ve emoji yok
- Orijinal tweeti kopyalama

HEDEF TWEET:
@${tweet.authorHandle}: ${tweet.text}

Sadece reply metnini döndür, açıklama yapma.`;

      let result = '';

      if (settings.claudeKey) {
        try {
          // Basit tek mesaj çağrısı — tweet üretiminden farklı format
          const tweets = await claudeApi.generateTweets(
            settings.claudeKey,
            'Sen kısa, güçlü reply yazan bir Twitter uzmanısın.',
            replyPrompt,
            1
          );
          result = tweets[0]?.text || '';
        } catch {
          result = '';
        }
      }

      if (!result) {
        // Copy-paste mod — panoya kopyala
        await navigator.clipboard.writeText(replyPrompt).catch(() => {});
        result = '(API key yok — prompt panoya kopyalandı, claude.ai\'a yapıştır)';
      }

      setReplies((prev) => ({
        ...prev,
        [tweet.id]: { tweetId: tweet.id, text: result, loading: false, result, copied: false },
      }));
    },
    [settings]
  );

  const handleCopyReply = async (tweetId: string, text: string) => {
    await navigator.clipboard.writeText(text).catch(() => {});
    setReplies((prev) => ({
      ...prev,
      [tweetId]: { ...prev[tweetId], copied: true },
    }));
    setTimeout(() => {
      setReplies((prev) => ({
        ...prev,
        [tweetId]: { ...prev[tweetId], copied: false },
      }));
    }, 2000);
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
      <div className="w-72 shrink-0 border-r border-white/[0.07] p-4 space-y-4 overflow-y-auto">
        <div>
          <label className="text-xs text-[#6b6b72] mb-1.5 block">Arama konusu / niche</label>
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
            placeholder="orn: yazılım, kripto, üretkenlik..."
            className="w-full bg-elevated border border-white/[0.07] rounded-xl px-3 py-2.5 text-sm text-[#e8e8e0] placeholder-[#6b6b72] focus:border-accent/50 transition-colors"
          />
        </div>

        <div>
          <label className="text-xs text-[#6b6b72] mb-1.5 block">
            Öncelikli hesaplar{' '}
            <span className="text-[#6b6b72]">(opsiyonel)</span>
          </label>
          <input
            type="text"
            value={priorityAccounts}
            onChange={(e) => setPriorityAccounts(e.target.value)}
            placeholder="@hurricane, @elonmusk..."
            className="w-full bg-elevated border border-white/[0.07] rounded-xl px-3 py-2.5 text-sm text-[#e8e8e0] placeholder-[#6b6b72] focus:border-accent/50 transition-colors"
          />
          <p className="text-[11px] text-[#6b6b72] mt-1">
            Bu hesapların tweetleri öncelikli gösterilir
          </p>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs text-[#6b6b72] mb-1.5 block">Son (saat)</label>
            <select
              value={hours}
              onChange={(e) => setHours(Number(e.target.value))}
              className="w-full bg-elevated border border-white/[0.07] rounded-xl px-2 py-2 text-sm text-[#e8e8e0] focus:border-accent/50 transition-colors"
            >
              {[1, 2, 4, 8, 24].map((h) => (
                <option key={h} value={h} className="bg-[#18181c]">{h}sa</option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs text-[#6b6b72] mb-1.5 block">Min. beğeni</label>
            <select
              value={minFaves}
              onChange={(e) => setMinFaves(Number(e.target.value))}
              className="w-full bg-elevated border border-white/[0.07] rounded-xl px-2 py-2 text-sm text-[#e8e8e0] focus:border-accent/50 transition-colors"
            >
              {[20, 50, 100, 250, 500].map((f) => (
                <option key={f} value={f} className="bg-[#18181c]">{f}+</option>
              ))}
            </select>
          </div>
        </div>

        <button
          onClick={handleSearch}
          disabled={!query.trim() || searching}
          className="w-full py-2.5 rounded-xl bg-accent hover:bg-accent/90 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-medium transition-colors"
        >
          {searching ? 'Aranıyor...' : 'Fırsatları Bul'}
        </button>

        {/* Açıklama */}
        <div className="border border-white/[0.07] rounded-xl p-3 space-y-1.5">
          <p className="text-[11px] font-medium text-[#e8e8e0]">Neden reply?</p>
          <p className="text-[10px] text-[#6b6b72] leading-relaxed">
            Büyük hesaplara kaliteli reply = juice transfer.
            reply_engaged_by_author sinyal ağırlığı 75 — en kritik sinyal.
          </p>
        </div>
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
              Niche gir, filtrele — son 2 saatin viral tweetlerine reply yaz, büy.
            </p>
          </div>
        )}

        <div className="space-y-3">
          {tweets.map((tweet) => {
            const replyState = replies[tweet.id];
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
                      <span className="text-[10px] text-[#6b6b72]">
                        @{tweet.authorHandle}
                      </span>
                      <span className="text-[10px] text-[#6b6b72]">
                        {timeAgo(tweet.createdAt)}
                      </span>
                    </div>
                    <p className="text-sm text-[#e8e8e0] leading-relaxed">
                      {tweet.text}
                    </p>
                  </div>
                </div>

                {/* Engagement stats */}
                <div className="flex gap-4 text-[10px] text-[#6b6b72]">
                  <span>❤ {formatNum(tweet.likes)}</span>
                  <span>💬 {formatNum(tweet.replies)}</span>
                  <span>🔁 {formatNum(tweet.retweets)}</span>
                  {tweet.views && <span>👁 {formatNum(tweet.views)}</span>}
                  <a
                    href={tweet.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="ml-auto text-accent/60 hover:text-accent transition-colors"
                  >
                    X'te aç ↗
                  </a>
                </div>

                {/* Reply üret butonu + sonuç */}
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
                      <p className="text-xs text-[#e8e8e0] leading-relaxed whitespace-pre-wrap">
                        {replyState.result}
                      </p>
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
