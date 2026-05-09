/** --- YAML
 * name: translateService
 * description: AI-перевод названия и описания услуги мастера на 3 языка
 *   через router (Gemini → fallback OpenRouter, всё free). Возвращает
 *   {uk, ru, en} либо null если AI недоступен. Используется в фоне после
 *   POST/PATCH /api/services чтобы заполнить services.name_i18n.
 * created: 2026-05-09
 * --- */

import { textToJSON } from '@/lib/ai/router';

export type Lang = 'uk' | 'ru' | 'en';
export type I18nMap = Record<Lang, string>;

const SYSTEM = `Ты переводчик названий услуг мастеров (бьюти, спорт, образование, авто, дом и т.д.).
Тебе дано название и описание на одном из трёх языков (uk / ru / en).

Твоя задача:
1. Определи исходный язык.
2. Переведи на 2 других языка СОХРАНЯЯ:
   - краткость и стиль оригинала (если коротко — оставляй коротко)
   - бытовое название а не словарное (например «маникюр» НЕ «работа с ногтями»)
   - заглавную букву только если она была в оригинале
3. Не добавляй уточнений, скобок, эмодзи.

Верни СТРОГО JSON формы (без markdown, без backticks):
{
  "name": { "uk": "...", "ru": "...", "en": "..." },
  "description": { "uk": "...", "ru": "...", "en": "..." }
}

Если description пустой или null — верни поле description: null.
Если входное название бессмысленное (1-2 буквы, набор символов) — верни name с одинаковыми значениями для всех 3 языков (исходное).`;

interface TranslationOutput {
  name: I18nMap;
  description: I18nMap | null;
}

/**
 * Переводит название (и опционально описание) услуги на 3 языка.
 * Best-effort: возвращает null при ошибке AI или невалидном JSON —
 * вызывающий код должен корректно работать без перевода.
 */
export async function translateService(
  name: string,
  description: string | null,
): Promise<TranslationOutput | null> {
  const trimmedName = name.trim();
  if (trimmedName.length < 1) return null;

  const userMessage = description && description.trim()
    ? `Название: "${trimmedName}"\nОписание: "${description.trim()}"`
    : `Название: "${trimmedName}"\nОписание: null`;

  try {
    const { data } = await textToJSON({
      systemPrompt: SYSTEM,
      userMessage,
    });
    if (!data) return null;

    // Чистим от возможных markdown-обёрток.
    const cleaned = data
      .replace(/^```json\s*/i, '')
      .replace(/^```\s*/i, '')
      .replace(/\s*```$/i, '')
      .trim();

    const parsed = JSON.parse(cleaned) as Partial<TranslationOutput>;

    if (!parsed.name || typeof parsed.name !== 'object') return null;
    const nm = parsed.name as Partial<I18nMap>;
    if (!nm.uk || !nm.ru || !nm.en) return null;

    let descMap: I18nMap | null = null;
    if (parsed.description && typeof parsed.description === 'object') {
      const d = parsed.description as Partial<I18nMap>;
      if (d.uk && d.ru && d.en) {
        descMap = { uk: d.uk, ru: d.ru, en: d.en };
      }
    }

    return {
      name: { uk: nm.uk, ru: nm.ru, en: nm.en },
      description: descMap,
    };
  } catch (e) {
    console.error('[translate-service] failed:', (e as Error).message);
    return null;
  }
}
