/** --- YAML
 * name: VerticalCopy
 * description: Тексты адаптивные под вертикаль (beauty/health/auto/...) и роль
 *              (solo-мастер / админ команды). Сервис должен говорить с парикмахером,
 *              стоматологом и автомастером РАЗНЫМИ словами — «салон», «клиника»,
 *              «СТО» соответственно. Импортируй getVerticalCopy() везде где
 *              надо подставить vertical-aware строку (онбординг, дашборд,
 *              публичка, настройки, шапки писем и т.п.).
 * created: 2026-04-27
 * --- */

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

export type Role = 'solo' | 'admin';

export interface VerticalCopy {
  /** «Бизнес» в именительном: салон / СТО / клиника / кабинет / студия */
  business: string;
  /** С притяжательным «ваш/ваше/ваша» в именительном: «ваш салон», «ваше СТО», «ваша клиника» */
  businessNomPossessive: string;
  /** Краткая форма для шапок («у вашего салона», «вашего СТО») */
  businessGenitive: string;
  /** Локатив — «в салоне», «на СТО», «в клинике» */
  businessLocative: string;
  /** Кто такой соло-человек этой ниши: парикмахер / врач / автомастер / тренер */
  soloRole: string;
  /** Что делает мастер: услуга / процедура / тренировка / приём */
  service: string;
  /** Множественное от service — «услуги» / «процедуры» / ... */
  servicePlural: string;
  /** Кто приходит — клиент / пациент / гость / ученик */
  client: string;
  /** Множественное — «клиенты» / «пациенты» / ... */
  clientPlural: string;
  /** Поздравление при создании — «Салон создан!», «СТО создано!» */
  createdSuccess: string;
  /** Заголовок шага локации для МАСТЕРА — где мастер принимает */
  locationStepTitle: string;
  /** Варианты локации для мастера в человеческом формате */
  locationOptions: {
    physical: string; // «Принимаю у себя в кабинете», «Клиенты приезжают на СТО», ...
    mobile: string;   // «Выезжаю к клиенту», «Делаю на дому», ...
    online: string;   // «Онлайн-консультации», «Онлайн-тренировки», ...
  };
}

/* ─── База: «другое» используется как fallback ─── */
const DEFAULT_COPY: VerticalCopy = {
  business: 'бизнес',
  businessNomPossessive: 'ваш бизнес',
  businessGenitive: 'вашего бизнеса',
  businessLocative: 'в бизнесе',
  soloRole: 'мастер',
  service: 'услуга',
  servicePlural: 'услуги',
  client: 'клиент',
  clientPlural: 'клиенты',
  createdSuccess: 'Бизнес создан!',
  locationStepTitle: 'Где вы предоставляете услуги?',
  locationOptions: {
    physical: 'Клиенты приходят ко мне',
    mobile: 'Я работаю с выездом к клиенту',
    online: 'Я предоставляю услуги онлайн',
  },
};

const ADMIN_DEFAULT_OVERRIDES: Partial<VerticalCopy> = {
  // Админ услуг не оказывает — его вариант локации не нужен (онбординг
  // skip-ает этот шаг для admin). Здесь только бизнес-сущность.
};

/* ─── Per-vertical (solo) ─── */
const SOLO: Record<VerticalKey, VerticalCopy> = {
  beauty: {
    ...DEFAULT_COPY,
    business: 'кабинет',
    businessNomPossessive: 'ваш кабинет',
    businessGenitive: 'вашего кабинета',
    businessLocative: 'в кабинете',
    soloRole: 'мастер красоты',
    service: 'услуга',
    servicePlural: 'услуги',
    client: 'клиент',
    clientPlural: 'клиенты',
    createdSuccess: 'Профиль готов!',
    locationStepTitle: 'Где вы принимаете клиентов?',
    locationOptions: {
      physical: 'У себя в кабинете / на рабочем месте',
      mobile: 'Выезжаю к клиенту на дом',
      online: 'Онлайн-консультации',
    },
  },
  health: {
    ...DEFAULT_COPY,
    business: 'кабинет',
    businessNomPossessive: 'ваш кабинет',
    businessGenitive: 'вашего кабинета',
    businessLocative: 'в кабинете',
    soloRole: 'специалист',
    service: 'приём',
    servicePlural: 'приёмы',
    client: 'пациент',
    clientPlural: 'пациенты',
    createdSuccess: 'Профиль готов!',
    locationStepTitle: 'Где вы принимаете пациентов?',
    locationOptions: {
      physical: 'У себя в кабинете',
      mobile: 'Выезжаю к пациенту',
      online: 'Онлайн-консультации',
    },
  },
  auto: {
    ...DEFAULT_COPY,
    business: 'мастерская',
    businessNomPossessive: 'ваша мастерская',
    businessGenitive: 'вашей мастерской',
    businessLocative: 'в мастерской',
    soloRole: 'автомастер',
    service: 'работа',
    servicePlural: 'работы',
    client: 'клиент',
    clientPlural: 'клиенты',
    createdSuccess: 'Профиль готов!',
    locationStepTitle: 'Где вы принимаете клиентов?',
    locationOptions: {
      physical: 'Клиенты приезжают ко мне',
      mobile: 'Выезд на место (мобильный сервис)',
      online: 'Онлайн-консультации / диагностика',
    },
  },
  tattoo: {
    ...DEFAULT_COPY,
    business: 'студия',
    businessNomPossessive: 'ваша студия',
    businessGenitive: 'вашей студии',
    businessLocative: 'в студии',
    soloRole: 'тату-мастер',
    service: 'сеанс',
    servicePlural: 'сеансы',
    client: 'клиент',
    clientPlural: 'клиенты',
    createdSuccess: 'Профиль готов!',
    locationStepTitle: 'Где проходят сеансы?',
    locationOptions: {
      physical: 'У себя в студии / на рабочем месте',
      mobile: 'Выезжаю к клиенту',
      online: 'Онлайн-консультации (эскизы)',
    },
  },
  pets: {
    ...DEFAULT_COPY,
    business: 'кабинет',
    businessNomPossessive: 'ваш кабинет',
    businessGenitive: 'вашего кабинета',
    businessLocative: 'в кабинете',
    soloRole: 'специалист по питомцам',
    service: 'визит',
    servicePlural: 'визиты',
    client: 'клиент',
    clientPlural: 'клиенты',
    createdSuccess: 'Профиль готов!',
    locationStepTitle: 'Где проходят визиты?',
    locationOptions: {
      physical: 'Питомца привозят ко мне',
      mobile: 'Выезжаю к питомцу на дом',
      online: 'Онлайн-консультации',
    },
  },
  craft: {
    ...DEFAULT_COPY,
    business: 'мастерская',
    businessNomPossessive: 'ваша мастерская',
    businessGenitive: 'вашей мастерской',
    businessLocative: 'в мастерской',
    soloRole: 'мастер',
    service: 'работа',
    servicePlural: 'работы',
    client: 'клиент',
    clientPlural: 'клиенты',
    createdSuccess: 'Профиль готов!',
    locationStepTitle: 'Где вы принимаете заказы?',
    locationOptions: {
      physical: 'У себя в мастерской',
      mobile: 'Выезжаю на объект к клиенту',
      online: 'Онлайн-консультации',
    },
  },
  fitness: {
    ...DEFAULT_COPY,
    business: 'студия',
    businessNomPossessive: 'ваша студия',
    businessGenitive: 'вашей студии',
    businessLocative: 'в студии',
    soloRole: 'тренер',
    service: 'тренировка',
    servicePlural: 'тренировки',
    client: 'ученик',
    clientPlural: 'ученики',
    createdSuccess: 'Профиль готов!',
    locationStepTitle: 'Где проходят тренировки?',
    locationOptions: {
      physical: 'У меня в зале / студии',
      mobile: 'Выездные тренировки (дом / парк / зал клиента)',
      online: 'Онлайн-тренировки / программы',
    },
  },
  events: {
    ...DEFAULT_COPY,
    business: 'студия',
    businessNomPossessive: 'ваша студия',
    businessGenitive: 'вашей студии',
    businessLocative: 'в студии',
    soloRole: 'специалист',
    service: 'съёмка / выступление',
    servicePlural: 'съёмки / выступления',
    client: 'клиент',
    clientPlural: 'клиенты',
    createdSuccess: 'Профиль готов!',
    locationStepTitle: 'Где вы работаете?',
    locationOptions: {
      physical: 'У себя в студии',
      mobile: 'Выезд на локацию клиента',
      online: 'Онлайн (стримы / видеосъёмка удалённо)',
    },
  },
  education: {
    ...DEFAULT_COPY,
    business: 'кабинет',
    businessNomPossessive: 'ваш кабинет',
    businessGenitive: 'вашего кабинета',
    businessLocative: 'в кабинете',
    soloRole: 'преподаватель',
    service: 'занятие',
    servicePlural: 'занятия',
    client: 'ученик',
    clientPlural: 'ученики',
    createdSuccess: 'Профиль готов!',
    locationStepTitle: 'Где проходят занятия?',
    locationOptions: {
      physical: 'У меня (свой кабинет / класс)',
      mobile: 'У ученика дома',
      online: 'Онлайн-занятия',
    },
  },
  other: DEFAULT_COPY,
};

/* ─── Per-vertical (admin / команда) ─── */
const ADMIN: Record<VerticalKey, Partial<VerticalCopy>> = {
  beauty:    { business: 'салон',         businessNomPossessive: 'ваш салон',         businessGenitive: 'вашего салона',         businessLocative: 'в салоне',     createdSuccess: 'Салон создан!' },
  health:    { business: 'клиника',       businessNomPossessive: 'ваша клиника',      businessGenitive: 'вашей клиники',         businessLocative: 'в клинике',    createdSuccess: 'Клиника создана!' },
  auto:      { business: 'СТО',           businessNomPossessive: 'ваше СТО',          businessGenitive: 'вашего СТО',            businessLocative: 'на СТО',       createdSuccess: 'СТО создано!' },
  tattoo:    { business: 'студия',        businessNomPossessive: 'ваша студия',       businessGenitive: 'вашей студии',          businessLocative: 'в студии',     createdSuccess: 'Студия создана!' },
  pets:      { business: 'ветклиника',    businessNomPossessive: 'ваша ветклиника',   businessGenitive: 'вашей ветклиники',      businessLocative: 'в ветклинике', createdSuccess: 'Ветклиника создана!' },
  craft:     { business: 'мастерская',    businessNomPossessive: 'ваша мастерская',   businessGenitive: 'вашей мастерской',      businessLocative: 'в мастерской', createdSuccess: 'Мастерская создана!' },
  fitness:   { business: 'фитнес-клуб',   businessNomPossessive: 'ваш клуб',          businessGenitive: 'вашего клуба',          businessLocative: 'в клубе',      createdSuccess: 'Клуб создан!' },
  events:    { business: 'агентство',     businessNomPossessive: 'ваше агентство',    businessGenitive: 'вашего агентства',      businessLocative: 'в агентстве',  createdSuccess: 'Агентство создано!' },
  education: { business: 'школа',         businessNomPossessive: 'ваша школа',        businessGenitive: 'вашей школы',           businessLocative: 'в школе',      createdSuccess: 'Школа создана!' },
  other:     { business: 'компания',      businessNomPossessive: 'ваша компания',     businessGenitive: 'вашей компании',        businessLocative: 'в компании',   createdSuccess: 'Компания создана!' },
};

/**
 * Возвращает набор vertical+role-aware строк. Если vertical неизвестен — fallback
 * на 'other'. Solo-роль — детальная адаптация. Admin — наследует solo-копию,
 * перекрывает только бизнес-сущность (салон/СТО/клиника).
 */
export function getVerticalCopy(vertical: string | null | undefined, role: Role): VerticalCopy {
  const v = (vertical && vertical in SOLO ? vertical : 'other') as VerticalKey;
  const base = SOLO[v];
  if (role === 'solo') return base;
  return { ...base, ...ADMIN_DEFAULT_OVERRIDES, ...ADMIN[v] };
}
