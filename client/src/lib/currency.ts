import type { Currency } from "@shared/schema-mongo";
import type { Locale } from "@/hooks/use-translation";

/** Base currency for storage - all amounts in DB are USD */
export const BASE_CURRENCY = "USD";

/** Approximate USD to target currency rates (update periodically; for display only) */
const USD_RATES: Record<Exclude<Currency, "USD">, number> = {
  MXN: 17.5,
  BRL: 5.2,
};

/** Map locale to default currency when user hasn't set preference */
export const LOCALE_TO_CURRENCY: Record<Locale, Currency> = {
  "en-US": "USD",
  "es-US": "USD",
  "es-MX": "MXN",
  "pt-BR": "BRL",
};

/**
 * Convert amount in USD to target currency for display.
 * Uses approximate rates; amounts are stored in USD.
 */
export function convertUsdToCurrency(amountUsd: number, currency: Currency): number {
  if (currency === "USD") return amountUsd;
  return amountUsd * (USD_RATES[currency] ?? 1);
}

/**
 * Format a monetary amount for display.
 * @param amountUsd - Amount in USD (base currency)
 * @param currency - Display currency
 * @param options - Intl.NumberFormatOptions (e.g. minimumFractionDigits)
 */
export function formatCurrency(
  amountUsd: number,
  currency: Currency,
  options?: Intl.NumberFormatOptions,
): string {
  const amount = convertUsdToCurrency(amountUsd, currency);
  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
    ...options,
  }).format(amount);
}

/** Get the currency symbol for display (e.g. "$", "MX$", "R$") */
export function getCurrencySymbol(currency: Currency): string {
  return (
    new Intl.NumberFormat(undefined, {
      style: "currency",
      currency,
    })
      .formatToParts(0)
      .find((p) => p.type === "currency")?.value ?? "$"
  );
}

/**
 * Format cents (e.g. roundUpBalanceCents) as currency.
 */
export function formatCentsAsCurrency(
  centsUsd: number,
  currency: Currency,
  options?: Intl.NumberFormatOptions,
): string {
  return formatCurrency(centsUsd / 100, currency, options);
}
