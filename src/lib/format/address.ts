/** --- YAML
 * name: Address Formatter
 * description: Чистый рендер адреса мастера. Reverse-geocoded мусор типа
 *              «Харьков, Циркунівська сільська громада, Харьковский район,
 *              Харьковская область, 61127, Украина» нужно нормализовать в
 *              читаемое «вул. ..., Київ» или сжать до клик-ссылки на карту.
 * created: 2026-04-26
 * --- */

const ADMIN_NOISE = [
  'сільська громада', 'сельская громада',
  'район', 'область', 'oblast', 'raion',
  'країна', 'страна', 'country',
  'Україна', 'Украина', 'Ukraine',
  'Російська Федерація', 'Российская Федерация',
];

const POSTAL_RE = /\b\d{5,6}\b/;

/** Удаляет «область / район / громада / индекс / страну» — оставляет улицу + город. */
export function cleanAddress(raw: string | null | undefined): string {
  if (!raw) return '';
  const parts = raw
    .split(/[,،]/)
    .map((p) => p.trim())
    .filter(Boolean)
    // убираем индекс (5-6 цифр)
    .filter((p) => !POSTAL_RE.test(p))
    // убираем административные хвосты
    .filter((p) => !ADMIN_NOISE.some((noise) => p.toLowerCase().includes(noise.toLowerCase())));
  // дедуп подряд идущих одинаковых частей
  const dedup: string[] = [];
  for (const p of parts) {
    if (dedup[dedup.length - 1] !== p) dedup.push(p);
  }
  return dedup.join(', ');
}

/** Собирает адрес для отображения: workplace_name + cleaned address (+ city если address не содержит города). */
export function composeAddress(
  workplaceName: string | null | undefined,
  address: string | null | undefined,
  city: string | null | undefined,
): string {
  const cleaned = cleanAddress(address);
  const cityT = (city ?? '').trim();
  const parts: string[] = [];
  if (workplaceName?.trim()) parts.push(workplaceName.trim());
  if (cleaned) {
    // Если cleanedAddress уже содержит город — не дублируем.
    if (cityT && !cleaned.toLowerCase().includes(cityT.toLowerCase())) {
      parts.push(cleaned, cityT);
    } else {
      parts.push(cleaned);
    }
  } else if (cityT) {
    parts.push(cityT);
  }
  return parts.join(' · ');
}
