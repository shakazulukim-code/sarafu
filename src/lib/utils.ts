import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Get the effective price for a coin:
 * - If use_price_override is true, return price_override
 * - Otherwise, return the market-driven price
 */
export function getEffectivePrice(coin: any): number {
  if (coin.use_price_override && coin.price_override) {
    return coin.price_override;
  }
  return coin.price || 0.001;
}

/**
 * Check if a coin is using admin price override
 */
export function isUsingPriceOverride(coin: any): boolean {
  return coin.use_price_override && coin.price_override ? true : false;
}

