export function SkeletonCard() {
  return (
    <div className="bg-card border border-white/[0.07] rounded-xl p-4 space-y-3 overflow-hidden">
      <div className="h-4 animate-shimmer rounded-lg w-full" />
      <div className="h-4 animate-shimmer rounded-lg w-4/5" />
      <div className="h-4 animate-shimmer rounded-lg w-3/5" />
      <div className="flex gap-2 mt-3">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="h-1.5 flex-1 animate-shimmer rounded-full" />
        ))}
      </div>
      <div className="flex gap-2">
        <div className="h-8 flex-1 animate-shimmer rounded-lg" />
        <div className="h-8 flex-1 animate-shimmer rounded-lg" />
        <div className="h-8 w-12 animate-shimmer rounded-lg" />
      </div>
    </div>
  );
}
