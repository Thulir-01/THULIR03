/**
 * Referrer price resolution — the ONE place pricing rules live.
 *
 * Rule (in order of precedence) for a given (referrer, parameter|package):
 *  1. referrer.pricingMode === 'custom' AND a ReferrerPrice override exists
 *     -> use the override price.
 *  2. referrer.pricingMode === 'discount'
 *     -> base price * (1 - discountPercent / 100).
 *  3. otherwise -> base price, where base = fixedPrice for a fixed-priced
 *     package, else defaultPrice.
 *
 * Call this from order registration AND the price-preview/quote screen.
 * Never re-implement the discount math inline in a service.
 */

export interface ReferrerPricing {
  pricingMode: string | null; // 'default' | 'discount' | 'custom'
  discountPercent?: number | null;
}

export interface ResolvePriceOptions {
  code: string;
  /** Catalog default price (or the client-supplied rate as a fallback). */
  defaultPrice: number;
  /** Set when the item is a package priced in 'fixed' mode. */
  fixedPrice?: number | null;
  referrer?: ReferrerPricing | null;
  /** Existing ReferrerPrice override for this exact item (custom mode). */
  overridePrice?: number | null;
}

export function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

export function resolveEffectivePrice(opts: ResolvePriceOptions): number {
  const base = opts.fixedPrice != null ? opts.fixedPrice : opts.defaultPrice;

  const mode = opts.referrer?.pricingMode ?? 'default';

  if (mode === 'custom' && opts.overridePrice != null) {
    return round2(opts.overridePrice);
  }

  if (mode === 'discount' && (opts.referrer?.discountPercent ?? 0) > 0) {
    return round2(base * (1 - (opts.referrer?.discountPercent ?? 0) / 100));
  }

  return round2(base);
}
