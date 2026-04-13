import { useState } from 'react';
import type { TweetVariation } from '../lib/claude';
import { claudeApi } from '../lib/claude';
import { SCORING_CRITERIA } from '../lib/skill';
import { scoreColor } from '../lib/utils';
import { xquikApi } from '../lib/xquik';
import type { XquikScore } from '../lib/xquik';

interface TweetCardProps {
  tweet: TweetVariation;
  onSave?: (tweet: TweetVariation) => void;
  maxLength?: number;
  hasPremium?: boolean;
  xquikKey?: string;
  twitterUsername?: string;
  claudeKey?: string;
  impressionType?: string;
}

function scoreBarColor(score: number, max: number) {
  const pct = (score / max) * 100;
  if (pct >= 80) return 'bg-accent-green';
  if (pct >= 60) return 'bg-accent-yellow';
  if (pct >= 40) return 'bg-accent-orange';
  return 'bg-accent-red';
}

function estimateDwellTime(text: string): { minutes: number; label: string; tip: string } {
  const words = text.trim().split(/\s+/).length;
  const minutes = words / 180;
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

export function TweetCard({
  tweet, onSave, maxLength = 280, hasPremium = true,
  xquikKey, twitterUsername, claudeKey, impressionType = 'general',
}: TweetCardProps) {
  const [copied, setCopied] = useState(false);
  const [saved, setSaved] = useState(false);
  const [showGoldenHour, setShowGoldenHour] = useState(false);

  // Grok live score
  const [liveScore, setLiveScore] = useState<XquikScore | null>(null);
  const [scoreLoading, setScoreLoading] = useState(false);
  const [showChecklist, setShowChecklist] = useState(false);

  // Direkt paylaşım
  const [postState, setPostState] = useState<'idle' | 'editing' | 'loading' | 'done' | 'error'>('idle');
  const [editText, setEditText] = useState(tweet.text);
  const [postedId, setPostedId] = useState('');

  // Görsel öneri
  const [visualPrompt, setVisualPrompt] = useState('');
  const [visualLoading, setVisualLoading] = useState(false);
  const [visualCopied, setVisualCopied] = useState(false);
  const [visualError, setVisualError] = useState('');
  // Görsel paneli: tweet kaydedilince veya skoru yüksekse otomatik expand
  const [visualOpen, setVisualOpen] = useState(false);

  const charCount = tweet.text.length;
  const hasLink = /https?:\/\/\S+/i.test(tweet.text);
  const showLinkWarning = !hasPremium && hasLink;
  const dwell = estimateDwellTime(tweet.text);

  // Kaydet sonrası görsel paneli aç
  const handleSave = () => {
    onSave?.(tweet);
    setSaved(true);
    setVisualOpen(true); // kaydet → görsel öneri öne çık
    setTimeout(() => setSaved(false), 2000);
  };

  const handleCopy = async () => {
    await navigator.clipboard.writeText(tweet.text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleOpenX = () => {
    window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(tweet.text)}`, '_blank');
    setShowGoldenHour(true);
  };

  const handleLiveScore = async () => {
    if (!xquikKey || scoreLoading) return;
    setScoreLoading(true);
    try {
      const result = await xquikApi.scoreTweet(xquikKey, tweet.text);
      setLiveScore(result);
      setShowChecklist(true);
      if (result && result.total >= 70) setVisualOpen(true); // yüksek skor → görsel öner
    } catch { /* sessiz hata */ }
    setScoreLoading(false);
  };

  const handleDirectPost = async () => {
    if (!xquikKey || !twitterUsername || postState === 'loading') return;
    setPostState('loading');
    try {
      const result = await xquikApi.postTweet(xquikKey, twitterUsername, editText);
      if (result?.tweetId) {
        setPostedId(result.tweetId);
        setPostState('done');
        setShowGoldenHour(true);
      } else {
        setPostState('error');
        setTimeout(() => setPostState('idle'), 3000);
      }
    } catch {
      setPostState('error');
      setTimeout(() => setPostState('idle'), 3000);
    }
  };

  const handleGenerateVisual = async () => {
    if (!claudeKey || visualLoading) return;
    setVisualLoading(true);
    setVisualError('');
    setVisualPrompt('');
    try {
      const prompt = await claudeApi.generateVisualPrompt(claudeKey, tweet.text, impressionType);
      setVisualPrompt(prompt);
    } catch (e: any) {
      setVisualError(e.message || 'Görsel prompt üretilemedi.');
    }
    setVisualLoading(false);
  };

  const handleCopyVisual = async () => {
    if (!visualPrompt) return;
    await navigator.clipboard.writeText(visualPrompt);
    setVisualCopied(true);
    setTimeout(() => setVisualCopied(false), 2000);
  };

  return (
    <div className="relative bg-card border border-white/[0.07] rounded-xl p-4 space-y-3 hover:border-white/[0.14] hover:shadow-[0_8px_32px_rgba(0,0,0,0.45)] transition-all duration-200 overflow-hidden">

      {/* Sol üst köşe: yüksek skor çizgisi */}
      {tweet.total_score >= 85 && (
        <div className="absolute left-0 top-0 bottom-0 w-[3px] bg-gradient-to-b from-[#4ade80]/80 via-[#4ade80]/50 to-transparent rounded-l-xl" />
      )}

      {/* Tweet metni */}
      <p className="text-[#e8e8e0] text-sm leading-relaxed whitespace-pre-wrap">
        {tweet.text}
      </p>

      {/* Skor + dwell + karakter */}
      <div className="flex items-center justify-between gap-2">
        <span className={`text-sm font-bold px-3 py-1 rounded-full border ${scoreColor(tweet.total_score)}`}>
          {tweet.total_score}/100
        </span>
        <span
          title={dwell.tip}
          className={`text-[10px] px-2 py-0.5 rounded-full border cursor-default ${
            dwell.minutes >= 2 ? 'text-accent-green bg-accent-green/10 border-accent-green/20'
            : dwell.minutes >= 1 ? 'text-accent-yellow bg-accent-yellow/10 border-accent-yellow/20'
            : 'text-[#6b6b72] bg-white/[0.04] border-white/[0.07]'
          }`}
        >
          {dwell.label} okuma
        </span>
        <span className={`text-xs ${charCount > maxLength ? 'text-accent-red' : 'text-[#6b6b72]'}`}>
          {charCount}/{maxLength}
        </span>
      </div>

      {/* Mini skor çubukları */}
      <div className="space-y-1.5">
        {Object.entries(SCORING_CRITERIA).map(([key, crit]) => {
          const val = tweet.scores[key as keyof typeof tweet.scores] ?? 0;
          const pct = Math.round((val / crit.weight) * 100);
          return (
            <div key={key} className="flex items-center gap-2" title={crit.description}>
              <span className="text-[10px] text-[#6b6b72] w-28 shrink-0 truncate">{crit.label}</span>
              <div className="flex-1 h-1 bg-white/[0.06] rounded-full overflow-hidden">
                <div className={`h-full rounded-full transition-all ${scoreBarColor(val, crit.weight)}`}
                  style={{ width: `${pct}%` }} />
              </div>
              <span className="text-[10px] text-[#6b6b72] w-8 text-right">{val}/{crit.weight}</span>
            </div>
          );
        })}
      </div>

      {/* Skor notu */}
      {tweet.score_reason && (
        <p className="text-[11px] text-[#6b6b72] italic border-t border-white/[0.05] pt-2">
          {tweet.score_reason}
        </p>
      )}

      {/* Grok Canlı Skor */}
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
              <div className="flex items-center justify-between">
                <span className="text-[10px] text-[#6b6b72]">Grok Checklist</span>
                <div className="flex items-center gap-2">
                  <span className={`text-[10px] font-semibold ${liveScore.passed ? 'text-accent-green' : 'text-accent-orange'}`}>
                    {liveScore.passedCount}/{liveScore.totalChecks} geçti
                  </span>
                  <button onClick={() => setShowChecklist(!showChecklist)}
                    className="text-[10px] text-[#4a4a55] hover:text-[#8b8b96] transition-colors">
                    {showChecklist ? 'gizle' : 'göster'}
                  </button>
                </div>
              </div>
              {liveScore.topSuggestion && (
                <p className="text-[10px] text-accent-yellow bg-accent-yellow/[0.06] border border-accent-yellow/20 rounded-lg px-2.5 py-1.5 leading-relaxed">
                  {liveScore.topSuggestion}
                </p>
              )}
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
                          <p className="text-[9px] text-[#6b6b72] mt-0.5 leading-relaxed">{item.suggestion}</p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
              <button onClick={() => { setLiveScore(null); setShowChecklist(false); }}
                className="text-[9px] text-[#4a4a55] hover:text-[#6b6b72] transition-colors">
                tekrar skor al
              </button>
            </div>
          )}
        </div>
      )}

      {/* ── Görsel Öneri ────────────────────────────────────────── */}
      <div className={`border-t border-white/[0.05] pt-2.5 transition-all ${visualOpen ? '' : ''}`}>
        {/* Başlık satırı — her zaman görünür, tıklanabilir */}
        <button
          onClick={() => setVisualOpen(!visualOpen)}
          className="w-full flex items-center justify-between group"
        >
          <div className="flex items-center gap-2">
            <span className="text-base">🎨</span>
            <span className="text-xs font-semibold text-[#8b8b96] group-hover:text-[#e8e8e0] transition-colors">
              Görsel Öneri
            </span>
            {/* Kaydet sonrası "yeni" badge */}
            {saved && (
              <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-accent/10 text-accent border border-accent/20 animate-pulse">
                önerildi
              </span>
            )}
          </div>
          <span className="text-[10px] text-[#4a4a55] group-hover:text-[#6b6b72] transition-colors">
            {visualOpen ? '▲' : '▼'}
          </span>
        </button>

        {/* Açık durum içeriği */}
        {visualOpen && (
          <div className="mt-2.5 space-y-2">
            {!claudeKey ? (
              /* Key yok */
              <div className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl bg-white/[0.02] border border-white/[0.06]">
                <span className="text-sm">🔑</span>
                <div>
                  <p className="text-[11px] font-medium text-[#6b6b72]">Claude API key gerekli</p>
                  <p className="text-[10px] text-[#4a4a55] mt-0.5">
                    Ayarlar'dan Claude key ekle → Midjourney / DALL-E prompt üretilir
                  </p>
                </div>
              </div>
            ) : !visualPrompt ? (
              /* Key var, henüz üretilmedi */
              <div className="space-y-1.5">
                <p className="text-[10px] text-[#6b6b72] leading-relaxed">
                  Bu tweet için{' '}
                  <span className="text-[#8b8b96] font-medium">
                    {impressionType === 'Data' ? 'infografik' :
                     impressionType === 'Story' ? 'fotoğraf' :
                     impressionType === 'Edu' ? 'diyagram' :
                     impressionType === 'Inspire' ? 'quote kart' :
                     impressionType === 'Humor' ? 'meme görseli' : 'görsel'}
                  </span>{' '}
                  stili Midjourney/DALL-E promptu oluştur.
                </p>
                <button
                  onClick={handleGenerateVisual}
                  disabled={visualLoading}
                  className="w-full flex items-center justify-center gap-2 py-2 rounded-xl border border-accent/25 text-accent/80 hover:text-accent hover:border-accent/50 hover:bg-accent/[0.05] text-xs font-medium transition-all disabled:opacity-50"
                >
                  {visualLoading ? (
                    <>
                      <span className="w-3 h-3 border border-accent/40 border-t-accent rounded-full animate-spin" />
                      Prompt oluşturuluyor...
                    </>
                  ) : (
                    <>
                      <span>✨</span>
                      Görsel Prompt Üret
                    </>
                  )}
                </button>
                {visualError && (
                  <p className="text-[10px] text-accent-red text-center">{visualError}</p>
                )}
              </div>
            ) : (
              /* Prompt hazır */
              <div className="space-y-2">
                <div className="bg-white/[0.03] border border-white/[0.08] rounded-xl px-3 py-2.5">
                  <p className="text-[11px] text-[#c8c8d0] leading-relaxed font-mono">{visualPrompt}</p>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={handleCopyVisual}
                    className="flex-1 py-1.5 rounded-lg bg-accent/[0.1] hover:bg-accent/[0.18] text-accent text-[10px] font-medium transition-colors"
                  >
                    {visualCopied ? '✓ Kopyalandı' : '📋 Kopyala'}
                  </button>
                  <button
                    onClick={() => { setVisualPrompt(''); setVisualError(''); }}
                    className="px-3 py-1.5 rounded-lg bg-white/[0.04] hover:bg-white/[0.08] text-[#6b6b72] text-[10px] transition-colors"
                  >
                    Yenile
                  </button>
                </div>
                <p className="text-[9px] text-[#4a4a55] text-center">
                  Midjourney, DALL-E 3, Ideogram veya Firefly'a yapıştır
                </p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Premium uyarısı */}
      {showLinkWarning && (
        <div className="bg-accent-orange/10 border border-accent-orange/30 rounded-lg px-3 py-2 text-[11px] text-accent-orange">
          ⚠ Free hesap: Link tweet içinde = sıfır reach. Linki reply'a taşı.
        </div>
      )}

      {/* Golden Hour hatırlatması */}
      {showGoldenHour && (
        <div className="bg-accent-green/10 border border-accent-green/30 rounded-xl px-3 py-2.5 space-y-1">
          <p className="text-xs font-semibold text-accent-green">⚡ İlk 1 saat kritik!</p>
          <p className="text-[11px] text-[#e8e8e0]">
            Şimdi kendi tweetine 2-3 reply yaz. Gelen her reply'a hemen cevap ver.
          </p>
          <p className="text-[10px] text-[#6b6b72]">
            reply_engaged_by_author = 75 ağırlık — like'in 150 katı. En güçlü sinyal bu.
          </p>
          <button onClick={() => setShowGoldenHour(false)}
            className="text-[10px] text-[#6b6b72] hover:text-[#e8e8e0] mt-1 transition-colors">
            kapat
          </button>
        </div>
      )}

      {/* Düzenle & At */}
      {xquikKey && twitterUsername && postState !== 'done' && (
        <div className="border-t border-white/[0.05] pt-2">
          {postState === 'idle' && (
            <button
              onClick={() => { setEditText(tweet.text); setPostState('editing'); }}
              className="w-full text-[10px] py-1.5 rounded-lg border border-accent-green/20 text-accent-green/70 hover:text-accent-green hover:border-accent-green/40 hover:bg-accent-green/[0.04] transition-all"
            >
              ✍️ Düzenle & At — @{twitterUsername.replace(/^@/, '')}
            </button>
          )}
          {postState === 'editing' && (
            <div className="space-y-2">
              <div className="relative">
                <textarea
                  value={editText}
                  onChange={(e) => setEditText(e.target.value)}
                  rows={5}
                  className="w-full bg-[#0e0e11] border border-accent-green/25 rounded-xl px-3 py-2.5 text-sm text-[#e8e8e0] resize-none focus:border-accent-green/50 focus:outline-none transition-all leading-relaxed"
                />
                <span className={`absolute bottom-2 right-2.5 text-[10px] ${editText.length > maxLength ? 'text-accent-red' : 'text-[#4a4a55]'}`}>
                  {editText.length}/{maxLength}
                </span>
              </div>
              {!hasPremium && /https?:\/\/\S+/i.test(editText) && (
                <p className="text-[10px] text-accent-orange bg-accent-orange/[0.06] border border-accent-orange/20 rounded-lg px-2.5 py-1.5">
                  ⚠ Free hesap: link tweet içine yazma, reach sıfırlanır.
                </p>
              )}
              <div className="flex gap-2">
                <button
                  onClick={handleDirectPost}
                  disabled={!editText.trim() || editText.length > maxLength}
                  className="flex-1 text-xs py-2 rounded-lg bg-accent-green/[0.14] text-accent-green hover:bg-accent-green/[0.22] transition-colors font-semibold disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  🚀 At
                </button>
                <button
                  onClick={() => setPostState('idle')}
                  className="px-4 text-xs py-2 rounded-lg bg-white/[0.04] text-[#6b6b72] hover:bg-white/[0.08] transition-colors"
                >
                  İptal
                </button>
              </div>
            </div>
          )}
          {postState === 'loading' && (
            <div className="flex items-center justify-center gap-2 py-2">
              <span className="w-3 h-3 border border-accent-green/40 border-t-accent-green rounded-full animate-spin" />
              <span className="text-[10px] text-accent-green/70">Gönderiliyor...</span>
            </div>
          )}
          {postState === 'error' && (
            <p className="text-[10px] text-accent-red text-center py-1">
              ✗ Gönderilemedi. Hesabın xquik'e bağlı mı kontrol et.
            </p>
          )}
        </div>
      )}
      {postState === 'done' && postedId && (
        <div className="border-t border-white/[0.05] pt-2 flex items-center justify-between">
          <span className="text-[10px] text-accent-green font-medium">✓ Tweet gönderildi!</span>
          <a href={`https://x.com/i/web/status/${postedId}`} target="_blank" rel="noreferrer"
            className="text-[10px] text-accent hover:text-accent/80 transition-colors">
            tweeti gör →
          </a>
        </div>
      )}

      {/* Aksiyon butonları */}
      <div className="flex gap-2 pt-1">
        <button onClick={handleCopy}
          className="flex-1 text-xs py-1.5 rounded-lg bg-white/[0.05] hover:bg-white/[0.09] text-[#e8e8e0] transition-colors">
          {copied ? '✓ Kopyalandı' : 'Kopyala'}
        </button>
        <button onClick={handleSave}
          className="flex-1 text-xs py-2 rounded-lg bg-accent/10 hover:bg-accent/20 text-accent transition-colors font-medium">
          {saved ? '✓ Kaydedildi' : 'Kaydet'}
        </button>
        <button onClick={handleOpenX}
          className="px-3 text-xs py-1.5 rounded-lg bg-white/[0.05] hover:bg-white/[0.09] text-[#6b6b72] hover:text-[#e8e8e0] transition-colors"
          title="X'te Aç">
          𝕏
        </button>
      </div>
    </div>
  );
}
