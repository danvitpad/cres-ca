/** --- YAML
 * name: Public Review Form
 * description: Клиент оставляет отзыв (1–5 звёзд + текст) по appointment_id. Уже существующий отзыв блокирует форму.
 * created: 2026-04-14
 * updated: 2026-04-14
 * --- */

'use client';

import { use, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Star, Check } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';

interface PageProps {
  params: Promise<{ apt_id: string }>;
}

export default function PublicReviewPage({ params }: PageProps) {
  const { apt_id } = use(params);
  const [score, setScore] = useState(5);
  const [hover, setHover] = useState(0);
  const [comment, setComment] = useState('');
  const [anonymous, setAnonymous] = useState(false);
  const [loading, setLoading] = useState(true);
  const [masterId, setMasterId] = useState<string | null>(null);
  const [existing, setExisting] = useState(false);
  const [done, setDone] = useState(false);
  const [masterName, setMasterName] = useState('');
  const [serviceName, setServiceName] = useState('');

  useEffect(() => {
    (async () => {
      const supabase = createClient();
      const { data: apt } = await supabase
        .from('appointments')
        .select('master_id, masters(display_name), services(name)')
        .eq('id', apt_id)
        .maybeSingle();
      type A = { master_id: string; masters: { display_name: string | null } | null; services: { name: string } | null };
      const a = apt as unknown as A | null;
      if (a) {
        setMasterId(a.master_id);
        setMasterName(a.masters?.display_name ?? 'мастер');
        setServiceName(a.services?.name ?? '');
      }
      const { data: r } = await supabase
        .from('reviews')
        .select('id')
        .eq('appointment_id', apt_id)
        .eq('target_type', 'master')
        .maybeSingle();
      if (r) setExisting(true);
      setLoading(false);
    })();
  }, [apt_id]);

  async function submit() {
    if (!masterId) return;
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    const { error } = await supabase.from('reviews').insert({
      appointment_id: apt_id,
      reviewer_id: user?.id ?? null,
      target_type: 'master',
      target_id: masterId,
      score,
      comment: comment.trim() || null,
      is_published: true,
      is_anonymous: anonymous,
    });
    if (error) {
      toast.error(error.message);
      return;
    }
    setDone(true);
    toast.success('Спасибо за отзыв!');
  }

  if (loading) return <div className="p-10 text-center text-sm text-neutral-500">Загрузка…</div>;

  if (existing || done) {
    return (
      <div className="mx-auto max-w-md p-10 text-center">
        <div className="mx-auto flex size-16 items-center justify-center rounded-full bg-emerald-100">
          <Check className="size-8 text-emerald-600" />
        </div>
        <h1 className="mt-4 text-xl font-bold">{done ? 'Спасибо!' : 'Отзыв уже оставлен'}</h1>
        <p className="mt-2 text-sm text-neutral-600">
          {done ? 'Ваш отзыв опубликован.' : 'Повторный отзыв по этому визиту невозможен.'}
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-md space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-bold">Как прошёл визит?</h1>
        <p className="mt-1 text-sm text-neutral-600">
          {serviceName && <>«{serviceName}» · </>}
          {masterName}
        </p>
      </div>

      <div className="rounded-2xl border bg-card p-6">
        <div className="flex justify-center gap-2">
          {[1, 2, 3, 4, 5].map((n) => (
            <button
              key={n}
              onClick={() => setScore(n)}
              onMouseEnter={() => setHover(n)}
              onMouseLeave={() => setHover(0)}
              className="p-1"
              aria-label={`${n} stars`}
            >
              <Star
                className={`size-10 transition-colors ${
                  n <= (hover || score) ? 'fill-amber-400 text-amber-400' : 'text-neutral-300'
                }`}
              />
            </button>
          ))}
        </div>
        <div className="mt-2 text-center text-xs text-neutral-500">
          {score} из 5
        </div>

        <textarea
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          placeholder="Комментарий (не обязательно)"
          rows={4}
          className="mt-4 w-full rounded-lg border border-neutral-300 p-3 text-sm outline-none focus:border-neutral-500"
        />

        <label className="mt-3 flex items-center gap-2 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={anonymous}
            onChange={(e) => setAnonymous(e.target.checked)}
            className="size-4 rounded border-neutral-300 text-neutral-900 focus:ring-0 focus:ring-offset-0"
          />
          <span className="text-sm text-neutral-700">Оставить анонимно</span>
        </label>
        <p className="mt-1 ml-6 text-[11px] text-neutral-500 leading-relaxed">
          Имя скроется на публичной странице мастера. Мастер своё имя клиента всё равно увидит в кабинете.
        </p>

        <button
          onClick={submit}
          className="mt-4 w-full rounded-lg bg-neutral-900 py-3 text-sm font-semibold text-white hover:bg-neutral-800"
        >
          Отправить отзыв
        </button>
      </div>
    </div>
  );
}
