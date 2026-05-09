/** --- YAML
 * name: Services i18n columns
 * description: AI auto-translation of service name + description into 3 languages.
 *   Master enters service in his own language (e.g. «Маникюр»), background
 *   Gemini call fills name_i18n = {uk: "Манікюр", ru: "Маникюр", en: "Manicure"}.
 *   Public pages and Mini App pick the right form via getServiceName(svc, lang).
 *   Original `name` column stays as fallback.
 * created: 2026-05-09
 * --- */

alter table public.services
  add column if not exists name_i18n jsonb;

alter table public.services
  add column if not exists description_i18n jsonb;

comment on column public.services.name_i18n is
  'AI-translated service name in 3 languages. Shape: {"uk":"...","ru":"...","en":"..."}. Filled async after INSERT/UPDATE on `name`.';

comment on column public.services.description_i18n is
  'AI-translated service description in 3 languages.';
