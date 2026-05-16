/** --- YAML
 * name: Salon Team
 * description: Admin-only salon team management. Active masters + receptionists with editable
 *              commission/rent, suspend/resume, soft-delete. Links to existing invite creation flow.
 * created: 2026-04-19
 * --- */

'use client';

import { useCallback, useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { motion } from 'framer-motion';
import {
  Building2, Users, Crown, UserCog, UserCheck, UserMinus, Pencil, Check, X, Pause, Play,
} from 'lucide-react';
import { toast } from 'sonner';
import { useConfirm } from '@/hooks/use-confirm';

interface Member {
  id: string;
  role: 'admin' | 'master' | 'receptionist';
  status: 'pending' | 'active' | 'suspended';
  commission_percent: number | null;
  rent_amount: number | null;
  joined_at: string | null;
  profile_id: string;
  master_id: string | null;
  display_name: string | null;
  avatar_url: string | null;
  specialization: string | null;
  appointments_week: number;
  is_owner: boolean;
}

interface TeamData {
  salon: {
    id: string;
    name: string;
    team_mode: 'unified' | 'marketplace';
    default_master_commission: number | null;
    owner_commission_percent: number | null;
    owner_rent_per_master: number | null;
  };
  members: Member[];
}

function formatCurrency(v: number) {
  return new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 0 }).format(v) + ' ₴';
}

export default function SalonTeamPage() {
  const params = useParams();
  const salonId = params.id as string;
  const locale = params.locale as string;
  const confirm = useConfirm();

  const [data, setData] = useState<TeamData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValues, setEditValues] = useState<{ commission_percent: string; rent_amount: string }>({ commission_percent: '', rent_amount: '' });
  const [busyId, setBusyId] = useState<string | null>(null);
  const [isMobileView, setIsMobileView] = useState(false);

  useEffect(() => {
    const check = () => setIsMobileView(window.innerWidth < 768);
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  const load = useCallback(() => {
    setLoading(true);
    fetch(`/api/salon/${salonId}/members`)
      .then(async (r) => {
        if (r.status === 403) throw new Error('forbidden');
        if (!r.ok) throw new Error('failed');
        return r.json();
      })
      .then((j: TeamData) => setData(j))
      .catch((e) => setError(e instanceof Error ? e.message : 'error'))
      .finally(() => setLoading(false));
  }, [salonId]);

  useEffect(() => { load(); }, [load]);

  async function patchMember(memberId: string, patch: Record<string, unknown>) {
    setBusyId(memberId);
    const res = await fetch(`/api/salon/${salonId}/members/${memberId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(patch),
    });
    setBusyId(null);
    if (!res.ok) { toast.error('Не удалось обновить участника'); return false; }
    return true;
  }

  async function removeMember(m: Member) {
    const ok = await confirm({
      title: `Удалить ${m.display_name ?? 'участника'} из салона?`,
      description: 'Записи и клиенты останутся в базе. Участника можно будет пригласить снова.',
      confirmLabel: 'Удалить',
      cancelLabel: 'Отмена',
      destructive: true,
    });
    if (!ok) return;
    setBusyId(m.id);
    const res = await fetch(`/api/salon/${salonId}/members/${m.id}`, { method: 'DELETE' });
    setBusyId(null);
    if (!res.ok) { toast.error('Ошибка удаления'); return; }
    toast.success('Удалено');
    load();
  }

  async function toggleStatus(m: Member) {
    const next = m.status === 'active' ? 'suspended' : 'active';
    const ok = await patchMember(m.id, { status: next });
    if (ok) {
      toast.success(next === 'suspended' ? 'Приостановлено' : 'Возобновлено');
      load();
    }
  }

  async function saveFinance(m: Member) {
    const commission = editValues.commission_percent === ''
      ? null
      : Number.parseFloat(editValues.commission_percent);
    const rent = editValues.rent_amount === ''
      ? null
      : Number.parseFloat(editValues.rent_amount);
    if (Number.isNaN(commission as number) && commission !== null) { toast.error('Комиссия должна быть числом'); return; }
    if (Number.isNaN(rent as number) && rent !== null) { toast.error('Аренда должна быть числом'); return; }
    const ok = await patchMember(m.id, {
      commission_percent: commission,
      rent_amount: rent,
    });
    if (ok) { toast.success('Сохранено'); setEditingId(null); load(); }
  }

  if (loading && !data) {
    return (
      <div className="p-6 space-y-4">
        <div className="h-10 w-64 bg-muted rounded animate-pulse" />
        <div className="h-64 bg-muted rounded-xl animate-pulse" />
      </div>
    );
  }

  if (error === 'forbidden') {
    return (
      <div className="p-6 max-w-md mx-auto text-center">
        <Crown className="size-10 mx-auto text-muted-foreground mb-3" />
        <h2 className="text-lg font-semibold">Управление командой — только для владельца</h2>
      </div>
    );
  }

  if (!data) {
    return <div className="p-6 text-center text-muted-foreground">Не удалось загрузить</div>;
  }

  const isUnified = data.salon.team_mode === 'unified';
  const masters = data.members.filter((m) => m.role === 'master' || (m.role === 'admin' && m.master_id));
  const receptionists = data.members.filter((m) => m.role === 'receptionist');
  const adminsOnly = data.members.filter((m) => m.role === 'admin' && !m.master_id);
  const editingMember = editingId ? data.members.find((m) => m.id === editingId) ?? null : null;

  if (isMobileView) {
    const ACCENT = '#2563eb';
    const allMembers = [...masters, ...adminsOnly, ...receptionists];

    return (
      <div style={{ minHeight: '100dvh', background: '#f8fafc', padding: '16px 16px 120px', position: 'relative' }}>
        {/* Header */}
        <div style={{ marginBottom: 20 }}>
          <div style={{ fontSize: 11, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Команда · {isUnified ? 'Єдиний бізнес' : 'Коворкінг'}
          </div>
          <div style={{ fontSize: 22, fontWeight: 700, color: '#0f172a' }}>{data.salon.name}</div>
          <div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>
            {isUnified
              ? `Комісія за замовчуванням: ${data.salon.default_master_commission ?? 50}%`
              : `Комісія власнику: ${data.salon.owner_commission_percent ?? 0}% · Оренда: ${formatCurrency(Number(data.salon.owner_rent_per_master ?? 0))}`}
          </div>
        </div>

        {/* Summary chips */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
          {[
            { label: `Майстрів ${masters.length}`, color: ACCENT },
            { label: `Адм. ${adminsOnly.length + receptionists.length}`, color: '#64748b' },
          ].map((c) => (
            <div key={c.label} style={{ padding: '5px 12px', borderRadius: 20, background: `${c.color}15`, color: c.color, fontSize: 12, fontWeight: 500 }}>
              {c.label}
            </div>
          ))}
        </div>

        {/* Members list */}
        {allMembers.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '40px 0', color: '#94a3b8', fontSize: 13 }}>Немає учасників</div>
        ) : (
          allMembers.map((m) => {
            const roleLabel = m.role === 'admin' ? 'адмін' : m.role === 'receptionist' ? 'ресепшн' : 'майстер';
            const isEditing = editingId === m.id;
            const statusColor = m.status === 'active' ? '#10b981' : m.status === 'suspended' ? '#f43f5e' : '#f59e0b';

            return (
              <div key={m.id} style={{ background: '#fff', borderRadius: 14, padding: '12px 14px', marginBottom: 10, border: '1px solid #f1f5f9' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{ width: 40, height: 40, borderRadius: '50%', background: `${ACCENT}15`, color: ACCENT, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, fontWeight: 700, flexShrink: 0, overflow: 'hidden' }}>
                    {m.avatar_url ? <img src={m.avatar_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : (m.display_name || 'M')[0].toUpperCase()}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                      <span style={{ fontSize: 13, fontWeight: 600, color: '#0f172a' }}>{m.display_name || 'Учасник'}</span>
                      {m.is_owner && <span style={{ fontSize: 10, padding: '1px 6px', borderRadius: 6, background: '#fef3c7', color: '#d97706', fontWeight: 500 }}>власник</span>}
                      <span style={{ fontSize: 10, padding: '1px 6px', borderRadius: 6, background: '#f1f5f9', color: '#64748b' }}>{roleLabel}</span>
                      {m.status !== 'active' && <span style={{ fontSize: 10, padding: '1px 6px', borderRadius: 6, background: `${statusColor}15`, color: statusColor }}>{m.status === 'suspended' ? 'призупинено' : 'запрошення'}</span>}
                    </div>
                    <div style={{ fontSize: 11, color: '#64748b', marginTop: 2 }}>
                      {m.specialization || 'Без спеціалізації'} · {m.appointments_week} зап/тиж
                    </div>
                    {!isEditing && m.role === 'master' && (
                      <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 2 }}>
                        {isUnified
                          ? `Комісія: ${m.commission_percent ?? data.salon.default_master_commission ?? 50}%`
                          : [
                              m.commission_percent != null && m.commission_percent > 0 && `Комісія: ${m.commission_percent}%`,
                              m.rent_amount != null && m.rent_amount > 0 && `Оренда: ${formatCurrency(Number(m.rent_amount))}`,
                            ].filter(Boolean).join(' · ') || 'За замовчуванням'}
                      </div>
                    )}
                    {isEditing && (
                      <div style={{ marginTop: 8, display: 'flex', gap: 8 }}>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: 10, color: '#94a3b8', marginBottom: 2 }}>Комісія %</div>
                          <input
                            type="number"
                            value={editValues.commission_percent}
                            onChange={(e) => setEditValues((v) => ({ ...v, commission_percent: e.target.value }))}
                            style={{ width: '100%', padding: '6px 8px', borderRadius: 8, border: '1px solid #e2e8f0', fontSize: 13, background: '#f8fafc', boxSizing: 'border-box' }}
                          />
                        </div>
                        {!isUnified && (
                          <div style={{ flex: 1 }}>
                            <div style={{ fontSize: 10, color: '#94a3b8', marginBottom: 2 }}>Оренда ₴</div>
                            <input
                              type="number"
                              value={editValues.rent_amount}
                              onChange={(e) => setEditValues((v) => ({ ...v, rent_amount: e.target.value }))}
                              style={{ width: '100%', padding: '6px 8px', borderRadius: 8, border: '1px solid #e2e8f0', fontSize: 13, background: '#f8fafc', boxSizing: 'border-box' }}
                            />
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                  {!m.is_owner && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 4, flexShrink: 0 }}>
                      {!isEditing ? (
                        <>
                          {(m.role === 'master') && (
                            <button
                              type="button"
                              onClick={() => { setEditingId(m.id); setEditValues({ commission_percent: m.commission_percent != null ? String(m.commission_percent) : '', rent_amount: m.rent_amount != null ? String(m.rent_amount) : '' }); }}
                              style={{ width: 32, height: 32, borderRadius: 8, border: '1px solid #e2e8f0', background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#64748b' }}
                            >
                              <Pencil style={{ width: 13, height: 13 }} />
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => toggleStatus(m)}
                            disabled={busyId === m.id}
                            style={{ width: 32, height: 32, borderRadius: 8, border: '1px solid #e2e8f0', background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#64748b', opacity: busyId === m.id ? 0.5 : 1 }}
                          >
                            {m.status === 'active' ? <Pause style={{ width: 13, height: 13 }} /> : <Play style={{ width: 13, height: 13 }} />}
                          </button>
                          <button
                            type="button"
                            onClick={() => removeMember(m)}
                            disabled={busyId === m.id}
                            style={{ width: 32, height: 32, borderRadius: 8, border: '1px solid #fecdd3', background: '#fff5f5', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#f43f5e', opacity: busyId === m.id ? 0.5 : 1 }}
                          >
                            <UserMinus style={{ width: 13, height: 13 }} />
                          </button>
                        </>
                      ) : (
                        <>
                          <button
                            type="button"
                            onClick={() => editingMember && saveFinance(editingMember)}
                            disabled={busyId === m.id}
                            style={{ width: 32, height: 32, borderRadius: 8, border: 'none', background: ACCENT, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#fff', opacity: busyId === m.id ? 0.5 : 1 }}
                          >
                            <Check style={{ width: 13, height: 13 }} />
                          </button>
                          <button
                            type="button"
                            onClick={() => setEditingId(null)}
                            style={{ width: 32, height: 32, borderRadius: 8, border: '1px solid #e2e8f0', background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#64748b' }}
                          >
                            <X style={{ width: 13, height: 13 }} />
                          </button>
                        </>
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })
        )}

        {/* FAB — invite */}
        <a
          href={`/${locale}/settings/team`}
          style={{ position: 'fixed', bottom: 24, right: 20, display: 'flex', alignItems: 'center', gap: 8, padding: '12px 20px', borderRadius: 28, background: ACCENT, color: '#fff', fontSize: 14, fontWeight: 600, textDecoration: 'none', boxShadow: '0 4px 16px rgba(37,99,235,0.4)', zIndex: 40 }}
        >
          <Users style={{ width: 16, height: 16 }} />
          Запросити
        </a>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 space-y-6 pb-20">
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-wrap items-center gap-3 justify-between"
      >
        <div className="flex items-center gap-3">
          <div className="size-11 rounded-xl bg-blue-500/15 border border-blue-500/25 flex items-center justify-center text-blue-600 dark:text-blue-300">
            <Building2 className="size-5" />
          </div>
          <div>
            <div className="text-xs uppercase text-muted-foreground tracking-wider">
              Команда · {isUnified ? 'Единый бизнес' : 'Коворкинг'}
            </div>
            <h1 className="text-xl md:text-2xl font-bold tracking-tight">{data.salon.name}</h1>
          </div>
        </div>
        <a
          href={`/${locale}/settings/team`}
          className="h-9 px-4 rounded-lg bg-primary text-primary-foreground text-sm font-medium inline-flex items-center"
        >
          Пригласить участника
        </a>
      </motion.div>

      <div className="text-xs text-muted-foreground">
        {isUnified ? (
          <>Комиссия по умолчанию: <strong className="text-foreground">{data.salon.default_master_commission ?? 50}%</strong></>
        ) : (
          <>
            Комиссия владельцу: <strong className="text-foreground">{data.salon.owner_commission_percent ?? 0}%</strong>
            {' · '}
            Фикс аренда: <strong className="text-foreground">{formatCurrency(Number(data.salon.owner_rent_per_master ?? 0))}</strong>
          </>
        )}
      </div>

      <Section title="Мастера" icon={UserCheck} count={masters.length}>
        {masters.length === 0 ? (
          <EmptyBlock text="Пока нет мастеров" />
        ) : (
          masters.map((m) => {
            const isEditing = editingId === m.id;
            return (
              <div key={m.id} className="rounded-xl border border-border bg-card p-4">
                <div className="flex items-start gap-3">
                  <Avatar member={m} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-medium truncate">{m.display_name ?? 'Мастер'}</span>
                      {m.is_owner && <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-700 inline-flex items-center gap-0.5"><Crown className="size-3" /> владелец</span>}
                      {m.status === 'suspended' && <span className="text-[10px] px-1.5 py-0.5 rounded bg-rose-500/10 text-rose-700">приостановлен</span>}
                      {m.status === 'pending' && <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-700">приглашение</span>}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {m.specialization ?? 'Без специализации'}
                      {' · '}
                      {m.appointments_week} зап. за неделю
                    </div>
                    {!isEditing ? (
                      <div className="text-xs text-muted-foreground mt-1">
                        {isUnified ? (
                          <>Комиссия: <strong className="text-foreground">{m.commission_percent ?? data.salon.default_master_commission ?? 50}%</strong></>
                        ) : (
                          <>
                            {m.commission_percent != null && m.commission_percent > 0 && (
                              <>Комиссия владельцу: <strong className="text-foreground">{m.commission_percent}%</strong>{' · '}</>
                            )}
                            {m.rent_amount != null && m.rent_amount > 0 && (
                              <>Аренда: <strong className="text-foreground">{formatCurrency(Number(m.rent_amount))}</strong></>
                            )}
                            {(m.commission_percent == null || m.commission_percent === 0) && (m.rent_amount == null || m.rent_amount === 0) && (
                              <>Берёт по-умолчанию: {data.salon.owner_commission_percent ?? 0}% / {formatCurrency(Number(data.salon.owner_rent_per_master ?? 0))}</>
                            )}
                          </>
                        )}
                      </div>
                    ) : (
                      <div className="mt-2 grid grid-cols-2 gap-2 max-w-sm">
                        <div>
                          <label className="text-[10px] uppercase text-muted-foreground">Комиссия %</label>
                          <input
                            type="number"
                            value={editValues.commission_percent}
                            onChange={(e) => setEditValues((v) => ({ ...v, commission_percent: e.target.value }))}
                            placeholder={String(isUnified ? (data.salon.default_master_commission ?? 50) : (data.salon.owner_commission_percent ?? 0))}
                            className="w-full h-8 px-2 rounded border border-border bg-background text-sm"
                          />
                        </div>
                        {!isUnified && (
                          <div>
                            <label className="text-[10px] uppercase text-muted-foreground">Аренда ₴</label>
                            <input
                              type="number"
                              value={editValues.rent_amount}
                              onChange={(e) => setEditValues((v) => ({ ...v, rent_amount: e.target.value }))}
                              placeholder={String(data.salon.owner_rent_per_master ?? 0)}
                              className="w-full h-8 px-2 rounded border border-border bg-background text-sm"
                            />
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                  <div className="flex flex-col gap-1 shrink-0">
                    {!isEditing ? (
                      <>
                        {!m.is_owner && (
                          <button
                            onClick={() => {
                              setEditingId(m.id);
                              setEditValues({
                                commission_percent: m.commission_percent != null ? String(m.commission_percent) : '',
                                rent_amount: m.rent_amount != null ? String(m.rent_amount) : '',
                              });
                            }}
                            className="h-8 w-8 rounded-md border border-border hover:bg-muted flex items-center justify-center"
                            aria-label="Редактировать"
                          >
                            <Pencil className="size-3.5" />
                          </button>
                        )}
                        {!m.is_owner && (
                          <button
                            onClick={() => toggleStatus(m)}
                            disabled={busyId === m.id}
                            className="h-8 w-8 rounded-md border border-border hover:bg-muted flex items-center justify-center disabled:opacity-50"
                            aria-label={m.status === 'active' ? 'Приостановить' : 'Возобновить'}
                          >
                            {m.status === 'active' ? <Pause className="size-3.5" /> : <Play className="size-3.5" />}
                          </button>
                        )}
                        {!m.is_owner && (
                          <button
                            onClick={() => removeMember(m)}
                            disabled={busyId === m.id}
                            className="h-8 w-8 rounded-md border border-border hover:bg-rose-500/10 text-rose-600 flex items-center justify-center disabled:opacity-50"
                            aria-label="Удалить"
                          >
                            <UserMinus className="size-3.5" />
                          </button>
                        )}
                      </>
                    ) : (
                      <>
                        <button
                          onClick={() => saveFinance(m)}
                          disabled={busyId === m.id}
                          className="h-8 w-8 rounded-md bg-primary text-primary-foreground flex items-center justify-center disabled:opacity-50"
                          aria-label="Сохранить"
                        >
                          <Check className="size-3.5" />
                        </button>
                        <button
                          onClick={() => setEditingId(null)}
                          className="h-8 w-8 rounded-md border border-border hover:bg-muted flex items-center justify-center"
                          aria-label="Отмена"
                        >
                          <X className="size-3.5" />
                        </button>
                      </>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </Section>

      {(receptionists.length > 0 || adminsOnly.length > 0) && (
        <Section title="Ресепшн и администраторы" icon={UserCog} count={receptionists.length + adminsOnly.length}>
          {[...adminsOnly, ...receptionists].map((m) => (
            <div key={m.id} className="rounded-xl border border-border bg-card p-4">
              <div className="flex items-center gap-3">
                <Avatar member={m} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-medium truncate">{m.display_name ?? 'Участник'}</span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
                      {m.role === 'admin' ? 'админ' : 'ресепшн'}
                    </span>
                    {m.is_owner && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-700 inline-flex items-center gap-0.5">
                        <Crown className="size-3" /> владелец
                      </span>
                    )}
                    {m.status === 'suspended' && <span className="text-[10px] px-1.5 py-0.5 rounded bg-rose-500/10 text-rose-700">приостановлен</span>}
                  </div>
                </div>
                {!m.is_owner && (
                  <div className="flex gap-1 shrink-0">
                    <button
                      onClick={() => toggleStatus(m)}
                      disabled={busyId === m.id}
                      className="h-8 w-8 rounded-md border border-border hover:bg-muted flex items-center justify-center disabled:opacity-50"
                      aria-label={m.status === 'active' ? 'Приостановить' : 'Возобновить'}
                    >
                      {m.status === 'active' ? <Pause className="size-3.5" /> : <Play className="size-3.5" />}
                    </button>
                    <button
                      onClick={() => removeMember(m)}
                      disabled={busyId === m.id}
                      className="h-8 w-8 rounded-md border border-border hover:bg-rose-500/10 text-rose-600 flex items-center justify-center disabled:opacity-50"
                      aria-label="Удалить"
                    >
                      <UserMinus className="size-3.5" />
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))}
        </Section>
      )}
    </div>
  );
}

function Section({ title, icon: Icon, count, children }: { title: string; icon: typeof Users; count: number; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="text-sm font-semibold text-muted-foreground mb-3 flex items-center gap-1.5">
        <Icon className="size-4" /> {title} · {count}
      </h2>
      <div className="space-y-2">{children}</div>
    </section>
  );
}

function EmptyBlock({ text }: { text: string }) {
  return (
    <div className="rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
      {text}
    </div>
  );
}

function Avatar({ member: m }: { member: Member }) {
  return (
    <div className="size-10 rounded-full bg-primary/10 text-primary font-bold flex items-center justify-center overflow-hidden shrink-0">
      {m.avatar_url ? (
        <img src={m.avatar_url} alt="" className="size-full object-cover" />
      ) : (
        (m.display_name || 'M')[0].toUpperCase()
      )}
    </div>
  );
}
