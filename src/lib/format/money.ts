/** --- YAML
 * name: Money Formatter
 * description: Унифицированное форматирование цены и валютного символа.
 *              Используется и на клиентских страницах, и в cron-уведомлениях,
 *              и в master public profile. UAH → «грн», USD → «$» и т.д.
 * created: 2026-04-26
 * --- */

export const CURRENCY_LABEL: Record<string, string> = {
  UAH: '₴',
  USD: '$',
  EUR: '€',
  RUB: '₽',
  PLN: 'zł',
  GBP: '£',
  CZK: 'Kč',
  KZT: '₸',
  TRY: '₺',
};

/** "1350 грн" / "59.50 €" / "1000" если валюта неизвестна */
export function formatMoney(
  price: number | string | null | undefined,
  currency: string | null | undefined,
): string {
  if (price == null || price === '') return '';
  const n = typeof price === 'string' ? Number(price) : price;
  if (!Number.isFinite(n) || n < 0) return '';
  const cur = (currency ?? 'UAH').toUpperCase();
  const label = CURRENCY_LABEL[cur] ?? cur;
  // 1350.00 → "1350"; 59.50 → "59.50"; 0.99 → "0.99"
  const numStr = Number.isInteger(n) ? String(n) : Number(n.toFixed(2)).toString();
  return `${numStr} ${label}`;
}

/** Только символ/код: «грн», «$» и т.д. */
export function currencySymbol(currency: string | null | undefined): string {
  const cur = (currency ?? 'UAH').toUpperCase();
  return CURRENCY_LABEL[cur] ?? cur;
}
