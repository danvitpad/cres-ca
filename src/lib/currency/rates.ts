/** --- YAML
 * name: Currency Rates
 * description: NBU exchange rate fetcher with Supabase caching
 * --- */

interface NbuRate {
  r030: number;
  txt: string;
  rate: number;
  cc: string;
  exchangedate: string;
}

export interface CurrencyRates {
  [currency: string]: number;
}

/**
 * Fetch today's exchange rates from National Bank of Ukraine (NBU).
 * Returns rates as { USD: 41.25, EUR: 44.80, PLN: 10.95, ... }
 */
export async function fetchNbuRates(): Promise<CurrencyRates> {
  const res = await fetch(
    'https://bank.gov.ua/NBUStatService/v1/statdirectory/exchange?json',
    { next: { revalidate: 86400 } },
  );

  if (!res.ok) return {};

  const data: NbuRate[] = await res.json();
  const rates: CurrencyRates = { UAH: 1 };

  for (const item of data) {
    rates[item.cc] = item.rate;
  }

  return rates;
}

/**
 * Convert amount from one currency to UAH.
 */
export function toUah(amount: number, currency: string, rates: CurrencyRates): number {
  if (currency === 'UAH') return amount;
  const rate = rates[currency];
  if (!rate) return amount;
  return amount * rate;
}

/**
 * Convert amount between currencies via UAH.
 */
export function convertCurrency(
  amount: number,
  from: string,
  to: string,
  rates: CurrencyRates,
): number {
  if (from === to) return amount;
  const inUah = toUah(amount, from, rates);
  if (to === 'UAH') return inUah;
  const toRate = rates[to];
  if (!toRate) return inUah;
  return inUah / toRate;
}
