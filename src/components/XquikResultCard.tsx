import { useState } from 'react';
import type { XquikTweetResult } from '../lib/xquik';
import { xquikApi } from '../lib/xquik';

interface Props {
  result: XquikTweetResult;
  index: number;
  xquikKey: string;
  twitterUsername?: string;
  onSave?: (text: string) => void;
}

export function XquikResultCard({ result, index, xquikKey, twitterUsername, onSave }: Props) {
  const [copied, setCopied] = useState(false);
  const [saved, setSaved] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editText, setEditText] = useState(result.text);
  const [showChecklist, setShowChecklist] = useState(false);
  const [postState, setPostState] = useState<'idle' | 'editing' | 'loading' | 'done' | 'error'>('idle');
  const [postEditText, setPostEditText] = useState(result.text);
  const [postedId, setPostedId] = useState('');

  const score = result.score;
  const pct = score ? Math.round((score.passedCount / score.totalChecks) * 100) : 0;
  const scoreColor = pct >= 80 ? 'text-accent-green border-accent-green/30 bg-accent-green/10'
    : pct >= 60 ? 'text-accent-yellow border-accent-yellow/30 bg-accent-yellow/10'
    : 'text-accent-orange border-accent-orange/30 bg-accent-orange/10';

  const handleCopy = async () => {
    await navigator.clipboard.writeText(editText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSave = () => {
    onSave?.(editText);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const handlePost = async () => {
    if (!xquikKey || !twitterUsername || postState === 'loading') return;
    setPostState('loading');
    const result = await xquikApi.postTweet(xquikKey, twitterUsername, postEditText);
    if (result?.tweetId) {
      setPostedId(result.tweetId);
      setPostState('done');
    } else {
      setPostState('error');
      setTimeout(() => setPostState('idle'), 3000);
    }
  };

  const failed = score?.checklist.filter(c => !c.passed) ?? [];
  const passed = score?.checklist.filter(c => c.passed) ?? [];

  return (
    <div className="bg-card border border-accent/20 rounded-xl p-4 space-y-3 hover:border-accent/35 transition-all">

      {/* Başlık: xquik badge + skor */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-[10px] px-2 py-0.5 rounded-full bg-accent/10 text-accent border border-accent/20 font-medium">
            xquik #{index + 1}
          </span>
          <span className="text-[9px] text-[#4a4a55]">compose → refine → score</span>
        </div>
        {score && (
          <span className={`text-xs font-bold px-2.5 py-0.5 rounded-full border ${scoreColor}`}>
            {score.passedCount}/{score.totalChecks} kural
          </span>
        )}
      </div>

      {/* Tweet metni — inline edit */}
      {editing ? (
        <div className="space-y-1.5">
          <textarea
            value={editText}
            onChange={e => setEditText(e.target.value)}
            rows={4}
            className="w-full bg-[#0e0e11] border border-accent/25 rounded-xl px-3 py-2.5 text-sm text-[#e8e8e0] resize-none focus:border-accent/50 focus:outline-none transition-all"
            autoFocus
          />
          <div className="flex justify-between items-center">
            <span className="text-[10px] text-[#4a4a55]">{editText.length}/280</span>
            <button onClick={() => setEditing(false)} className="text-[10px] text-accent hover:text-accent/80">
              ✓ Tamam
            </button>
          </div>
        </div>
      ) : (
        <p
          onClick={() => setEditing(true)}
          className="text-sm text-[#e8e8e0] leading-relaxed whitespace-pre-wrap cursor-text hover:bg-white/[0.02] rounded-lg p-1 -m-1 transition-colors"
          title="Düzenlemek için tıkla"
        >
          {editText}
        </p>
      )}

      {/* xquik Checklist */}
      {score && (
        <div className="space-y-1.5">
          {/* Progress bar */}
          <div className="flex items-center gap-2">
            <div className="flex-1 h-1 bg-white/[0.06] rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${pct >= 80 ? 'bg-accent-green' : pct >= 60 ? 'bg-accent-yellow' : 'bg-accent-orange'}`}
                style={{ width: `${pct}%` }}
              />
            </div>
            <button
              onClick={() => setShowChecklist(!showChecklist)}
              className="text-[10px] text-[#4a4a55] hover:text-[#8b8b96] transition-colors shrink-0"
            >
              {showChecklist ? 'gizle' : `detay (${failed.length} hata)`}
            </button>
          </div>

          {score.topSuggestion && (
            <p className="text-[10px] text-accent-yellow bg-accent-yellow/[0.06] border border-accent-yellow/20 rounded-lg px-2.5 py-1.5 leading-relaxed">
              {score.topSuggestion}
            </p>
          )}

          {showChecklist && (
            <div className="bg-white/[0.02] rounded-lg p-2 space-y-1">
              {failed.map((item, i) => (
                <div key={i} className="flex items-start gap-2">
                  <span className="text-[10px] text-accent-red shrink-0 mt-0.5">✗</span>
                  <div>
                    <span className="text-[10px] text-[#e8e8e0]">{item.factor}</span>
                    {item.suggestion && <p className="text-[9px] text-[#6b6b72] mt-0.5">{item.suggestion}</p>}
                  </div>
                </div>
              ))}
              {passed.length > 0 && (
                <p className="text-[9px] text-[#4a4a55] pt-1">+ {passed.length} kural geçti</p>
              )}
            </div>
          )}
        </div>
      )}

      {/* Düzenle & At */}
      {xquikKey && twitterUsername && postState !== 'done' && (
        <div className="border-t border-white/[0.05] pt-2">
          {postState === 'idle' && (
            <button
              onClick={() => { setPostEditText(editText); setPostState('editing'); }}
              className="w-full text-[10px] py-1.5 rounded-lg border border-accent-green/20 text-accent-green/70 hover:text-accent-green hover:border-accent-green/40 hover:bg-accent-green/[0.04] transition-all"
            >
              ✍️ Düzenle & At — @{twitterUsername.replace(/^@/, '')}
            </button>
          )}
          {postState === 'editing' && (
            <div className="space-y-2">
              <textarea
                value={postEditText}
                onChange={e => setPostEditText(e.target.value)}
                rows={4}
                className="w-full bg-[#0e0e11] border border-accent-green/25 rounded-xl px-3 py-2.5 text-sm text-[#e8e8e0] resize-none focus:border-accent-green/50 focus:outline-none transition-all"
              />
              <div className="flex gap-2">
                <button onClick={handlePost} disabled={!postEditText.trim()}
                  className="flex-1 text-xs py-2 rounded-lg bg-accent-green/[0.14] text-accent-green hover:bg-accent-green/[0.22] font-semibold disabled:opacity-40 transition-colors">
                  🚀 At
                </button>
                <button onClick={() => setPostState('idle')}
                  className="px-4 text-xs py-2 rounded-lg bg-white/[0.04] text-[#6b6b72] hover:bg-white/[0.08] transition-colors">
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
            <p className="text-[10px] text-accent-red text-center py-1">✗ Gönderilemedi.</p>
          )}
        </div>
      )}
      {postState === 'done' && postedId && (
        <div className="border-t border-white/[0.05] pt-2 flex items-center justify-between">
          <span className="text-[10px] text-accent-green font-medium">✓ Tweet gönderildi!</span>
          <a href={`https://x.com/i/web/status/${postedId}`} target="_blank" rel="noreferrer"
            className="text-[10px] text-accent hover:text-accent/80">tweeti gör →</a>
        </div>
      )}

      {/* Aksiyonlar */}
      <div className="flex gap-2">
        <button onClick={handleCopy}
          className="flex-1 text-xs py-1.5 rounded-lg bg-white/[0.05] hover:bg-white/[0.09] text-[#e8e8e0] transition-colors">
          {copied ? '✓ Kopyalandı' : 'Kopyala'}
        </button>
        <button onClick={handleSave}
          className="flex-1 text-xs py-2 rounded-lg bg-accent/10 hover:bg-accent/20 text-accent font-medium transition-colors">
          {saved ? '✓ Kaydedildi' : 'Kaydet'}
        </button>
        <button onClick={() => setEditing(!editing)}
          className="px-3 text-xs py-1.5 rounded-lg bg-white/[0.05] hover:bg-white/[0.09] text-[#6b6b72] hover:text-[#e8e8e0] transition-colors"
          title="Düzenle">
          ✏️
        </button>
      </div>
    </div>
  );
}
