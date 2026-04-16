/** --- YAML
 * name: SpecializationsPerVertical
 * description: Списки профессий (специализаций) per-vertical и per-category. Используется в onboarding для выбора конкретной профессии мастера. Источник правды — .knowledge/verticals.md.
 * created: 2026-04-13
 * updated: 2026-04-16
 * --- */

import type { VerticalKey } from './default-services';

/** Specializations grouped by onboarding category key */
export const CATEGORY_SPECIALIZATIONS: Record<string, string[]> = {
  categoryHairdressing: [
    'Парикмахер',
    'Колорист',
    'Стилист',
    'Трихолог',
  ],
  categoryNails: [
    'Мастер маникюра',
    'Мастер педикюра',
    'Nail-дизайнер',
  ],
  categoryBrowsLashes: [
    'Brow-мастер',
    'Лэшмейкер',
    'Brow & lash мастер',
  ],
  categoryBeautySalon: [
    'Косметолог',
    'Визажист',
    'Стилист',
    'Дерматокосметолог',
  ],
  categoryMedspa: [
    'Косметолог (мед. лицензия)',
    'Дерматолог',
    'Инъекционист',
    'Лазерный терапевт',
  ],
  categoryBarber: [
    'Барбер',
    'Мужской парикмахер',
    'Стилист мужских стрижек',
  ],
  categoryMassage: [
    'Массажист (классический)',
    'Массажист (спортивный)',
    'Массажист (расслабляющий)',
    'Массажист (лимфодренажный)',
    'Массажист (тайский)',
    'Массажист (антицеллюлитный)',
    'Остеопат',
    'Мануальный терапевт',
  ],
  categorySpa: [
    'SPA-терапевт',
    'Массажист (SPA)',
    'Банщик',
    'Специалист по обёртываниям',
  ],
  categoryWaxing: [
    'Мастер депиляции (воск)',
    'Мастер шугаринга',
    'Мастер лазерной эпиляции',
  ],
  categoryTattoo: [
    'Тату-мастер',
    'Пирсер',
    'Перманентный макияж',
    'Микроблейдинг',
    'Удаление тату',
  ],
  categoryTanning: [
    'Специалист по загару',
    'Специалист по автозагару',
  ],
  categoryFitness: [
    'Персональный тренер',
    'Инструктор йоги',
    'Пилатес-инструктор',
    'Функциональный тренер',
    'Стретчинг-мастер',
    'Кроссфит-тренер',
  ],
  categoryPhysio: [
    'Физиотерапевт',
    'Реабилитолог',
    'Кинезиотерапевт',
    'Остеопат',
  ],
  categoryMedical: [
    'Терапевт',
    'Стоматолог',
    'Ортодонт',
    'Дерматолог',
    'Психолог',
    'Психотерапевт',
    'Нутрициолог',
  ],
  categoryPets: [
    'Грумер',
    'Ветеринар',
    'Хендлер',
    'Кинолог',
    'Фелинолог',
  ],
  categoryTutoring: [
    'Репетитор (школа)',
    'Преподаватель языков',
    'Музыкальный педагог',
    'Коуч',
    'Ментор',
    'Инструктор вождения',
  ],
  categoryPlumbing: [
    'Сантехник',
    'Электрик',
    'Мастер на час',
    'Ремонтник',
  ],
  categoryCleaning: [
    'Клинер (квартиры)',
    'Клинер (офисы)',
    'Химчистка мебели',
    'Мойщик окон',
  ],
  categoryOther: [
    'Свой вариант',
  ],
};

/** Legacy per-vertical mapping (resolves to the most common category for backward compat) */
export const SPECIALIZATIONS: Record<VerticalKey, string[]> = {
  beauty: [
    'Парикмахер',
    'Колорист',
    'Барбер',
    'Мастер маникюра',
    'Мастер педикюра',
    'Brow / lash мастер',
    'Визажист',
    'Косметолог',
    'Депиляция / воск',
    'Массажист (эстетический)',
  ],
  health: [
    'Терапевт',
    'Стоматолог',
    'Ортодонт',
    'Дерматолог',
    'Физиотерапевт',
    'Остеопат',
    'Массажист (медицинский)',
    'Психолог',
    'Психотерапевт',
    'Нутрициолог',
  ],
  auto: [
    'Мойщик',
    'Детейлер',
    'Шиномонтажник',
    'Автослесарь',
    'Автоэлектрик',
    'Моторист',
    'Кузовщик',
    'Полировщик',
  ],
  tattoo: [
    'Тату-мастер',
    'Пирсер',
    'Перманентный макияж',
    'Микроблейдинг',
    'Удаление тату',
  ],
  pets: [
    'Грумер',
    'Ветеринар',
    'Хендлер',
    'Кинолог',
    'Фелинолог',
  ],
  craft: [
    'Сапожник',
    'Портной',
    'Ювелир',
    'Часовщик',
    'Реставратор',
    'Столяр',
    'Мастер по коже',
  ],
  fitness: [
    'Персональный тренер',
    'Инструктор йоги',
    'Пилатес-инструктор',
    'Функциональный тренер',
    'Стретчинг-мастер',
    'Кроссфит-тренер',
  ],
  events: [
    'Фотограф',
    'Видеограф',
    'Ведущий / MC',
    'Диджей',
    'Аниматор',
    'Декоратор',
    'Флорист',
  ],
  education: [
    'Репетитор (школа)',
    'Преподаватель языков',
    'Музыкальный педагог',
    'Коуч',
    'Ментор',
    'Инструктор вождения',
  ],
  other: [
    'Свой вариант',
  ],
};

export function getSpecializations(vertical: string | null | undefined): string[] {
  if (!vertical) return [];
  return SPECIALIZATIONS[vertical as VerticalKey] ?? [];
}

/** Get specializations for a list of selected category keys */
export function getSpecializationsForCategories(categories: string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const cat of categories) {
    const specs = CATEGORY_SPECIALIZATIONS[cat] ?? [];
    for (const s of specs) {
      if (!seen.has(s)) {
        seen.add(s);
        result.push(s);
      }
    }
  }
  return result;
}
