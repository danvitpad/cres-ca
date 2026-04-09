/** --- YAML
 * name: Auto-translate
 * description: AI-powered auto-translation with Supabase caching for service descriptions
 * --- */

import { createClient } from '@/lib/supabase/client';
import { aiComplete } from '@/lib/ai/openrouter';

const localeNames: Record<string, string> = {
  en: 'English',
  uk: 'Ukrainian',
  ru: 'Russian',
};

/**
 * Get translated text for a source record field.
 * Checks cache first, falls back to AI translation.
 */
export async function getTranslation(
  sourceTable: string,
  sourceId: string,
  sourceField: string,
  originalText: string,
  targetLocale: string,
): Promise<string> {
  const supabase = createClient();

  // Check cache
  const { data: cached } = await supabase
    .from('translations_cache')
    .select('translated_text')
    .eq('source_table', sourceTable)
    .eq('source_id', sourceId)
    .eq('source_field', sourceField)
    .eq('target_locale', targetLocale)
    .single();

  if (cached) return cached.translated_text;

  // AI translate
  const targetLang = localeNames[targetLocale] ?? targetLocale;
  const translated = await aiComplete(
    `You are a professional translator. Translate the following text to ${targetLang}. Return ONLY the translated text, nothing else.`,
    originalText,
  );

  if (!translated) return originalText;

  // Cache the translation
  await supabase.from('translations_cache').upsert({
    source_table: sourceTable,
    source_id: sourceId,
    source_field: sourceField,
    target_locale: targetLocale,
    translated_text: translated.trim(),
  });

  return translated.trim();
}
