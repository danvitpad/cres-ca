# CRES-CA

Universal service CRM (masters → salons). Next.js 16 + React 19 + Supabase + next-intl. All commands run from the repo root (this directory).

## 🧭 MAIN MAP — читать первым делом каждой сессии

**`PROJECT-MAP.md`** (рядом с этим файлом) — **единственный живой документ со статусом всего проекта**. Там полная карта всех страниц сервиса с чекбоксами `[x]/[ ]`, раздел «Что предстоит сделать», и inbox для заметок владельца проекта.

**Обязательный протокол на старте каждой сессии:**
1. Прочитать `PROJECT-MAP.md` полностью.
2. Найти все строки с префиксом `📝 TODO:` / `📝 BUG:` / `📝 IDEA:` / `📝 FIX:` (это заметки Данила).
3. Для каждой такой строки — превратить в чекбокс `[ ]` в соответствующем разделе карты, либо в секции «Что предстоит сделать», и начать работу с ней, если пользователь подтвердил.
4. После любых изменений в проекте — обновить чекбоксы в `PROJECT-MAP.md` и добавить запись в секцию «Changelog» внизу карты.
5. **Никогда не создавать параллельный roadmap-документ.** Все фазы, блоки, задачи — только в `PROJECT-MAP.md`. Старые файлы `MASTER-WORK.md`, `CLIENT-WORK.md`, `phase-*.md` — **архив**, не рабочий план.

```bash
npm run dev      # Dev server
npm run build    # Verify build
npm run lint     # ESLint
```

## Knowledge base — read on demand

Do NOT load everything. Read only the files relevant to the current task.

| If the task involves… | Read |
|---|---|
| Project overview, personas, business model | `.knowledge/project.md` |
| **User's raw feature vision** (источник истины для "что делаем и почему") | `.knowledge/vision.md` |
| **Карта индустриальных вертикалей** — дефолты per-industry (анамнез, шаблоны услуг, спец. сущности: pets/vehicles/events) | `.knowledge/verticals.md` |
| Framework versions, Next.js 16 quirks | `.knowledge/tech-stack.md` |
| **Critical rules & DO NOTs** (read before any code) | `.knowledge/rules.md` |
| Folder layout, where files go | `.knowledge/structure.md` |
| DB tables, migrations, storage, subscription tiers | `.knowledge/database.md` |
| Env variables | `.knowledge/env.md` |
| Boilerplate for pages/components/API routes | `.knowledge/patterns.md` |
| i18n / translation keys | `.knowledge/translations.md` |
| UI libraries, 21st.dev snippets, shadcn usage | `.knowledge/ui-libraries.md` |
| **DESIGN.md library** (per-brand palettes/typo/components — ALWAYS check before styling UI) | `.knowledge/design-md/INDEX.md` |
| **АКТИВНАЯ фаза работ (client unfreeze)** | `.knowledge/roadmap/CLIENT-WORK.md` ← единый рабочий док |
| Завершённая фаза (solo-master) | `.knowledge/roadmap/MASTER-WORK.md` (116/116 ✓, для справки) |
| **Client module snapshot** (что реализовано у клиента, связи с мастером, заморожено) | `.knowledge/CLIENT-REFERENCE.md` |
| Исторический roadmap | `.knowledge/roadmap/INDEX.md` |
| Specific phase details | `.knowledge/roadmap/phase-NN-*.md` |

## Planning principle — блоковая нумерация (обязательно)

Любой план фазы / roadmap всегда разбивай на **блоки с буквенным кодом**: `BLOCK A`, `BLOCK B`, `BLOCK X`, `BLOCK Y`... Внутри блока задачи идут с буквенно-цифровым ID: `A1, A2, A3... X6, X7, X8`. Блок = логическая область (Mini App мастера, биллинг, маркетинг, финансы, growth loop и т.п.). Задача = один конкретный шаг.

Обязательные элементы roadmap-документа:
- Легенда статусов `[ ] TODO · [~] IN PROGRESS · [x] DONE+deployed · [!] BLOCKED`
- Рабочие правила сверху (порядок, build→deploy→галочка)
- Прогресс-бар на каждый блок + TOTAL
- Новые идеи идут **только в Parking lot** в конце, не вклинивай в середину
- Единый активный документ фазы (сейчас: `.knowledge/roadmap/MASTER-WORK.md`)

Так работаем всегда — от задачи к задаче, строго сверху вниз по текущему активному документу.

## Auto-promote to Toolbox (обязательно)

Любой приём, правило, шаблон, скилл, агент, компонент или MD-фрагмент, который пользователь одобряет фразами вроде «да, круто», «оставим», «это мы берём», «применяй всегда», «это работает» — **немедленно переносится** в универсальный toolbox: `D:/toolbox/CLAUDE.md` (правила/практики), `D:/toolbox/skills/` (скиллы), `D:/toolbox/templates/` (шаблоны), `D:/toolbox/notes/` (заметки). Цель — ничего не терять между проектами.

Порядок действий при одобрении:
1. Добавить секцию/пункт в `D:/toolbox/CLAUDE.md` с датой и названием проекта-источника.
2. Если это кусок кода / компонент / агент — скопировать файл в соответствующую подпапку toolbox.
3. Обновить `D:/toolbox/README.md`, если появился новый раздел.
4. Коротко сообщить пользователю: «перенёс в toolbox».

Toolbox читается первым на любом новом проекте как база универсальных знаний до проектного CLAUDE.md.

## Triggers that must never be forgotten

1. **`@/` imports only** — never relative `../../..`
2. **YAML header on every new component/page** — `name`, `description`, `created`, `updated`
3. **Supabase: two clients** — `createClient()` server-side (cookies), `createBrowserClient()` client-side. Never mix.
4. **next-intl everywhere** — no hardcoded user-visible strings; all text via `useTranslations()` / `getTranslations()`.
5. **shadcn v4 / base-ui** — do NOT pass `asChild`. Use `render` prop or wrap manually.
6. **DESIGN.md reference on every UI task** — open `.knowledge/design-md/INDEX.md`, pick the brand reference for the surface you're styling (dashboard → `linear.app`, Mini App feed → `pinterest`/`spotify`, marketing → `stripe`), read palette/type/spacing, then build. Never invent ad-hoc styling.

Full list and rationale in `.knowledge/rules.md`.

## Sector agents — auto-routing

Three persona agents live in `.agents/personas/`. Invoke the matching one BEFORE editing files in its sector, and update its `SECTOR.md` after every change.

| Sector | Files | Invoke | Protocol |
|---|---|---|---|
| **Client** | `app/src/app/[locale]/(client)/**` | `/client-agent` | `.agents/personas/client-agent/SECTOR.md` |
| **Master (solo)** | `(dashboard)/**` solo features (calendar, clients, services, personal finance, inventory, settings) | `/master-agent` | `.agents/personas/master-agent/SECTOR.md` |
| **Salon / team** | `(dashboard)/**` team features (team, shifts, payrun, equipment, locations, multi-master calendar, queue, segments, reports, campaigns) | `/salon-agent` | `.agents/personas/salon-agent/SECTOR.md` |

Shared dashboard components → pick the persona that benefits more. If both → invoke sequentially.

## Workspace layout

```
D:/Claude.cres-ca/app/     ← git repo root (github.com/danvitpad/cres-ca)
├── CLAUDE.md              ← this file (index only)
├── PROJECT-MAP.md         ← живой инвентарь проекта (читать первым)
├── .knowledge/            ← lazy-loaded knowledge base
│   ├── project.md, tech-stack.md, rules.md, structure.md,
│   ├── database.md, env.md, patterns.md, translations.md, ui-libraries.md
│   └── roadmap/           ← INDEX.md + phase-00..23
├── .agents/               ← Claude Code agents, категоризированные
│   ├── personas/          ← client-agent, master-agent, salon-agent
│   └── frontend/ backend/ research/ data/ devops/
├── .skills/               ← skills (frontend/backend/research/data/devops/testing)
├── .components/           ← 21st.dev snippets (layout/forms/cards/modals/data-display/marketing/motion)
├── .snippets/             ← hooks/lib/types/sql/regex
├── src/                   ← Next.js App Router code
├── supabase/migrations/   ← SQL migrations
└── public/                ← static assets

D:/Claude.cres-ca/references/  ← read-only (outside git repo)
    ├── original-brief.txt
    ├── ui-snippets-21st/      ← 107 .txt snippets from 21st.dev
    └── fresha-dashboard/      ← cloning reference
```
