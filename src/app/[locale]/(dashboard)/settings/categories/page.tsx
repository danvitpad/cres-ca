/** --- YAML
 * name: Settings / Categories Page
 * description: Web Settings → «Категории и услуги». Мастер выбирает несколько
 *              категорий + одну основную + подкатегории. Может добавить свою
 *              подкатегорию (автоапрув при 3+ мастерах) и предложить новую
 *              категорию верхнего уровня (через TG-апрув суперадмина).
 * created: 2026-05-10
 * --- */

'use client';

import Link from 'next/link';
import { useLocale } from 'next-intl';
import { ChevronLeft } from 'lucide-react';
import { CategoriesEditor } from '@/components/master/categories-editor';

export default function SettingsCategoriesPage() {
  const locale = useLocale() as 'ru' | 'uk' | 'en';

  return (
    <div className="mx-auto max-w-3xl px-6 py-8">
      <Link
        href={`/${locale}/settings`}
        className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ChevronLeft className="size-4" />
        Настройки
      </Link>

      <div className="mb-6">
        <h1 className="text-[28px] font-bold tracking-[-0.02em] leading-none">Категории и услуги</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Это то, по чему тебя ищут клиенты. Чем точнее — тем лучше попадание.
        </p>
      </div>

      <CategoriesEditor locale={locale} />
    </div>
  );
}
