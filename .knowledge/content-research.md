# Content Research — визуальная генерация (research для META-2)

> Дистиллят 10 внешних источников от Данила. Цель: практические методы, промпты, воркфлоу, которые можно сразу применять в `D:/toolbox/.workspace/skills/visual-gen/`. Дата: 2026-04-15.
> Research-агент: Opus 4.6. Задача C4 (META-2) из PROJECT-JOURNAL.md.

---

## Executive summary

1. **Стек индустрии схлопнулся вокруг FAL.ai.** Nano Banana 2 (image edit, ~$0.12 / image @ 2K), Veo 3.1 (image-to-video + voice, ~$0.15/s @ 1080p), Seedance 1.5 Pro (UGC talking-head, ~$0.05/s), Kling 3.0 Pro (motion + audio, ~$0.168/s). Один API-ключ покрывает image + video + voice. Это наш дефолтный провайдер для visual-gen.
2. **Claude Code — оркестратор, не генератор.** Всё что делает Joey Mulcahy, viznfr, AI Creative Studio — это Claude Code + `.env` с FAL_KEY + `CLAUDE.md` + `.claude/skills/*/SKILL.md` как reusable workflows. Slash-команды типа `/brand`, `/packshot`, `/ugc`. Это буквально архитектура нашего `visual-gen/` — подтверждение, что направление правильное.
3. **Brand-lock = `/brand <url>` pattern.** Скрипт скрейпит сайт, вытягивает hex-коды / шрифты / top-20 продуктов, генерит `visual-guidelines.md` + `products.json` + папку `product-images/`. Внутри `visual-guidelines.md` живёт "prompt modifier" который автоматически префиксится к каждой генерации. Это готовый компонент F (Brand-lock) для META-2.
4. **5-8 референсов >> 1-2.** Консистентный стиль референсов решает больше, чем хорошо написанный промпт. Это базовое правило для consistency checker (G) и photo engine (B).
5. **UGC-воркфлоу = 4 шага: model-lock → shotboard → extract → animate.** Сначала генерится "талант" (AI-аватар), его лицо/тело фиксируется как reference, потом shotboard выдаёт кадры с продуктом в руках этого же человека, дистортированные лица чинятся Nano Banana 2 edit-ом, в конце Kling/Veo анимирует статичные кадры в talking-head видео. Это buildprint для компонентов A (Avatar factory) + C (Video engine) + D (Lip-sync).
6. **Instagram формат = "комментарий-за-гайд" + screen-record workflow.** Все вирусные reels (viznfr, lenivins, mobileeditingclub) работают по паттерну: хук "100 креативов за 4 минуты" → показ терминала/Claude Code → CTA "напиши CLAUDE / ZRACHOK / editz в комментах → пришлю гайд". Это template для нашего собственного маркетинга visual-gen.
7. **JSON-структурированные промпты для фото реализма.** В nano-banana библиотеке пример #17 (car backseat selfie) использует JSON-спеку с identity-lock, camera EXIF (iPhone 15 Pro), locations, lighting setup, outfit, photography rules. Это паттерн для Prompt library (E) — храним не plain-text, а structured JSON который можно programmatically заполнять.

---

## Источник 1: Joey Mulcahy — Claude Code Product Visual Workflow

- **URL:** https://joeymulcahyguides.notion.site/The-Claude-Code-Product-Visual-Workflow-3262b10bd51680d6ba29e2072a5ba78e
- **Status:** прочитано полностью (через firecrawl, WebFetch возвращал пустой Notion)
- **Автор:** Joey Mulcahy (@byjoeym, 10K IG, 18K TikTok), AI Creative Studio community на Skool

### Ключевые методы
1. **Claude Code как creative director в IDE.** Запускается не в терминале, а внутри Antigravity / VS Code / Cursor как extension.
2. **Три-фазный workflow для продуктового фото:**
   - **Phase 1 — Brand Research.** Юзер кидает URL → Claude скрейпит сайт, строит brand profile, качает top-20 product images.
   - **Phase 2 — Style References.** Юзер dragged-and-drop reference images в чат, говорит `"I want 8 shots of the [product name] in this style"`. Референсы: editorial, film stills, Pinterest, screenshots — что угодно визуально консистентное.
   - **Phase 3 — Generation.** Claude сам пишет промпты, шлёт в Fal.ai, складывает в `brands/yourbrand/outputs/` и строит HTML-gallery page для ревью.
3. **Skill-файл архитектура (4 файла):**
   ```
   your-project-folder/
   ├── CLAUDE.md                          (root-level инструкции)
   ├── .env                               (FAL_KEY=xxx)
   └── skills/references/
       ├── generate-visuals.py            (FAL API caller)
       ├── SKILL.md                       (инструкции для Claude)
       └── style-analysis.md              (как анализировать референсы)
   ```

### Промпт-шаблоны (дословно)
- Запуск Phase 1: `"Start phase 1. https://www.thebrand.com"`
- Phase 2: `"I want 8 shots of the [product name] in this style"`
- Опции (inline natural language):
  - `"generate just shot 1 first"` — test single shot
  - `"give me 4 versions of each shot"` — variants
  - `"use 1K resolution"` / `"use 4K resolution"` — quality toggle
  - `"dry run first"` — preview без сжигания credits

### Инструменты
- **IDE:** Antigravity (recommended), VS Code, Cursor
- **Agent:** Claude Code extension (Anthropic account, Pro+ subscription)
- **Generation API:** Fal.ai (единственный ключ в `.env`)
- **Model:** Nano Banana 2 (Google Gemini-family image edit)
- **Stack:** Python (скрипт `generate-visuals.py`)

### Применимость к visual-gen (META-2)
- **B (Photo engine):** прямой blueprint. Phase 1-2-3 воспроизводим 1:1.
- **E (Prompt library):** структура `skills/references/` = наш `skills/visual-gen/references/`.
- **F (Brand-lock):** brand-profile + top-20 products как input для каждой генерации.
- **H (Output vault):** `brands/<brand>/outputs/` + auto-generated gallery = наш output vault.

> Полный исходник файлов — в отдельном Google Doc, который Joey даёт подписчикам AI Creative Studio (`https://docs.google.com/document/d/1NhJJqED7vuuIVolyXAGncRcTOtmag0kWAmgfG2zS26Y/edit`). Публично — только описание workflow. Если хочется исходники — нужно подписаться на Skool (бесплатный tier или founding member).

---

## Источник 2: Joey Mulcahy — Claude Code For Brands 101

- **URL:** https://joeymulcahyguides.notion.site/Claude-Code-For-Brands-101-Guide-32d2b10bd51680d7b962eef06abde69f
- **Status:** прочитано полностью
- **Тип:** базовый setup-гайд (101) для non-devs

### Ключевые методы

#### Архитектура проекта
```
brand-studio/
├── .env                                    ← FAL_KEY
├── CLAUDE.md                               ← session context
├── brands/
│   └── [brand-name]/
│       ├── brand-identity/
│       │   ├── visual-guidelines.md        ← brand DNA + prompt modifier
│       │   ├── products.json               ← catalogue
│       │   └── product-images/             ← scraped refs
│       └── outputs/                        ← generations
└── .claude/
    └── skills/
        └── [skill-name]/
            └── SKILL.md
```

#### `CLAUDE.md` — starter template (дословно из источника)
```markdown
# AI Brand Studio: Session Context
## Project
AI content generation pipeline for [brand name].
All outputs saved under brands/[brand-name]/.

## Tools
- Image generation: FAL.ai (Nano Banana 2)
- Video generation: FAL.ai (Veo 3.1, Seedance 1.5 Pro, Kling 3.0 Pro)
- API keys loaded from .env

## Folder conventions
- Always create output folders before sharing file paths
- Image naming: [output-name].png for first generation, rename to _v1 on regeneration
- Video naming: [image-stem]-run[n].mp4

## Workflow rules
- Never modify script files unless explicitly asked
- Run scripts from the project root, not from subfolders
- Check for existing spec files before creating new ones

## Brand
[Paste a short summary of your brand here once you've run the /brand setup]
```

#### Skill files (`.claude/skills/<name>/SKILL.md`)
Каждый skill — это Markdown с инструкциями step-by-step: какой FAL-модель звать, в каком порядке спрашивать юзера, как именовать файлы, как версионировать. Вызывается slash-командой вроде `/packshot`, `/ugc`, `/brand`. Описание от Joey: *"Think of each skill as a member of staff who already knows their job. You don't train them every time. You just tell them to start."*

#### `/brand <url>` skill (самый ценный)
Два файла: `skills/references/brand.py` (9.1 KiB) + `skills/brand/SKILL.md` (9.9 KiB). Запуск: `/brand https://yourbrand.com`. Делает:
1. Reads сайт, ищет exact hex codes, fonts, design references.
2. Анализирует конкурентов для визуального differentiator.
3. Пишет `visual-guidelines.md` с: colour palette, typography, photography style, packaging details, ad creative formats, + **"ready-to-use prompt modifier"** что автоматически префиксится к каждой генерации.
4. Скачивает top продукты с сайта → `product-images/` + `products.json`.

### Инструменты и цены (из источника, дословно)

| Модель | Use case | Цена |
|---|---|---|
| Nano Banana 2 (edit) | product shots, model compositing, packshots | ~$0.12 / image @ 2K |
| Veo 3.1 (image-to-video) | product UGC video with voice | ~$0.15/s @ 1080p |
| Seedance 1.5 Pro | UGC talking-head video | ~$0.05/s @ 1080p |
| Kling 3.0 Pro | Motion and animation | ~$0.168/s with audio |

### Ключевые принципы (дословные формулировки)
- *"Without a CLAUDE.md, Claude Code starts each session with no memory... With a good one, it picks up exactly where you left off."*
- *"One well-built skill file can replace hours of prompting across an entire campaign."*
- *"If CLAUDE.md is the brain, skill files are the cheat codes."*

### Применимость к visual-gen
- **Вся архитектура** visual-gen должна зеркалить эту структуру: `CLAUDE.md` + `.env` + `.claude/skills/<name>/SKILL.md` + `skills/references/*.py`.
- **A (Avatar factory):** `/avatar <profile>` skill по аналогии с `/brand`.
- **B (Photo engine):** `/packshot`, `/lifestyle`, `/editorial` skills (у Joey прямо перечислены).
- **C (Video engine):** `/motion <image>` = Veo 3.1 / Kling image-to-video.
- **D (Lip-sync + voice):** Seedance 1.5 Pro = готовый talking-head.
- **E (Prompt library):** prompt modifiers внутри `visual-guidelines.md` — наш формат для brand-locked промптов.
- **F (Brand-lock):** **`/brand` skill = компонент F целиком.** Можно почти дословно копировать.
- **G (Consistency checker):** из принципа "5-8 refs > 1-2" — checker должен валидировать минимум 5 референсов перед запуском.
- **H (Output vault):** `brands/<brand>/outputs/` + smart versioning (`_v1`, `_v2`) + `[image-stem]-run[n].mp4` — naming convention ready.

---

## Источник 3: Nano Banana Pro Prompts библиотека (youmind.com)

- **URL:** https://youmind.com/nano-banana-pro-prompts
- **Status:** прочитано (WebFetch вернул 18 prompt-примеров из 12,467 в библиотеке)
- **Размер библиотеки:** 12,467 промптов, daily updates

### Категории промптов
Photography (portraits, macro, selfies), Infographics (bento grid), Typography (experimental posters, 3D alphabet), Cultural art (Ukiyo-e, Javanese, Viking), Historical (vintage patent), Educational (chalkboard, watercolor maps), Stylisation (paper-cut, line art, hand-drawn).

### Примеры промптов (дословно, по возможности полный текст)

**#1 — Quote Card (Nicolechan, 2025-11-21)**
```
A wide quote card featuring a famous person, with a brown background
and a light-gold serif font for the quote: "Stay Hungry, Stay Foolish"...
```
Формат: 2:1, портрет слева, текст справа, gradient transition.

**#2 — Premium Bento Grid Infographic (Mansi Sanghani, 2026-01-20)**
```
Input Variable: [insert product name]
Language: [insert language]

Create an image of premium liquid glass Bento grid product infographic
with 8 modules...
```
8-card layout, liquid glass 85-90% transparent, 16:9 landscape. Модули: Hero display, Benefits, Usage, Metrics, Demographics, Precautions, Quick Reference, Did You Know.

**#5 — Vintage Patent Document (Alexandra Aisling, 2025-12-25)**
```
A vintage patent document for INVENTION, styled after late 1800s
United States Patent Office filings. The page features precise
technical drawings, numbered callouts (Fig. 1, 2, 3), handwritten
fountain-pen annotations, aged ivory paper with foxing stains,
embossed seals and wax stamps...
```

**#7 — Mirror Selfie Photorealism (宝玉, 2025-10-10)** — structured spec:
```
Scene: blue-toned otaku room
Subject: [gender, age, ethnicity, body type, hairstyle, pose, clothing]
Environment: desk, monitor, PC tower, plants
Lighting: daylight, diffused, 5200K
Camera: smartphone, 26mm equivalent, f/1.8, ISO 100
Negative: no pink, no artificial blur, no NSFW
```

**#8 — Edo Ukiyo-e (VoxcatAI, 2025-12-01)**
```
A Japanese Edo-period Ukiyo-e woodblock print... reimagining modern
technology through an ancient lens...
Smartphones → glowing paper scrolls
Trains → articulated wooden centipede carriages
Skyscrapers → wooden pagodas
Robots → armored woodblock golems
Colours: Prussian blue, vermilion, yellow ochre
Effects: visible wood grain, color misalignment
Aspect ratio: 3:4
```

**#9 — Four-Panel Character Collage (松果先森, 2025-12-30)** — 2x2 grid с identity lock:
```
Panel backgrounds: Navy, Pink, Mint Green, Yellow
Character consistency across all panels
Outfit variations per panel
Puzzle piece integration with text
Central composition burst effects
Camera: 85mm lens, f/1.8, fashion magazine styling
```

**#13 — Extreme Macro Eye (BananaBanana)**
```
Extreme macro photograph of a human eye, iris detail showing intricate
fiber patterns and color variations from deep amber to golden brown...
Camera: Canon 100mm macro, f/8, studio ring light
Style: National Geographic
```

**#17 — Car Backseat Selfie (JSON structured)** — самый важный для нас паттерн:
```json
{
  "character_lock": {
    "face": "reference image 1",
    "body": "reference image 1"
  },
  "scene": "car backseat, natural daylight",
  "camera": "iPhone 15 Pro, portrait mode",
  "lighting": "natural daylight through windows",
  "outfit": "...",
  "photography_rules": [
    "organic Instagram aesthetic",
    "no studio lighting",
    "candid, not posed"
  ]
}
```

### Категоризация (наша, для visual-gen/prompt-library/)
- `portraits/` — #1, #7, #14, #17
- `products/` — #2, #18
- `infographics/` — #2, #6
- `stylized/` — #5, #8, #10, #16
- `typography/` — #12, #15
- `macro-photo/` — #13

### Применимость
- **E (Prompt library):** прямой source. 18 дословных промптов — стартовый seed. Категоризация готова.
- **B (Photo engine):** паттерн JSON-structured prompts (#17) — наш формат `spec.json` для photo generation.
- **G (Consistency checker):** паттерн character_lock из #9, #17 — шаблон для identity-preservation проверки.
- Надо вернуться на сайт и скачать ещё — библиотека 12,467, а у нас только 18. **Action item:** написать firecrawl-crawl скрипт для https://youmind.com/nano-banana-pro-prompts который сохранит всё в `D:/toolbox/.workspace/skills/visual-gen/prompt-library/nano-banana/`.

---

## Источник 4: Mobile Editing Club — Create UGC Ads (Invideo workflow)

- **URL PDF:** https://assets.stanwith.me/live/msc/26131308/8qbjy/mobileeditingclubcreateugcads.pdf
- **Status:** прочитано полностью (через firecrawl `parsers: ["pdf"]`)
- **Название:** "FREE AD WORKFLOW — Mobile Editing Club — Create UGC Ads" (2 страницы)

### 7-шаговый воркфлоу (дословная структура)

**Step 1** — Create Invideo account. Это all-in-one платформа с доступом к Nano Banana, Kling, Google Veo.

**Step 2** — Открыть "Text to Image", выбрать модель.

**Step 3** — Generate/upload model с 10-параметрической спецификацией:
```
01. Subject: Woman
02. Age / vibe: 28
03. Skin: tanned, freckles
04. Eyes: green, large
05. Hair: Blonde, long
06. Body / silhouette: Slim
07. Wardrobe: Pink sweater, brown trousers
08. Pose: selfie
09. Shot: iPhone-portrait
10. Mood / lighting: UGC
```

**Example prompt (дословно):**
```
UGC-style portrait selfie of a 28-year-old woman with a slim silhouette.
She has tanned skin with visible freckles, large green eyes, and long
blonde hair. She is wearing a soft pink sweater and brown trousers.
The pose is casual and natural, as if she is taking the photo herself.
Framing should be a vertical UGC portrait, authentic and social-media
style. Use natural, flattering UGC lighting with a warm, relatable
everyday mood. The overall image should feel candid, modern, and
realistic rather than overly polished or studio-shot.
```

**Step 4** — Lock the person holding the product. Проверить distortions, это reference forward.

**Step 5** — Shotboard: Invideo > Trends > Boards, добавить prompt + все референсы включая продукт на нейтральном фоне.

**Step 6** — Extract: выбрать лучшие кадры, исправить дистортионы через **Nano Banana 2 edit**.

**Step 7** — Animate каждый clip через **Kling o3** — чтобы модель говорила и двигала продукт в руках.

### Применимость
- **A (Avatar factory):** 10-параметрическая спека = наш `avatar.json` schema (subject, age, skin, eyes, hair, body, wardrobe, pose, shot, mood).
- **C (Video engine):** Kling o3 image-to-video для "talking + product handling".
- **D (Lip-sync):** Kling o3 уже умеет lip sync (подтверждение что Kling покрывает компонент D, не только Seedance).
- **B (Photo engine):** Step 4 "lock the person" = identity-preservation loop, это задача для G (consistency checker).
- Полный pipeline UGC ad за 7 шагов — можно обернуть в `/ugc-ad <product-url> <avatar-id>` skill.

---

## Источник 5: Instagram Reel DWjsQhVk22z — viznfr (verified)

- **URL:** https://www.instagram.com/reel/DWjsQhVk22z/
- **Status:** метаданные extracted
- **Автор:** @viznfr (verified)
- **Дата:** 2026-03-31
- **Engagement:** 13.2K likes, 14.9K comments (конский comment-rate — это "comment CLAUDE for guide" hack)
- **Hashtags:** #metaads #claude #aidesign #aistudio #ad

### Контент (из описания)
Workflow: **Claude Code + Nano Banana 2** → "100 ad creatives in 4 minutes" с разными scenes, formats, copy. Плюс автоматизация upload в Meta Ad Library.

### Шаги (из caption)
1. Install Fal AI в Claude Code
2. Upload product/site link
3. Generate ad variations через Nano Banana 2
4. Build performance dashboard
5. Connect Meta API для auto-upload в Ads Manager

### CTA
Comment "CLAUDE" → DM с ссылкой на гайд.

### Что украсть для commerce
- **Hook:** числовой + временной ("100 креативов за 4 минуты"). Конкретно, измеримо, абсурдно-звучащая скорость.
- **Формат:** screen-record терминала + Claude Code в действии + финальный grid из 100 тумбнейлов.
- **CTA-mechanic:** "comment KEYWORD → DM guide" — генерит искусственно-высокий comment-to-like ratio, что пушит reel в алгоритме IG.
- **Применимо к visual-gen маркетингу:** наш hook для demo-reel: "100 ad creatives за 4 минуты для твоего beauty/fitness/food бренда — без фотографа".

---

## Источник 6: Instagram Reel DWrWNtBDX66 — lenivins

- **URL:** https://www.instagram.com/reel/DWrWNtBDX66/
- **Status:** метаданные extracted
- **Автор:** @lenivins
- **Дата:** 2026-04-03
- **Engagement:** 3.4K likes, 2.7K comments
- **Audio:** Joey Valence & Brae — HOOLIGANG

### Контент
AI-generated фото/видео демонстрация. Caption (дословно):
> "Пиши ЗРАЧОК в комментариях — отправлю ссылку на бесплатный мастер-класс, где покажу, как делать такие ИИ-фото и видео"

Формат: reel с демонстрацией готовых AI-визуалов + keyword-CTA в комментах.

### Что украсть
- **Русскоязычный вариант** keyword-CTA mechanic — работает не только для англоязычных ниш. Для Данила важно: целевая аудитория СНГ/русскоязычная.
- **Формат:** чисто output-grid без процесса. Обратная стратегия от viznfr: там показывают "как", тут показывают "что". Оба формата работают. Для visual-gen нужны оба: `demo-reel-process.mp4` (terminal workflow) + `demo-reel-output.mp4` (гриды визуалов).
- **Audio trending:** использует trending US audio (Joey Valence & Brae) на русскоязычный контент. Это умышленное — trending audio пушит reach независимо от языка.

---

## Источник 7: Instagram Post DWwNA-ECMB3 — mobileeditingclub (verified)

- **URL:** https://www.instagram.com/p/DWwNA-ECMB3/
- **Status:** метаданные extracted
- **Автор:** @mobileeditingclub (тот же создатель PDF из источника 4)
- **Дата:** 2026-04-05
- **Формат:** carousel (multiple images) + educational text
- **Engagement:** 1.7K likes, 3.1K comments (опять comment-hack)
- **Hashtags:** #ai #aiediting #aiimages #aiproductphotography

### Контент (дословные фразы из caption)
- *"It's now possible to generate campaign-quality visuals without a full production team"*
- Precise prompts > vague prompts.
- Три critical элемента: **shot purpose**, **light source direction**, **visual style consistency**.
- *"Without a clear strategy for consistency across all content, the results won't feel polished or on-brand."*
- Тема: jewelry brands AI photography без production-команды.

### CTA (два keyword-hacks в одном посте)
- Comment `editz` → 180+ page strategy guide на consistent AI imagery.
- Comment `AI` → full editing workflow course link.

### Применимость
- **E / F:** 3 critical элемента (shot purpose + light direction + style consistency) = required fields в нашей `prompt-spec.json`:
  ```json
  {
    "shot_purpose": "hero | lifestyle | detail | editorial",
    "light_direction": "top-left | top-right | front | back | rim",
    "style_consistency_key": "<brand-id>"
  }
  ```
- **G (Consistency checker):** "без стратегии консистентности результаты не будут on-brand" — это прямое требование.
- **Маркетинг:** двойной keyword-CTA = удваивает comment-rate. Наш reel может использовать тот же паттерн: `visgen` → гайд setup, `ugc` → UGC-скрипт.

---

## Источник 8: Instagram Post DWD0TyTDKK9

- **URL:** https://www.instagram.com/p/DWD0TyTDKK9/
- **Status:** **недоступно.** Firecrawl вернул ошибку "we do not support this site" для этого URL. WebFetch вернул только IG footer/навигацию без реального post content — вероятно session gating / login wall.
- **Action needed:** Данил должен либо:
  1. Открыть пост сам и скинуть caption + screenshot,
  2. Либо дать доступ через `mcp__claude-in-chrome__*` (авторизованный браузер),
  3. Либо разрешить использовать `mcp__plugin_playwright_playwright__browser_navigate` в headed-режиме.

---

## Источник 9: Skool profile @dan-p-6986 (NextGen AI)

- **URL:** https://www.skool.com/@dan-p-6986?g=nextgenai
- **Status:** прочитано (public profile доступен без логина — **никаких курсов-за-walls не видно, только список memberships**)
- **Профиль:**
  - Username: @dan-p-6986
  - Member since: 2026-04-02 (менее 2 недель назад)
  - Active 5 hours ago (свежий)
  - Followers: 0, Following: 4, Contributions: 1
- **Memberships (4 комьюнити):**
  1. **Chase AI Community** — 56.5k members, **Free**
  2. **AI Realism Starter Hub** — 17.6k members, **Free**
  3. **NextGen AI** — 23.1k members, **Free**
  4. **AI Video Bootcamp** — 17.8k members, **$9/month** (единственное платное)

### Интерпретация для visual-gen
- Данил активно качается в AI-realism + AI video нишах. **AI Realism Starter Hub** (17.6k) и **AI Video Bootcamp** (17.8k, платное) — это источники где могут быть курсы с реальными workflow.
- **Action needed:** содержимое курсов / постов внутри этих комьюнити доступно **только после логина** в Skool. Research-агент не может туда зайти. Данилу нужно:
  1. Экспортировать топ-постов из каждого комьюнити (screenshots / copy-paste),
  2. Либо использовать `mcp__claude-in-chrome__*` под его сессией,
  3. Либо перечислить ключевые курсы/модули вручную.
- **Приоритет на review:** AI Realism Starter Hub (free, legal, быстрый win) → NextGen AI (free) → AI Video Bootcamp ($9/мес, там реально качественные скрипты ожидаемо).
- Факт что Joey Mulcahy держит **AI Creative Studio** именно на Skool — это не случайно. Skool в 2026 стал де-факто дистрибуцией для AI-content курсов.

---

## Источник 10: Google Drive file 18C9GxNx5xYMrGa3aW_CHUXzyVDNGupjn

- **URL:** https://drive.google.com/file/d/18C9GxNx5xYMrGa3aW_CHUXzyVDNGupjn/view
- **Status:** **недоступно без логина.** Метаданные:
  - Название файла: **"GenHQguidePDF - Arcads AI UGC V2 (1).pdf"**
  - Формат: PDF
  - Viewer показывает Ukrainian login prompt → файл в private Drive.
- **Что это вероятно:** гайд от **Arcads AI** (https://arcads.ai) — платформа для UGC avatars (talking-head AI actors для рекламы). V2 — вторая версия, "GenHQ" — возможно название комьюнити/курса.
- **Action needed:** Данил должен либо скачать и положить в `D:/toolbox/.workspace/skills/visual-gen/_inbox/arcads-genhq-v2.pdf`, либо сделать его public-viewable, либо использовать `mcp__claude_ai_Google_Drive__authenticate`.
- **Почему стоит прочитать:** Arcads AI — прямой конкурент/аналог того что Данил строит. Их гайд = ready-made playbook для D (lip-sync + voice) и A (avatar factory).

---

## Синтез — playbook для visual-gen

### A. Avatar factory
**Цель:** генерить и фиксировать фото-реалистичных AI-талантов, переиспользуемых в photo + video + UGC.

**Методы из источников:**
- Источник 4 (Mobile Editing Club PDF): 10-параметрическая спека — subject / age / skin / eyes / hair / body / wardrobe / pose / shot / mood.
- Источник 3 (#17 car selfie JSON): character_lock блок с face + body reference.
- Источник 2 (Joey Brand 101): skill-file pattern → `.claude/skills/avatar/SKILL.md` + `skills/references/avatar.py`.

**Инструменты:** FAL.ai Nano Banana 2 (generate base identity), Nano Banana 2 edit (fix distortions between shots).

**Промпт-шаблон (наш, синтезированный):**
```json
{
  "avatar_id": "talent-001",
  "base_prompt": "UGC-style portrait of a [age]-year-old [gender], [skin], [eyes], [hair], [body]. Wearing [wardrobe]. [pose]. [shot]. Lighting: [mood].",
  "character_lock": {
    "face": "skills/visual-gen/avatars/talent-001/face.png",
    "body": "skills/visual-gen/avatars/talent-001/body.png"
  },
  "negative": ["studio polish", "oversaturated", "CGI look", "plastic skin"]
}
```

**Files:** `skills/visual-gen/avatars/<avatar-id>/{spec.json, face.png, body.png, refs/}`.

### B. Photo engine
**Цель:** любой тип фото (packshot, lifestyle, editorial, hero) по brand-locked промптам.

**Методы:**
- Joey Workflow 1: 3 phases (brand → refs → generation).
- Mobile Editing Club: 7-step UGC flow (адаптация под фото — только steps 1-6).
- nano-banana-prompts #2 (Bento grid), #13 (macro), #14 (formal portrait) — ready templates.

**Инструменты:** FAL.ai Nano Banana 2 (~$0.12 / image @ 2K).

**Slash-skills:**
- `/packshot <product-url>` — hero shot на neutral background
- `/lifestyle <product-id> <avatar-id> <scene>` — talent with product
- `/editorial <brand-id> <concept>` — brand campaign shoot
- `/bento <product-id>` — infographic bento grid (nano-banana #2)

**Правило из источника 7 (mobileeditingclub):** каждый генерация должна иметь обязательные поля `shot_purpose`, `light_direction`, `style_consistency_key`.

### C. Video engine
**Цель:** image-to-video для рекламных клипов.

**Модели (из источника 2):**
- **Veo 3.1** — ~$0.15/s @ 1080p, image-to-video + voice (best для product demos)
- **Kling 3.0 Pro** — ~$0.168/s @ audio, motion + animation (best для model movement, источник 4 подтверждает)
- **Seedance 1.5 Pro** — ~$0.05/s @ 1080p (cheapest, для UGC talking-head)

**Slash-skills:**
- `/motion <image-path> <action>` — image-to-video через Veo/Kling
- `/ugc-clip <avatar-id> <product-id> <script>` — end-to-end talking UGC через Seedance

**Naming convention (из Joey CLAUDE.md template):**
```
[image-stem]-run[n].mp4
```

### D. Lip-sync + voice
**Цель:** говорящий talking-head avatar с продуктом.

**Методы:**
- Источник 4 (step 7): Kling o3 animate clip — модель говорит и двигает продукт.
- Источник 2: Seedance 1.5 Pro — purpose-built для UGC talking-head.
- Источник 10 (Arcads AI PDF, недоступен): вероятно лучший playbook, нужно получить от Данила.

**Инструменты:** Seedance 1.5 Pro (primary) + Kling 3.0 Pro (fallback для сложной моторики).

**Open question:** где брать voice? Нужен TTS провайдер (ElevenLabs? OpenAI TTS?). Источники не покрывают эту часть явно — Seedance/Veo могут включать built-in voice, но параметры не описаны. **Action item:** ресёрчнуть FAL.ai docs по Veo 3.1 "with voice" features + рассмотреть ElevenLabs SDK.

### E. Prompt library
**Цель:** версионированное хранилище промптов.

**Источники:**
- nano-banana-prompts (источник 3): 18 готовых дословных промптов из 12,467. Категоризированы.
- Joey `visual-guidelines.md` pattern (источник 2): brand-specific prompt modifiers.

**Структура (наша):**
```
skills/visual-gen/prompt-library/
├── categories/
│   ├── portraits/
│   ├── products/
│   ├── infographics/
│   ├── stylized/
│   ├── typography/
│   └── macro/
├── brand-modifiers/
│   └── <brand-id>.md
└── templates/
    ├── avatar.json
    ├── packshot.json
    └── ugc-clip.json
```

**Action item:** написать firecrawl crawler для https://youmind.com/nano-banana-pro-prompts чтобы вытащить все 12,467 промптов. Фильтровать по лицензии (публичные / с атрибуцией автора).

### F. Brand-lock
**Цель:** один раз настроить бренд → все генерации автоматически on-brand.

**Это полностью готовый компонент из источника 2 (Joey /brand skill).** Почти дословно переносим:

**Files:**
```
skills/visual-gen/brands/<brand-id>/
├── brand-identity/
│   ├── visual-guidelines.md   ← palette, typography, photo style, prompt modifier
│   ├── products.json          ← catalogue
│   └── product-images/
│       └── <product-id>.jpg
```

**Slash-skill:** `/brand <url>` → делает всё автоматически (scrape, analyze, download).

**Python script:** `skills/visual-gen/references/brand.py` (аналог Joey brand.py, 9.1 KiB).

**Поля в `visual-guidelines.md`:**
1. Colour palette (exact hex codes)
2. Typography
3. Photography style
4. Packaging details
5. Ad creative formats
6. **Prompt modifier** (auto-prepended to every generation)

### G. Consistency checker
**Цель:** валидировать что генерация соответствует brand + identity-lock.

**Правила из источников:**
- Источник 1: *"5-8 references > 1-2 every time"* → checker требует ≥5 refs перед запуском.
- Источник 7: `shot_purpose`, `light_direction`, `style_consistency_key` — required fields.
- Источник 4 (step 4): lock person reference, check distortions после каждого кадра.

**Реализация:**
- Pre-flight: валидация `spec.json` (все required fields + ≥5 refs).
- Post-flight: image similarity check между generated face и `character_lock.face` (CLIP embeddings или Nano Banana 2 edit-loop).
- Auto-fix: если distortion detected → retry через Nano Banana 2 edit с `character_lock` as stronger reference.

**Инструменты:** CLIP (open-source), Nano Banana 2 edit (для auto-fix), Python PIL (pre-flight).

### H. Output vault
**Цель:** structured storage всех генераций с versioning и gallery.

**Паттерн из источника 1-2:**
```
brands/<brand-id>/outputs/
├── <shoot-id>/
│   ├── spec.json           ← что генерили, с какими refs
│   ├── shot-01.png          ← first generation
│   ├── shot-01_v2.png       ← regeneration
│   ├── shot-01-run1.mp4     ← animated
│   └── gallery.html         ← auto-generated HTML page for review
```

**Versioning rules (дословно из Joey CLAUDE.md):**
- *"Image naming: [output-name].png for first generation, rename to _v1 on regeneration"*
- *"Video naming: [image-stem]-run[n].mp4"*

**Auto-gallery:** HTML с grid всех shots, click → full-size, metadata sidebar. Простой Python/Jinja2 скрипт.

---

## Open questions для Данила

1. **FAL.ai API key** — есть ли уже? Если нет — надо получить на fal.ai и положить в `D:/toolbox/.workspace/skills/visual-gen/.env`.
2. **Бюджет на токены/генерации** — Joey оценивает ~$0.12/image, ~$0.15/sec video. Для теста 50 фото + 5 видео (30 sec) = ~$6 + ~$22 = **~$28 на прототип**. OK?
3. **Приоритет MVP:** начать с photo engine (B) + brand-lock (F)? Или с avatar factory (A) + UGC video (C+D)? Joey советует начинать с `/brand` → потом `/packshot` → потом `/ugc`.
4. **Arcads GenHQ V2 PDF** (источник 10) — можешь расшарить? Это **ключевой** источник для D (lip-sync + voice).
5. **Skool content** (источник 9): можешь экспортировать top-посты из AI Realism Starter Hub + AI Video Bootcamp? Или дать доступ через авторизованный Chrome MCP session?
6. **IG DWD0TyTDKK9** (источник 8) — не смог достать метаданные. Можешь скинуть screenshot + caption?
7. **Voice TTS provider** — какой используешь? ElevenLabs / OpenAI TTS / встроенный Veo 3.1? От этого зависит D (lip-sync).
8. **Антикопирайт:** 12,467 промптов на youmind.com — где лицензия? Можем ли мы их локально сохранить и переиспользовать в наших skills, или надо хранить как "referenced, not redistributed"?
9. **Language strategy:** reels (источники 5-7) — часть русская, часть английская. Visual-gen маркетинг — на какую аудиторию? СНГ (lenivins-style) или global (viznfr-style)?
10. **Instagram vs TikTok** — оба автора (Joey, Mobile Editing Club) доминируют на IG, но постят и в TikTok. Нужен ли visual-gen на TikTok тоже?

---

## Следующие шаги

1. **[Этой сессии]** Создать базовую структуру `D:/toolbox/.workspace/skills/visual-gen/` с `CLAUDE.md` + `.env.example` + пустыми folders для A-H компонентов (по Joey архитектуре).
2. **[Эта/следующая сессия]** Скопировать Joey CLAUDE.md starter template в `visual-gen/CLAUDE.md` с адаптацией под verticals проекта (beauty / fitness / food).
3. **[Следующая сессия]** Написать `/brand <url>` skill (Python scraper + SKILL.md) — это unblock всё остальное, F готов.
4. **[После brand]** Написать `/packshot` skill — simplest proof-of-concept для B (photo engine).
5. **[Data pull]** Firecrawl crawler по youmind.com/nano-banana-pro-prompts → скачать все 12,467 промптов в `prompt-library/nano-banana/` (или стольких сколько firecrawl разрешит без rate-limit).
6. **[От Данила needed]** Arcads GenHQ V2 PDF (источник 10) + Skool content (источник 9) + IG DWD0TyTDKK9 caption (источник 8).
7. **[После данных]** Написать `/avatar` skill на основе 10-параметрической спеки из источника 4 + character_lock из источника 3.
8. **[После A+B+F]** Videо pipeline: `/motion` (Veo 3.1) + `/ugc-clip` (Seedance 1.5 Pro).
9. **[Marketing parallel]** Записать demo-reel по viznfr-паттерну: hook "100 креативов за X минут" + screen-record Claude Code + CTA keyword.
10. **[Validation]** Прогнать consistency checker (G) на first batch из `/packshot` и убедиться что он ловит distortions.

---

## Карта источников → компонентов META-2

| Источник | A (Avatar) | B (Photo) | C (Video) | D (Lip-sync) | E (Prompts) | F (Brand) | G (Consistency) | H (Output) |
|---|---|---|---|---|---|---|---|---|
| 1. Joey Product Visual Workflow | — | ★★★ | — | — | ★★ | ★★ | ★★ | ★★★ |
| 2. Joey Brands 101 | ★ | ★★★ | ★★ | ★★ | ★★ | ★★★ | ★ | ★★★ |
| 3. Nano-banana library | ★ | ★★★ | — | — | ★★★ | — | ★★ | — |
| 4. Mobile Editing Club PDF | ★★★ | ★★ | ★★ | ★★ | ★ | — | ★★ | — |
| 5. viznfr reel | — | ★ | — | — | — | — | — | — (marketing) |
| 6. lenivins reel | — | ★ | — | — | — | — | — | — (marketing) |
| 7. mobileeditingclub post | — | ★ | — | — | ★ | ★ | ★★ | — |
| 8. IG DWD0TyTDKK9 | недоступно | | | | | | | |
| 9. Skool profile | недоступно без логина | | | | | | | |
| 10. Arcads GenHQ PDF | недоступно (в Drive под логином) | | | | | | | |

**★★★ — прямой blueprint, ★★ — сильные инсайты, ★ — упоминания.**

---

## Главный takeaway (одно предложение)

**Architecture for `visual-gen/` уже почти полностью описана в связке Joey Mulcahy (2 Notion-гайда) + Mobile Editing Club (PDF + IG post) + nano-banana prompt library — нам нужно только склеить их в единый repo с 8 компонентами A-H, где `/brand`, `/avatar`, `/packshot`, `/ugc-clip` — slash-skills, а FAL.ai — единственный генеративный провайдер.**
