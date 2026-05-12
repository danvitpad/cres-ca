"""
ти → ви (українська): паралельний скрипт для українських рядків.
Працює на файлах, де є uk-локалі і виправляє:
1) Українські займенники ти/тебе/тобі/твій
2) Помилкові русифікації, що залишилися від попереднього скрипта
   («Введите коректну» → «Введіть коректну»)
"""
import os
import re
import sys

ROOT = os.path.join(os.path.dirname(__file__), '..', 'src')

REPLACEMENTS = [
    # ─── Українські займенники ─────────────────────────────────
    (r'\bти\b', 'ви'),
    (r'\bТи\b', 'Ви'),
    (r'\bтобі\b', 'вам'),
    (r'\bТобі\b', 'Вам'),
    (r'\bтебе\b', 'вас'),
    (r'\bТебе\b', 'Вас'),
    (r'\bтобою\b', 'вами'),
    (r'\bТобою\b', 'Вами'),
    (r'\bз тобою\b', 'з вами'),
    (r'\bЗ тобою\b', 'З вами'),
    (r'\bтвій\b', 'ваш'),
    (r'\bТвій\b', 'Ваш'),
    (r'\bтвоя\b', 'ваша'),
    (r'\bТвоя\b', 'Ваша'),
    (r'\bтвоє\b', 'ваше'),
    (r'\bТвоє\b', 'Ваше'),
    (r'\bтвої\b', 'ваші'),
    (r'\bТвої\b', 'Ваші'),
    (r'\bтвого\b', 'вашого'),
    (r'\bТвого\b', 'Вашого'),
    (r'\bтвоєї\b', 'вашої'),
    (r'\bТвоєї\b', 'Вашої'),
    (r'\bтвоєму\b', 'вашому'),
    (r'\bТвоєму\b', 'Вашому'),
    (r'\bтвоїм\b', 'вашим'),
    (r'\bТвоїм\b', 'Вашим'),
    (r'\bтвоїх\b', 'ваших'),
    (r'\bТвоїх\b', 'Ваших'),
    # ─── Українські імперативи ───────────────────────────────────
    (r'\bТапни\b', 'Тапніть'),
    (r'\bтапни\b', 'тапніть'),
    (r'\bВведи\b', 'Введіть'),
    (r'\bвведи\b', 'введіть'),
    (r'\bДодай\b', 'Додайте'),
    (r'\bдодай\b', 'додайте'),
    (r'\bЗбережи\b', 'Збережіть'),
    (r'\bзбережи\b', 'збережіть'),
    (r'\bПочни\b', 'Почніть'),
    (r'\bпочни\b', 'почніть'),
    (r'\bВідкрий\b', 'Відкрийте'),
    (r'\bвідкрий\b', 'відкрийте'),
    (r'\bЗакрий\b', 'Закрийте'),
    (r'\bзакрий\b', 'закрийте'),
    (r'\bПодивись\b', 'Подивіться'),
    (r'\bподивись\b', 'подивіться'),
    (r'\bСпробуй\b', 'Спробуйте'),
    (r'\bспробуй\b', 'спробуйте'),
    (r'\bПеревір\b', 'Перевірте'),
    (r'\bперевір\b', 'перевірте'),
    (r'\bВкажи\b', 'Вкажіть'),
    (r'\bвкажи\b', 'вкажіть'),
    (r'\bНапиши\b', 'Напишіть'),
    (r'\bнапиши\b', 'напишіть'),
    (r'\bЗапиши\b', 'Запишіть'),
    (r'\bзапиши\b', 'запишіть'),
    (r'\bПродовж\b', 'Продовжте'),
    (r'\bпродовж\b', 'продовжте'),
    (r'\bСкажи\b', 'Скажіть'),
    (r'\bскажи\b', 'скажіть'),
    (r'\bЧекай\b', 'Чекайте'),
    (r'\bчекай\b', 'чекайте'),
    (r'\bПерейди\b', 'Перейдіть'),
    (r'\bперейди\b', 'перейдіть'),
    (r'\bПодзвони\b', 'Подзвоніть'),
    (r'\bподзвони\b', 'подзвоніть'),
    (r'\bПозначи\b', 'Позначте'),
    (r'\bпозначи\b', 'позначте'),
    (r'\bОбери\b', 'Оберіть'),
    (r'\bобери\b', 'оберіть'),
    (r'\bВибери\b', 'Виберіть'),
    (r'\bвибери\b', 'виберіть'),
    (r'\bРозкажи\b', 'Розкажіть'),
    (r'\bрозкажи\b', 'розкажіть'),
    (r'\bЗайди\b', 'Зайдіть'),
    (r'\bзайди\b', 'зайдіть'),
    (r'\bНе забудь\b', 'Не забудьте'),
    (r'\bне забудь\b', 'не забудьте'),
    (r'\bЗапроси\b', 'Запросіть'),
    (r'\bзапроси\b', 'запросіть'),
    # ─── Українські дієслова 2sg → 2pl ─────────────────────────
    (r'\bхочеш\b', 'хочете'),
    (r'\bХочеш\b', 'Хочете'),
    (r'\bзнаєш\b', 'знаєте'),
    (r'\bЗнаєш\b', 'Знаєте'),
    (r'\bможеш\b', 'можете'),
    (r'\bМожеш\b', 'Можете'),
    (r'\bзможеш\b', 'зможете'),
    (r'\bЗможеш\b', 'Зможете'),
    (r'\bбачиш\b', 'бачите'),
    (r'\bБачиш\b', 'Бачите'),
    (r'\bпобачиш\b', 'побачите'),
    (r'\bПобачиш\b', 'Побачите'),
    (r'\bотримаєш\b', 'отримаєте'),
    (r'\bОтримаєш\b', 'Отримаєте'),
    # ─── Виправлення русифікацій від першого скрипта ────────────
    # «Введите коректну» → «Введіть коректну» тощо — для рядків де
    # сусідні слова українські (контекст: «коректну», «нагадування», etc.).
    # Робимо це консервативно — тільки де є явні маркери uk-контексту.
    (r'Введите коректну', 'Введіть коректну'),
    (r'Введите коректне', 'Введіть коректне'),
    (r'Введите коректний', 'Введіть коректний'),
    (r'Сохраните', 'Збережіть'),   # uk контекст однозначний? обережно, якщо в російському тексті — false positive
    # ↑ Це ризиковано. Пропускаємо такі — нехай користувач перевірить вручну.
]

# Видаляємо ризиковані заміни що можуть зачепити RU контекст
SAFE_REPLACEMENTS = [r for r in REPLACEMENTS if r[0] not in (r'Сохраните',)]

SKIP_DIR_KEYWORDS = ['node_modules', '.next', '__tests__', '.test.', '.spec.']


def should_skip(path):
    norm = path.replace('\\', '/')
    return any(k in norm for k in SKIP_DIR_KEYWORDS)


def find_uk_block_ranges(text):
    """
    Знаходимо позиції українських i18n блоків:
    «uk: {» ... «}» (балансування фігурних дужок).
    Замінюємо ТІЛЬКИ в цих блоках, щоб не зачепити RU/EN.
    Для .json з ключами top-level «uk» теж шукаємо.
    """
    ranges = []
    # TS патерн: uk: {  (трохи варіацій пробілів)
    for m in re.finditer(r'\buk\s*:\s*\{', text):
        start = m.end() - 1  # позиція «{»
        depth = 0
        i = start
        while i < len(text):
            c = text[i]
            if c == '{':
                depth += 1
            elif c == '}':
                depth -= 1
                if depth == 0:
                    ranges.append((start, i + 1))
                    break
            i += 1
    # JSON патерн: "uk": {  — те ж саме
    for m in re.finditer(r'"uk"\s*:\s*\{', text):
        start = m.end() - 1
        depth = 0
        i = start
        while i < len(text):
            c = text[i]
            if c == '{':
                depth += 1
            elif c == '}':
                depth -= 1
                if depth == 0:
                    ranges.append((start, i + 1))
                    break
            i += 1
    return ranges


def process_file(path):
    try:
        with open(path, 'r', encoding='utf-8') as f:
            text = f.read()
    except Exception as e:
        print(f'SKIP (read error): {path} ({e})', file=sys.stderr)
        return 0

    ranges = find_uk_block_ranges(text)
    if not ranges:
        return 0

    original = text
    # Замінюємо у кожному uk-блоці окремо, не чіпаючи інше
    new_text_parts = []
    cursor = 0
    for start, end in sorted(ranges):
        # Зовнішня частина — без змін
        new_text_parts.append(text[cursor:start])
        block = text[start:end]
        for pattern, repl in SAFE_REPLACEMENTS:
            block = re.sub(pattern, repl, block)
        new_text_parts.append(block)
        cursor = end
    new_text_parts.append(text[cursor:])
    text = ''.join(new_text_parts)

    if text != original:
        with open(path, 'w', encoding='utf-8') as f:
            f.write(text)
        changed = sum(1 for a, b in zip(original.splitlines(), text.splitlines()) if a != b)
        return changed
    return 0


def main():
    total_files = 0
    total_changes = 0
    for dirpath, _, filenames in os.walk(ROOT):
        if should_skip(dirpath):
            continue
        for fn in filenames:
            if not (fn.endswith('.ts') or fn.endswith('.tsx') or fn.endswith('.json')):
                continue
            path = os.path.join(dirpath, fn)
            if should_skip(path):
                continue
            changed = process_file(path)
            if changed:
                total_files += 1
                total_changes += changed
                rel = os.path.relpath(path, ROOT)
                print(f'  {changed:3d} lines  {rel}')
    print(f'\n=== Done (uk): {total_files} files, {total_changes} lines changed ===')


if __name__ == '__main__':
    main()
