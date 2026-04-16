# PROJECT-JOURNAL.md — ЖИВОЙ ЖУРНАЛ ПРОЕКТА CRES-CA

> **Это главный документ проекта.** Единая точка правды, по которой мы работаем из любой сессии Claude Code. Все остальные документы (roadmap фаз, CLIENT-WORK, MASTER-WORK, memory) — вспомогательные. Здесь — **вся карта сервиса + inbox от Данила + changelog**: что есть, что работает, что предстоит сделать.
>
> **Имя `PROJECT-JOURNAL.md` зарезервировано** под будущий визуальный canvas (граф страниц/кнопок/связей). Текстовый журнал и визуальная карта будут жить параллельно.
>
> **Расположение:** `D:/Claude.cres-ca/app/PROJECT-JOURNAL.md` (рядом с `CLAUDE.md`).
> **Язык:** русский, для владельца проекта.
> **Обновляется:** в конце каждой сессии, когда что-то закрыто / добавлено / обнаружено.

---

## 🧭 Как этим пользоваться

**Для Данила (владельца проекта):**
1. Открываешь этот файл — видишь, где мы сейчас.
2. Чтобы добавить новую задачу / заметку / идею — пишешь прямо в нужный раздел строкой с префиксом `📝 TODO:` (или `📝 BUG:`, `📝 IDEA:`, `📝 FIX:`). Пример:
   ```
   📝 TODO: на странице регистрации master — добавить выбор города из списка
   📝 BUG: wallet transfer показывает «not found» даже для валидного email
   ```
3. Следующая сессия Claude Code при `/read PROJECT-JOURNAL.md` автоматически подберёт все `📝`-строки, превратит каждую в чекбокс задачи и добавит в соответствующий блок. После выполнения — отметит `[x]` и **оставит** историю в changelog внизу.

**Для Claude Code (любая сессия):**
1. **Прочитать этот файл первым** после `CLAUDE.md`.
2. Собрать все `📝`-строки и предложить план действий по ним.
3. После изменений — обновить чекбоксы в этом файле и занести запись в changelog.
4. **Никогда не создавать параллельный roadmap-документ.** Все новые задачи идут сюда.

---

## ⚖️ ПРИНЦИПЫ РАБОТЫ (закреплено Данилом, не удалять)

> Эти правила — **структурная часть документа**, а не inbox. Они закреплены владельцем проекта и действуют всегда, во всех сессиях. Claude обязан им следовать молча, без напоминаний.

1. **Субагент на каждый элемент сервиса.** Лендинг, auth (login+register), onboarding, client web, client mobile (telegram), client profile, client feed, client search/map, master mobile, master dashboard (с под-доменами: calendar, clients, services, finance, marketing, inventory, settings), админка, инфраструктура — **у каждого должен быть свой собственный субагент** с прописанными правилами проектирования, дизайна, UX, кодовых паттернов и референсов. Перед любой правкой в секторе — **обязателен вызов соответствующего субагента**. Цель: не тратить время и деньги на фиксы того, что субагент мог бы сделать правильно с первого раза. Текущее состояние (2026-04-15): есть только 3 persona-агента (`client-agent`, `master-agent`, `salon-agent`) — слишком крупные гранулы. Задача AGENTS-1 ниже раскрывает структуру.

2. **Inbox — только для Данила.** В разделе `📥 INBOX` пишет **исключительно владелец проекта**. Claude **никогда** не добавляет туда записи — ни правила, ни задачи, ни идеи. Claude читает inbox в начале сессии, разносит `📝`-заметки по правильным разделам документа (HIGH / MEDIUM / LOW / IDEAS / PRINCIPLES), и **очищает inbox**. Новые правила Claude записывает **сюда, в раздел «Принципы работы»**, а не в inbox.

3. **Дословность слов Данила.** При сохранении любых заметок владельца (в changelog, в задачи, в память) — **сохранять формулировки дословно**, не перефразировать и не интерпретировать. Если нужно структурировать — цитата отдельно, структура отдельно.

4. **Премиум-дизайн обязателен.** Клиентская мобильная версия (Telegram Mini App) — **приоритет №1** продукта. Качество UI измеряется по шкале «Instagram / Linear / Pinterest / Stripe», а не «туториал на YouTube». Перед любой UI-задачей на клиентской мобилке — открыть `.knowledge/design-md/INDEX.md`, выбрать релевантный бренд-референс, затем строить. Пустых состояний с «нет постов» — не допускать (см. UX-6). Дешёвых шаблонов — не допускать.

5. **PROJECT-JOURNAL.md — источник истины.** Всё, что должно пережить сессию (правила, задачи, решения, прогресс) — идёт в структуру этого документа. Не в память, не в отдельные файлы, не в inbox. Параллельные roadmap-документы создавать **запрещено**.

---

## 📋 Легенда

- `[x]` — сделано, задеплоено, работает
- `[~]` — в работе сейчас
- `[ ]` — в очереди, код отсутствует / неполный
- `[!]` — блокер (причина в скобках)
- `[?]` — требует верификации (код есть, но не проверено вживую)
- `📝 TODO:` / `📝 BUG:` / `📝 IDEA:` / `📝 FIX:` — **inbox от Данила**: эти строки следующая сессия Claude превратит в чекбоксы задач

---

## 🧬 META — автономные системы (больше чем cres-ca, не забывать)

> Идеи Данила верхнего уровня — **инфраструктура для создания проектов вообще**, не только cres-ca. Живут здесь, потому что PROJECT-JOURNAL.md — единая точка правды, и терять их между проектами нельзя. После оформления — дублируются в `D:/toolbox/` как универсальное достояние.

### META-1. Полуавтономная фабрика создания сервисов (закреплено 2026-04-15)

**Видение Данила (дословно):**
> «хочу настроить систему полуавтономного создания сервисов — я кидаю ТЗ и первый субагент аналитик помогает его развить, второй создает PROJECT-JOURNAL.md, третий создает PROJECT-MAP.md... поитогу должна быть создана выверенная структура создания любых проектов от автоматизации, до CRM, сайтов, программ, мобильных игр и прочего»

**Цель:** один slash-command `/new-project "<бриф>"` → живой проект с документацией, кодом, деплоем, handoff-пакетом. От брифа до сдачи клиенту — часы.

**Где жить:** `D:/toolbox/.workspace/skills/project-factory/SKILL.md` + агенты в `D:/toolbox/.workspace/agents/factory/<name>/AGENT.md`. Проекты создаются в `D:/projects/<name>/`.

**Контекст:**
- Типы проектов: web-сайт, CRM, автоматизация, Telegram-бот, **мобильные игры** (="мобилка" в лексиконе Данила = mobile games, не обычные мобильные приложения)
- Вход: сырая идея "хочу как X" от клиента. **Данил = посредник** между Claude и клиентом — Данил пишет Claude текстовое ТЗ на основе общения с клиентом. Intake-agent работает по этому тексту, не напрямую с клиентом.
- Срок: часы (от брифа до handoff)
- Стек: адаптивный, per-type пресеты + переиспользование cres-ca компонентов (копировать в новый проект, не npm-link)
- Оркестрация: один slash-command `/new-project`, native Claude Code Agent tool (не Ruflo — избыточно), молчаливый режим с чекпоинтами каждые ~3 агента / 15 минут
- GitHub: создаётся в аккаунте Данила, потом transfer клиенту
- Путь: `D:/projects/<name>/`
- Эксперимент: обкатываем фабрику на cres-ca (responsive-agent → handoff-agent → потом перенос в toolbox)

**Цепочка — 14 агентов (выверенная последовательность, запускается оркестратором):**

| # | Agent | Роль | Входы | Выходы | Handoff | Время | Parallel? |
|---|---|---|---|---|---|---|---|
| 1 | `intake-agent` | Читает текст ТЗ от Данила, задаёт **до 5** уточняющих вопросов в ОДНОМ сообщении, фиксирует open-questions | `raw_brief.md` (текст от Данила) | `01-intake.md` (ТЗ-структура: тип, цель, must-have, nice-to-have, constraints, open-questions) | → analyst | ~10м | нет |
| 2 | `analyst-agent` | Расширяет: персоны, user stories, 1 конкурент-референс, метрики успеха, риски | `01-intake.md` | `02-analyst.md` (persona, stories, competitor, metrics, risks) | → stack | ~15м | нет |
| 3 | `stack-agent` | Выбирает стек по типу из пресет-таблицы (ниже). Копирует нужные куски из cres-ca | `01-intake.md` + `02-analyst.md` | `03-stack.md` (выбранный стек, список cres-ca компонентов для копирования) | → journal | ~5м | нет |
| 4 | `journal-agent` | Создаёт `PROJECT-JOURNAL.md` в новом проекте по канону cres-ca (принципы, inbox, блоки A/B/C, changelog) | все предыдущие | `PROJECT-JOURNAL.md` в `D:/projects/<name>/` | → map | ~5м | ✅ с map |
| 5 | `map-agent` | `PROJECT-MAP.md` — routes/components/DB-сущности в mermaid + JSON | 01+02+03 | `PROJECT-MAP.md` | → architecture | ~10м | ✅ с journal |
| 6 | `architecture-agent` | DB schema, API routes, auth model, env vars, папочная структура | 03 + map | `ARCHITECTURE.md` + `schema.sql` | → design | ~15м | нет |
| 7 | `design-system-agent` | Выбирает DESIGN.md референс из `.knowledge/design-md/`, генерит `tokens.css`, компонентный каркас | 01 + architecture | `DESIGN.md` + `tokens.css` + `components/` skeleton | → skeleton | ~15м | нет |
| 8 | `skeleton-agent` | `git init`, скаффолд страниц / API / миграций (пустые но рабочие), копирование cres-ca компонентов из `03-stack.md` | всё выше | рабочий проект в `D:/projects/<name>/` + первый `git commit` | → impl | ~20м | нет |
| 9 | `impl-agent` (×N) | Реализация фич по блокам из journal. **Параллельный** — оркестратор запускает N instances по одному на блок A/B/C... | journal + skeleton | фичи реализованы, чекбоксы в journal закрыты | → responsive | зависит | ✅ N параллельно |
| 10 | ⭐ `responsive-agent` | **Отдельный по запросу Данила** — адаптирует ВСЕ surfaces под разные экраны: mobile 320-430, tablet 768-1024, desktop 1280-1920+, TV 2560+ | готовый impl | обновлённые компоненты с брейкпоинтами, storybook snapshots | → qa | ~30м | нет (после impl) |
| 11 | `qa-agent` | `tsc --noEmit` + `eslint` + `next build` + Playwright smoke golden path + Lighthouse ≥85 | готовый impl + responsive | `QA-REPORT.md` | → deploy **или** → impl если fail | ~15м | нет |
| 12 | `deploy-agent` | Vercel provision (в аккаунте Данила), Supabase provision, env vars из `.env.example`, кастомный домен (опц.), production deploy | qa pass | `DEPLOYMENT.md` (URLs, креды, env) | → content-seed | ~10м | нет |
| 13 | `content-seed-agent` | Реалистичный seed data в БД, i18n starters (ru/en/uk), legal placeholders (privacy/terms) | deploy done | seed applied, `SEED.md` | → handoff | ~10м | нет |
| 14 | `handoff-agent` | Генерит handoff-пакет (см. ниже). Передача клиенту через Данила | всё выше | `handoff/` папка | DONE | ~15м | нет |

**Пресеты stack-agent (выбор по типу):**

| Тип проекта | Дефолтный стек | Референс из cres-ca |
|---|---|---|
| Web-сайт / лендинг | Next 16 + Tailwind + framer-motion + Vercel | `app/(marketing)` |
| CRM / dashboard | Next 16 + Supabase + next-intl + Tailwind + Vercel (= cres-ca) | весь cres-ca |
| Автоматизация | Bun scripts + cron + Supabase + простой web-UI Next | — |
| Telegram-бот | grammY + Bun + Supabase + Vercel Functions | `src/app/telegram/*` (Mini App паттерны) |
| **Мобильная игра** | Godot 4 (нативная iOS/Android) **или** Phaser 3 (HTML5 для web-wrap) — выбирает intake в open-questions | — |

**Handoff-пакет (что генерит `handoff-agent`):**
1. `README.md` — как запустить локально + архитектура в 1 абзаце
2. `.env.example` — описание каждой переменной
3. `CLIENT-GUIDE.pdf` (6-10 страниц) — скриншоты каждого экрана + "что куда кликать"
4. `LOOM-SCRIPT.md` — готовый текст для записи 5-мин walkthrough видео (Данил сам пишет ртом)
5. `ACCESS.md` — как передать Vercel/Supabase/GitHub доступы клиенту (transfer ownership инструкции)
6. GitHub repo создан в аккаунте Данила, готов к transfer
7. Live preview URL (Vercel production)

**Quality gates (блокируют deploy, принуждают impl-agent чинить):**
- `tsc --noEmit` = 0 errors
- `eslint` = 0 errors (warnings ok)
- `next build` = green
- Playwright smoke golden path = pass
- Lighthouse home ≥ 85 (performance + accessibility)

**Протокол тишины оркестратора:**
- Не отчитывается после каждого агента
- Пишет статус каждые **~3 завершённых агента** ИЛИ **каждые 15 минут** (что раньше)
- Формат чекпоинта: `✓ [агенты выполнены]. [краткий факт — например выбранный стек, URL]. Начинаю [следующие агенты].`
- Блокирующий вопрос Данилу — ТОЛЬКО если критично: API ключи, домен, платёжный провайдер, выбор при open-questions > 0
- Ошибка (например qa-agent fail) — печатает сразу, не ждёт чекпоинта

**Статус реализации:**

- [ ] **META-1.** Фабрика проектов v0.2. План:
  - [ ] **1a.** Прописать `AGENT.md` для каждого из 14 агентов в `D:/toolbox/.workspace/agents/factory/<name>/AGENT.md` (14 файлов по шаблону).
  - [ ] **1b.** Создать оркестратор-скилл `D:/toolbox/.workspace/skills/project-factory/SKILL.md` + `/new-project` slash-command с silent-mode протоколом.
  - [ ] **1c.** Создать пресет-таблицу `stack-agent` в отдельном файле `D:/toolbox/.workspace/agents/factory/stack-agent/PRESETS.md`.
  - [ ] **1d.** 🧪 **Эксперимент на cres-ca:** прогнать `responsive-agent` по клиентскому модулю (закрывает UX-7 premium polish).
  - [ ] **1e.** 🧪 **Эксперимент на cres-ca:** прогнать `handoff-agent` по cres-ca — получить handoff-пакет как dogfooding.
  - [ ] **1f.** Перенос принципа работы (этот раздел v0.2) в `D:/toolbox/.workspace/CLAUDE.md` и `D:/toolbox/.workspace/PROJECT-JOURNAL.md`.
  - [ ] **1g.** Первый реальный mini-проект через `/new-project`: "лендинг для вымышленной кофейни", цель — уложиться в 2 часа от брифа до live URL.
  - [ ] **1h.** Retrofit `agents-bootstrap-agent` на cres-ca → 18 `SECTOR.md` (закрывает AGENTS-1).
  - [ ] **1i.** Документация для Данила: как пользоваться `/new-project`, где смотреть прогресс, как эскалировать.

### META-2. Система реалистичной генерации фото/видео + AI-аватары (commerce-grade)

**Видение Данила (дословно, 2026-04-15):**
> «создать внутри тулбокса систему генерации реалистичных фото и видео для коммерции, с реалистичными ии аватарами и прочим»

**Уточнённый scope:** это **не** весь контент-пайплайн (как я ошибочно записал раньше), а именно **движок генерации коммерческого визуала** — реалистичные фото и видео, AI-аватары (повторяющиеся персонажи, speaking-portrait, lip-sync), которые потом можно использовать в рекламе, постах, креативах продуктов.

**Основа — референсы Данила, которые нужно прочитать и перегнать в playbook:**

_Внешние гайды / курсы:_
- https://www.skool.com/@dan-p-6986?g=nextgenai — Skool профиль Данила (memberships: NextGen AI и др. AI-контент комьюнити)
- https://joeymulcahyguides.notion.site/The-Claude-Code-Product-Visual-Workflow-3262b10bd51680d6ba29e2072a5ba78e — Joey Mulcahy, Claude Code Product Visual Workflow
- https://joeymulcahyguides.notion.site/Claude-Code-For-Brands-101-Guide-32d2b10bd51680d7b962eef06abde69f — Joey Mulcahy, Claude Code For Brands 101
- https://youmind.com/nano-banana-pro-prompts — nano-banana prompts библиотека
- Mobile Editing Club PDF — https://assets.stanwith.me/live/msc/26131308/8qbjy/mobileeditingclubcreateugcads.pdf
- Google Drive ref — https://drive.google.com/file/d/18C9GxNx5xYMrGa3aW_CHUXzyVDNGupjn/view

_Instagram референсы (стиль/формат):_
- https://www.instagram.com/reel/DWjsQhVk22z/
- https://www.instagram.com/reel/DWrWNtBDX66/
- https://www.instagram.com/p/DWwNA-ECMB3/
- https://www.instagram.com/p/DWD0TyTDKK9/

**Где жить:** `D:/toolbox/.workspace/skills/visual-gen/` — универсальный skill + набор агентов в `D:/toolbox/.workspace/agents/visual/`.

**Компоненты системы (первая гипотеза — уточнить после research-агента):**
1. **Avatar factory** — генерация AI-аватаров с консистентной внешностью (IP-Adapter / Photomaker / InstantID / reference identity locking). Каждый аватар — YAML-персонаж: возраст, этность, стиль, одежда, сцены.
2. **Prompt library** — дистиллят из nano-banana prompts + Joey Mulcahy методов (правила brief→prompt, шаблоны под commerce).
3. **Photo engine** — реалистичные product photos / lifestyle / portraits (fal.ai + Flux + nano-banana + SDXL — выбор модели по задаче).
4. **Video engine** — короткие видео и reels (Runway / Luma / Kling / Wan / fal.ai video) с аватарами.
5. **Lip-sync + voice** — speaking portraits (Sync.so / Hedra / HeyGen API) + голосовые клоны (ElevenLabs).
6. **Brand-lock** — per-проект brand book (палитра, типо, logo overlay, tone) применяется ко всему выводу.
7. **Consistency checker** — проверка что аватар выглядит одинаково между сценами.
8. **Output vault** — `D:/toolbox/.workspace/assets/visual/<project>/<brief_id>/` с метаданными (модель, промпт, сид, стоимость, ссылка на fal.ai job).

**Связь с cres-ca:** BLOCK C (C1 product-content, C2 marketing-content, C3 FORGE, C4 skool research) — это **потребитель** этой системы внутри cres-ca. После того как visual-gen в toolbox готов — cres-ca подключает его как зависимость, BLOCK C закрывается автоматически.

**Статус:** 0% реализации + 0% research. Research-агент запущен 2026-04-15 для дистилляции всех референсов выше в `.knowledge/content-research.md` — это закроет долг по C4 (2 дня) и даст базу для архитектуры.

- [ ] **META-2.** Система реалистичной визуальной генерации (см. выше). Первый шаг: research-агент читает все ссылки → `.knowledge/content-research.md`. Второй шаг: на основе дистиллята — архитектура `D:/toolbox/.workspace/skills/visual-gen/` (8 компонентов выше). Третий шаг: MVP — Avatar factory + Photo engine + Prompt library (минимум, который уже даёт ценность). Четвёртый шаг: video engine + lip-sync. Пятый шаг: consistency checker + brand-lock.

---

## 📥 INBOX — заметки Данила (разбираются в начале каждой сессии)

> Сюда Данил пишет всё, что приходит в голову — Claude разбирает, превращает в задачи, и **очищает inbox**, чтобы следующая запись попадала в пустой лист.

### Batch 1 — 2026-04-14 (из commit `fea6e28`, дословно)

```
📝 FIX: D:\Claude.cres-ca\image copy 5.png почему если массаж, то только медицинский? 
📝 FIX: D:\Claude.cres-ca\image copy 6.png хочу чтобы на каждом шагу было разделение в верхней полосе прогресса прохождения регистрации а не сплошная полоса 
📝 FIX: image copy 7.png у нас одно и тоже спрашивается в двух разных местах D:\Claude.cres-ca\image copy 8.png 
📝 FIX: D:\Claude.cres-ca\image copy 9.png если я выбрал вариант мастер, а не команда в начале то этот шаг не нужен, я же уже выбрал что я мастер, а не команда. та же логика касается и команды
📝 FIX: image copy 10.png почему выбрав массаж я вижу Профессиональная чистка ; Психологическая сессия?? они не применяются в массаже. нужно для каждой сферы написать свой перечень услуг 
📝 FIX:image copy 11.png  нужно написать перейти к рабочей панеле
📝 BUG: D:\Claude.cres-ca\image copy 12.png не работает календарь у мастера
📝 BUG: D:\Claude.cres-ca\image copy 13.png вместо имени пользователя пишется Master
📝 BUG: не везде есть внутренние отступы в разделах
```

### Batch 2 — 2026-04-14 (FORGE + skool + URLs, из чата)

Обработанная версия в BLOCK C ниже (C1–C4 + референс-URL). Оригинальный raw-текст не сохранился в git.

### Batch 3 — 2026-04-14 10:12 (toolbox structure, из transcript `19e49ee6` line 2601, дословно)

> Хочу, а еще я хочу чтобы в ToolBox тоже был создан файл project map и в нем уже были заложены вот эти все моменты с правилами ведения todo, bug, idea, fix и так далее. Чтобы все это уже Он был, конечно, чистым, но чтобы верхняя шапка того, что за проект, допустим, или даже не что запретить, а как его вести. И правило для глот кода, который будет тоже работать с ним. Чтобы оно уже было там заложено. В этом project map. А еще я хочу чтобы в этом Toolbox была очень грамотно построена система папок. Допустим там есть точка Qlot. Это твоя папка, которая будет технически твоя. А дальше все остальное я хочу, чтобы было адекватно. Отдельно папка для скилов, отдельно папка для агентов, отдельно папка для паблика, где будут все индексы JavaScript и тому подобное. Отдельно компоненты, которую я буду добавлять через вот эти вот все 21 21ST. Ну, короче, в мои вот эти компоненты готовы Чтобы все было удобно, чтобы не было никакого мусора, путаницы, в папках, репозитории и так далее. И то же самое ты можешь применить и в этом проекте. Я хочу, чтобы система папок была построена очень грамотно и чтобы я понимал, что где находится. Не было лишних файлов, папок и документов. Разбросанных не пойми как Все должно иметь свое место и все раскидано по своим местам. То же самое здесь сделай в кресле и то же самое сделай в тулбоксе.

### Batch 4 — 2026-04-15 (этот чат, дословно)

```
📝 BUG: при регистрации любой роли не могу ввести почту (readOnly из-за ?email= в URL)
📝 BUG: в роли «Команда» форма не адаптирована — показывается "common.name" literal + требует имя/фамилию вместо названия команды
📝 SPEC: структура toolbox должна быть .system/ (технические файлы Claude) + .workspace/ (skills, components, mcp, PROJECT-JOURNAL.md, CLAUDE.md, PROJECT-MAP.md)
📝 RULE: сохранять слова Данила в инбокс ДОСЛОВНО, не интерпретировать — иначе теряется смысл
```

### Batch 5 — 2026-04-15 (этот чат, дословно)

> клиент уже при регистрации это ввел, зачем повторно об этом спрашивать. и еще когда система в номере телефона пишет +380 ... и человек вводит 934455321 и тд то потом система все равно воспринимает его номер целиком как +380934455101, понял?; & 'd:\Claude.cres-ca\image copy.png' не красиво выполнено; & 'd:\Claude.cres-ca\image copy 2.png' пустоты быть не должно, как только у нас будет больше реальных мастеров и команд можно самых популярных и кто доплачивает нам за продвижение может показываться в ленте у новиньких клиентов. вот я сейчас зарегистрировал клиента; когда я в телеграмм версии нажимаю у меня есть аккаунт то просят сразу ввести имеил и пароль, не должн спрашивать роль? и как только человек авторизируется то система в телеграмме должна его запомнить и ему больше не нужно повторно авторизироваться; и наверное на весь экран это все таки лишнее, невозможно ни свернуть, ни перейти на другое приложение; & 'd:\Claude.cres-ca\image copy 4.png' в телеграмм не заходит в мой аккаунт который я создал только что

---

## 🎬 BLOCK C — CONTENT PIPELINE (AI-генерация видео/фото/постов)

> Материал пришёл от Данила как inbox 2026-04-14 (FORGE-агент + 8 ссылок + skool.com профиль). Тема: полноценный пайплайн генерации визуального контента для (а) маркетинга проекта, (б) контента внутри продукта (посты мастеров, before/after, stories).

### Задачи

- [ ] **C1. Product-content skill** — генерация контента **внутри** продукта: мастер снял фото/видео → жмёт «сгенерировать пост/stories» → получает готовый премиум-контент (обложка, подпись, crop, колоризация, before/after коллаж). Стек: Claude API + Vercel AI Gateway (fallback модели) + FFmpeg (локально). Интеграция: кнопка в `/telegram/m/home` и master dashboard. **Ждёт:** первых реальных мастеров с живым материалом.

- [ ] **C2. Marketing-content skill** — пайплайн для маркетинга самого CRES-CA: landing копирайтинг, scroll-stop анимации, YouTube shorts, соцсети. **Уже доступны готовые skills** в текущей среде: `3d-animation-creator` (scroll-controlled video sites), `image-generator` (3 prompts для scroll-stop), `website-intelligence` (competitive analysis + premium site build), `full-clone` (functional replica), `web-page-archiver` (offline copies). Первый deliverable: новый landing с scroll-stop hero через `3d-animation-creator`.

- [ ] **C3. FORGE agent port** — адаптировать FORGE-агент (ads creative pipeline via fal.ai nano-banana-2) из Vizznary-инбокса под CRES-CA. Это фоновой агент, не продуктовая фича: SCRAPER (конкурентные креативы) → LOOPER (winner refs) → FORGE (fal.ai генерация) → PUBLISHER (модерация + аплоад). Применение: мастер загружает референс → система генерит 4 варианта креатива для его постов. **Блокер:** нужен fal.ai API key + договорённость с мастерами про data policy.

- [ ] **C4. Research: AI content research from skool.com + guides** — полная ресёрч-задача: пройти `https://www.skool.com/@dan-p-6986?g=nextgenai` memberships, прочитать 2 Notion guides (Joey Mulcahy — Claude Code Product Visual Workflow + Claude Code For Brands 101), Mobile Editing Club PDF, разобрать 4 Instagram reels как референсы стиля. Выход: `.knowledge/content-research.md` с выдержками best practices. **Инструмент:** `mcp__claude-in-chrome__*` (пользователь уже залогинен в skool) + Firecrawl MCP для Notion. **Не курс по курсу — а дистиллят в 1 файл.**

### Референсы (источники, не удалять)

**Внешние гайды / курсы:**
- https://www.skool.com/@dan-p-6986?g=nextgenai — Skool профиль Данила (memberships: NextGen AI и другие AI-контент комьюнити)
- https://joeymulcahyguides.notion.site/The-Claude-Code-Product-Visual-Workflow-3262b10bd51680d6ba29e2072a5ba78e — Claude Code Product Visual Workflow (Joey Mulcahy)
- https://joeymulcahyguides.notion.site/Claude-Code-For-Brands-101-Guide-32d2b10bd51680d7b962eef06abde69f — Claude Code For Brands 101
- https://youmind.com/nano-banana-pro-prompts — nano-banana prompts библиотека
- Mobile Editing Club PDF — `https://assets.stanwith.me/live/msc/26131308/8qbjy/mobileeditingclubcreateugcads.pdf`
- Google Drive ref — `https://drive.google.com/file/d/18C9GxNx5xYMrGa3aW_CHUXzyVDNGupjn/view`

**Instagram референсы (стиль / формат):**
- https://www.instagram.com/reel/DWjsQhVk22z/
- https://www.instagram.com/reel/DWrWNtBDX66/
- https://www.instagram.com/p/DWwNA-ECMB3/
- https://www.instagram.com/p/DWD0TyTDKK9/

### FORGE agent — спецификация (для C3, сохранена целиком)

```yaml
name: FORGE
description: Generates ad creatives (images and videos) via fal.ai nano-banana-2 using briefs from SCRAPER and winner references from LOOPER. Outputs to /ads/pending/.
pipeline_step: 2
receives_from: [SCRAPER, LOOPER]
feeds_into: PUBLISHER
```

**Responsibilities:**
- Consume briefs from SCRAPER + winner refs from LOOPER
- Build generation prompts (copy hooks + visual refs + brand tone)
- Call fal.ai nano-banana-2 → image/video variants (default 4)
- Write outputs to `/ads/pending/` + metadata sidecars
- Tag each asset: `brief_id`, `hook_used`, `source_agent`, `variant_index`

**Behavior rules:**
- Always ≥2 variants per brief
- Prefer winner refs from LOOPER; fallback to SCRAPER brief
- Never push direct to Meta — only to `/ads/pending/`
- Retry once on fal.ai error, then skip
- Preserve hook text verbatim
- Video variants приоритетны для AWARENESS objective

**Outputs:**
```
/ads/pending/
  {brief_id}_{variant_index}.jpg  (or .mp4)
  {brief_id}_{variant_index}.meta.json  # {brief_id, hook_used, headline, format, created_at, fal_job_id, source_agent}
```

---

## 1️⃣ ПУБЛИЧНЫЕ СТРАНИЦЫ (landing + статические)

Расположение: `src/app/[locale]/(landing)/`

- [x] **Главная** `/` — hero с three.js, секции features / pricing / testimonials, language switcher (ru/en/ua)
- [x] **Terms** `/terms` — пользовательское соглашение
- [x] **Privacy** `/privacy` — политика конфиденциальности
- [x] **Contact** `/contact` — форма связи
- [x] **User flow** `/user-flow` — диаграмма сценариев использования (внутренняя)
- [x] **Leaderboard** `/leaderboard` — top masters, gamification
- [x] **Public master profile** `/m/[handle]` — публичная страница мастера по pretty-handle
- [x] **Invite** `/invite/[code]` — лендинг приглашения мастера (auto-follow после регистрации)

### Транзакционные публичные страницы (без locale)
- [x] **Confirm** `/confirm/[apt_id]` — клиент подтверждает запись по ссылке из уведомления
- [x] **Review** `/review/[apt_id]` — клиент оставляет отзыв после визита
- [x] **Invoice** `/invoice/[apt_id]` — счёт / чек для клиента
- [x] **Consent** `/consent/[token]` — подписание согласия (медицинские / эстетические услуги)

---

## 2️⃣ AUTH — регистрация, вход, сброс пароля

Расположение: `src/app/[locale]/(auth)/`

### Web
- [x] **Login** `/login` — email + password, routing по роли (client → `/feed`, master → `/dashboard`, salon → `/dashboard`)
- [x] **Register** `/register` — регистрация с выбором роли (client / master / salon)
- [?] **Password reset** — **код существует в Supabase Auth, но UI-страницы `/forgot-password` и `/reset-password` НЕТ** → см. раздел 🔮 «Что предстоит сделать»

### Telegram Mini App (альтернативный вход)
- [x] **Entry** `/telegram` — HMAC-валидация initData, routing на welcome/register/home в зависимости от статуса
- [x] **Welcome** `/telegram/welcome` — CTA «Создать аккаунт» + «У меня уже есть аккаунт»
- [x] **Register** `/telegram/register` — анкета (имя, отчество, фамилия, email, согласие)
- [x] **Link existing** — bottom sheet с email → 8-значный OTP → линковка существующего аккаунта к `telegram_id`
- [x] **Terms** `/telegram/terms` — согласие внутри Mini App
- [x] **Email OTP delivery** — Resend key в Vercel production, redeploy сделан, код обработки готов *(live-доставка проверяется на стороне пользователя)*

---

## 3️⃣ ONBOARDING — первые шаги после регистрации

Расположение: `src/app/[locale]/onboarding/`

- [x] **Account type** `/onboarding/account-type` — выбор: соло-мастер / салон / клиент
- [x] **Vertical** `/onboarding/vertical` — выбор индустрии (beauty / health / auto / pets / tattoo / …), грузит дефолты услуг
- [x] **Create business** `/onboarding/create-business` — название бизнеса, логотип, адрес, часовой пояс

---

## 4️⃣ КЛИЕНТ — WEB версия

Расположение: `src/app/[locale]/(client)/`

> **Статус:** Frozen после запуска Mini App. Web-клиент оставлен для совместимости / десктоп-сценариев. Основной клиентский опыт — в Telegram Mini App (раздел 5).

- [x] **Feed** `/feed` — лента постов мастеров, на которых подписан клиент
- [x] **Map** `/map` — карта с мастерами и салонами рядом
- [x] **Masters list** `/masters` — поиск/фильтры мастеров
- [x] **Master profile** `/masters/[id]` — карточка мастера + услуги + магазин + before/after
- [x] **Booking** `/book?master_id=…&service_id=…` — флоу записи
- [x] **My calendar** `/my-calendar` — календарь клиента со всеми записями
- [x] **History** `/history` + `/history/[id]` — история визитов, before/after фото, отзывы
- [x] **My masters** `/my-masters` — список follow'ов (legacy, уйдёт в follows)
- [x] **Notifications** `/notifications` — inbox
- [x] **Profile** `/profile` — карточка клиента
- [x] **Profile → Photos** `/profile/photos` — загруженные фото
- [x] **Profile → Documents** `/profile/documents` — документы (только мастер видит)
- [x] **Profile → Family** `/profile/family` — члены семьи (несовершеннолетние)
- [x] **Wallet** `/wallet` — баланс, перевод, цели накоплений, реферал
- [x] **Forms** `/forms` — анамнез / противопоказания / здоровье
- [x] **Account settings** `/account-settings` — настройки аккаунта

---

## 5️⃣ КЛИЕНТ — MOBILE (Telegram Mini App) ⭐ ОСНОВНОЙ ОПЫТ

Расположение: `src/app/telegram/(app)/`
**Дизайн:** Instagram-like, 5-tab bottom nav, dark theme, framer-motion, haptics.

- [x] **Home** `/telegram/home` — Stories row + next appointment strip + PostCard feed
  - Stories mixer: likes_7d×2 + rating×10 + recency + city bonus
  - Optimistic like toggle с rollback
  - Empty state: «Лента пуста → Подписаться на мастеров»
- [x] **Search → Map** `/telegram/search` — редирект на `/telegram/map`
- [x] **Map** `/telegram/map` — Leaflet карта, TG LocationManager → browser → IP → Kyiv fallback, маркеры мастеров + салонов, selected card
- [x] **Search detail** `/telegram/search/[id]` — карточка мастера из результатов поиска
- [x] **Salon detail** `/telegram/salon/[id]` — карточка салона
- [x] **User profile** `/telegram/u/[publicId]` — публичный профиль юзера
- [x] **Activity** `/telegram/activity` — список записей клиента
- [x] **Activity detail** `/telegram/activity/[id]` — cancel / reschedule / repeat / rate modals
- [x] **Notifications** `/telegram/notifications` — inbox, realtime badge, mark-all-read
- [x] **Profile** `/telegram/profile` — Instagram-style: аватар + CRES-ID под именем, followers/following, Edit/Share, avatar upload, posts grid, меню (сертификаты + настройки)
- [x] **Settings** `/telegram/settings` — sign out + legal links

**Block CA-CF Summary (CLIENT-WORK.md 37/37 ✓):**
- CA: Auth holes закрыты (Resend + link-existing)
- CB: Instagram restyle профиля (9/9)
- CC: 5-я иконка Notifications в bottom nav + realtime badge (3/3)
- CD: Home feed = посты подписок + stories + likes (9/9)
- CE: Аудит каждой кнопки (8/8)
- CF: Backlog закрыт — shop на master page, goals v2, wallet RPC, before/after appointment_id (4/4)

---

## 6️⃣ МАСТЕР — MOBILE (Telegram Mini App)

Расположение: `src/app/telegram/m/`
**Дизайн:** дашборд-style dark theme, быстрый доступ к календарю и клиентам прямо с телефона.

- [x] **Home** `/telegram/m/home` — KPI плашки, ближайшие записи, быстрые действия
- [x] **Calendar** `/telegram/m/calendar` — день + неделя, drag-drop, быстрое создание слота
- [x] **Slot new** `/telegram/m/slot/new` — создание нового слота / записи
- [x] **Voice booking** `/telegram/m/voice-book` — голосом: запись → транскрипция → парсинг → confirm
- [x] **Clients** `/telegram/m/clients` — список клиентов мастера
- [x] **Client detail** `/telegram/m/clients/[id]` — карточка: визиты, документы, allergies, blacklist
- [x] **Stats** `/telegram/m/stats` — KPI: revenue / appointments / top services
- [x] **Notifications** `/telegram/m/notifications` — мастерский inbox
- [x] **Profile** `/telegram/m/profile` — профиль мастера + posts grid + кнопка «+» для загрузки поста

---

## 7️⃣ МАСТЕР / САЛОН — WEB (Dashboard)

Расположение: `src/app/[locale]/(dashboard)/`
**Дизайн:** Linear/Raycast-like, dark sidebar, bento stat cards, command palette.
**Роутинг:** одна dashboard-структура для соло-мастера и салона; фичи, которые видны только салону (team, shifts, payrun, multi-location, equipment), скрыты через `useMaster().type === 'salon'`.

### 📊 Dashboard home
- [x] `/dashboard` — обзор, KPI, свежие события, stat cards

### 📅 Calendar
- [x] `/calendar` — day/week/3-day/month view, drag-drop, quick-sale drawer, Fresha-like UI

### 👥 Clients
- [x] `/clients` — список клиентов, поиск, фильтры
- [x] `/clients/[id]` — карточка клиента
- [x] `/clients/import` — импорт CSV / Google Contacts
- [x] `/clients/blacklist` — global blacklist (cancel history cross-master)
- [x] `/clients/cadence` — cadence analytics (регулярность визитов)
- [x] `/clients/loyalty` — программа лояльности
- [x] `/clients/segments` — сегменты для рассылок

### 💼 Services
- [x] `/services` — каталог услуг
- [x] `/services/memberships` — абонементы / пакеты
- [x] `/services/products` — товары на продажу

### 📦 Inventory
- [x] `/inventory` — склад
- [x] `/inventory/scan` — штрих-код сканер

### 💰 Finance
- [x] `/finance` — overview
- [x] `/finance/daily` — ежедневный кассовый отчёт
- [x] `/finance/appointments` — финансы по записям
- [x] `/finance/payments` — платежи
- [x] `/finance/expenses` — расходы
- [x] `/finance/cashflow` — cashflow
- [x] `/finance/profitability` — рентабельность
- [x] `/finance/reports` — отчёты
- [x] `/finance/tax-report` — налоги
- [x] `/finance/tips` — чаевые
- [x] `/finance/gift-cards` — подарочные сертификаты
- [x] `/finance/memberships` — доход от абонементов
- [x] `/finance/lost-revenue` — упущенная выручка
- [x] `/finance/split/[apt_id]` — сплит оплаты (несколько методов)

### 📢 Marketing
- [x] `/marketing` — overview
- [x] `/marketing/automation` — автоматизации (reminder, upsell, birthday)
- [x] `/marketing/campaigns` — кампании
- [x] `/marketing/deals` — акции / скидки
- [x] `/marketing/google` — Google My Business интеграция
- [x] `/marketing/guild` — гильдии мастеров (cross-promo)
- [x] `/marketing/links` — короткие ссылки + UTM
- [x] `/marketing/messages` — прямые рассылки
- [x] `/marketing/pricing` — динамическое ценообразование
- [x] `/marketing/products` — CRUD товаров магазина
- [x] `/marketing/profile` — настройки публичного профиля мастера
- [x] `/marketing/reviews` — модерация отзывов
- [x] `/marketing/social` — соцсети / автопост

### 🎨 Portfolio & content
- [x] `/portfolio` — портфолио мастера
- [x] `/stories` — stories / истории
- [x] `/before-after` — загрузка фото до/после

### 🎙 AI / voice
- [x] `/voice-notes` — голосовые заметки (OpenRouter транскрипция)
- [x] `/recommend` — AI-рекомендации услуг/товаров клиенту

### 📝 Consents
- [x] `/consents` — формы согласий / подписи

### ⏱ Queue
- [x] `/queue` — очередь (живая очередь без записи)

### 🔌 Add-ons / Network
- [x] `/addons` — marketplace платных аддонов
- [x] `/network` — сеть мастеров / референс

### ⚙ Settings
- [x] `/settings` — главные настройки
- [x] `/settings/billing` — подписка + оплата (LiqPay)
- [x] `/settings/equipment` — оборудование (салон)
- [x] `/settings/faq` — FAQ
- [x] `/settings/locations` — локации (мульти-локация)
- [x] `/settings/team` — команда (салон)
- [x] `/settings/team/payrun` — выплаты зарплат
- [x] `/settings/team/shifts` — смены
- [x] `/settings/team/timesheets` — табели
- [x] `/settings/time-off` — отпуска / выходные
- [x] `/settings/time-off/import-ics` — импорт ICS календаря

---

## 8️⃣ ИНФРАСТРУКТУРА

### API Routes (`src/app/api/`)
- [x] `/api/auth/*` — sign-in, sign-out
- [x] `/api/telegram/*` — webhook, register, email-otp, link-existing
- [x] `/api/telegram/webhook` — обработка команд бота
- [x] `/api/pair/issue` + `/api/pair/consume` — 6-значный pairing code *(orphan UI после удаления QR-таба в CB3)*
- [x] `/api/profile` — CRUD профиля
- [x] `/api/follow` + `/api/follow/list` — подписки
- [x] `/api/posts` + `/api/posts/like` — посты + лайки
- [x] `/api/feed` + `/api/feed/stories` — лента + сторис
- [x] `/api/notifications` — inbox CRUD
- [x] `/api/cron/*` — крон-задачи (reminders, burning-slots, birthday, cadence)
- [x] `/api/voice-booking/parse` — AI парсинг голосовых записей
- [x] `/api/webhook/liqpay` — обработка оплат

### Supabase
- [x] **DB schema:** 40+ таблиц (migrations 00001-00027), детали в `.knowledge/database.md`
- [x] **RLS policies** на каждой таблице
- [x] **RPC functions:** `wallet_transfer`, `posts_bump_author_count`, `post_likes_bump_count`, ещё ~15 штук
- [x] **Storage buckets:** `avatars`, `covers`, `posts`, `portfolio`, `before-after`, `documents`, `voice-notes`
- [x] **Edge functions:** нет (всё в API routes)

### Интеграции
- [x] **Telegram Bot API** — webhook + бот `cres_ca_bot`
- [x] **LiqPay** — оплата подписок и предоплат
- [x] **Resend** — транзакционные emails (OTP, reminders)
- [x] **OpenRouter** — AI (voice transcription, recommendations)
- [x] **Google Maps** — геокодинг + маршруты
- [x] **Leaflet + OSM** — карты в Mini App (бесплатные)
- [x] **next-intl** — 3 языка (ru/en/ua)

### DevOps
- [x] **Vercel** production deploy
- [x] **Supabase** managed DB
- [x] **Middleware** — locale, auth, role routing
- [x] **PWA** manifest + service worker
- [x] **SEO** sitemap.xml, robots.txt, OG images

---

## 🔮 ЧТО ПРЕДСТОИТ СДЕЛАТЬ

> Всё, что не является багом текущего функционала. Упорядочено по приоритету.

### HIGH — критично для запуска
- [x] **AUTH-1.** Password reset UI — flow уже inline на `/login` (step machine `forgot → reset-sent → reset-otp → new-password`). **Нашёл баг:** UI ждал 8-значный OTP, а Supabase `resetPasswordForEmail` шлёт 6-значный — flow был сломан. Fix: 6-slot `InputOTP`. Commit `a74608e`.
- [ ] **AUTH-2.** Live-верификация email OTP при регистрации (Resend key стоит, нужен реальный тест)
- [ ] **AUTH-3.** Live-верификация web `/login` для master/salon ролей с реальным аккаунтом
- [x] **BUG-1.** При регистрации через Mini App имя сохраняется с лишним пробелом → fix в `api/telegram/register/route.ts` (trim каждой части до join). Commit `7fa7ce8`.
- [x] **FIX-1.** `cancelled_by_client` / `cancelled_by_master` теперь учитываются в 5 местах: `api/ai/lost-revenue`, `api/slots`, `api/cron/recurring`, `(dashboard)/finance/lost-revenue`, `(dashboard)/finance/appointments`. Commit `7fa7ce8`.
- [~] **I18N-1.** Масштабная регрессия next-intl: **50 файлов с захардкоженными RU-строками** (нарушение §4 rules). Делается пакетами по surface. **Прогресс: 2/50.**
  - [x] `(dashboard)/layout.tsx` — 66 строк (sidebar nav + header + user menu + notifications panel) вынесены в `dashboard.nav.*` / `dashboard.header.*` для ru/en/uk. Commit `0e65320`.
  - [x] `(dashboard)/marketing/messages/page.tsx` — 15 строк (title, description, kindLabels×8, form labels, toasts) → `marketing.messagesPage.*` для ru/en/uk. 2026-04-15.
  - [ ] **Следующий батч (по убыванию количества строк):**
    - [ ] `(dashboard)/calendar/page.tsx` (~26)
    - [ ] `(dashboard)/finance/*` (lost-revenue, appointments, daily, profitability, tax-report, payments, gift-cards, memberships)
    - [ ] `(dashboard)/clients/*` (segments, loyalty, blacklist, cadence)
    - [ ] `(dashboard)/services/*`, `inventory/*`, `before-after`, `recommend`, `network`
    - [ ] `(dashboard)/settings/team/*` (shifts, timesheets, payrun)
    - [ ] `(client)/**` — web client profile + feed legacy
    - [ ] `/telegram/**` — Mini App (notifications, home, profile, search, slot/new, voice-book)
- [ ] **E2E-1.** Master↔Client live flow не верифицирован: создать запись мастером → проверить у клиента (history/wallet/notifications). Нужен прогон через Claude-in-Chrome после подключения расширения.
- [ ] **E2E-2.** Wallet transfer RPC (`00027_cf3_wallet_transfer_rpc.sql`) — проверить live: перевод между кошельками, concurrent lock, FX конверсия.
- [ ] **E2E-3.** RLS policies — аудит всех таблиц (client не видит чужое, master видит только своих клиентов).

### HIGH — из слов Данила (Batch 5 + устные указания 2026-04-15)

- [ ] **AGENTS-1.** Создать полный набор субагентов по элементам сервиса (принцип №1): `landing-agent`, `auth-agent` (login+register+reset), `onboarding-agent`, `client-mobile-profile-agent`, `client-mobile-feed-agent`, `client-mobile-search-map-agent`, `client-mobile-activity-agent`, `client-web-legacy-agent`, `master-mobile-agent`, `dashboard-calendar-agent`, `dashboard-clients-agent`, `dashboard-services-agent`, `dashboard-finance-agent`, `dashboard-marketing-agent`, `dashboard-inventory-agent`, `dashboard-settings-agent`, `admin-agent`, `infrastructure-agent`. Каждый с собственным `SECTOR.md`: правила проектирования, UX-паттерны, референсы DESIGN.md, типичные ошибки, чек-лист перед коммитом. Роутинг (какой файл → какой агент) прописать в `CLAUDE.md §Sector agents`. **Источник:** слова Данила 2026-04-14 и 2026-04-15, подтверждено при аудите структуры.
- [ ] **UX-5.** Клиентская мобилка: категорийные пилюли («Красота / Здоровье / Велнес / Дом / Авто / Фитнес») — премиум-редизайн. Сейчас «не красиво» (Batch 5). Референс: `.knowledge/design-md/` (pinterest / spotify-like chips с микро-анимациями).
- [ ] **UX-6.** Клиентская мобилка: пустое состояние ленты «Лента пуста» — заменить на **промо-мастеров**. Логика: если у клиента 0 подписок → показывать топ-мастеров (по рейтингу, активности, платному продвижению в будущем) как «Рекомендуем подписаться». Никогда не показывать голый «nothing here». **Источник:** Batch 5, дословно «пустоты быть не должно, как только у нас будет больше реальных мастеров и команд можно самых популярных и кто доплачивает нам за продвижение может показываться в ленте у новиньких клиентов».
- [ ] **UX-7.** Клиентская мобилка целиком: премиум-полировка по каждому экрану (home, feed, search, map, activity, notifications, profile, settings). **Источник:** Batch 5, дословно «это самая ущербная мобильная версия что я видел. исправляйся, ищи референсы, делай премиально, дорого и достойно». Делать только через `client-mobile-*-agent` (см. AGENTS-1).
- [ ] **UX-8.** Telegram Mini App: верифицировать персистентность сессии — после закрытия/переоткрытия Mini App пользователь не должен снова проходить авторизацию. Проверить, что Supabase session cookies переживают Telegram WebView reload. **Источник:** Batch 5, дословно «как только человек авторизируется то система в телеграмме должна его запомнить и ему больше не нужно повторно авторизироваться».
- [x] **UX-9.** Mobile profile клиента: редактирование email, телефона, пароля + видимая кнопка «Выйти из аккаунта». Выполнено 2026-04-15 (commit `b4539b4`): добавлен блок Email/Phone на профиле, Edit modal расширен phone/email, отдельная модалка «Сменить пароль» (через `supabase.auth.updateUser`), кнопка «Выйти» прямо на профиле (не спрятана в Settings), `/api/profile` принимает `phone`/`email`/`password`.
- [x] **UX-10.** Mobile profile клиента: фикс несоответствия имени и аватара. Баг: при `profiles.full_name = "Таисия Падалко"` аватар показывал букву «Д» (из Telegram `photo_url` текущего tg-аккаунта «Даниил»). Фикс: аватар использует `user.photo_url` **только** если DB full_name пустое или совпадает с Telegram first+last name. Иначе — первая буква DB full_name. Commit `b4539b4`.

### MEDIUM — улучшения UX / quality
- [ ] **UX-1.** Hardcoded RU-строки в `/telegram/(app)/notifications` — перенести в next-intl (часть I18N-1)
- [ ] **UX-2.** Client web-профиль (`(client)/profile/page.tsx`) — актуализировать под новый дизайн (сейчас legacy)
- [ ] **UX-3.** Pairing API (`/api/pair/*`) — либо вернуть UI, либо удалить orphan роуты
- [ ] **UX-4.** Кнопка «Пожаловаться» на публичном профиле мастера `/m/[handle]` + модалка с причинами + запись в `reports` таблицу (источник: inbox 2026-04-14)
- [ ] **LINT-1.** 79 `react-hooks/set-state-in-effect` ошибок (React 19 strict) — рефакторить effect'ы на events / derived state. Не runtime-блокер, но копится.
- [ ] **LINT-2.** 76 unused imports/vars — автоматически через `eslint --fix` + ручная чистка.
- [ ] **LINT-3.** 27 `<img>` → заменить на `next/image` (performance + LCP).
- [x] **LINT-4.** 12 `<a href="/...">` → `<Link>` из `next/link`. Исправлено в `calendar/page.tsx` (`/services`) и `telegram/register/page.tsx` (`/telegram/terms`). 2026-04-15.
- [ ] **LINT-5.** 29 `react-hooks/preserve-manual-memoization` + 20 `exhaustive-deps` warnings — аудит и исправление.

### LOW — rework / рефакторинг
- [ ] **REF-1.** `favorites` → мигрировать в `follows` (legacy таблица)
- [ ] **REF-2.** `/my-masters` web-страница — решить судьбу (переписать или удалить)
- [ ] **REF-3.** 21 non-null assertion (`!`) в коде — ревью на безопасность.
- [ ] **REF-4.** 4 `any`-типа — заменить на конкретные типы.
- [ ] **REF-5.** TODO Phase 8 в `feed/page.tsx` — geo + paid placement ranking RPC, real social-proof from bookings.

### BLOCK D — КЛИЕНТСКИЕ КАРТЫ & CRM (dashboard/clients)

> **Аудит 2026-04-16:** все страницы clients/* подключены к Supabase (REAL, не стабы). Ниже — задачи по доведению до production-grade CRM.

- [ ] **D1.** Карточка клиента `/clients/[id]` — **верификация табов**: прогнать E2E flow (Info → History → Notes → Health → Files) с реальным клиентом. Убедиться: (a) визиты отображаются по дате, (b) notes сохраняются, (c) allergies/contraindications показывают alert-баннер на записи, (d) файлы загружаются в Storage bucket `documents`.
- [ ] **D2.** Анамнез per-vertical — intake-форма (`allergies`, `chronic_conditions`, `medications`, `pregnancy`, `contraindications`) сейчас универсальная. **Сделать:** dynamic form по вертикали мастера: beauty → кожа/аллергены/процедуры, health → полный медицинский, auto → нет анамнеза, pets → порода/вес/прививки. Конфигурация в `src/lib/verticals/`.
- [ ] **D3.** Consent forms — `/consents` имеет CRUD шаблонов. **Проверить:** (a) подписание через `/consent/[token]` публичную страницу работает, (b) подпись привязывается к appointment, (c) PDF-экспорт/печать формы.
- [ ] **D4.** Before/After фото — `/before-after` имеет upload + slider. **Проверить:** (a) привязка к appointment_id, (b) клиент видит свои before/after в Mini App `/telegram/activity/[id]`, (c) фото в Storage bucket `before-after`.
- [ ] **D5.** Blacklist — `/clients/blacklist` работает по threshold (cancellations/no-shows). **Добавить:** (a) ручное добавление клиента в blacklist с причиной, (b) cross-salon видимость (если мастер в салоне — blacklist общий), (c) alert при попытке записи blacklisted клиента.
- [ ] **D6.** Семейные аккаунты — web client `/profile/family` существует. **Сделать:** (a) мастер видит связанных членов семьи на карточке клиента, (b) parent подписывает consent за minor, (c) при записи minor — автоматически уведомить parent.
- [ ] **D7.** Клиентская аналитика на карточке — `total_visits`, `total_spent`, `avg_check`, `last_visit_at` уже в интерфейсе. **Добавить:** (a) CLV прогноз (average spend × predicted visits), (b) график частоты визитов (sparkline), (c) рекомендация «пора напомнить о визите» на основе cadence.
- [ ] **D8.** Голосовые заметки к клиенту — `/voice-notes` существует отдельно. **Интегрировать:** кнопка 🎙 на карточке клиента → запись голосовой → сохранение в notes клиента с транскрипцией.

### BLOCK E — КАЛЕНДАРЬ & БРОНИРОВАНИЕ (production flow)

> **Аудит 2026-04-16:** calendar page полная — 4 views, waitlist, blocked times, quick-sale, analytics, filters. Задачи ниже — про E2E flow и бизнес-логику.

- [ ] **E1.** E2E бронирование — **golden path:** (a) мастер создаёт slot → (b) клиент бронирует через Mini App → (c) мастер видит в календаре → (d) reminder за 24ч/1ч → (e) appointment completes → (f) review request → (g) payment записывается в finance. Каждый шаг верифицировать live.
- [ ] **E2.** Auto-reminders — cron `/api/cron/reminders` существует. **Проверить:** (a) Telegram push notification работает через бот, (b) email reminder через Resend, (c) configurable за N часов до визита.
- [ ] **E3.** Waitlist matching — `waitlist-drawer` в календаре существует. **Проверить:** (a) когда slot освобождается (cancel) — первый в waitlist получает уведомление, (b) auto-book или manual-confirm option.
- [ ] **E4.** Recurring appointments — **проверить:** (a) повторяющаяся запись создаётся серией, (b) cancel одного не отменяет остальные, (c) reschedule всей серии.
- [ ] **E5.** Buffer time — между appointments должен быть настраиваемый перерыв (5/10/15 мин). **Проверить** в settings → working_hours, убедиться что calendar не позволяет booking впритык.
- [ ] **E6.** Online booking widget — мастер расшаривает ссылку `/m/[handle]` → клиент видит услуги → выбирает время → бронирует. **Верифицировать** весь flow от публичной страницы до записи в DB.
- [ ] **E7.** Cancellation policy — `/settings` имеет настройки. **Проверить:** (a) late cancel (< 24ч) → запись в lost-revenue, (b) no-show → behavior indicator, (c) клиент видит policy при бронировании.

### BLOCK F — ФИНАНСЫ (production readiness)

> **Аудит 2026-04-16:** 14 finance sub-pages, все с real Supabase queries. Задачи — E2E верификация и недостающая логика.

- [ ] **F1.** Daily sales report — `/finance/daily`. **Верифицировать** с реальным completed appointment: (a) сумма считается правильно, (b) разбивка по payment method (cash/card/online), (c) tips отображаются отдельно.
- [ ] **F2.** Gift cards lifecycle — `/finance/gift-cards`. **Проверить:** (a) создание gift card с суммой, (b) применение при оплате appointment, (c) частичное использование (остаток на карте), (d) expiry date.
- [ ] **F3.** Memberships revenue — `/finance/memberships` + `/services/memberships`. **Проверить:** (a) создание абонемента (N визитов за цену), (b) списание визита при бронировании, (c) revenue attribution в отчёте.
- [ ] **F4.** Split payment — `/finance/split/[apt_id]`. **Проверить:** оплата одного appointment несколькими методами (часть cash + часть card).
- [ ] **F5.** Tax report — `/finance/tax-report`. **Проверить:** (a) налоговая ставка из `masters.tax_rate_percent`, (b) калькуляция за период, (c) export CSV/PDF.
- [ ] **F6.** Expenses tracking — `/finance/expenses`. **Проверить:** (a) CRUD расходов по категориям, (b) учёт в profitability report (revenue - expenses = profit).
- [ ] **F7.** LiqPay integration — webhook `/api/webhook/liqpay`. **Верифицировать:** (a) оплата подписки проходит, (b) статус обновляется в `subscriptions` таблице, (c) receipt генерируется.

### BLOCK G — МАРКЕТИНГ & GROWTH (автоматизации)

> **Аудит 2026-04-16:** marketing/* pages все REAL. Задачи — активация автоматизаций и проверка delivery.

- [ ] **G1.** Auto-birthday greetings — `/marketing/automation`. **Проверить:** (a) cron проверяет `date_of_birth` ежедневно, (b) Telegram notification или email отправляется, (c) опциональный купон/скидка attached.
- [ ] **G2.** Re-booking cadence — `/clients/cadence` показывает analytics. **Автоматизировать:** если клиент не был N дней (настраиваемый threshold по услуге) → auto-push «Пора записаться».
- [ ] **G3.** Review collection — `/marketing/reviews`. **Проверить:** (a) после completed appointment → auto-send review request через Telegram/email, (b) `/review/[apt_id]` публичная страница работает, (c) отзыв сохраняется и виден на профиле мастера.
- [ ] **G4.** Campaign delivery — `/marketing/campaigns`. **Проверить:** (a) сегмент clients → compose message → отправка через Telegram бот, (b) delivery tracking (sent/delivered/read), (c) unsubscribe option.
- [ ] **G5.** Deals & promotions — `/marketing/deals`. **Проверить:** (a) создание акции (% или фиксированная скидка, период), (b) deal видна клиенту в Mini App при бронировании, (c) revenue учитывается со скидкой.
- [ ] **G6.** Social auto-posting — `/marketing/social`. **Проверить:** (a) мастер создаёт пост → auto-cross-post в feed Mini App, (b) Instagram/Telegram integration (если настроено).
- [ ] **G7.** Auto-upsell — `/recommend`. **Проверить:** (a) на основе истории визитов AI рекомендует доп. услугу/продукт, (b) рекомендация показывается мастеру на карточке клиента перед визитом.

### BLOCK H — ИНВЕНТАРЬ & ТОВАРЫ

> **Аудит 2026-04-16:** inventory page REAL с CRUD и barcode scan. Задачи — integration с appointments и alerts.

- [ ] **H1.** Product sale при appointment — при завершении визита мастер может добавить продажу товара. **Проверить:** (a) quick-sale drawer на calendar, (b) stock decrement, (c) revenue в finance.
- [ ] **H2.** Low stock alerts — **добавить:** (a) threshold per product, (b) notification мастеру когда stock < threshold, (c) badge на sidebar Inventory icon.
- [ ] **H3.** Supplier management — **если нет:** добавить простую таблицу suppliers + привязка product → supplier. Для reorder flow.
- [ ] **H4.** Barcode scan verification — `/inventory/scan` существует. **Проверить** live: камера → распознание → поиск товара → +/- stock.

### BLOCK I — ИНТЕГРАЦИЯ КЛИЕНТ↔МАСТЕР (Telegram Mini App ↔ Dashboard)

> Самый критичный блок: связка между тем что мастер делает в Dashboard и тем что клиент видит в Telegram.

- [ ] **I1.** Realtime notifications — когда мастер создаёт/меняет/отменяет appointment → клиент получает push в Telegram. **Проверить:** (a) Supabase realtime trigger → API → Telegram Bot API `sendMessage`, (b) badge в Mini App notifications tab обновляется.
- [ ] **I2.** Booking flow полный цикл — клиент в Mini App: (a) находит мастера на карте `/telegram/map`, (b) открывает профиль `/telegram/search/[id]`, (c) выбирает услугу, (d) выбирает время из доступных слотов, (e) подтверждает → запись появляется в `/telegram/activity`. **Весь flow верифицировать E2E.**
- [ ] **I3.** Client feed ↔ Master posts — мастер создаёт пост в Dashboard `/portfolio` или `/stories` → пост появляется в ленте подписанных клиентов `/telegram/home`. **Проверить** latency и корректность.
- [ ] **I4.** Master profile in Mini App — `/telegram/search/[id]` показывает: (a) услуги с ценами, (b) портфолио, (c) отзывы, (d) рабочие часы, (e) кнопка «Записаться». **Проверить** полноту данных.
- [ ] **I5.** After-visit flow — после completed appointment клиент в Mini App: (a) видит визит в `/telegram/activity/[id]`, (b) может оставить отзыв, (c) видит before/after фото (если мастер загрузил), (d) может repeat booking.
- [ ] **I6.** Wallet & payments — клиент в `/telegram/profile` видит wallet balance. **Проверить:** (a) пополнение, (b) оплата записи с wallet, (c) бонусные баллы начисляются после визита.
- [ ] **I7.** Dashboard header name fix — **DONE 2026-04-16:** убран generic fallback «Пользователь» → показывается реальное имя мастера из `master.profile.full_name`. Пустая строка как fallback пока profile загружается.

### IDEAS — Parking lot (не в порядке)
- [ ] **Платные stories** для продвижения — buy-boost с тарифом в subscription, или разовая оплата через wallet (источник: inbox 2026-04-14)
- [ ] Stories 24h auto-expire (сейчас stories микшер постоянный)
- [ ] Видео-посты в feed
- [ ] Reels-style вертикальные видео мастеров
- [ ] Direct messages client ↔ master внутри Mini App
- [ ] Pretty-handle URLs `cres-ca.com/u/<slug>`
- [ ] Multi-account switcher (несколько TG аккаунтов на один профиль)
- [ ] AI-rebooking flow (backlog из `backlog-feed-and-ai.md`)

---

## 📊 ОБЩИЙ СТАТУС ПРОЕКТА

```
Phases 00-23          ████████████  24 / 24 ✓
MASTER-WORK           ████████████  116 / 116 ✓
CLIENT-WORK           ████████████  37 / 37 ✓

Landing               ████████████  8 / 8
Auth                  ████████████  7 / 7 (+ 3 TODO для password reset UI и live test)
Onboarding            ████████████  3 / 3
Client Web            ████████████  17 / 17 (legacy, frozen)
Client Mini App       ████████████  11 / 11 ⭐ основной
Master Mini App       ████████████  9 / 9
Dashboard             ████████████  ~60 / 60
Infrastructure        ████████████  все интеграции на месте
```

**Вердикт:** UI и Supabase интеграция для всех 60+ страниц dashboard REAL (не стабы). Фокус: E2E верификация, автоматизации, client↔master интеграция (BLOCK D-I: ~40 задач).

---

## 🗂 Связанные документы (вспомогательные)

Эти файлы **не дублируют** этот документ — они хранят детали:

- `CLAUDE.md` — правила работы, индекс lazy-loaded знаний
- `.knowledge/project.md` — бизнес-модель, персоны, монетизация
- `.knowledge/vision.md` — сырое видение владельца (источник истины для «что и зачем»)
- `.knowledge/verticals.md` — карта индустриальных вертикалей
- `.knowledge/tech-stack.md` — Next.js 16 quirks, версии
- `.knowledge/rules.md` — критичные правила и DO NOTs
- `.knowledge/database.md` — схема БД, миграции
- `.knowledge/translations.md` — ключи i18n
- `.knowledge/design-md/INDEX.md` — per-brand DESIGN.md палитры (linear, pinterest, stripe…)
- `.knowledge/roadmap/INDEX.md` — исторические phases 00-23
- `.knowledge/roadmap/MASTER-WORK.md` — архив фазы соло-мастера (116/116 ✓)
- `.knowledge/roadmap/CLIENT-WORK.md` — архив фазы расфриза клиента (37/37 ✓)
- `.knowledge/CLIENT-REFERENCE.md` — снэпшот клиентского модуля
- `D:/toolbox/CLAUDE.md` — универсальные лучшие практики (переносятся между проектами)

---

## 📜 Changelog (журнал изменений PROJECT-MAP)

- **2026-04-14** — файл создан. Полная ревизия проекта: 116 pages замаплены по 8 разделам, собрана секция «Что предстоит сделать» (AUTH 1-3, UX 1-3, REF 1-2, IDEAS), определён механизм `📝`-заметок от Данила.
- **2026-04-14** — repo restructure: файл перенесён в `app/` (git repo root) для видимости на GitHub Mobile. Inbox разобран: 4 заметки → BUG-1 (имя с пробелом), FIX-1 (cancelled_by_client в сегментах), UX-4 (кнопка «Пожаловаться» на профиле мастера), IDEAS (платные stories). Добавлены категоризированные папки `.agents/.skills/.components/.snippets/` по таксономии toolbox. Git backlog 124 файла закоммичен и запушен на github.com/danvitpad/cres-ca.
- **2026-04-14** — code-level аудит: `npm run build ✓`, но 260 lint issues и 50 файлов с захардкоженными RU-строками (i18n регрессия §4). Открыты задачи I18N-1, LINT-1..5, E2E-1..3, REF-3..5. Закрыты HIGH: BUG-1 (trim whitespace API), FIX-1 (granular cancellation statuses в 5 местах). Commit `7fa7ce8`.
- **2026-04-14** — AUTH-1 fix: OTP input 8→6 slots (Supabase `resetPasswordForEmail` шлёт 6-digit). Commit `a74608e`.
- **2026-04-14** — I18N-1 batch 1: `(dashboard)/layout.tsx` полностью i18n — 66 строк (sidebar nav titles/tooltips/submenus + header CTA + notifications panel + user menu) вынесены в `dashboard.nav.*` / `dashboard.header.*` для ru/en/uk. `sidebarNav` переведён из top-level const в `useMemo(buildSidebarNav(t))`. Build ✓. Commit `0e65320`.
- **2026-04-14** — сессия завершена. Session totals: AUTH-1 ✓, BUG-1 ✓, FIX-1 ✓, I18N-1 batch 1 ✓ (1/50 файлов). **Завтра продолжать:** I18N-1 batch 2 — начать с `marketing/messages/page.tsx` (27 строк), дальше `calendar/page.tsx`. Затем LINT-2 (unused vars — быстрая победа) перед LINT-1 (79 set-state-in-effect — большой).
- **2026-04-15** — **Block C создан + inbox-долг закрыт.** При первоначальном B1 я ошибочно пропустил блок на 78 строк (FORGE agent spec + 8 внешних ссылок + skool.com профиль Данила) — решил, что это embedded YAML, а на деле это был сырой inbox-материал по контент-пайплайну от 2026-04-14. Сейчас разнесён в новый `BLOCK C — CONTENT PIPELINE` с 4 задачами (C1 product-content, C2 marketing-content, C3 FORGE port, C4 research skool+guides) и секцией «Референсы» где все ссылки сохранены. FORGE yaml спецификация также сохранена для C3. Inbox действительно очищен.
- **2026-04-15** — **Autonomous session (продолжение).** **A7** telegram-auth audit complete → `.knowledge/telegram-auth-audit-2026-04-15.md` с 4 findings (key: salon_admin нельзя зарегать через Mini App — design gap). **LINT-2** unused imports: установлен `eslint-plugin-unused-imports`, настроен в `eslint.config.mjs`, `--fix` выгреб 52 unused imports в 28 файлах, issues 259→207. **I18N-1 batch 2** (1 файл): `marketing/messages/page.tsx` → 15 строк в `marketing.messagesPage.*` (ru/en/uk) + ICU-escape переменных шаблонов. **LINT-4** clear: 12 `<a href>` → `<Link>` в `calendar/page.tsx` и `telegram/register/page.tsx`. Прогресс I18N-1: 2/50.
- **2026-04-15** — **Структурный фикс документа.** Данил указал, что за 2 дня его слова не дошли до структуры: ни правило про субагента на каждый элемент сервиса, ни Batch 5 (пилюли, пустая лента, премиум полировка, Telegram persistence, правка email/phone/password/logout). Исправлено: (1) добавлена новая секция **⚖️ ПРИНЦИПЫ РАБОТЫ** сверху с 5 закреплёнными правилами (субагент на элемент, inbox только Данил, дословность, премиум-дизайн, PROJECT-JOURNAL.md как единая точка правды). (2) Добавлены задачи **AGENTS-1, UX-5, UX-6, UX-7, UX-8** в HIGH. (3) Задачи **UX-9, UX-10** отмечены как `[x]` (сделано сегодня, commits `b4539b4`). **Inbox не трогал** — он только для владельца проекта.
- **2026-04-16** — **Client↔Master subscription system (Instagram-like).** Migration `00033_follow_system.sql`: добавлены `master_follows_back` + `master_followed_back_at` на `client_master_links`, включён RLS (5 policies: client read/insert/delete, master read/update). Новые CRM API routes: `/api/follow/crm/toggle` (follow/unfollow + notification), `/api/follow/crm/back` (master follow-back + notification), `/api/follow/crm/list` (followers/mutual/following). UI: master profile page использует API вместо прямого Supabase + mutual badge, search расширен на email, dashboard clients page получил табы «Все клиенты / Подписчики / Взаимные» с FollowerCard компонентом, my-masters показывает mutual badge. i18n `followSystem` для ru/en/uk. Build ✓.
- **2026-04-16** — **CRM audit + BLOCK D-I создан.** Аудит всех 15 ключевых dashboard pages: ВСЕ подключены к real Supabase (не стабы). Создано 5 новых блоков: **D** (Client Cards & CRM, 8 задач), **E** (Calendar & Booking production flow, 7 задач), **F** (Finances production readiness, 7 задач), **G** (Marketing & Growth автоматизации, 7 задач), **H** (Inventory & Products, 4 задачи), **I** (Client↔Master интеграция Telegram↔Dashboard, 7 задач). Итого ~40 production-readiness задач. Dashboard header name fix: убран fallback «Пользователь» → empty string (реальное имя из `master.profile.full_name`).
- **2026-04-15** — **B4 полная консолидация фронтенд-правил.** Собраны все разрозненные правила (CLAUDE.md §Triggers + `rules.md` + `patterns.md` + `ui-libraries.md` + `design-md/INDEX.md` + toolbox §4/5/6/7/8) в единый мастер-документ `.knowledge/FRONTEND.md` (10 секций). Master-копия — `D:/toolbox/skills/frontend/FRONTEND-PREMIUM.md` (для переноса на следующие проекты). В knowledge-таблице проектного `CLAUDE.md` поднят первой строкой как «читать первым перед любой UI-задачей». Toolbox §16 переписан в двухслойную систему: base skill (`frontend-design@claude-plugins-official`) + premium consolidated doc (проектная надстройка).
- **2026-04-15** — inbox-триаж + критические фиксы. **A1** диагностика: Supabase save path работает (trigger `handle_new_user()` создаёт profiles + masters + subscriptions) — «регистрации не сохраняются» было следствием A2/A4. **A2** `/profile` page.tsx: убран запрос к несуществующей `client_wallets` (404) + исправлены колонки `client_master_links` (`profile_id`/`master_id` вместо `id`/`client_id`) — погасило React error #418 у клиента. **A3** Supabase wipe: тестовые auth users зачищены, 7 демо-мастеров сохранены. **A4** auth полностью переписан: `/login` и `/register` — unified pages с 3-кнопочным role picker (client/master/salon_admin), role = internal state, OAuth только для клиента, старые 1231 строк → `(auth)/_archive/`, `/user-flow` → redirect. **A6** Zoya search — закрыт диагностически (мастерский поиск читает `clients` per-master address book, а не `profiles`). **B1** `PROJECT-MAP.md → PROJECT-JOURNAL.md`, имя MAP зарезервировано под визуальный canvas, inbox очищен (📝 разнесены в A1-A7/B1-B4), `CLAUDE.md` обновлён. **Остаётся:** A5 (унификация тёмной темы master vs client через Context7), A7 (аудит telegram-auth), B2 (toolbox audit), B3 (MCP plugins), B4 (консолидация frontend-design скиллов).
