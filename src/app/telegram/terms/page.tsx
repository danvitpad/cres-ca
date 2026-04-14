/** --- YAML
 * name: TermsOfServicePage
 * description: Условия использования CRES-CA для Telegram Mini App
 * created: 2026-04-14
 * updated: 2026-04-14
 * --- */

'use client';

import { useRouter } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';

export default function TermsPage() {
  const router = useRouter();

  return (
    <div className="min-h-dvh bg-[#1f2023] text-white">
      <header className="sticky top-0 z-10 flex items-center gap-3 border-b border-white/10 bg-[#1f2023]/95 px-4 py-3 backdrop-blur-xl">
        <button
          onClick={() => router.back()}
          className="flex size-9 items-center justify-center rounded-xl bg-white/5 active:scale-95 transition-transform"
        >
          <ArrowLeft className="size-4" />
        </button>
        <h1 className="text-base font-semibold">Условия использования</h1>
      </header>

      <main className="space-y-6 px-6 py-8 text-[13px] leading-relaxed text-white/80">
        <section className="space-y-2">
          <h2 className="text-[15px] font-semibold text-white">1. Что такое CRES-CA</h2>
          <p>
            CRES-CA — платформа для записи к мастерам индустрии красоты и бытовых услуг.
            Мы помогаем находить мастеров, бронировать слоты, копить бонусы и вести историю визитов.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-[15px] font-semibold text-white">2. Какие данные мы сохраняем</h2>
          <p>Используя Telegram Mini App, вы даёте согласие на сохранение следующих данных:</p>
          <ul className="list-disc space-y-1 pl-5 text-white/70">
            <li>ваш Telegram ID и username — для входа и идентификации;</li>
            <li>имя, указанное в Telegram, и аватар — для отображения в профиле;</li>
            <li>номер телефона и email, если вы сами их укажете при регистрации;</li>
            <li>история ваших записей, бонусов и отзывов у мастеров CRES-CA.</li>
          </ul>
        </section>

        <section className="space-y-2">
          <h2 className="text-[15px] font-semibold text-white">3. Кому видны ваши данные</h2>
          <p>
            Только тем мастерам, к которым вы записываетесь, и только в объёме, необходимом для оказания услуги.
            Мы не передаём персональные данные третьим лицам и не используем их для рекламы вне платформы.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-[15px] font-semibold text-white">4. Ваши права</h2>
          <p>Вы в любой момент можете:</p>
          <ul className="list-disc space-y-1 pl-5 text-white/70">
            <li>выгрузить все свои данные в формате JSON в разделе «Настройки»;</li>
            <li>удалить аккаунт — все данные будут стёрты в течение 30 дней;</li>
            <li>отозвать любое согласие, заполненное у мастера.</li>
          </ul>
        </section>

        <section className="space-y-2">
          <h2 className="text-[15px] font-semibold text-white">5. Связь с нами</h2>
          <p>
            По любым вопросам о данных, безопасности или работе сервиса пишите на{' '}
            <a href="mailto:privacy@cres.ca" className="underline decoration-white/30">
              privacy@cres.ca
            </a>
            .
          </p>
        </section>

        <p className="pt-4 text-[11px] text-white/40">
          Последнее обновление: 14 апреля 2026 г.
        </p>
      </main>
    </div>
  );
}
