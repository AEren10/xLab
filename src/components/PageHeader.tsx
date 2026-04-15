import type { ReactNode } from 'react';

type Chip = {
  label: string;
  tone?: 'neutral' | 'accent' | 'green' | 'yellow' | 'orange';
};

interface PageHeaderProps {
  kicker: string;
  title: string;
  subtitle: string;
  chips?: Chip[];
  actions?: ReactNode;
  compact?: boolean;
}

const chipToneClass: Record<NonNullable<Chip['tone']>, string> = {
  neutral: 'primary-chip',
  accent: 'primary-chip primary-chip-accent',
  green: 'primary-chip border-accent-green/25 bg-accent-green/10 text-accent-green',
  yellow: 'primary-chip border-accent-yellow/25 bg-accent-yellow/10 text-accent-yellow',
  orange: 'primary-chip border-accent-orange/25 bg-accent-orange/10 text-accent-orange',
};

export function PageHeader({ kicker, title, subtitle, chips = [], actions, compact = false }: PageHeaderProps) {
  return (
    <div className={`premium-panel-strong ${compact ? 'p-4 md:p-4.5' : 'p-5 md:p-6'}`}>
      <div className={`flex flex-col ${compact ? 'gap-3 md:flex-row md:items-start md:justify-between' : 'gap-4 md:flex-row md:items-end md:justify-between'}`}>
        <div className={compact ? 'space-y-1.5' : 'space-y-2'}>
          <p className={`page-kicker ${compact ? 'text-[9px]' : ''}`}>{kicker}</p>
          <h1 className={`${compact ? 'text-[16px] md:text-[17px]' : 'page-title'}`}>{title}</h1>
          <p className={`${compact ? 'text-[11px] leading-relaxed text-[#8b8b96] max-w-2xl' : 'page-subtitle max-w-2xl'}`}>{subtitle}</p>
        </div>
        {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
      </div>
      {chips.length > 0 && (
        <div className={`${compact ? 'mt-3 gap-1.5' : 'mt-4 gap-2'} flex flex-wrap`}>
          {chips.map((chip) => (
            <span
              key={chip.label}
              className={`${chipToneClass[chip.tone || 'neutral']} ${compact ? 'px-2 py-0.5 text-[9px]' : ''}`}
            >
              {chip.label}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
