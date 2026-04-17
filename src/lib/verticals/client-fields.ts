/** --- YAML
 * name: ClientFieldsPerVertical
 * description: Extra fields shown in the client card per vertical (e.g. pet breed, object address, dental chart). Stored in clients.extra_info JSONB.
 * created: 2026-04-17
 * updated: 2026-04-17
 * --- */

import type { VerticalKey } from './default-services';

export type ExtraFieldType = 'text' | 'textarea' | 'number' | 'boolean' | 'tags' | 'select' | 'date';

export interface ExtraFieldDef {
  key: string;
  label: string; // direct label (not i18n key — extra fields are rare and ru-first)
  type: ExtraFieldType;
  placeholder?: string;
  options?: string[];
  required?: boolean;
}

/**
 * Extra client fields per vertical — shown in "Дополнительно" section of client card.
 * Values stored in `clients.extra_info` JSONB.
 */
export const EXTRA_CLIENT_FIELDS: Record<VerticalKey, ExtraFieldDef[]> = {
  beauty: [
    { key: 'preferred_slot',  label: 'Любимое время', type: 'select', options: ['утро', 'день', 'вечер'] },
    { key: 'hair_type',       label: 'Тип волос', type: 'select', options: ['прямые', 'волнистые', 'кудрявые', 'окрашенные'] },
    { key: 'kids',            label: 'Дети (имя, возраст)', type: 'textarea', placeholder: 'Аня, 5 лет · Петя, 8 лет' },
    { key: 'pets',            label: 'Питомцы', type: 'textarea', placeholder: 'Чихуа-хуа Буся' },
    { key: 'notes_extra',     label: 'Дополнительные заметки', type: 'textarea' },
  ],
  health: [
    { key: 'insurance',       label: 'Страховка', type: 'text' },
    { key: 'doctor_referral', label: 'Направление от врача', type: 'text' },
    { key: 'emergency_contact', label: 'Экстренный контакт', type: 'text' },
  ],
  auto: [
    { key: 'vehicle_make',    label: 'Марка', type: 'text', placeholder: 'Toyota' },
    { key: 'vehicle_model',   label: 'Модель', type: 'text', placeholder: 'Camry 2019' },
    { key: 'vehicle_plate',   label: 'Гос.номер', type: 'text' },
    { key: 'service_address', label: 'Адрес работ', type: 'textarea' },
    { key: 'access_notes',    label: 'Как попасть / код домофона', type: 'textarea' },
  ],
  tattoo: [
    { key: 'skin_sensitivity', label: 'Чувствительность кожи', type: 'select', options: ['нормальная', 'повышенная', 'очень высокая'] },
    { key: 'blood_thinners',   label: 'Кроворазжижающие препараты', type: 'boolean' },
    { key: 'previous_tattoos', label: 'Предыдущие тату (где, когда)', type: 'textarea' },
    { key: 'style_preference', label: 'Любимые стили', type: 'tags' },
  ],
  pets: [
    { key: 'pet_name',        label: 'Кличка', type: 'text' },
    { key: 'pet_species',     label: 'Вид', type: 'select', options: ['собака', 'кошка', 'кролик', 'птица', 'другое'] },
    { key: 'pet_breed',       label: 'Порода', type: 'text' },
    { key: 'pet_age',         label: 'Возраст', type: 'text', placeholder: '3 года' },
    { key: 'pet_weight',      label: 'Вес, кг', type: 'number' },
    { key: 'vaccinations',    label: 'Вакцинация', type: 'textarea' },
    { key: 'temperament',     label: 'Темперамент', type: 'select', options: ['спокойный', 'активный', 'агрессивный', 'пугливый'] },
  ],
  craft: [
    { key: 'item_description', label: 'Описание вещи', type: 'textarea' },
    { key: 'deadline',        label: 'Срок готовности', type: 'date' },
  ],
  fitness: [
    { key: 'goals',           label: 'Цели', type: 'tags', placeholder: 'похудение, рельеф, сила' },
    { key: 'injuries',        label: 'Травмы / ограничения', type: 'textarea' },
    { key: 'experience_level', label: 'Уровень', type: 'select', options: ['новичок', 'средний', 'продвинутый'] },
    { key: 'training_frequency', label: 'Желаемая частота', type: 'select', options: ['1 раз/нед', '2-3 раза/нед', '4+ раз/нед'] },
  ],
  events: [
    { key: 'event_date',      label: 'Дата события', type: 'date' },
    { key: 'event_type',      label: 'Тип события', type: 'select', options: ['свадьба', 'юбилей', 'день рождения', 'корпоратив', 'другое'] },
    { key: 'event_location',  label: 'Место проведения', type: 'textarea' },
    { key: 'guest_count',     label: 'Кол-во гостей', type: 'number' },
  ],
  education: [
    { key: 'subject',         label: 'Предмет', type: 'text' },
    { key: 'grade_level',     label: 'Класс / уровень', type: 'text' },
    { key: 'goals',           label: 'Цели обучения', type: 'textarea' },
    { key: 'parent_contact',  label: 'Контакт родителя (если ребёнок)', type: 'text' },
  ],
  other: [
    { key: 'notes_extra',     label: 'Дополнительно', type: 'textarea' },
  ],
};
