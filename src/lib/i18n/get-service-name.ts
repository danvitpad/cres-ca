/** --- YAML
 * name: getServiceName / getServiceDescription
 * description: Безопасный fallback при чтении локализованного имени услуги.
 *   Берёт name_i18n[lang] если есть, иначе оригинальное name. Тот же паттерн
 *   для description. Используется везде где показывается услуга в UI
 *   (Mini App, /m/[handle], booking flow, AI chat).
 * created: 2026-05-09
 * --- */

export type Lang = 'uk' | 'ru' | 'en';

interface ServiceLike {
  name?: string | null;
  name_i18n?: Record<string, string> | null;
  description?: string | null;
  description_i18n?: Record<string, string> | null;
}

export function getServiceName(svc: ServiceLike, lang: Lang): string {
  const i18n = svc.name_i18n;
  if (i18n && typeof i18n === 'object' && typeof i18n[lang] === 'string' && i18n[lang]) {
    return i18n[lang];
  }
  return svc.name ?? '';
}

export function getServiceDescription(svc: ServiceLike, lang: Lang): string {
  const i18n = svc.description_i18n;
  if (i18n && typeof i18n === 'object' && typeof i18n[lang] === 'string' && i18n[lang]) {
    return i18n[lang];
  }
  return svc.description ?? '';
}
