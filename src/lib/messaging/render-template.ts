/** --- YAML
 * name: renderTemplate
 * description: Простой рендер шаблонов сообщений — подставляет {переменные} из контекста. Используется cron-джобами для reminders/thanks/win_back.
 * created: 2026-04-13
 * updated: 2026-04-13
 * --- */

export type TemplateContext = Record<string, string | number | null | undefined>;

export function renderTemplate(tpl: string, ctx: TemplateContext): string {
  return tpl.replace(/\{(\w+)\}/g, (_, key) => {
    const v = ctx[key];
    return v == null ? '' : String(v);
  });
}

export function pickTemplate<T extends { content: string; is_active: boolean }>(
  templates: T[] | null | undefined,
  fallback: string,
): string {
  const active = (templates ?? []).filter((t) => t.is_active);
  if (active.length === 0) return fallback;
  return active[0].content;
}
