import { useState } from 'react';
import type { UserTweet } from '../lib/xquik';

/**
 * AccountHealth — Sol panelde hesap durumu ve feedback loop özeti.
 * TweepCred tahmini: gerçek skor API'de yok, hesabın özelliklerine göre tahmin.
 * userTweets varsa: son tweetlerin ortalama engagement'ı ve en iyi tweet gösterilir.
 */
export function AccountHealth({ settings, userTweets }: { settings: any; userTweets: UserTweet[] }) {
  const [open, setOpen] = useState(false);

  // TweepCred kaba tahmini
  const tweepCredTier = settings.hasPremium
    ? { label: '65+ muhtemelen', color: 'text-accent-green', note: 'Mavi tik +100 başlangıç → dağıtım eşiği aşıldı' }
    : { label: 'Belirsiz', color: 'text-accent-yellow', note: '65 altında = sadece 3 tweet seçiliyor. Mavi tik alınırsa garantilenir' };

  // Gerçek engagement ortalaması
  const avgEng = userTweets.length > 0
    ? Math.round(userTweets.reduce((s, t) => s + t.likes + t.replies * 5 + t.retweets * 2, 0) / userTweets.length)
    : null;

  // En iyi tweet
  const topTweet = userTweets.length > 0
    ? [...userTweets].sort((a, b) => (b.likes + b.replies * 5 + b.retweets * 2) - (a.likes + a.replies * 5 + a.retweets * 2))[0]
    : null;

  return (
    <div className="rounded-xl border border-white/[0.07] overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-3.5 py-2.5 hover:bg-white/[0.03] transition-colors"
      >
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-medium text-[#8b8b96]">Hesap Durumu</span>
          {userTweets.length > 0 && (
            <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-accent-green/10 text-accent-green border border-accent-green/20">
              {userTweets.length} tweet
            </span>
          )}
        </div>
        <span className="text-[#4a4a55] text-[10px]">{open ? '▲' : '▼'}</span>
      </button>

      {open && (
        <div className="px-3.5 pb-3.5 pt-1 border-t border-white/[0.05] space-y-3">
          {/* TweepCred tahmini */}
          <div>
            <p className="text-[9px] font-semibold text-[#4a4a55] uppercase tracking-wider mb-1.5">TweepCred Tahmini</p>
            <div className="flex items-center justify-between">
              <span className={`text-[11px] font-semibold ${tweepCredTier.color}`}>{tweepCredTier.label}</span>
              <span className="text-[9px] text-[#4a4a55]">eşik: 65</span>
            </div>
            <p className="text-[10px] text-[#6b6b72] mt-1 leading-relaxed">{tweepCredTier.note}</p>
          </div>

          {/* Gerçek engagement verisi */}
          {userTweets.length > 0 ? (
            <div>
              <p className="text-[9px] font-semibold text-[#4a4a55] uppercase tracking-wider mb-1.5">
                Son {userTweets.length} Tweet — Gerçek X Verisi
              </p>
              {avgEng !== null && (
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[10px] text-[#8b8b96]">Ort. algo skoru</span>
                  <span className={`text-[11px] font-semibold ${avgEng >= 50 ? 'text-accent-green' : avgEng >= 20 ? 'text-accent-yellow' : 'text-[#6b6b72]'}`}>
                    {avgEng}
                  </span>
                </div>
              )}
              {topTweet && (
                <div className="bg-white/[0.03] rounded-lg px-2.5 py-2">
                  <p className="text-[9px] text-accent-green mb-1">En iyi tweet</p>
                  <p className="text-[10px] text-[#e8e8e0] leading-relaxed line-clamp-2">
                    {topTweet.text.slice(0, 100)}...
                  </p>
                  <p className="text-[9px] text-[#4a4a55] mt-1">
                    {topTweet.likes} like · {topTweet.replies} reply · {topTweet.retweets} rt
                  </p>
                </div>
              )}
            </div>
          ) : !settings.twitterUsername ? (
            <p className="text-[10px] text-[#6b6b72] leading-relaxed">
              Ayarlar'a Twitter kullanıcı adını ekle → gerçek performans verisi buraya çekilir.
            </p>
          ) : !settings.xquikKey ? (
            <p className="text-[10px] text-[#6b6b72] leading-relaxed">
              xquik API key gerekli → Ayarlar'dan ekle.
            </p>
          ) : (
            <p className="text-[10px] text-[#4a4a55]">Tweetler yükleniyor...</p>
          )}
        </div>
      )}
    </div>
  );
}
