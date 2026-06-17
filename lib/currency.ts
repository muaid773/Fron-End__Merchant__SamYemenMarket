/**
 * currency.ts — Single source of truth for all currency display logic.
 *
 * IMPORTANT: Every page, form, and service that references currencies
 * MUST import CURRENCIES and Currency from here. Never hardcode
 * ["YER","USD","SAR"] inline elsewhere.
 */

// ─── Supported Currencies ────────────────────────────────────────────────────
export const CURRENCIES = ["YER", "USD", "SAR"] as const;
export type Currency = (typeof CURRENCIES)[number];

// ─── Display helpers ─────────────────────────────────────────────────────────
export const CURRENCY_LABEL: Record<Currency, string> = {
  YER: "ريال يمني",
  USD: "دولار أمريكي",
  SAR: "ريال سعودي",
};

export const CURRENCY_SYMBOL: Record<Currency, string> = {
  YER: "﷼",
  USD: "$",
  SAR: "ر.س",
};

export const CURRENCY_FLAG: Record<Currency, string> = {
  YER: "🇾🇪",
  USD: "🇺🇸",
  SAR: "🇸🇦",
};

/**
 * Format a monetary value for display (e.g. "250.00 YER").
 */
export function formatMoney(amount: number, currency: Currency): string {
  const fixed = amount.toFixed(2);
  return `${fixed} ${currency}`;
}

// ─── Delivery Fee Config ──────────────────────────────────────────────────────
// Mirrors backend config.py — keep in sync if changed there.
export const MIN_BASE_FEE: Record<Currency, number> = {
  USD: 2.0,
  SAR: 7.5,
  YER: 500.0,
};

export const DELIVERY_PER_KM: Record<Currency, number> = {
  USD: 0.5,
  SAR: 1.5,
  YER: 100.0,
};

export const DELIVERY_PER_KG: Record<Currency, number> = {
  USD: 0.5,
  SAR: 1.5,
  YER: 100.0,
};

/**
 * Estimate the delivery fee for a given distance, weight and currency.
 * Uses the same formula as the backend. Returns 0 if inputs are invalid.
 */
export function estimateDeliveryFee(
  distanceKm: number,
  weightKg: number,
  currency: Currency
): number {
  if (distanceKm < 0 || weightKg < 0) return 0;
  const base = MIN_BASE_FEE[currency];
  const distFee = distanceKm * DELIVERY_PER_KM[currency];
  const weightFee = weightKg * DELIVERY_PER_KG[currency];
  return Math.round((base + distFee + weightFee) * 100) / 100;
}
