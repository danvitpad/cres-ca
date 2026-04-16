/** --- YAML
 * name: DefaultServicesPerVertical
 * description: Code-ready шаблоны услуг по вертикалям. Используется в /onboarding/create-business после выбора индустрии — предлагает мастеру bulk-insert популярных услуг. Источник правды — .knowledge/verticals.md.
 * created: 2026-04-13
 * updated: 2026-04-13
 * --- */

export type PricingModel =
  | 'fixed'
  | 'per_hour'
  | 'per_sqm'
  | 'per_item'
  | 'per_person'
  | 'on_request';

export interface DefaultService {
  name: string;
  duration_minutes: number;
  price: number;
  pricing_model: PricingModel;
}

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

export const DEFAULT_SERVICES: Record<VerticalKey, DefaultService[]> = {
  beauty: [
    { name: 'Женская стрижка', duration_minutes: 60, price: 500, pricing_model: 'fixed' },
    { name: 'Мужская стрижка', duration_minutes: 45, price: 350, pricing_model: 'fixed' },
    { name: 'Окрашивание (однотонное)', duration_minutes: 120, price: 1200, pricing_model: 'fixed' },
    { name: 'Сложное окрашивание', duration_minutes: 180, price: 2500, pricing_model: 'fixed' },
    { name: 'Маникюр классика', duration_minutes: 60, price: 450, pricing_model: 'fixed' },
    { name: 'Педикюр', duration_minutes: 75, price: 600, pricing_model: 'fixed' },
    { name: 'Наращивание ресниц', duration_minutes: 120, price: 800, pricing_model: 'fixed' },
    { name: 'Коррекция бровей', duration_minutes: 30, price: 250, pricing_model: 'fixed' },
  ],
  health: [
    { name: 'Консультация', duration_minutes: 30, price: 500, pricing_model: 'fixed' },
    { name: 'Первичный приём', duration_minutes: 60, price: 800, pricing_model: 'fixed' },
    { name: 'Повторный приём', duration_minutes: 30, price: 500, pricing_model: 'fixed' },
    { name: 'Профессиональная чистка', duration_minutes: 45, price: 900, pricing_model: 'fixed' },
    { name: 'Психологическая сессия', duration_minutes: 50, price: 1000, pricing_model: 'fixed' },
    { name: 'Массаж терапевтический', duration_minutes: 60, price: 700, pricing_model: 'fixed' },
  ],
  auto: [
    { name: 'Комплексная мойка', duration_minutes: 40, price: 350, pricing_model: 'fixed' },
    { name: 'Мойка двигателя', duration_minutes: 30, price: 300, pricing_model: 'fixed' },
    { name: 'Химчистка салона', duration_minutes: 180, price: 1800, pricing_model: 'fixed' },
    { name: 'Шиномонтаж (4 колеса)', duration_minutes: 45, price: 600, pricing_model: 'fixed' },
    { name: 'Замена масла', duration_minutes: 45, price: 500, pricing_model: 'fixed' },
    { name: 'Полировка кузова', duration_minutes: 360, price: 3500, pricing_model: 'fixed' },
    { name: 'Диагностика', duration_minutes: 30, price: 400, pricing_model: 'fixed' },
  ],
  tattoo: [
    { name: 'Консультация и эскиз', duration_minutes: 60, price: 500, pricing_model: 'fixed' },
    { name: 'Мини-тату (до 5 см)', duration_minutes: 90, price: 1500, pricing_model: 'fixed' },
    { name: 'Средняя работа', duration_minutes: 240, price: 3500, pricing_model: 'fixed' },
    { name: 'Сеанс (крупная работа)', duration_minutes: 60, price: 1200, pricing_model: 'per_hour' },
    { name: 'Коррекция', duration_minutes: 60, price: 800, pricing_model: 'fixed' },
    { name: 'Пирсинг (ухо)', duration_minutes: 30, price: 500, pricing_model: 'fixed' },
    { name: 'Перманентный макияж бровей', duration_minutes: 180, price: 3000, pricing_model: 'fixed' },
  ],
  pets: [
    { name: 'Груминг мелкой породы', duration_minutes: 90, price: 700, pricing_model: 'fixed' },
    { name: 'Груминг средней породы', duration_minutes: 120, price: 900, pricing_model: 'fixed' },
    { name: 'Груминг крупной породы', duration_minutes: 180, price: 1300, pricing_model: 'fixed' },
    { name: 'Гигиеническая стрижка', duration_minutes: 60, price: 500, pricing_model: 'fixed' },
    { name: 'Стрижка когтей', duration_minutes: 15, price: 150, pricing_model: 'fixed' },
    { name: 'Приём ветеринара', duration_minutes: 30, price: 500, pricing_model: 'fixed' },
    { name: 'Вакцинация', duration_minutes: 20, price: 400, pricing_model: 'fixed' },
  ],
  craft: [
    { name: 'Диагностика изделия', duration_minutes: 30, price: 200, pricing_model: 'fixed' },
    { name: 'Мелкий ремонт', duration_minutes: 60, price: 400, pricing_model: 'fixed' },
    { name: 'Реставрация (базовая)', duration_minutes: 120, price: 1000, pricing_model: 'fixed' },
    { name: 'Пошив на заказ', duration_minutes: 0, price: 0, pricing_model: 'on_request' },
    { name: 'Работа мастера', duration_minutes: 60, price: 400, pricing_model: 'per_hour' },
  ],
  fitness: [
    { name: 'Персональная тренировка', duration_minutes: 60, price: 600, pricing_model: 'fixed' },
    { name: 'Сплит-тренировка', duration_minutes: 90, price: 850, pricing_model: 'fixed' },
    { name: 'Первичная консультация', duration_minutes: 45, price: 400, pricing_model: 'fixed' },
    { name: 'Групповой класс', duration_minutes: 60, price: 250, pricing_model: 'per_person' },
    { name: 'Йога (индивид.)', duration_minutes: 60, price: 550, pricing_model: 'fixed' },
    { name: 'Растяжка / stretching', duration_minutes: 45, price: 400, pricing_model: 'fixed' },
  ],
  events: [
    { name: 'Фотосъёмка (1 час)', duration_minutes: 60, price: 1500, pricing_model: 'per_hour' },
    { name: 'Лавстори', duration_minutes: 120, price: 3000, pricing_model: 'fixed' },
    { name: 'Свадебная съёмка (день)', duration_minutes: 480, price: 15000, pricing_model: 'fixed' },
    { name: 'Ведущий (3 часа)', duration_minutes: 180, price: 5000, pricing_model: 'fixed' },
    { name: 'Диджей (вечер)', duration_minutes: 240, price: 6000, pricing_model: 'fixed' },
    { name: 'Оформление зала', duration_minutes: 0, price: 0, pricing_model: 'on_request' },
    { name: 'Аниматор (1 час)', duration_minutes: 60, price: 1200, pricing_model: 'fixed' },
  ],
  education: [
    { name: 'Пробный урок', duration_minutes: 45, price: 300, pricing_model: 'fixed' },
    { name: 'Индивидуальный урок', duration_minutes: 60, price: 500, pricing_model: 'fixed' },
    { name: 'Интенсив (90 мин)', duration_minutes: 90, price: 750, pricing_model: 'fixed' },
    { name: 'Групповое занятие', duration_minutes: 60, price: 250, pricing_model: 'per_person' },
    { name: 'Онлайн-урок', duration_minutes: 60, price: 450, pricing_model: 'fixed' },
  ],
  other: [
    { name: 'Консультация', duration_minutes: 30, price: 500, pricing_model: 'fixed' },
    { name: 'Базовая услуга', duration_minutes: 60, price: 700, pricing_model: 'fixed' },
    { name: 'Работа по часам', duration_minutes: 60, price: 500, pricing_model: 'per_hour' },
  ],
};

export function getDefaultServices(vertical: string | null | undefined): DefaultService[] {
  if (!vertical) return [];
  return DEFAULT_SERVICES[vertical as VerticalKey] ?? [];
}

/** Services grouped by onboarding category key */
export const CATEGORY_SERVICES: Record<string, DefaultService[]> = {
  categoryHairdressing: [
    { name: 'Женская стрижка', duration_minutes: 60, price: 500, pricing_model: 'fixed' },
    { name: 'Мужская стрижка', duration_minutes: 45, price: 350, pricing_model: 'fixed' },
    { name: 'Окрашивание (однотонное)', duration_minutes: 120, price: 1200, pricing_model: 'fixed' },
    { name: 'Сложное окрашивание', duration_minutes: 180, price: 2500, pricing_model: 'fixed' },
    { name: 'Укладка', duration_minutes: 45, price: 400, pricing_model: 'fixed' },
  ],
  categoryNails: [
    { name: 'Маникюр классика', duration_minutes: 60, price: 450, pricing_model: 'fixed' },
    { name: 'Маникюр с покрытием гель-лак', duration_minutes: 90, price: 600, pricing_model: 'fixed' },
    { name: 'Педикюр', duration_minutes: 75, price: 600, pricing_model: 'fixed' },
    { name: 'Наращивание ногтей', duration_minutes: 120, price: 900, pricing_model: 'fixed' },
    { name: 'Снятие покрытия', duration_minutes: 30, price: 150, pricing_model: 'fixed' },
  ],
  categoryBrowsLashes: [
    { name: 'Наращивание ресниц', duration_minutes: 120, price: 800, pricing_model: 'fixed' },
    { name: 'Коррекция ресниц', duration_minutes: 60, price: 500, pricing_model: 'fixed' },
    { name: 'Коррекция бровей', duration_minutes: 30, price: 250, pricing_model: 'fixed' },
    { name: 'Окрашивание бровей', duration_minutes: 30, price: 200, pricing_model: 'fixed' },
    { name: 'Ламинирование ресниц', duration_minutes: 60, price: 600, pricing_model: 'fixed' },
  ],
  categoryBeautySalon: [
    { name: 'Чистка лица', duration_minutes: 60, price: 700, pricing_model: 'fixed' },
    { name: 'Пилинг', duration_minutes: 45, price: 500, pricing_model: 'fixed' },
    { name: 'Макияж дневной', duration_minutes: 45, price: 600, pricing_model: 'fixed' },
    { name: 'Макияж вечерний', duration_minutes: 60, price: 900, pricing_model: 'fixed' },
    { name: 'Уход за лицом (комплекс)', duration_minutes: 90, price: 1200, pricing_model: 'fixed' },
  ],
  categoryMedspa: [
    { name: 'Биоревитализация', duration_minutes: 45, price: 2000, pricing_model: 'fixed' },
    { name: 'Ботокс (1 зона)', duration_minutes: 30, price: 2500, pricing_model: 'fixed' },
    { name: 'Контурная пластика', duration_minutes: 45, price: 3000, pricing_model: 'fixed' },
    { name: 'Лазерная шлифовка', duration_minutes: 60, price: 2000, pricing_model: 'fixed' },
    { name: 'Мезотерапия', duration_minutes: 45, price: 1500, pricing_model: 'fixed' },
  ],
  categoryBarber: [
    { name: 'Мужская стрижка', duration_minutes: 45, price: 350, pricing_model: 'fixed' },
    { name: 'Стрижка + борода', duration_minutes: 60, price: 500, pricing_model: 'fixed' },
    { name: 'Моделирование бороды', duration_minutes: 30, price: 250, pricing_model: 'fixed' },
    { name: 'Королевское бритьё', duration_minutes: 30, price: 300, pricing_model: 'fixed' },
    { name: 'Камуфляж седины', duration_minutes: 45, price: 400, pricing_model: 'fixed' },
  ],
  categoryMassage: [
    { name: 'Классический массаж (общий)', duration_minutes: 60, price: 700, pricing_model: 'fixed' },
    { name: 'Массаж спины', duration_minutes: 30, price: 400, pricing_model: 'fixed' },
    { name: 'Спортивный массаж', duration_minutes: 60, price: 800, pricing_model: 'fixed' },
    { name: 'Расслабляющий массаж', duration_minutes: 60, price: 700, pricing_model: 'fixed' },
    { name: 'Антицеллюлитный массаж', duration_minutes: 60, price: 800, pricing_model: 'fixed' },
    { name: 'Лимфодренажный массаж', duration_minutes: 60, price: 900, pricing_model: 'fixed' },
    { name: 'Массаж лица', duration_minutes: 30, price: 400, pricing_model: 'fixed' },
    { name: 'Массаж стоп', duration_minutes: 30, price: 350, pricing_model: 'fixed' },
  ],
  categorySpa: [
    { name: 'SPA-программа (комплекс)', duration_minutes: 120, price: 2000, pricing_model: 'fixed' },
    { name: 'Обёртывание', duration_minutes: 60, price: 800, pricing_model: 'fixed' },
    { name: 'Пилинг тела', duration_minutes: 45, price: 600, pricing_model: 'fixed' },
    { name: 'Парение в бане', duration_minutes: 120, price: 1500, pricing_model: 'fixed' },
    { name: 'Расслабляющий массаж', duration_minutes: 60, price: 700, pricing_model: 'fixed' },
  ],
  categoryWaxing: [
    { name: 'Восковая депиляция (ноги)', duration_minutes: 45, price: 500, pricing_model: 'fixed' },
    { name: 'Восковая депиляция (бикини)', duration_minutes: 30, price: 400, pricing_model: 'fixed' },
    { name: 'Шугаринг (ноги)', duration_minutes: 45, price: 550, pricing_model: 'fixed' },
    { name: 'Шугаринг (бикини)', duration_minutes: 30, price: 450, pricing_model: 'fixed' },
    { name: 'Депиляция подмышек', duration_minutes: 15, price: 200, pricing_model: 'fixed' },
  ],
  categoryTattoo: [
    { name: 'Консультация и эскиз', duration_minutes: 60, price: 500, pricing_model: 'fixed' },
    { name: 'Мини-тату (до 5 см)', duration_minutes: 90, price: 1500, pricing_model: 'fixed' },
    { name: 'Средняя работа', duration_minutes: 240, price: 3500, pricing_model: 'fixed' },
    { name: 'Сеанс (крупная работа)', duration_minutes: 60, price: 1200, pricing_model: 'per_hour' },
    { name: 'Пирсинг (ухо)', duration_minutes: 30, price: 500, pricing_model: 'fixed' },
    { name: 'Перманентный макияж бровей', duration_minutes: 180, price: 3000, pricing_model: 'fixed' },
  ],
  categoryTanning: [
    { name: 'Солярий (сеанс)', duration_minutes: 15, price: 200, pricing_model: 'fixed' },
    { name: 'Автозагар (тело)', duration_minutes: 45, price: 800, pricing_model: 'fixed' },
    { name: 'Абонемент (10 сеансов)', duration_minutes: 15, price: 1500, pricing_model: 'fixed' },
  ],
  categoryFitness: [
    { name: 'Персональная тренировка', duration_minutes: 60, price: 600, pricing_model: 'fixed' },
    { name: 'Сплит-тренировка', duration_minutes: 90, price: 850, pricing_model: 'fixed' },
    { name: 'Первичная консультация', duration_minutes: 45, price: 400, pricing_model: 'fixed' },
    { name: 'Групповой класс', duration_minutes: 60, price: 250, pricing_model: 'per_person' },
    { name: 'Йога (индивид.)', duration_minutes: 60, price: 550, pricing_model: 'fixed' },
    { name: 'Растяжка / stretching', duration_minutes: 45, price: 400, pricing_model: 'fixed' },
  ],
  categoryPhysio: [
    { name: 'Первичная консультация', duration_minutes: 60, price: 800, pricing_model: 'fixed' },
    { name: 'Сеанс физиотерапии', duration_minutes: 45, price: 600, pricing_model: 'fixed' },
    { name: 'Кинезиотейпирование', duration_minutes: 30, price: 400, pricing_model: 'fixed' },
    { name: 'Реабилитационное занятие', duration_minutes: 60, price: 700, pricing_model: 'fixed' },
  ],
  categoryMedical: [
    { name: 'Консультация', duration_minutes: 30, price: 500, pricing_model: 'fixed' },
    { name: 'Первичный приём', duration_minutes: 60, price: 800, pricing_model: 'fixed' },
    { name: 'Повторный приём', duration_minutes: 30, price: 500, pricing_model: 'fixed' },
    { name: 'Профессиональная чистка', duration_minutes: 45, price: 900, pricing_model: 'fixed' },
    { name: 'Психологическая сессия', duration_minutes: 50, price: 1000, pricing_model: 'fixed' },
  ],
  categoryPets: [
    { name: 'Груминг мелкой породы', duration_minutes: 90, price: 700, pricing_model: 'fixed' },
    { name: 'Груминг средней породы', duration_minutes: 120, price: 900, pricing_model: 'fixed' },
    { name: 'Груминг крупной породы', duration_minutes: 180, price: 1300, pricing_model: 'fixed' },
    { name: 'Гигиеническая стрижка', duration_minutes: 60, price: 500, pricing_model: 'fixed' },
    { name: 'Стрижка когтей', duration_minutes: 15, price: 150, pricing_model: 'fixed' },
    { name: 'Приём ветеринара', duration_minutes: 30, price: 500, pricing_model: 'fixed' },
  ],
  categoryTutoring: [
    { name: 'Пробный урок', duration_minutes: 45, price: 300, pricing_model: 'fixed' },
    { name: 'Индивидуальный урок', duration_minutes: 60, price: 500, pricing_model: 'fixed' },
    { name: 'Интенсив (90 мин)', duration_minutes: 90, price: 750, pricing_model: 'fixed' },
    { name: 'Групповое занятие', duration_minutes: 60, price: 250, pricing_model: 'per_person' },
    { name: 'Онлайн-урок', duration_minutes: 60, price: 450, pricing_model: 'fixed' },
  ],
  categoryPlumbing: [
    { name: 'Вызов мастера', duration_minutes: 60, price: 400, pricing_model: 'fixed' },
    { name: 'Мелкий ремонт', duration_minutes: 60, price: 500, pricing_model: 'fixed' },
    { name: 'Установка сантехники', duration_minutes: 120, price: 1000, pricing_model: 'fixed' },
    { name: 'Работа по часам', duration_minutes: 60, price: 500, pricing_model: 'per_hour' },
  ],
  categoryCleaning: [
    { name: 'Уборка квартиры (1-комн.)', duration_minutes: 120, price: 800, pricing_model: 'fixed' },
    { name: 'Уборка квартиры (2-комн.)', duration_minutes: 180, price: 1200, pricing_model: 'fixed' },
    { name: 'Генеральная уборка', duration_minutes: 300, price: 2500, pricing_model: 'fixed' },
    { name: 'Мойка окон', duration_minutes: 60, price: 500, pricing_model: 'fixed' },
    { name: 'Химчистка мебели', duration_minutes: 120, price: 1500, pricing_model: 'fixed' },
  ],
  categoryOther: [
    { name: 'Консультация', duration_minutes: 30, price: 500, pricing_model: 'fixed' },
    { name: 'Базовая услуга', duration_minutes: 60, price: 700, pricing_model: 'fixed' },
    { name: 'Работа по часам', duration_minutes: 60, price: 500, pricing_model: 'per_hour' },
  ],
};

/** Get services for a list of selected category keys */
export function getServicesForCategories(categories: string[]): DefaultService[] {
  const seen = new Set<string>();
  const result: DefaultService[] = [];
  for (const cat of categories) {
    const services = CATEGORY_SERVICES[cat] ?? [];
    for (const s of services) {
      if (!seen.has(s.name)) {
        seen.add(s.name);
        result.push(s);
      }
    }
  }
  return result;
}
