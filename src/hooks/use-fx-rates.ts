/** --- YAML
 * name: useFxRates
 * description: Loads latest currency rates (UAH base) from currency_rates table. Provides convert(amount, from, to).
 * created: 2026-04-12
 * updated: 2026-04-12
 * --- */

'use client';

import { useCallback, useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';

export type FxRates = Record<string, number>;

export const SUPPORTED_CURRENCIES = ['UAH', 'USD', 'EUR', 'PLN', 'GBP'] as const;
export type SupportedCurrency = (typeof SUPPORTED_CURRENCIES)[number];

export function useFxRates() {
  const [rates, setRates] = useState<FxRates | null>(null);
  const [date, setDate] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      const supabase = createClient();
      const { data } = await supabase
        .from('currency_rates')
        .select('date, rates')
        .order('date', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (!alive) return;
      if (data) {
        setRates((data.rates as FxRates) ?? null);
        setDate(data.date as string);
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  const convert = useCallback(
    (amount: number, from: string, to: string): number => {
      if (from === to) return amount;
      if (!rates) return amount;
      const fromRate = from === 'UAH' ? 1 : rates[from];
      const toRate = to === 'UAH' ? 1 : rates[to];
      if (!fromRate || !toRate) return amount;
      const inUah = amount / fromRate;
      return inUah * toRate;
    },
    [rates],
  );

  return { rates, date, convert, ready: rates !== null };
}
