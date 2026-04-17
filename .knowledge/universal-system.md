# Универсальная мульти-вертикальная система CRES-CA

> **Читай это первым перед любой работой по мастер/салон-дашборду и онбордингу.**
> Работает в связке с `.knowledge/verticals.md` (карта 15+ сфер с деталями).

## 0. TL;DR — три принципа

1. **Мы строим не бьюти-CRM, а универсальную CRM для любых услуг** — от сантехника до стоматолога, от репетитора до массажиста. 20+ сфер.
2. **Vertical presets + модульность** — при регистрации мастер выбирает сферу, получает дефолтный пакет (услуги, анамнез, модули). После — может включать/выключать модули.
3. **Симметрия + эстетика + понятность** — каждый экран должен быть ровным, читаемым, без пустых пробелов. Это фронт-правило, не фича.

---

## 1. Регистрация мастера → выбор вертикали

**Обязательный шаг онбординга:** «Чем вы занимаетесь?» → сетка из ~20 карточек с иконкой и названием.

```
┌─────────────┬─────────────┬─────────────┐
│ 💇 Beauty    │ 💅 Nails     │ ✂️ Barber    │
│              │              │              │
├─────────────┼─────────────┼─────────────┤
│ 💆 Massage   │ 🦷 Dental    │ 🐾 Veterinary│
├─────────────┼─────────────┼─────────────┤
│ 🎨 Tattoo    │ 🧘 Fitness   │ 🧠 Psychology│
├─────────────┼─────────────┼─────────────┤
│ 🔧 Plumber   │ ⚡ Electrician│ 🚗 Auto      │
├─────────────┼─────────────┼─────────────┤
│ 📚 Tutor     │ 📷 Photo     │ 🎭 Designer  │
├─────────────┼─────────────┼─────────────┤
│ ⚖️ Lawyer    │ 🥗 Nutrition │ 🩺 Medical   │
├─────────────┼─────────────┼─────────────┤
│ 🐕 Grooming  │ 💼 Coaching  │ ➕ Другое    │
└─────────────┴─────────────┴─────────────┘
```

**Поле в БД:** `profiles.vertical` (enum: `beauty`, `nails`, `barber`, `massage`, `dental`, `veterinary`, `tattoo`, `fitness`, `psychology`, `plumber`, `electrician`, `auto`, `tutor`, `photography`, `design`, `legal`, `nutrition`, `medical`, `grooming`, `coaching`, `other`).

**Значение по умолчанию:** `beauty` (для старых аккаунтов до миграции).

---

## 2. Vertical presets — что подставляется автоматически

Каждая вертикаль = pack из 6 компонентов:

| Компонент | Что это | Файл |
|---|---|---|
| **1. Шаблоны услуг** | 5–8 типовых услуг с названием, длительностью, ценовой логикой | `src/lib/verticals/service-presets.ts` (создать) |
| **2. Анамнез** | Поля intake-формы (аллергии, противопоказания, беременность, хрон.заб.) | `src/lib/verticals/intake-fields.ts` (уже есть) |
| **3. Поля клиента** | Доп.поля в карточке клиента (зубная карта, карта тела, адрес объекта, дневник сессий) | `src/lib/verticals/client-fields.ts` (создать) |
| **4. Рабочий режим** | Длительность слота по умолчанию, выездной/студийный, рабочие часы | `src/lib/verticals/work-presets.ts` (создать) |
| **5. Feature flags** | Какие модули дашборда показаны/скрыты (галерея, inventory, CRM, giftcards) | `src/lib/verticals/feature-flags.ts` (создать) |
| **6. Тональность AI** | Как AI-помощник говорит с мастером (для стоматолога — клинически, для барбера — неформально) | в `openrouter.ts` system prompt |

Пример для `dental`:
```ts
{
  vertical: 'dental',
  serviceTemplates: [
    { name: 'Осмотр', duration: 30, price: 500 },
    { name: 'Чистка', duration: 60, price: 1500 },
    { name: 'Пломба', duration: 60, price: 2000 },
    { name: 'Коронка', duration: 90, price: 8000 },
  ],
  intakeFields: ['allergies', 'chronic_conditions', 'last_dental_visit', 'pregnancy', 'medications', 'pain_level'],
  clientFields: ['dental_chart', 'insurance_info'],
  workDefaults: { slotMinutes: 30, workHours: '09:00-18:00', mobile: false },
  features: {
    gallery: false,              // before/after
    giftCards: false,            // не релевантно
    inventory: true,              // материалы
    healthProfile: true,          // обязательно
    familyLinks: true,            // семейная стоматология
    smartRebooking: true,         // раз в 6 мес
    loyalty: false,               // не принято
  },
  aiTone: 'clinical',            // формальный, медицинская терминология
}
```

Пример для `plumber`:
```ts
{
  vertical: 'plumber',
  serviceTemplates: [
    { name: 'Диагностика', duration: 60, price: 800 },
    { name: 'Замена крана', duration: 60, price: 1500 },
    { name: 'Прочистка труб', duration: 90, price: 2000 },
    { name: 'Установка смесителя', duration: 90, price: 1800 },
  ],
  intakeFields: [],              // анамнез не нужен
  clientFields: ['address', 'problem_photo', 'access_instructions'],
  workDefaults: { slotMinutes: 90, workHours: '09:00-19:00', mobile: true },
  features: {
    gallery: false,              // портфолио необязательно
    giftCards: false,
    inventory: true,              // запчасти
    healthProfile: false,         // не нужен
    familyLinks: false,
    smartRebooking: false,        // не регулярно
    loyalty: false,
  },
  aiTone: 'professional',
}
```

---

## 3. Модульность — мастер может включать/выключать фичи

В `/settings/features` — список всех модулей с toggle:

```
┌────────────────────────────────────────┐
│ Модули дашборда                         │
│ Включите только то, что вам нужно      │
├────────────────────────────────────────┤
│ ✅ Клиенты                              │
│ ✅ Календарь                            │
│ ✅ Финансы                              │
│ ☐ Галерея до/после                     │
│ ✅ Склад материалов                     │
│ ☐ Абонементы                           │
│ ☐ Подарочные карты                     │
│ ✅ Лояльность (punch card)              │
│ ☐ Реферальная программа                │
│ ☐ Онлайн-консультации                  │
│ ☐ Выездные визиты (геолокация)         │
│ ✅ Напоминания клиентам                 │
│ ✅ Автоматизации                        │
│ ☐ Email-маркетинг                      │
│ ✅ Telegram-интеграция                  │
│ ☐ Zoom / Google Meet                   │
└────────────────────────────────────────┘
```

**Где хранить:** `profiles.feature_overrides` (JSONB) — переопределяет дефолты вертикали.  
**Резолвинг:** `resolveFeatures(vertical, overrides)` возвращает финальный набор feature-flags.

**Условный рендер в sidebar/дашборде:**
```tsx
const features = useFeatures(); // хук поверх master.vertical + feature_overrides
{features.gallery && <GallerySection />}
{features.inventory && <InventoryLink />}
```

---

## 4. Что это значит для нашего refactor-плана

### Изменения в порядке BLOCK-ов:

**BLOCK A (Клиенты) — уже сделан:**
- ✅ Карточки клиентов работают для ВСЕХ вертикалей (базовая инфа одинакова)
- ⚠️ Добавить: условный рендер секций в `/clients/[id]` — скрывать «Медицинское» для `plumber`, показывать «Адрес объекта» для выездных, и т.д.

**BLOCK A.5 (новое) — инфраструктура вертикалей:**
- Создать 4 новых файла в `src/lib/verticals/`
- Написать resolveFeatures() + useFeatures() hook
- Обновить `/clients/[id]` чтобы секции рендерились условно

**BLOCK B (Telegram AI voice router):**
- Intent-detection промпт адаптируется к вертикали (стоматолог vs сантехник)
- AI tone (aiTone: 'clinical' / 'casual' / 'professional') передаётся в system prompt

**BLOCK C (Настройки мастера):**
- Добавить раздел «Моя сфера» — показать текущую вертикаль + кнопка «Сменить»
- Добавить раздел «Модули» — toggle-список feature-flags
- Добавить flow смены email/password/phone с confirmation
- Добавить выбор вертикали в онбординг (если ещё не выбран)

**BLOCK D (Каталог):**
- При создании услуги — кнопка «Выбрать из шаблонов» → сервис-пресеты текущей вертикали
- Условное скрытие табов «Галерея» / «Абонементы» / «Склад» через feature-flags

**BLOCK E (Маркетинг):**
- Показывать только те автоматизации, что релевантны (review-request для beauty, не для plumber)
- Шаблоны сообщений per vertical

---

## 5. Правила симметрии и эстетики (hard rules для frontend)

**Каждое нарушение = переделка.** Применяется ко всем страницам master/salon/client.

### 5.1. Grid/выравнивание
- **Используй grid с gap, не гнездо из флексов с margin-ами** — всегда регулярная сетка
- **Симметричный padding** — если слева 24px, то и справа 24px. Никаких `paddingLeft: 24, paddingRight: 36`
- **Одинаковая высота** соседних карточек в ряду (`alignItems: stretch`)
- **Одинаковый radius** в пределах одной секции (14 или 16, не смешивать)

### 5.2. Spacing system
- Gap между карточками в grid: 14–16px
- Внутренний padding карточки: 18–24px
- Отступ между секциями: 16–20px
- Padding страницы: 28–36px
- **Не используй odd-значения** (19, 23, 27) — только кратные 4

### 5.3. Типографика
- Заголовок секции — всегда `font-size: 15, font-weight: 650` + иконка 15px + gap 8
- KPI число — `font-size: 22–28, font-weight: 650–700`
- Label — `font-size: 11, font-weight: 600, text-transform: uppercase, letter-spacing: 0.04em`
- Body text — `font-size: 13–14, font-weight: 400–500`
- **Не смешивай 4+ размера** на одном экране

### 5.4. Цвет
- Акцент — `C.accent` (фиолетовый)
- Для градиентов KPI используй `KPI_GRADIENTS` из `dashboard-theme.ts`
- Success — зелёный, Danger — красный, Warning — жёлтый
- **Никакой случайной палитры** — только из dashboard-theme

### 5.5. Пустое пространство
- **Нет сиротливых «Нет данных»** — всегда оборачивай в card с иконкой и подсказкой «Что делать»
- **Нет огромных пустых зон** — если секция пустая, скрой её или замени на CTA
- **Grid с min-max** — `repeat(auto-fill, minmax(240px, 1fr))` чтобы не было кривых рядов

### 5.6. Закругления
- Buttons — `border-radius: 8–10`
- Cards — `border-radius: 14–16`
- Full rounded (для badge/chip) — `border-radius: 999` или 7
- **Одинаковые на одной странице**

### 5.7. Иконки
- lucide-react
- Размер 13–16 в UI-элементах, 20–28 в empty states
- **Цвет иконки связан с контекстом** — accent / textTertiary / status color

### 5.8. Анимация
- `motion.div` с `initial: { opacity: 0, y: 8 }`, `animate: { opacity: 1, y: 0 }`
- `transition: { delay: i * 0.04, duration: 0.25 }` для staggered lists
- **Не переборщи** — не анимировать каждую мелочь, только блоки при маунте
- Hover — `translateY(-2px)` + небольшой shadow
- Duration 0.15–0.25s, easing `[0.25, 0.46, 0.45, 0.94]`

### 5.9. User-friendly
- **Любое действие** должно иметь loading state и feedback (toast)
- **Любая ошибка** должна показывать что произошло и что делать
- **Любая форма** должна работать на Enter (не только клик по кнопке)
- **Любая таблица** должна работать на touch (мобильный)
- **Keyboard shortcuts** где уместно (Esc закрывает модалки, Cmd/Ctrl+K открывает команды)

---

## 6. Что нужно реализовать (чек-лист универсальной системы)

### Инфраструктура (делаем в BLOCK A.5, до следующих блоков):
- [ ] `src/lib/verticals/service-presets.ts` — шаблоны услуг per vertical (20 сфер)
- [ ] `src/lib/verticals/client-fields.ts` — доп.поля клиента per vertical
- [ ] `src/lib/verticals/work-presets.ts` — рабочий режим per vertical
- [ ] `src/lib/verticals/feature-flags.ts` — какие модули включены по умолчанию
- [ ] `src/hooks/use-features.ts` — хук resolveFeatures(vertical, overrides)
- [ ] Миграция: `profiles.feature_overrides JSONB DEFAULT '{}'::jsonb`

### Онбординг (делаем в BLOCK C):
- [ ] Шаг онбординга «Выбор вертикали» (если не указана)
- [ ] Автоподстановка шаблонов услуг при первом входе
- [ ] «Включить/выключить модули» в настройках

### UI-слой (применяем по ходу всех BLOCK-ов):
- [ ] `/clients/[id]` — условный рендер секций через `useFeatures()`
- [ ] `/services` — кнопка «Шаблоны вертикали»
- [ ] `/calendar` — длительность слота из work-presets
- [ ] Sidebar — скрывать разделы через feature-flags
- [ ] AI system prompt — учитывать `aiTone` вертикали

---

## 7. Приоритеты (что делать прямо сейчас vs позже)

### 🟢 Сейчас (до салона):
1. Создать инфраструктуру вертикалей (4 preset-файла + hook)
2. `/clients/[id]` — условный рендер (скрывать "Медицинское" где не нужно)
3. Онбординг с выбором вертикали
4. Каталог услуг — шаблоны per vertical

### 🟡 Потом (параллельно с салоном):
1. Модульный конструктор в настройках
2. AI tone per vertical
3. Work presets (длительность слотов)

### 🔴 Потом-потом (v2):
1. Drag-and-drop дашборд
2. Custom vertical builder (мастер создаёт свою сферу с 0)

---

## 8. Связанные файлы

- `.knowledge/verticals.md` — полная карта 15 вертикалей (анамнез, услуги, KPI)
- `src/lib/verticals/intake-fields.ts` — анамнез per vertical (уже есть)
- `src/types/profile.ts` — `profile.vertical` enum
- Этот документ — единый гайд как это всё должно работать

**Последнее обновление:** 2026-04-17.
