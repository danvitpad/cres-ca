/** --- YAML
 * name: MasterMiniAppSettings/Services
 * description: Mobile services list — read-only view of master's active services. Edit opens web dashboard (forms too heavy for mobile).
 * created: 2026-04-20
 * --- */

'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Scissors, Clock, ArrowSquareOut, Plus } from '@phosphor-icons/react';
import { motion } from 'framer-motion';
import { createClient } from '@/lib/supabase/client';
import { useAuthStore } from '@/stores/auth-store';
import { SettingsShell } from '@/components/miniapp/settings-shell';

interface Service {
  id: string;
  name: string;
  duration_minutes: number;
  price: number;
  currency: string;
  is_active: boolean;
  color: string | null;
}

export default function MiniAppServicesPage() {
  const { userId } = useAuthStore();
  const [items, setItems] = useState<Service[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userId) return;
    (async () => {
      const supabase = createClient();
      const { data: master } = await supabase
        .from('masters').select('id').eq('profile_id', userId).maybeSingle();
      if (!master) { setLoading(false); return; }
      const { data } = await supabase
        .from('services')
        .select('id, name, duration_minutes, price, currency, is_active, color')
        .eq('master_id', master.id)
        .order('name');
      setItems((data as Service[] | null) ?? []);
      setLoading(false);
    })();
  }, [userId]);

  const activeCount = items.filter((s) => s.is_active).length;

  return (
    <SettingsShell
      title="Услуги и цены"
      subtitle={loading ? undefined : `${activeCount} активных · ${items.length - activeCount} в архиве`}
    >
      {loading ? (
        <div className="space-y-2">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-16 w-full animate-pulse rounded-2xl bg-white/[0.04]" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-white/10 bg-white/[0.03] p-8 text-center">
          <div className="mx-auto flex size-10 items-center justify-center rounded-xl border border-white/10 bg-white/[0.03]">
            <Scissors size={18} className="text-white/40" />
          </div>
          <p className="mt-3 text-[13px] text-white/60">Пока нет услуг</p>
          <p className="mt-1 text-[11px] text-white/40">Создай услугу в веб-дашборде</p>
        </div>
      ) : (
        <ul className="space-y-2">
          {items.map((s, i) => (
            <motion.li
              key={s.id}
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.02 }}
              className={`flex items-center gap-3 rounded-2xl border px-4 py-3 ${
                s.is_active
                  ? 'border-white/10 bg-white/[0.03]'
                  : 'border-white/5 bg-white/[0.015] opacity-60'
              }`}
            >
              <span
                className="size-2.5 shrink-0 rounded-full"
                style={{ background: s.color || '#8b5cf6' }}
              />
              <div className="min-w-0 flex-1">
                <p className="truncate text-[13px] font-semibold">{s.name}</p>
                <p className="mt-0.5 flex items-center gap-2 text-[11px] text-white/50">
                  <Clock size={10} weight="bold" />
                  {s.duration_minutes} мин
                </p>
              </div>
              <p className="shrink-0 text-[13px] font-bold tabular-nums text-white/90">
                {Number(s.price).toFixed(0)} <span className="text-[11px] font-normal text-white/50">{s.currency}</span>
              </p>
            </motion.li>
          ))}
        </ul>
      )}

      <Link
        href="/ru/services"
        className="flex w-full items-center justify-center gap-2 rounded-2xl border border-violet-500/30 bg-violet-500/15 py-3.5 text-[14px] font-semibold text-violet-100 active:bg-violet-500/25 transition-colors"
      >
        <Plus size={15} weight="bold" />
        Добавить / редактировать
        <ArrowSquareOut size={13} weight="bold" />
      </Link>
      <p className="text-center text-[11px] text-white/40 -mt-2">
        Редактирование цен и услуг — в веб-дашборде.
      </p>
    </SettingsShell>
  );
}
