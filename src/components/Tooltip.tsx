/**
 * Tooltip — label'ın yanındaki ℹ ikonuna hover edilince açıklama gösterir.
 * Kullanım: <Tooltip text="açıklama metni" />
 * Opsiyonel: side="right" (default) veya side="left" — panel kenarına göre ayarla
 */

interface TooltipProps {
  text: string;
  side?: 'right' | 'left';
}

export function Tooltip({ text, side = 'right' }: TooltipProps) {
  return (
    <span className="group relative inline-flex items-center cursor-help ml-1 align-middle">
      <span className="text-[10px] text-[#6b6b72]/50 hover:text-[#6b6b72] transition-colors leading-none select-none">
        ⓘ
      </span>
      <span
        className={`
          pointer-events-none absolute z-50 hidden group-hover:block
          bg-[#1c1c22] border border-white/[0.12] rounded-xl
          px-3 py-2.5 text-[11px] text-[#c8c8c0] leading-relaxed
          w-56 shadow-2xl shadow-black/60
          top-1/2 -translate-y-1/2
          ${side === 'right' ? 'left-6' : 'right-6'}
        `}
      >
        {text}
      </span>
    </span>
  );
}
