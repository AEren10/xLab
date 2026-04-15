export interface DiscoveryFilters {
  hours: number;
  minRetweets: number;
  minViews: number;
  minBookmarks: number;
}

export const DISCOVERY_HOUR_OPTIONS = [2, 12, 24, 48, 72] as const;
export const DISCOVERY_RT_OPTIONS = [0, 25, 50, 100, 250] as const;
export const DISCOVERY_VIEW_OPTIONS = [0, 10_000, 25_000, 50_000, 100_000] as const;
export const DISCOVERY_BOOKMARK_OPTIONS = [0, 5, 10, 25, 50] as const;

const STORAGE_KEYS = {
  hours: 'gen_viral_hours',
  minRetweets: 'gen_viral_min_rt',
  minViews: 'gen_viral_min_views',
  minBookmarks: 'gen_viral_min_bookmarks',
} as const;

const DEFAULT_FILTERS: DiscoveryFilters = {
  hours: 12,
  minRetweets: 25,
  minViews: 25_000,
  minBookmarks: 10,
};

function readNumber(key: string, fallback: number): number {
  if (typeof window === 'undefined') return fallback;
  const raw = window.sessionStorage.getItem(key);
  const parsed = raw ? Number(raw) : NaN;
  return Number.isFinite(parsed) ? parsed : fallback;
}

export function loadDiscoveryFilters(): DiscoveryFilters {
  return {
    hours: readNumber(STORAGE_KEYS.hours, DEFAULT_FILTERS.hours),
    minRetweets: readNumber(STORAGE_KEYS.minRetweets, DEFAULT_FILTERS.minRetweets),
    minViews: readNumber(STORAGE_KEYS.minViews, DEFAULT_FILTERS.minViews),
    minBookmarks: readNumber(STORAGE_KEYS.minBookmarks, DEFAULT_FILTERS.minBookmarks),
  };
}

export function saveDiscoveryFilters(filters: DiscoveryFilters): void {
  if (typeof window === 'undefined') return;
  window.sessionStorage.setItem(STORAGE_KEYS.hours, String(filters.hours));
  window.sessionStorage.setItem(STORAGE_KEYS.minRetweets, String(filters.minRetweets));
  window.sessionStorage.setItem(STORAGE_KEYS.minViews, String(filters.minViews));
  window.sessionStorage.setItem(STORAGE_KEYS.minBookmarks, String(filters.minBookmarks));
}

export function formatCompactCount(value: number): string {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}m`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(1)}k`;
  return `${value}`;
}

