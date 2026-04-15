import type { TweetSearchResult } from '../lib/xquik';

interface InspirationSpotlightProps {
  topic: string;
  tweets: TweetSearchResult[];
  selectedIds: string[];
  onToggleSelect: (tweetId: string) => void;
  onSelectTop: () => void;
  onClear: () => void;
  onUseAsTopic: (text: string) => void;
}

function formatCount(n: number): string {
  if (!n) return '0';
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return String(n);
}

function PreviewMedia({ tweet }: { tweet: TweetSearchResult }) {
  if (!tweet.mediaPreviewUrl) return null;
  return (
    <div className="relative overflow-hidden rounded-2xl border border-white/[0.08] bg-white/[0.02]">
      <div className="relative aspect-[16/9] w-full">
        <img
          src={tweet.mediaPreviewUrl}
          alt={tweet.text.slice(0, 80)}
          loading="lazy"
          className="h-full w-full object-cover"
        />
        {tweet.isVideo && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/25">
            <span className="rounded-full border border-white/20 bg-black/50 px-3 py-1 text-[10px] text-white">
              Video
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

function QuotedTweet({ tweet }: { tweet: TweetSearchResult }) {
  const quotedText = tweet.quotedText?.trim();
  if (!quotedText) return null;

  return (
    <div className="rounded-xl border border-white/[0.07] bg-white/[0.03] p-3">
      <div className="flex items-center gap-2 text-[10px] text-[#8b8b96] mb-1.5">
        <span className="rounded-full bg-white/[0.05] px-1.5 py-0.5">Alıntı</span>
        {tweet.quotedAuthorHandle && <span>@{tweet.quotedAuthorHandle}</span>}
      </div>
      <p className="text-[11px] leading-relaxed text-[#8b8b96]">
        {quotedText}
      </p>
      {tweet.quotedMediaPreviewUrl && (
        <div className="mt-2 overflow-hidden rounded-lg border border-white/[0.06]">
          <img
            src={tweet.quotedMediaPreviewUrl}
            alt={quotedText.slice(0, 50)}
            loading="lazy"
            className="h-28 w-full object-cover"
          />
        </div>
      )}
    </div>
  );
}

export function InspirationSpotlight({
  topic,
  tweets,
  selectedIds,
  onToggleSelect,
  onSelectTop,
  onClear,
  onUseAsTopic,
}: InspirationSpotlightProps) {
  const selectedCount = selectedIds.length;
  const previewTweets = tweets;

  return (
    <div className="space-y-4">
      <div className="premium-panel overflow-hidden">
        <div className="flex items-start justify-between gap-3 px-4 py-3.5 border-b border-white/[0.05]">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-[#e8e8e0]">Örnek Tweetler</span>
              <span className="rounded-full border border-accent/20 bg-accent/10 px-1.5 py-0.5 text-[9px] text-accent">
                xquik
              </span>
              {selectedCount > 0 && (
                <span className="rounded-full border border-accent-green/20 bg-accent-green/10 px-1.5 py-0.5 text-[9px] text-accent-green">
                  seçili {selectedCount}
                </span>
              )}
            </div>
            <p className="text-[11px] text-[#6b6b72] leading-relaxed max-w-2xl">
              Konuyu yazınca önce örnek tweetleri burada büyükçe gör. 3-5 tanesini seç; seçtiklerin prompta gider ama diğer örnekler kaybolmaz.
            </p>
          </div>
          <div className="flex flex-col items-end gap-2 shrink-0">
            <div className="flex gap-1.5">
              <button
                onClick={onSelectTop}
                className="rounded-full bg-white/[0.05] px-2.5 py-1 text-[10px] text-[#e8e8e0] transition-colors hover:bg-white/[0.09]"
              >
                İlk 4
              </button>
              <button
                onClick={onClear}
                className="rounded-full bg-white/[0.05] px-2.5 py-1 text-[10px] text-[#6b6b72] transition-colors hover:bg-white/[0.09]"
              >
                Temizle
              </button>
            </div>
            <span className="text-[9px] text-[#4a4a55]">
              {topic.trim() ? `Konu: ${topic.trim().slice(0, 60)}` : 'Konu yazınca burada örnekler açılır.'}
            </span>
          </div>
        </div>

        {previewTweets.length === 0 ? (
          <div className="grid gap-3 p-4 md:grid-cols-2">
            <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-5 md:col-span-2">
              <p className="text-sm font-medium text-[#e8e8e0] mb-1">Bir konu yaz ve tweet örneklerini burada büyüt</p>
              <p className="text-xs text-[#6b6b72] leading-relaxed">
                Sağdaki panel arama havuzunu gösterecek. Burada ise seçtiğin 3-5 tweeti tam olarak okuyup daraltılmış brief çıkaracağız.
              </p>
            </div>
          </div>
        ) : (
          <div className="grid gap-4 p-4 xl:grid-cols-2">
            {previewTweets.map((tweet) => {
              const selected = selectedIds.includes(tweet.id);
              return (
                <article
                  key={tweet.id}
                  className={`rounded-2xl border p-4 transition-colors ${
                    selected
                      ? 'border-accent-green/30 bg-accent-green/[0.04]'
                      : 'border-white/[0.07] bg-white/[0.02] hover:bg-white/[0.035]'
                  }`}
                >
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-[#e8e8e0]">@{tweet.authorHandle || 'user'}</p>
                      <p className="mt-1 text-[10px] text-[#6b6b72]">
                        {formatCount(tweet.likes)} like · {formatCount(tweet.replies)} reply · {formatCount(tweet.bookmarkCount || 0)} bookmark
                      </p>
                    </div>
                    <button
                      onClick={() => onToggleSelect(tweet.id)}
                      className={`shrink-0 rounded-full border px-2.5 py-1 text-[10px] transition-colors ${
                        selected
                          ? 'border-accent-green/20 bg-accent-green/10 text-accent-green'
                          : 'border-white/[0.07] bg-white/[0.03] text-[#6b6b72] hover:bg-white/[0.08] hover:text-[#e8e8e0]'
                      }`}
                    >
                      {selected ? 'Seçili' : 'Seç'}
                    </button>
                  </div>

                  <p className="text-sm leading-relaxed text-[#e8e8e0] whitespace-pre-wrap">
                    {tweet.text}
                  </p>

                  {tweet.mediaPreviewUrl && <div className="mt-3"><PreviewMedia tweet={tweet} /></div>}
                  {tweet.quotedText && <div className="mt-3"><QuotedTweet tweet={tweet} /></div>}

                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <button
                      onClick={() => onUseAsTopic(tweet.text)}
                      className="text-[10px] text-accent/70 transition-colors hover:text-accent"
                    >
                      Konuya ekle →
                    </button>
                    {tweet.quotedUrl && (
                      <a
                        href={tweet.quotedUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[10px] text-[#6b6b72] transition-colors hover:text-[#e8e8e0]"
                      >
                        Alıntıyı aç ↗
                      </a>
                    )}
                    <a
                      href={tweet.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="ml-auto text-[10px] text-[#6b6b72] transition-colors hover:text-[#e8e8e0]"
                    >
                      X'te aç ↗
                    </a>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
