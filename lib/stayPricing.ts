export const STAY_PRICE_REFERENCE = {
  '2026-w1': { quoted: 6124.8, rounded: 6125, usdApprox: 194.77 },
  '2026-w2': { quoted: 4904.0, rounded: 4904, usdApprox: 155.95 },
  '2026-w3': { quoted: 5025.6, rounded: 5026, usdApprox: 159.82 },
  '2026-w4': { quoted: 5120.0, rounded: 5120, usdApprox: 162.82 },
} as const;

export function roundStayPriceTwd(value: number): number {
  return Math.ceil(value);
}
