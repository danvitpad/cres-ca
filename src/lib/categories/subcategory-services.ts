/** --- YAML
 * name: Default Services Per Subcategory
 * description: Готовые шаблоны услуг под каждую подкатегорию. Когда мастер
 *              в онбординге выбирает «Парикмахер» / «Электрик» / «Груминг»
 *              — ему сразу подсовываются 3-5 типовых услуг с длительностью
 *              и плейсхолдер-ценой. Он отмечает галочками что хочет, остальное
 *              убирает или переделывает позже в каталоге.
 *              Покрывает топ-самых-популярных подкатегорий. Для остальных —
 *              мастер сам заведёт услуги в каталоге.
 * created: 2026-05-10
 * --- */

import type { DefaultService as VerticalDefaultService } from '@/lib/verticals/default-services';

export interface DefaultService {
  name: string;
  duration_minutes: number;
  price: number;
}

/**
 * Ключ — `industry_subcategories.key`. Значение — массив дефолтных услуг.
 * Цена в гривнах (плейсхолдер, мастер поправит).
 */
export const SUBCATEGORY_DEFAULT_SERVICES: Record<string, DefaultService[]> = {
  // ===== BEAUTY =====
  hairdresser: [
    { name: 'Женская стрижка', duration_minutes: 60, price: 500 },
    { name: 'Мужская стрижка', duration_minutes: 30, price: 300 },
    { name: 'Окрашивание в один тон', duration_minutes: 120, price: 1500 },
    { name: 'Укладка', duration_minutes: 45, price: 400 },
  ],
  barber: [
    { name: 'Стрижка машинкой', duration_minutes: 30, price: 250 },
    { name: 'Стрижка ножницами', duration_minutes: 45, price: 400 },
    { name: 'Стрижка + борода', duration_minutes: 60, price: 550 },
    { name: 'Бритьё опасной бритвой', duration_minutes: 30, price: 300 },
  ],
  colorist: [
    { name: 'Окрашивание в один тон', duration_minutes: 120, price: 1500 },
    { name: 'Балаяж', duration_minutes: 240, price: 3000 },
    { name: 'Шатуш', duration_minutes: 180, price: 2500 },
    { name: 'Тонирование', duration_minutes: 60, price: 800 },
  ],
  manicure: [
    { name: 'Маникюр классический', duration_minutes: 60, price: 400 },
    { name: 'Маникюр + покрытие гель-лак', duration_minutes: 90, price: 600 },
    { name: 'Аппаратный маникюр', duration_minutes: 75, price: 500 },
    { name: 'Снятие гель-лака', duration_minutes: 30, price: 150 },
  ],
  pedicure: [
    { name: 'Педикюр классический', duration_minutes: 75, price: 600 },
    { name: 'Педикюр + гель-лак', duration_minutes: 105, price: 800 },
    { name: 'Аппаратный педикюр', duration_minutes: 90, price: 700 },
  ],
  brow_master: [
    { name: 'Коррекция бровей', duration_minutes: 30, price: 250 },
    { name: 'Окрашивание бровей', duration_minutes: 30, price: 200 },
    { name: 'Ламинирование бровей', duration_minutes: 60, price: 600 },
  ],
  lash_master: [
    { name: 'Наращивание ресниц классика', duration_minutes: 120, price: 800 },
    { name: 'Наращивание ресниц 2D-3D', duration_minutes: 150, price: 1000 },
    { name: 'Снятие ресниц', duration_minutes: 30, price: 200 },
    { name: 'Ламинирование ресниц', duration_minutes: 60, price: 500 },
  ],
  makeup: [
    { name: 'Макияж дневной', duration_minutes: 60, price: 800 },
    { name: 'Макияж вечерний', duration_minutes: 75, price: 1000 },
    { name: 'Свадебный макияж', duration_minutes: 90, price: 1500 },
  ],
  cosmetologist: [
    { name: 'Чистка лица', duration_minutes: 90, price: 1000 },
    { name: 'Пилинг', duration_minutes: 60, price: 800 },
    { name: 'Уходовая процедура', duration_minutes: 75, price: 900 },
  ],
  wax: [
    { name: 'Депиляция воском (ноги)', duration_minutes: 45, price: 400 },
    { name: 'Депиляция воском (руки)', duration_minutes: 30, price: 300 },
    { name: 'Депиляция воском (бикини)', duration_minutes: 45, price: 500 },
  ],
  sugaring: [
    { name: 'Шугаринг ноги', duration_minutes: 45, price: 450 },
    { name: 'Шугаринг руки', duration_minutes: 30, price: 350 },
    { name: 'Шугаринг бикини', duration_minutes: 45, price: 550 },
  ],
  laser_hair: [
    { name: 'Лазерная эпиляция (одна зона)', duration_minutes: 30, price: 400 },
    { name: 'Лазерная эпиляция (комплекс)', duration_minutes: 90, price: 1500 },
  ],

  // ===== WELLNESS =====
  massage_classic: [
    { name: 'Массаж спины', duration_minutes: 30, price: 400 },
    { name: 'Массаж общий', duration_minutes: 60, price: 700 },
    { name: 'Массаж шейно-воротниковой зоны', duration_minutes: 30, price: 400 },
  ],
  massage_lymph: [
    { name: 'Лимфодренаж рук + ног', duration_minutes: 60, price: 800 },
    { name: 'Лимфодренаж лица', duration_minutes: 45, price: 600 },
  ],
  massage_sport: [
    { name: 'Спортивный массаж', duration_minutes: 60, price: 800 },
    { name: 'Восстановительный после тренировки', duration_minutes: 45, price: 600 },
  ],
  massage_relax: [
    { name: 'Релакс-массаж', duration_minutes: 60, price: 700 },
    { name: 'Аромамассаж', duration_minutes: 75, price: 850 },
  ],
  massage_thai: [
    { name: 'Тайский массаж', duration_minutes: 90, price: 1200 },
    { name: 'Тайский массаж стоп', duration_minutes: 45, price: 600 },
  ],
  osteopath: [
    { name: 'Консультация', duration_minutes: 60, price: 1500 },
    { name: 'Сеанс остеопатии', duration_minutes: 60, price: 1500 },
  ],
  stretching: [
    { name: 'Парный стретчинг', duration_minutes: 60, price: 600 },
    { name: 'Глубокая растяжка', duration_minutes: 75, price: 700 },
  ],

  // ===== MEDICAL =====
  injectionist: [
    { name: 'Биоревитализация', duration_minutes: 45, price: 3000 },
    { name: 'Контурная пластика губ', duration_minutes: 60, price: 5000 },
    { name: 'Ботокс', duration_minutes: 30, price: 4000 },
  ],
  dentist: [
    { name: 'Консультация', duration_minutes: 30, price: 500 },
    { name: 'Профессиональная гигиена', duration_minutes: 60, price: 1500 },
    { name: 'Лечение кариеса', duration_minutes: 60, price: 2000 },
  ],
  psychologist: [
    { name: 'Консультация', duration_minutes: 60, price: 1200 },
    { name: 'Терапевтическая сессия', duration_minutes: 50, price: 1500 },
  ],
  psychotherap: [
    { name: 'Консультация', duration_minutes: 60, price: 1500 },
    { name: 'Терапевтическая сессия', duration_minutes: 50, price: 1800 },
  ],
  speech: [
    { name: 'Диагностика', duration_minutes: 60, price: 800 },
    { name: 'Занятие с логопедом', duration_minutes: 45, price: 600 },
  ],
  nutrition: [
    { name: 'Первичная консультация', duration_minutes: 90, price: 2000 },
    { name: 'Повторная консультация', duration_minutes: 45, price: 1000 },
  ],

  // ===== PETS =====
  grooming: [
    { name: 'Гигиеническая стрижка', duration_minutes: 90, price: 600 },
    { name: 'Полная стрижка', duration_minutes: 120, price: 900 },
    { name: 'Стрижка когтей', duration_minutes: 15, price: 100 },
    { name: 'Чистка ушей', duration_minutes: 15, price: 100 },
  ],
  trimming: [
    { name: 'Тримминг (полный)', duration_minutes: 150, price: 1200 },
    { name: 'Тримминг (частичный)', duration_minutes: 90, price: 800 },
  ],
  dog_haircut: [
    { name: 'Стрижка маленькой собаки', duration_minutes: 90, price: 500 },
    { name: 'Стрижка средней собаки', duration_minutes: 120, price: 700 },
    { name: 'Стрижка крупной собаки', duration_minutes: 150, price: 900 },
  ],
  cat_haircut: [
    { name: 'Стрижка под наркозом', duration_minutes: 90, price: 1500 },
    { name: 'Стрижка без наркоза', duration_minutes: 60, price: 700 },
  ],
  vet: [
    { name: 'Консультация', duration_minutes: 30, price: 400 },
    { name: 'Вакцинация', duration_minutes: 30, price: 600 },
    { name: 'Осмотр + анализы', duration_minutes: 45, price: 800 },
  ],
  walker: [
    { name: 'Прогулка 30 минут', duration_minutes: 30, price: 150 },
    { name: 'Прогулка 1 час', duration_minutes: 60, price: 250 },
  ],
  trainer: [
    { name: 'Индивидуальное занятие', duration_minutes: 60, price: 700 },
    { name: 'Курс послушания (10 занятий)', duration_minutes: 60, price: 6000 },
  ],
  boarding: [
    { name: 'Передержка (сутки)', duration_minutes: 1440, price: 500 },
  ],

  // ===== AUTO =====
  service: [
    { name: 'Диагностика', duration_minutes: 60, price: 500 },
    { name: 'Замена тормозных колодок', duration_minutes: 90, price: 1500 },
    { name: 'Замена ремня ГРМ', duration_minutes: 240, price: 4000 },
  ],
  wash: [
    { name: 'Мойка кузова', duration_minutes: 30, price: 300 },
    { name: 'Мойка кузов + салон', duration_minutes: 60, price: 600 },
    { name: 'Комплексная мойка', duration_minutes: 90, price: 900 },
  ],
  detailing: [
    { name: 'Полировка кузова', duration_minutes: 240, price: 4000 },
    { name: 'Химчистка салона', duration_minutes: 240, price: 3500 },
    { name: 'Защитное покрытие', duration_minutes: 360, price: 6000 },
  ],
  tire: [
    { name: 'Замена 4 колёс', duration_minutes: 60, price: 800 },
    { name: 'Балансировка', duration_minutes: 30, price: 400 },
    { name: 'Ремонт прокола', duration_minutes: 30, price: 250 },
  ],
  electric: [ // авто-электрик
    { name: 'Диагностика электрики', duration_minutes: 60, price: 500 },
    { name: 'Установка сигнализации', duration_minutes: 180, price: 2000 },
    { name: 'Замена аккумулятора', duration_minutes: 30, price: 300 },
  ],
  oil: [
    { name: 'Замена масла + фильтр', duration_minutes: 30, price: 400 },
    { name: 'Замена масла АКПП', duration_minutes: 120, price: 1500 },
  ],
  diagnostics: [
    { name: 'Компьютерная диагностика', duration_minutes: 45, price: 600 },
    { name: 'Диагностика подвески', duration_minutes: 30, price: 400 },
  ],
  alignment: [
    { name: 'Развал-схождение', duration_minutes: 60, price: 600 },
  ],

  // ===== HOME =====
  // ВАЖНО: ключ 'electric' уже использован для авто-электрика выше.
  // Электрик в категории «Дом» имеет тот же ключ, поэтому при выборе мастер увидит
  // авто-набор. Для строгого разделения нужны разные ключи. Пока — общий комплект:
  plumber: [
    { name: 'Установка смесителя', duration_minutes: 60, price: 700 },
    { name: 'Замена унитаза', duration_minutes: 120, price: 1500 },
    { name: 'Прочистка засора', duration_minutes: 60, price: 600 },
    { name: 'Установка стиральной машины', duration_minutes: 90, price: 1000 },
  ],
  handyman: [
    { name: 'Мелкий ремонт (час)', duration_minutes: 60, price: 600 },
    { name: 'Сборка мебели', duration_minutes: 120, price: 1200 },
    { name: 'Установка карнизов', duration_minutes: 45, price: 500 },
  ],
  cleaning: [
    { name: 'Поддерживающая уборка (2-комн)', duration_minutes: 180, price: 1200 },
    { name: 'Генеральная уборка (2-комн)', duration_minutes: 360, price: 2500 },
    { name: 'Уборка после ремонта', duration_minutes: 480, price: 3500 },
  ],
  drycleaning: [
    { name: 'Химчистка дивана', duration_minutes: 120, price: 1500 },
    { name: 'Химчистка ковра (м²)', duration_minutes: 30, price: 200 },
  ],
  appliance: [
    { name: 'Диагностика', duration_minutes: 60, price: 400 },
    { name: 'Ремонт стиральной машины', duration_minutes: 120, price: 1200 },
    { name: 'Ремонт холодильника', duration_minutes: 120, price: 1500 },
  ],
  furniture: [
    { name: 'Сборка кухни', duration_minutes: 360, price: 3000 },
    { name: 'Сборка шкафа', duration_minutes: 180, price: 1500 },
  ],
  aircon: [
    { name: 'Чистка кондиционера', duration_minutes: 60, price: 800 },
    { name: 'Установка кондиционера', duration_minutes: 240, price: 3500 },
    { name: 'Заправка фреоном', duration_minutes: 45, price: 600 },
  ],
  shoe_repair: [
    { name: 'Замена набойки', duration_minutes: 30, price: 200 },
    { name: 'Замена подошвы', duration_minutes: 60, price: 600 },
  ],

  // ===== FITNESS =====
  personal_trainer: [
    { name: 'Персональная тренировка', duration_minutes: 60, price: 600 },
    { name: 'Программа на месяц', duration_minutes: 60, price: 5000 },
  ],
  yoga: [
    { name: 'Индивидуальная йога', duration_minutes: 60, price: 700 },
    { name: 'Парная йога', duration_minutes: 75, price: 1200 },
  ],
  pilates: [
    { name: 'Индивидуальный пилатес', duration_minutes: 55, price: 700 },
  ],
  boxing: [
    { name: 'Персональная тренировка', duration_minutes: 60, price: 700 },
  ],
  dance: [
    { name: 'Индивидуальное занятие', duration_minutes: 60, price: 600 },
  ],
  swim: [
    { name: 'Индивидуальное занятие', duration_minutes: 45, price: 600 },
  ],

  // ===== EDUCATION =====
  english: [
    { name: 'Индивидуальный урок', duration_minutes: 60, price: 500 },
    { name: 'Пробный урок', duration_minutes: 30, price: 0 },
  ],
  math: [
    { name: 'Урок 1:1', duration_minutes: 60, price: 500 },
  ],
  music: [
    { name: 'Урок 1:1', duration_minutes: 45, price: 500 },
  ],
  vocal: [
    { name: 'Индивидуальный урок', duration_minutes: 60, price: 600 },
  ],
  guitar: [
    { name: 'Урок гитары', duration_minutes: 60, price: 500 },
  ],
  piano: [
    { name: 'Урок фортепиано', duration_minutes: 60, price: 500 },
  ],
  programming: [
    { name: 'Урок программирования', duration_minutes: 90, price: 1000 },
  ],
  tutor_school: [
    { name: 'Урок 1:1', duration_minutes: 60, price: 400 },
  ],

  // ===== EVENTS =====
  host: [
    { name: 'Ведение дня рождения', duration_minutes: 240, price: 5000 },
    { name: 'Ведение свадьбы', duration_minutes: 480, price: 12000 },
  ],
  photographer: [
    { name: 'Фотосессия 1 час', duration_minutes: 60, price: 2000 },
    { name: 'Свадебная съёмка', duration_minutes: 480, price: 12000 },
  ],
  videographer: [
    { name: 'Видеосъёмка события', duration_minutes: 240, price: 8000 },
  ],
  dj: [
    { name: 'DJ-сет 4 часа', duration_minutes: 240, price: 6000 },
  ],
  decorator: [
    { name: 'Оформление зала', duration_minutes: 240, price: 5000 },
  ],
  animator: [
    { name: 'Шоу 1 час', duration_minutes: 60, price: 2000 },
  ],

  // ===== TATTOO =====
  tattoo: [
    { name: 'Маленькое тату (до 5 см)', duration_minutes: 60, price: 1500 },
    { name: 'Среднее тату (до 15 см)', duration_minutes: 180, price: 4000 },
    { name: 'Эскиз', duration_minutes: 60, price: 500 },
  ],
  piercing: [
    { name: 'Прокол ушей', duration_minutes: 30, price: 500 },
    { name: 'Прокол носа', duration_minutes: 30, price: 700 },
  ],
  permanent_makeup: [
    { name: 'Перманент губ', duration_minutes: 180, price: 4000 },
    { name: 'Перманент бровей', duration_minutes: 150, price: 3500 },
  ],
  microblading: [
    { name: 'Микроблейдинг', duration_minutes: 180, price: 3500 },
  ],
};

/**
 * Собрать дефолтные услуги для набора подкатегорий. Дубли по имени убираются
 * (если две подкатегории дают «Стрижка» — оставляем одну).
 * Возвращает совместимый с verticals/DefaultService формат (pricing_model='fixed').
 */
export function getDefaultServicesForSubcategoryKeys(keys: string[]): VerticalDefaultService[] {
  const merged: DefaultService[] = [];
  const seen = new Set<string>();
  for (const k of keys) {
    const list = SUBCATEGORY_DEFAULT_SERVICES[k] ?? [];
    for (const s of list) {
      const id = s.name.toLowerCase();
      if (!seen.has(id)) {
        seen.add(id);
        merged.push(s);
      }
    }
  }
  return merged.map(s => ({ ...s, pricing_model: 'fixed' as const }));
}
