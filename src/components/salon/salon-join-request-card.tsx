/** --- YAML
 * name: SalonJoinRequestCard
 * description: На публичной странице салона. Показывается ТОЛЬКО мастеру (роль = master)
 *              когда recruitment_open=true и мастер ещё не в команде. Состояния:
 *                idle: Кнопка «Запросить вступление в команду»
 *                form: textarea с message + Отправить/Отмена
 *                pending: «Заявка отправлена · ждёт ответа админа»
 *                approved: «Тебя приняли · открой кабинет команды»
 *                rejected: «Админ отклонил» + reason если есть + «Запросить заново»
 *              Если recruitment_open=false и нет существующей заявки — показывает
 *              note «Набор временно закрыт».
 *              Прячется для не-мастеров (не загромождать клиентам).
 * created: 2026-04-26
 * --- */

'use client';

import { useEffect, useState } from 'react';
import { Loader2, Send, Clock, Check, X, Lock, Users } from 'lucide-react';
import { toast } from 'sonner';
import { createClient } from '@/lib/supabase/client';

interface Props {
  salonId: string;
  salonOwnerId: string;
  recruitmentOpen: boolean;
  recruitmentMessage: string | null;
}

interface ExistingRequest {
  id: string;
  status: 'pending' | 'approved' | 'rejected' | 'withdrawn';
  message: string | null;
  created_at: string;
  decided_at: string | null;
}

export function SalonJoinRequestCard({
  salonId,
  salonOwnerId,
  recruitmentOpen,
  recruitmentMessage,
}: Props) {
  const [isMaster, setIsMaster] = useState<boolean | null>(null);
  const [isSelfOwner, setIsSelfOwner] = useState(false);
  const [isMember, setIsMember] = useState(false);
  const [existing, setExisting] = useState<ExistingRequest | null>(null);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [draft, setDraft] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        if (!cancelled) {
          setIsMaster(false);
          setLoading(false);
        }
        return;
      }
      if (user.id === salonOwnerId) {
        if (!cancelled) {
          setIsSelfOwner(true);
          setIsMaster(true);
          setLoading(false);
        }
        return;
      }

      const { data: master } = await supabase
        .from('masters')
        .select('id, salon_id')
        .eq('profile_id', user.id)
        .maybeSingle();

      if (!master) {
        if (!cancelled) {
          setIsMaster(false);
          setLoading(false);
        }
        return;
      }

      const masterRow = master as { id: string; salon_id: string | null };

      if (masterRow.salon_id === salonId) {
        if (!cancelled) {
          setIsMaster(true);
          setIsMember(true);
          setLoading(false);
        }
        return;
      }

      const { data: member } = await supabase
        .from('salon_members')
        .select('id, status')
        .eq('salon_id', salonId)
        .eq('master_id', masterRow.id)
        .eq('status', 'active')
        .maybeSingle();

      if (member) {
        if (!cancelled) {
          setIsMaster(true);
          setIsMember(true);
          setLoading(false);
        }
        return;
      }

      // Fetch existing requests via API (RLS ensures only ours)
      const res = await fetch(`/api/salon/${salonId}/join-request`).then((r) => r.json()).catch(() => null);
      const recent: ExistingRequest | null = res?.requests?.[0] ?? null;

      if (!cancelled) {
        setIsMaster(true);
        setExisting(recent);
        setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [salonId, salonOwnerId]);

  async function submit() {
    setSubmitting(true);
    try {
      const res = await fetch(`/api/salon/${salonId}/join-request`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: draft.trim() || undefined }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error((json as { message?: string }).message || 'Не удалось отправить заявку');
        return;
      }
      toast.success('Заявка отправлена — ждём ответа админа');
      setShowForm(false);
      setDraft('');
      setExisting({
        id: (json as { request_id: string }).request_id,
        status: 'pending',
        message: draft.trim() || null,
        created_at: new Date().toISOString(),
        decided_at: null,
      });
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) return null;
  if (isMaster === false) return null; // клиент / гость — не показываем
  if (isSelfOwner) return null;       // владелец — не показываем
  if (isMember) return null;          // уже в команде — не показываем

  // Существует pending заявка
  if (existing && existing.status === 'pending') {
    return (
      <div className="rounded-2xl border border-amber-200 bg-amber-50/60 p-5">
        <div className="flex items-start gap-3">
          <div className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-lg bg-amber-100 text-amber-700">
            <Clock className="size-4" />
          </div>
          <div className="flex-1">
            <p className="text-[14px] font-semibold text-amber-900">Заявка отправлена</p>
            <p className="mt-0.5 text-[13px] text-amber-900/80">
              Админ салона рассматривает. Ответ придёт в уведомления.
            </p>
            {existing.message && (
              <p className="mt-2 rounded-lg bg-white/60 p-2 text-[12px] text-neutral-700">
                «{existing.message}»
              </p>
            )}
          </div>
        </div>
      </div>
    );
  }

  // Approved — но isMember был бы true. Если попали сюда — значит был approved и member-ship уже есть
  if (existing && existing.status === 'approved') return null;

  // Rejected
  if (existing && existing.status === 'rejected') {
    return (
      <div className="rounded-2xl border border-neutral-200 bg-white p-5">
        <div className="flex items-start gap-3">
          <div className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-lg bg-neutral-100 text-neutral-700">
            <X className="size-4" />
          </div>
          <div className="flex-1">
            <p className="text-[14px] font-semibold text-neutral-900">Заявка отклонена</p>
            {existing.message && (
              <p className="mt-1 text-[13px] text-neutral-600">«{existing.message}»</p>
            )}
            {recruitmentOpen && (
              <button
                type="button"
                onClick={() => { setExisting(null); setShowForm(true); }}
                className="mt-3 inline-flex items-center gap-1.5 rounded-full border border-neutral-900 bg-white px-4 py-1.5 text-[13px] font-semibold text-neutral-900 hover:bg-neutral-50"
              >
                Запросить заново
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  // No existing request
  if (!recruitmentOpen) {
    return (
      <div className="rounded-2xl border border-neutral-200 bg-neutral-50 p-5">
        <div className="flex items-start gap-3">
          <div className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-lg bg-neutral-200 text-neutral-700">
            <Lock className="size-4" />
          </div>
          <div>
            <p className="text-[14px] font-semibold text-neutral-900">Набор закрыт</p>
            <p className="mt-0.5 text-[13px] text-neutral-600">
              Этот салон временно не принимает новых мастеров.
            </p>
          </div>
        </div>
      </div>
    );
  }

  // recruitmentOpen + no request — show CTA
  if (!showForm) {
    return (
      <div className="rounded-2xl border border-neutral-900 bg-neutral-50 p-5">
        <div className="flex items-start gap-3">
          <div className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-lg bg-neutral-900 text-white">
            <Users className="size-4" />
          </div>
          <div className="flex-1">
            <p className="text-[14px] font-semibold text-neutral-900">Идёт набор в команду</p>
            {recruitmentMessage && (
              <p className="mt-1 whitespace-pre-line text-[13px] text-neutral-700">
                {recruitmentMessage}
              </p>
            )}
            <button
              type="button"
              onClick={() => setShowForm(true)}
              className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-neutral-900 px-5 py-2 text-[13px] font-semibold text-white hover:bg-neutral-800"
            >
              Запросить вступление
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Form open
  return (
    <div className="rounded-2xl border border-neutral-300 bg-white p-5">
      <p className="text-[14px] font-semibold text-neutral-900">Расскажи о себе админу</p>
      <p className="mt-1 text-[13px] text-neutral-500">
        Опыт, специализация, почему хочешь в эту команду. Можно пропустить.
      </p>
      <textarea
        value={draft}
        onChange={(e) => setDraft(e.target.value.slice(0, 600))}
        rows={4}
        autoFocus
        placeholder="Например: «Маникюр 4 года, ищу команду в центре»"
        className="mt-3 block w-full resize-none rounded-2xl border border-neutral-200 bg-white p-3 text-[13px] text-neutral-900 outline-none focus:border-neutral-400"
      />
      <div className="mt-3 flex items-center justify-between gap-3">
        <p className="text-[11px] text-neutral-400">{draft.length} / 600</p>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => { setShowForm(false); setDraft(''); }}
            className="rounded-full border border-neutral-200 px-4 py-2 text-[13px] font-semibold text-neutral-700 hover:bg-neutral-50"
          >
            Отмена
          </button>
          <button
            type="button"
            onClick={submit}
            disabled={submitting}
            className="inline-flex items-center gap-1.5 rounded-full bg-neutral-900 px-4 py-2 text-[13px] font-semibold text-white disabled:opacity-50"
          >
            {submitting ? <Loader2 className="size-3.5 animate-spin" /> : <Send className="size-3.5" />}
            Отправить заявку
          </button>
        </div>
      </div>
    </div>
  );
}
