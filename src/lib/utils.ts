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
