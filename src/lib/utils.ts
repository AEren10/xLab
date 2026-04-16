import type { TweetSearchResult } from './xquik';

export type ReplyLength = 'short' | 'standard' | 'long';

export function formatNum(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return String(n);
}

export function timeAgo(dateStr: string): string {
  if (!dateStr) return '';
  const diff = (Date.now() - new Date(dateStr).getTime()) / 60000;
  if (diff < 60) return `${Math.round(diff)}dk önce`;
  return `${Math.round(diff / 60)}sa önce`;
}

export function engScore(t: TweetSearchResult): number {
  return t.likes + (t.replies || 0) * 5 + (t.retweets || 0) * 2 + (t.views ? Math.round(t.views / 100) : 0);
}

/** Reply ekranı için skor rengi (75/50 eşikleri) */
export function replyScoreColor(score: number): string {
  if (score >= 75) return 'text-accent-green bg-accent-green/10 border-accent-green/30';
  if (score >= 50) return 'text-accent-yellow bg-accent-yellow/10 border-accent-yellow/30';
  return 'text-accent-red bg-accent-red/10 border-accent-red/30';
}

export function normalizeText(text: string): string {
  return (text || '')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9çğıöşü\s-]/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function shouldRetryReply(tweet: TweetSearchResult, reply: string, replyLength: ReplyLength): boolean {
  const cleanReply = normalizeText(reply);
  const cleanTweet = normalizeText(tweet.text);
  if (!cleanReply) return true;

  const replyWords = cleanReply.split(' ').filter((w) => w.length > 3);
  const tweetWords = cleanTweet.split(' ').filter((w) => w.length > 3);
  const overlap = replyWords.filter((w) => tweetWords.includes(w)).length;
  const overlapRatio = replyWords.length > 0 ? overlap / replyWords.length : 0;

  const bands: Record<ReplyLength, [number, number]> = {
    short: [35, 90],
    standard: [55, 130],
    long: [90, 180],
  };
  const [min, max] = bands[replyLength];
  if (reply.length < Math.floor(min * 0.8) || reply.length > Math.ceil(max * 1.2)) return true;

  if (overlap >= 5 || overlapRatio >= 0.45) return true;
  if (cleanTweet && cleanReply.startsWith(cleanTweet.slice(0, 24))) return true;
  if (/^(açısından|şimdi|tabii ki|tam da|aslında|evet|hayır)\b/i.test(reply.trim())) return true;

  return false;
}

/** Skor değerine göre Tailwind renk sınıfı döner */
export function scoreColor(score: number): string {
  if (score >= 85) return 'text-accent-green bg-accent-green/10 border-accent-green/30';
  if (score >= 70) return 'text-accent-yellow bg-accent-yellow/10 border-accent-yellow/30';
  if (score >= 50) return 'text-accent-orange bg-accent-orange/10 border-accent-orange/30';
  return 'text-accent-red bg-accent-red/10 border-accent-red/30';
}

/** History sayfası için border'sız skor rengi */
export function scoreColorSimple(score: number): string {
  if (score >= 85) return 'text-accent-green bg-accent-green/10';
  if (score >= 70) return 'text-accent-yellow bg-accent-yellow/10';
  if (score >= 50) return 'text-accent-orange bg-accent-orange/10';
  return 'text-accent-red bg-accent-red/10';
}
