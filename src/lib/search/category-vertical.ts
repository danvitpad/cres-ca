/** --- YAML
 * name: Category → Vertical mapping
 * description: Маппинг UI-категорий клиентского поиска в реальные значения
 *              `masters.vertical` (которые записывает онбординг). Раньше фильтр
 *              «Красота / Здоровье / Авто …» искал переводное слово в свободном
 *              тексте `specialization` через ilike — мастер «Парикмахер Светлана»
 *              не попадал в категорию «Красота» если в спец-поле не было слова.
 *              Теперь фильтр сначала проверяет точное `vertical = 'beauty'`,
 *              а на fallback (для старых мастеров с пустым vertical) — ilike по
 *              specialization. Тот же маппинг применяют web и Mini App.
 * created: 2026-05-10
 * --- */

export type CategoryKey =
  | 'all'
  | 'beauty'
  | 'health'
  | 'wellness'
  | 'auto'
  | 'fitness'
  | 'petCare'
  | 'education'
  | 'home';

/** Vertical-значения как их пишет онбординг (`/[locale]/onboarding/vertical`). */
export type VerticalKey =
  | 'beauty'
  | 'health'
  | 'auto'
  | 'tattoo'
  | 'pets'
  | 'craft'
  | 'fitness'
  | 'events'
  | 'education'
  | 'other';

/**
 * UI-категория → vertical (или null если точного соответствия нет — тогда
 * фильтрация откатится на substring-ilike по specialization).
 *
 * Особенности:
 *   - `petCare` (ключ в UI) → `pets` (значение в БД)
 *   - `wellness` → `health` (массаж/SPA относятся к здоровью)
 *   - `home` → null: нет соответствующей вертикали (наш «home» — это
 *     сантехник/электрик/уборка; в onboarding ниши `craft` — про ремонт/пошив,
 *     не точно то же), поэтому используем fallback на ilike.
 */
export const CATEGORY_TO_VERTICAL: Record<CategoryKey, VerticalKey | null> = {
  all: null,
  beauty: 'beauty',
  health: 'health',
  wellness: 'health',
  auto: 'auto',
  fitness: 'fitness',
  petCare: 'pets',
  education: 'education',
  home: null,
};

/**
 * Локализованные подписи категорий — используются как fallback для ilike
 * (если у мастера vertical пустой, ищем эти слова в specialization).
 * Берём все три локали — мастер мог написать «Краса» или «Красота» или «Beauty».
 */
export const CATEGORY_FALLBACK_TERMS: Record<CategoryKey, string[]> = {
  all: [],
  beauty: ['красота', 'краса', 'beauty'],
  health: ['здоровье', "здоров'я", 'health', 'wellness'],
  wellness: ['массаж', 'масаж', 'massage', 'spa', 'wellness'],
  auto: ['авто', 'auto', 'car'],
  fitness: ['фитнес', 'фітнес', 'fitness', 'йога', 'yoga'],
  petCare: ['питомцы', 'тварини', 'pets', 'pet'],
  education: ['обучение', 'навчання', 'education', 'tutor', 'репетитор'],
  home: ['дом', 'дім', 'home'],
};
