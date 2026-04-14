---
name: мой скилл по скачиванию веб-страниц
description: >
  Download and archive any web page as an exact 1:1 offline copy with all assets (CSS, JS, images, fonts, favicons).
  Use this skill whenever the user wants to: save a web page locally, download a website page, archive a URL,
  create an offline copy of a page, clone a webpage, grab/rip a page, mirror a single page, or make a local backup
  of any URL. Supports both public pages AND pages behind login/auth (via Playwright with manual login or saved sessions).
  Also handles JS-rendered SPAs (React, Vue, Angular). Also triggers on phrases like "скачать страницу",
  "сохранить сайт", "архив страницы", "скопировать страницу", "оффлайн копия", "сохранить страницу с авторизацией".
  The output is a .zip archive containing the HTML file with all assets rewritten to local paths,
  ready to open in a browser and look identical to the original.
---

# Мой скилл по скачиванию веб-страниц

Archives a single web page into a self-contained .zip with all assets preserved for pixel-perfect offline viewing.

## Two modes

### Mode 1: Static (fast, no browser needed)
Best for public, server-rendered pages. Uses `requests` + `BeautifulSoup`.

### Mode 2: Playwright with real Chrome profile (for auth pages — RECOMMENDED)
Launches the user's **real Chrome** with their actual profile via CDP (Chrome DevTools Protocol).
The user's Google account, saved sessions, cookies — everything works as if they opened Chrome normally.
Google OAuth login works because it's the real Chrome, not Chromium.
IMPORTANT: Chrome must be fully closed before running this mode.

### Mode 3: Playwright clean Chromium (for manual login or public SPAs)
Uses Playwright's bundled Chromium with a clean profile. Good for public pages that need JS rendering.
Google OAuth will NOT work here (Chromium is blocked by Google).

## Choosing the mode

Use **Static** mode when:
- The page is publicly accessible (no login needed)
- The page works without JavaScript (server-rendered HTML)

Use **Playwright --use-profile** mode when:
- The page requires login via Google OAuth or any other auth
- The user is already logged in via their Chrome browser
- The user mentions авторизация/логин/dashboard/личный кабинет/Google аккаунт
- The page is a SPA that needs JS rendering AND requires auth

Use **Playwright clean** mode when:
- The page is a public SPA (React, Vue) that just needs JS rendering
- No auth needed, or user is willing to login manually with email/password

## Prerequisites

### Static mode
```bash
pip install beautifulsoup4 lxml requests --break-system-packages
```

### Playwright mode
```bash
pip install playwright --break-system-packages
playwright install chromium
```

## Usage

### Static mode
```bash
python3 D:/Claude.cres-ca/.agents/skills/web-page-archiver/scripts/archive_page.py "https://example.com/page" -o output.zip
```

| Flag | Default | Description |
|------|---------|-------------|
| `-o` / `--output` | `archive.zip` | Output zip filename |
| `--timeout` | `30` | HTTP timeout seconds |
| `--user-agent` | Chrome 120 | Custom User-Agent |
| `--concurrency` | `20` | Max parallel downloads |

### Playwright --use-profile mode (auth pages — RECOMMENDED)
```bash
# Launches YOUR Chrome with your Google account, cookies, sessions:
# IMPORTANT: Close Chrome first!
python3 D:/Claude.cres-ca/.agents/skills/web-page-archiver/scripts/archive_playwright.py "https://partners.fresha.com/dashboard" \
  --use-profile -o dashboard.zip

# If you have multiple Chrome profiles:
python3 D:/Claude.cres-ca/.agents/skills/web-page-archiver/scripts/archive_playwright.py "https://..." \
  --use-profile --profile-dir "Profile 2" -o page.zip

# Custom Chrome path:
python3 D:/Claude.cres-ca/.agents/skills/web-page-archiver/scripts/archive_playwright.py "https://..." \
  --use-profile --chrome-path "/path/to/chrome" -o page.zip
```

| Flag | Default | Description |
|------|---------|-------------|
| `--use-profile` | off | Use real Chrome with your profile |
| `--profile-dir` | `Default` | Chrome profile dir (`Default`, `Profile 1`, etc.) |
| `--chrome-path` | auto-detect | Path to Chrome binary |
| `--debug-port` | `9222` | Chrome remote debugging port |

### Playwright clean mode (public SPAs or manual login)
```bash
# Public SPA (no auth):
python3 D:/Claude.cres-ca/.agents/skills/web-page-archiver/scripts/archive_playwright.py "https://spa-site.com/page" -o page.zip

# Manual login (opens headed Chromium):
python3 D:/Claude.cres-ca/.agents/skills/web-page-archiver/scripts/archive_playwright.py "https://site.com/login" --login -o page.zip

# With saved Playwright session:
python3 D:/Claude.cres-ca/.agents/skills/web-page-archiver/scripts/archive_playwright.py "https://..." --storage session.json -o page.zip
```

| Flag | Default | Description |
|------|---------|-------------|
| `-o` / `--output` | `archive.zip` | Output zip filename |
| `--login` | off | Open visible Chromium for manual login |
| `--cookies` | none | Path to cookies JSON |
| `--storage` | none | Playwright storage state file |
| `--save-storage` | none | Save session after archiving |
| `--wait` | `5` | Extra seconds for lazy content |
| `--wait-selector` | none | CSS selector to wait for |

## Step-by-step workflow for Claude

1. **Determine the mode**:
   - User wants to **clone/reproduce the design** in their project → `--use-profile --to-folder`
   - Page requires Google/OAuth login → `--use-profile`
   - Page requires login but user has email/password → `--login`
   - Public page with JS → clean Playwright (no flags)
   - Public static page → Static mode (`archive_page.py`)

2. **Install dependencies** (once per session):
   ```bash
   # For static mode:
   pip install beautifulsoup4 lxml requests --break-system-packages
   
   # For Playwright mode:
   pip install playwright --break-system-packages
   playwright install chromium
   ```

3. **For --use-profile mode** (auth pages):
   - Tell the user: "Закройте Chrome полностью, потом скажите мне."
   - After confirmation, run:
     ```bash
     python3 D:/Claude.cres-ca/.agents/skills/web-page-archiver/scripts/archive_playwright.py "URL" --use-profile -o output.zip
     ```
   - Chrome opens with user's profile. Tell user: "Когда страница загрузится — нажмите ENTER в терминале."

4. **Verify**: Unzip and check `index.html`. Playwright mode includes `screenshot.png`.

5. **Deliver**: Copy .zip to the output directory.

## Output structure

```
archive.zip
├── index.html          # Main page with local asset paths
├── screenshot.png      # Full-page screenshot (Playwright mode only)
├── css/
├── js/
├── images/
├── fonts/
└── assets/             # Anything that didn't match above categories
```

## Режим --to-folder (для Claude Code)

Когда пользователь хочет **воспроизвести дизайн страницы** в своём проекте, используй `--to-folder`.
Вместо .zip создаётся папка со всеми ассетами + файл `REFERENCE.md` с анализом структуры.

```bash
python3 D:/Claude.cres-ca/.agents/skills/web-page-archiver/scripts/archive_playwright.py "https://site.com/page" \
  --use-profile --to-folder -o ./reference/fresha-dashboard
```

Результат:
```
fresha-dashboard/
├── REFERENCE.md       # Гайд: структура страницы, CSS файлы, как использовать
├── index.html         # Полный HTML с JS (для анализа логики компонентов)
├── screenshot.png     # Визуальный референс
├── css/               # Все стили
├── js/                # Все скрипты (для анализа логики)
├── images/            # Картинки, иконки
└── fonts/             # Шрифты
```

Claude Code может прочитать эту папку и:
1. Посмотреть `screenshot.png` — как должна выглядеть страница
2. Прочитать `index.html` — DOM-структура и CSS-классы
3. Изучить `css/` — точные стили, цвета, отступы
4. Скопировать `images/` и `fonts/` в проект
5. Воспроизвести интерфейс с нуля в нужном фреймворке

В этом режиме `--keep-scripts` включается автоматически — JS сохраняется для анализа логики.

## SPA handling (React, Vue, Angular)

For SPA pages, the script captures the **fully rendered DOM** (after JS executed),
then **removes all `<script>` tags** from the saved HTML. This is critical because:
- The rendered HTML already contains the visible content
- Without removal, JS tries to call APIs on page open → fails → shows "Oops" errors
- CSS and layout are preserved perfectly without scripts

Use `--keep-scripts` if you need to preserve JavaScript (e.g. for static sites with interactive elements).

## Limitations

- **Chrome must be closed** for `--use-profile` mode (two Chrome instances can't share a profile).
- **2FA/CAPTCHA**: With `--use-profile` your sessions are already active, so 2FA shouldn't be needed. If it is — solve it in the Chrome window that opens.
- **Infinite scroll**: The script scrolls once. Very long feeds won't be fully captured.
- **iframes**: Cross-origin iframe content is not captured.
- **Google OAuth**: Only works with `--use-profile` (real Chrome). Playwright's Chromium is blocked by Google.
