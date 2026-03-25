import { useState } from 'react';

interface ContextPreviewProps {
  prompt: string;
}

export function ContextPreview({ prompt }: ContextPreviewProps) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(prompt);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="border border-white/[0.07] rounded-xl overflow-hidden">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-white/[0.03] transition-colors"
      >
        <span className="text-xs font-medium text-[#e8e8e0]">Prompt Onizleme</span>
        <span className="text-[#6b6b72] text-xs">{open ? '▲' : '▼'}</span>
      </button>

      {open && (
        <div className="border-t border-white/[0.05]">
          <pre className="px-4 py-3 text-[11px] text-[#6b6b72] overflow-auto max-h-48 whitespace-pre-wrap leading-relaxed">
            {prompt || 'Konu gir ve prompt oluştur...'}
          </pre>
          <div className="px-4 pb-3">
            <button
              onClick={handleCopy}
              className="w-full text-xs py-1.5 rounded-lg bg-accent/10 hover:bg-accent/20 text-accent transition-colors"
            >
              {copied ? 'Kopyalandı!' : 'Promptu Kopyala (claude.ai için)'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
