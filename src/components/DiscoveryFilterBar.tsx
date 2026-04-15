import {
  DISCOVERY_BOOKMARK_OPTIONS,
  DISCOVERY_HOUR_OPTIONS,
  DISCOVERY_RT_OPTIONS,
  DISCOVERY_VIEW_OPTIONS,
  formatCompactCount,
} from '../lib/discoveryFilters';

interface DiscoveryFilterBarProps {
  title: string;
  subtitle?: string;
  hours: number;
  minRetweets: number;
  minViews: number;
  minBookmarks: number;
  onHoursChange: (value: number) => void;
  onMinRetweetsChange: (value: number) => void;
  onMinViewsChange: (value: number) => void;
  onMinBookmarksChange: (value: number) => void;
}

function FilterGroup({
  label,
  items,
  value,
  onChange,
  tone,
}: {
  label: string;
  items: readonly number[];
  value: number;
  onChange: (value: number) => void;
  tone: 'accent' | 'green' | 'yellow' | 'neutral';
}) {
  const toneClass = {
    accent: 'bg-accent text-white',
    green: 'bg-accent-green text-white',
    yellow: 'bg-accent-yellow text-white',
    neutral: 'bg-[#7c6af7] text-white',
  }[tone];

  return (
    <div className="space-y-1">
      <p className="text-[9px] uppercase tracking-[0.18em] text-[#4a4a55]">{label}</p>
      <div className="flex flex-wrap gap-1.5">
        {items.map((item) => (
          <button
            key={item}
            onClick={() => onChange(item)}
            className={`text-[10px] px-2 py-1 rounded-md transition-colors ${
              value === item
                ? toneClass
                : 'bg-white/[0.05] text-[#6b6b72] hover:text-[#e8e8e0]'
            }`}
          >
            {item === 0
              ? '0+'
              : label === 'Saat'
                ? `${item}s`
                : label === 'Görüntülenme'
                ? `${formatCompactCount(item)}+`
                : `${item}+`}
          </button>
        ))}
      </div>
    </div>
  );
}

export function DiscoveryFilterBar({
  title,
  subtitle,
  hours,
  minRetweets,
  minViews,
  minBookmarks,
  onHoursChange,
  onMinRetweetsChange,
  onMinViewsChange,
  onMinBookmarksChange,
}: DiscoveryFilterBarProps) {
  return (
    <div className="rounded-2xl border border-white/[0.07] bg-white/[0.03] p-3 space-y-3">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h3 className="text-[11px] font-semibold text-[#e8e8e0] uppercase tracking-[0.14em]">
            {title}
          </h3>
          {subtitle && (
            <p className="text-[10px] text-[#6b6b72] mt-0.5 leading-relaxed">{subtitle}</p>
          )}
        </div>
        <span className="text-[9px] px-2 py-1 rounded-full bg-accent/[0.1] text-accent border border-accent/20">
          xquik
        </span>
      </div>

      <div className="space-y-2">
        <FilterGroup
          label="Saat"
          items={DISCOVERY_HOUR_OPTIONS}
          value={hours}
          onChange={onHoursChange}
          tone="accent"
        />
        <FilterGroup
          label="RT"
          items={DISCOVERY_RT_OPTIONS}
          value={minRetweets}
          onChange={onMinRetweetsChange}
          tone="green"
        />
        <FilterGroup
          label="Görüntülenme"
          items={DISCOVERY_VIEW_OPTIONS}
          value={minViews}
          onChange={onMinViewsChange}
          tone="neutral"
        />
        <FilterGroup
          label="Bookmark"
          items={DISCOVERY_BOOKMARK_OPTIONS}
          value={minBookmarks}
          onChange={onMinBookmarksChange}
          tone="yellow"
        />
      </div>
    </div>
  );
}
