/** --- YAML
 * name: DealsPage
 * description: Full CRUD for promo codes — create/edit/delete, percentage or fixed discount, valid dates, applicable services, usage stats, active toggle
 * created: 2026-04-13
 * updated: 2026-04-16
 * --- */

'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import {
  Tag,
  Plus,
  Trash2,
  Copy,
  Pencil,
  X,
  Check,
  BarChart3,
  Calendar,
  Percent,
  DollarSign,
  Users,
  ChevronDown,
} from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { useMaster } from '@/hooks/use-master';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { usePageTheme, FONT, FONT_FEATURES, CURRENCY } from '@/lib/dashboard-theme';
import { EmptyState } from '@/components/shared/primitives/empty-state';
import { humanizeError } from '@/lib/format/error';

/* ── types ─────────────────────────────────────────────── */

interface PromoCode {
  id: string;
  code: string;
  discount_percent: number;
  discount_type: 'percentage' | 'fixed';
  discount_value: number;
  max_uses: number | null;
  uses_count: number;
  valid_from: string | null;
  valid_until: string | null;
  is_active: boolean;
  applicable_service_ids: string[] | null;
  created_at: string;
}

interface ServiceOption {
  id: string;
  name: string;
}

type FormData = {
  code: string;
  discountType: 'percentage' | 'fixed';
  discountValue: number;
  maxUses: string;
  validFrom: string;
  validUntil: string;
  isActive: boolean;
  serviceIds: string[];
};

const emptyForm: FormData = {
  code: '',
  discountType: 'percentage',
  discountValue: 10,
  maxUses: '',
  validFrom: '',
  validUntil: '',
  isActive: true,
  serviceIds: [],
};

/* ── helpers ───────────────────────────────────────────── */

function generateCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let result = '';
  for (let i = 0; i < 8; i++) result += chars[Math.floor(Math.random() * chars.length)];
  return result;
}

/* ── page ──────────────────────────────────────────────── */

export default function DealsPage() {
  const { C, isDark, mounted } = usePageTheme();

  const { master } = useMaster();
  const [codes, setCodes] = useState<PromoCode[]>([]);
  const [services, setServices] = useState<ServiceOption[]>([]);
  const [loading, setLoading] = useState(true);

  // Form state
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormData>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [showServicePicker, setShowServicePicker] = useState(false);

  /* ── load data ─────────────────────────────────────── */

  const loadCodes = useCallback(async () => {
    if (!master?.id) return;
    const supabase = createClient();

    const { data, error } = await supabase
      .from('promo_codes')
      .select('*')
      .eq('master_id', master.id)
      .order('created_at', { ascending: false });

    if (error) {
      // Table likely doesn't exist — use mock data
      console.warn('promo_codes table not found, using empty state:', error.message);
      setCodes([]);
    } else {
      setCodes((data ?? []).map(normalizePromo));
    }
    setLoading(false);
  }, [master?.id]);

  const loadServices = useCallback(async () => {
    if (!master?.id) return;
    const supabase = createClient();
    const { data } = await supabase
      .from('services')
      .select('id, name')
      .eq('master_id', master.id)
      .eq('is_active', true)
      .order('name');
    setServices((data ?? []) as ServiceOption[]);
  }, [master?.id]);

  useEffect(() => {
    loadCodes();
    loadServices();
  }, [loadCodes, loadServices]);

  /* ── normalize DB row to PromoCode ─────────────────── */

  function normalizePromo(row: Record<string, unknown>): PromoCode {
    return {
      id: row.id as string,
      code: row.code as string,
      discount_percent: Number(row.discount_percent ?? row.discount_value ?? 0),
      discount_type: (row.discount_type as 'percentage' | 'fixed') ?? 'percentage',
      discount_value: Number(row.discount_value ?? row.discount_percent ?? 0),
      max_uses: row.max_uses as number | null,
      uses_count: Number(row.uses_count ?? 0),
      valid_from: (row.valid_from as string) ?? null,
      valid_until: (row.valid_until as string) ?? null,
      is_active: row.is_active as boolean,
      applicable_service_ids: (row.applicable_service_ids as string[] | null) ?? null,
      created_at: row.created_at as string,
    };
  }

  /* ── CRUD ───────────────────────────────────────────── */

  function openCreate() {
    setEditingId(null);
    setForm({ ...emptyForm, code: generateCode() });
    setShowForm(true);
  }

  function openEdit(p: PromoCode) {
    setEditingId(p.id);
    setForm({
      code: p.code,
      discountType: p.discount_type,
      discountValue: p.discount_value || p.discount_percent,
      maxUses: p.max_uses?.toString() ?? '',
      validFrom: p.valid_from ? p.valid_from.substring(0, 10) : '',
      validUntil: p.valid_until ? p.valid_until.substring(0, 10) : '',
      isActive: p.is_active,
      serviceIds: p.applicable_service_ids ?? [],
    });
    setShowForm(true);
  }

  function closeForm() {
    setShowForm(false);
    setEditingId(null);
    setForm(emptyForm);
    setShowServicePicker(false);
  }

  async function savePromo() {
    if (!master?.id || !form.code.trim() || form.discountValue <= 0) {
      toast.error('Заполни код и скидку');
      return;
    }
    setSaving(true);
    const supabase = createClient();

    const payload = {
      master_id: master.id,
      code: form.code.trim().toUpperCase(),
      discount_type: form.discountType,
      discount_percent: form.discountType === 'percentage' ? form.discountValue : 0,
      discount_value: form.discountValue,
      max_uses: form.maxUses ? parseInt(form.maxUses) : null,
      valid_from: form.validFrom ? new Date(form.validFrom).toISOString() : null,
      valid_until: form.validUntil ? new Date(form.validUntil).toISOString() : null,
      is_active: form.isActive,
      applicable_service_ids: form.serviceIds.length > 0 ? form.serviceIds : null,
    };

    let error;
    if (editingId) {
      ({ error } = await supabase.from('promo_codes').update(payload).eq('id', editingId));
    } else {
      ({ error } = await supabase.from('promo_codes').insert(payload));
    }

    setSaving(false);
    if (error) {
      toast.error(humanizeError(error));
      return;
    }
    toast.success(editingId ? 'Промокод обновлён' : 'Промокод создан');
    closeForm();
    loadCodes();
  }

  async function toggleActive(p: PromoCode) {
    const supabase = createClient();
    const { error } = await supabase.from('promo_codes').update({ is_active: !p.is_active }).eq('id', p.id);
    if (error) {
      toast.error(humanizeError(error));
      return;
    }
    setCodes((prev) => prev.map((x) => (x.id === p.id ? { ...x, is_active: !p.is_active } : x)));
  }

  async function remove(id: string) {
    const supabase = createClient();
    const { error } = await supabase.from('promo_codes').delete().eq('id', id);
    if (error) {
      toast.error(humanizeError(error));
      return;
    }
    setCodes((p) => p.filter((x) => x.id !== id));
    toast.success('Промокод удалён');
  }

  async function copyCode(text: string) {
    try {
      await navigator.clipboard.writeText(text);
      toast.success('Скопировано');
    } catch { /* ignore */ }
  }

  /* ── stats ─────────────────────────────────────────── */

  const stats = useMemo(() => {
    const totalCodes = codes.length;
    const activeCodes = codes.filter((c) => c.is_active).length;
    const totalUses = codes.reduce((a, c) => a + c.uses_count, 0);
    const mostUsed = codes.length > 0
      ? [...codes].sort((a, b) => b.uses_count - a.uses_count)[0]
      : null;
    return { totalCodes, activeCodes, totalUses, mostUsed };
  }, [codes]);

  /* ── service names lookup ──────────────────────────── */

  const serviceNameMap = useMemo(() => {
    const m = new Map<string, string>();
    for (const s of services) m.set(s.id, s.name);
    return m;
  }, [services]);

  function toggleService(id: string) {
    setForm((prev) => ({
      ...prev,
      serviceIds: prev.serviceIds.includes(id)
        ? prev.serviceIds.filter((s) => s !== id)
        : [...prev.serviceIds, id],
    }));
  }

  /* ── render ────────────────────────────────────────── */

  return (
    <div style={{ fontFamily: FONT, fontFeatureSettings: FONT_FEATURES, background: C.bg, color: C.text, padding: '32px 40px', maxWidth: 860, margin: '0 auto', width: '100%' }}>
      {/* Header — only subtitle + action; main h1 lives on the parent /marketing page */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 24, gap: 16 }}>
        <p style={{ fontSize: 14, color: C.textSecondary, margin: 0 }}>
          Создавай промокоды со скидками, отправляй клиентам и отслеживай результаты.
        </p>
        <button
          onClick={openCreate}
          style={{
            padding: '8px 16px', borderRadius: 8, border: 'none',
            background: C.accent, color: '#fff', fontSize: 13, fontWeight: 600,
            cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6,
            flexShrink: 0,
          }}
        >
          <Plus size={14} />
          Новый промокод
        </button>
      </div>

      {/* Stats cards */}
      {codes.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 24 }}
        >
          <StatCard icon={<Tag size={14} />} label="Всего промокодов" value={stats.totalCodes.toString()} C={C} />
          <StatCard icon={<Check size={14} />} label="Активных" value={stats.activeCodes.toString()} color={C.success} C={C} />
          <StatCard icon={<Users size={14} />} label="Всего использований" value={stats.totalUses.toString()} C={C} />
          <StatCard
            icon={<BarChart3 size={14} />}
            label="Самый популярный"
            value={stats.mostUsed ? `${stats.mostUsed.code} (${stats.mostUsed.uses_count})` : '—'}
            C={C}
          />
        </motion.div>
      )}

      {/* Create/Edit form modal */}
      <AnimatePresence>
        {showForm && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            style={{
              position: 'fixed', inset: 0, zIndex: 50,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: 'rgba(0,0,0,0.5)',
            }}
            onClick={(e) => { if (e.target === e.currentTarget) closeForm(); }}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              style={{
                background: C.surface, border: `1px solid ${C.border}`,
                borderRadius: 16, padding: 28, width: 520, maxHeight: '85vh', overflowY: 'auto',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                <h2 style={{ fontSize: 18, fontWeight: 700, margin: 0 }}>
                  {editingId ? 'Редактировать промокод' : 'Новый промокод'}
                </h2>
                <button onClick={closeForm} style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.textSecondary, padding: 4 }}>
                  <X size={18} />
                </button>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                {/* Code */}
                <div>
                  <Label style={{ fontSize: 12, color: C.textSecondary }}>Промокод</Label>
                  <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
                    <Input
                      value={form.code}
                      onChange={(e) => setForm((f) => ({ ...f, code: e.target.value.toUpperCase() }))}
                      placeholder="SUMMER20"
                      style={{ fontFamily: 'monospace', fontWeight: 700, letterSpacing: 1 }}
                    />
                    <Button variant="outline" size="sm" onClick={() => setForm((f) => ({ ...f, code: generateCode() }))}>
                      Сгенерировать
                    </Button>
                  </div>
                </div>

                {/* Discount type + value */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <div>
                    <Label style={{ fontSize: 12, color: C.textSecondary }}>Тип скидки</Label>
                    <div style={{ display: 'flex', gap: 4, marginTop: 4 }}>
                      {(['percentage', 'fixed'] as const).map((type) => (
                        <button
                          key={type}
                          onClick={() => setForm((f) => ({ ...f, discountType: type }))}
                          style={{
                            flex: 1, padding: '8px 12px', borderRadius: 8, fontSize: 13, fontWeight: 500,
                            border: `1px solid ${form.discountType === type ? C.accent : C.border}`,
                            background: form.discountType === type ? C.accentSoft : 'transparent',
                            color: form.discountType === type ? C.accent : C.text,
                            cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4,
                          }}
                        >
                          {type === 'percentage' ? <Percent size={12} /> : <DollarSign size={12} />}
                          {type === 'percentage' ? 'Процент' : 'Фикс. сумма'}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <Label style={{ fontSize: 12, color: C.textSecondary }}>
                      {form.discountType === 'percentage' ? 'Скидка (%)' : `Скидка (${CURRENCY})`}
                    </Label>
                    <Input
                      type="number"
                      min={1}
                      max={form.discountType === 'percentage' ? 100 : undefined}
                      value={form.discountValue}
                      onChange={(e) => setForm((f) => ({ ...f, discountValue: parseInt(e.target.value) || 0 }))}
                      style={{ marginTop: 4 }}
                    />
                  </div>
                </div>

                {/* Dates */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <div>
                    <Label style={{ fontSize: 12, color: C.textSecondary }}>Действует с</Label>
                    <Input
                      type="date"
                      value={form.validFrom}
                      onChange={(e) => setForm((f) => ({ ...f, validFrom: e.target.value }))}
                      style={{ marginTop: 4 }}
                    />
                  </div>
                  <div>
                    <Label style={{ fontSize: 12, color: C.textSecondary }}>Действует до</Label>
                    <Input
                      type="date"
                      value={form.validUntil}
                      onChange={(e) => setForm((f) => ({ ...f, validUntil: e.target.value }))}
                      style={{ marginTop: 4 }}
                    />
                  </div>
                </div>

                {/* Max uses */}
                <div>
                  <Label style={{ fontSize: 12, color: C.textSecondary }}>Макс. использований (пусто = безлимит)</Label>
                  <Input
                    type="number"
                    min={1}
                    value={form.maxUses}
                    onChange={(e) => setForm((f) => ({ ...f, maxUses: e.target.value }))}
                    placeholder="Без лимита"
                    style={{ marginTop: 4 }}
                  />
                </div>

                {/* Applicable services */}
                <div>
                  <Label style={{ fontSize: 12, color: C.textSecondary }}>Применимые услуги (пусто = все)</Label>
                  <div style={{ marginTop: 4 }}>
                    <button
                      onClick={() => setShowServicePicker(!showServicePicker)}
                      style={{
                        width: '100%', padding: '8px 12px', borderRadius: 8,
                        border: `1px solid ${C.border}`, background: 'transparent',
                        color: C.text, fontSize: 13, cursor: 'pointer',
                        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                      }}
                    >
                      <span style={{ color: form.serviceIds.length > 0 ? C.text : C.textSecondary }}>
                        {form.serviceIds.length > 0
                          ? `Выбрано ${form.serviceIds.length} услуг`
                          : 'Все услуги'}
                      </span>
                      <ChevronDown size={14} style={{ color: C.textSecondary, transition: 'transform 0.2s', transform: showServicePicker ? 'rotate(180deg)' : 'none' }} />
                    </button>
                    <AnimatePresence>
                      {showServicePicker && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: 'auto', opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          style={{ overflow: 'hidden' }}
                        >
                          <div
                            style={{
                              marginTop: 4, border: `1px solid ${C.border}`,
                              borderRadius: 8, maxHeight: 180, overflowY: 'auto',
                            }}
                          >
                            {services.length === 0 ? (
                              <div style={{ padding: 12, fontSize: 12, color: C.textSecondary }}>Нет активных услуг</div>
                            ) : (
                              services.map((s) => {
                                const selected = form.serviceIds.includes(s.id);
                                return (
                                  <button
                                    key={s.id}
                                    onClick={() => toggleService(s.id)}
                                    style={{
                                      width: '100%', padding: '8px 12px', fontSize: 13,
                                      background: selected ? C.accentSoft : 'transparent',
                                      border: 'none', borderBottom: `1px solid ${C.border}`,
                                      color: selected ? C.accent : C.text,
                                      cursor: 'pointer', textAlign: 'left',
                                      display: 'flex', alignItems: 'center', gap: 8,
                                    }}
                                  >
                                    <div
                                      style={{
                                        width: 16, height: 16, borderRadius: 4,
                                        border: `2px solid ${selected ? C.accent : C.border}`,
                                        background: selected ? C.accent : 'transparent',
                                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                                      }}
                                    >
                                      {selected && <Check size={10} style={{ color: '#fff' }} />}
                                    </div>
                                    {s.name}
                                  </button>
                                );
                              })
                            )}
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                </div>

                {/* Active toggle */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <button
                    onClick={() => setForm((f) => ({ ...f, isActive: !f.isActive }))}
                    style={{
                      width: 40, height: 22, borderRadius: 11, border: 'none', cursor: 'pointer',
                      background: form.isActive ? C.success : C.border,
                      position: 'relative', transition: 'background 0.2s',
                    }}
                  >
                    <div
                      style={{
                        width: 18, height: 18, borderRadius: 9, background: '#fff',
                        position: 'absolute', top: 2,
                        left: form.isActive ? 20 : 2,
                        transition: 'left 0.2s',
                      }}
                    />
                  </button>
                  <span style={{ fontSize: 13, color: C.text }}>{form.isActive ? 'Активен' : 'На паузе'}</span>
                </div>

                {/* Actions */}
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 8 }}>
                  <Button variant="outline" onClick={closeForm}>Отмена</Button>
                  <Button onClick={savePromo} disabled={saving}>
                    {saving ? '...' : editingId ? 'Сохранить' : 'Создать'}
                  </Button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Promo codes list */}
      {loading ? (
        <div style={{ fontSize: 14, color: C.textSecondary }}>Загрузка...</div>
      ) : codes.length === 0 ? (
        <EmptyState
          icon={<Tag className="w-6 h-6" />}
          title="Пока нет промокодов"
          description="Нажми «Новый промокод» вверху, чтобы создать."
        />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {codes.map((p, idx) => {
            const expired = p.valid_until && new Date(p.valid_until) < new Date();
            const notStarted = p.valid_from && new Date(p.valid_from) > new Date();
            const usagePct = p.max_uses ? Math.min(100, (p.uses_count / p.max_uses) * 100) : 0;
            const isLive = p.is_active && !expired && !notStarted;
            const applicableNames = (p.applicable_service_ids ?? [])
              .map((id) => serviceNameMap.get(id))
              .filter(Boolean);

            return (
              <motion.div
                key={p.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.03 }}
                style={{
                  background: C.surface,
                  border: `1px solid ${C.border}`,
                  borderRadius: 12,
                  padding: '16px 20px',
                  opacity: isLive ? 1 : 0.6,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16 }}>
                  {/* Left: code info */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                      <code
                        style={{
                          background: C.accentSoft, color: C.accent,
                          padding: '3px 10px', borderRadius: 6, fontFamily: 'monospace',
                          fontSize: 14, fontWeight: 700, letterSpacing: 1,
                        }}
                      >
                        {p.code}
                      </code>
                      <span style={{ fontSize: 18, fontWeight: 700, color: C.text }}>
                        {p.discount_type === 'fixed'
                          ? `−${p.discount_value} ${CURRENCY}`
                          : `−${p.discount_percent || p.discount_value}%`}
                      </span>
                      {expired && (
                        <span style={{ fontSize: 11, fontWeight: 600, color: C.danger, background: C.dangerSoft, padding: '2px 8px', borderRadius: 10 }}>
                          Истёк
                        </span>
                      )}
                      {notStarted && (
                        <span style={{ fontSize: 11, fontWeight: 600, color: C.warning, background: 'rgba(245,158,11,0.1)', padding: '2px 8px', borderRadius: 10 }}>
                          Ещё не начался
                        </span>
                      )}
                      {!p.is_active && (
                        <span style={{ fontSize: 11, fontWeight: 600, color: C.textTertiary, background: C.border, padding: '2px 8px', borderRadius: 10 }}>
                          На паузе
                        </span>
                      )}
                    </div>

                    {/* Meta info */}
                    <div style={{ display: 'flex', gap: 16, marginTop: 8, flexWrap: 'wrap' }}>
                      <span style={{ fontSize: 12, color: C.textTertiary, display: 'flex', alignItems: 'center', gap: 4 }}>
                        <Users size={11} />
                        Использовано: {p.uses_count}{p.max_uses ? ` / ${p.max_uses}` : ''}
                      </span>
                      {(p.valid_from || p.valid_until) && (
                        <span style={{ fontSize: 12, color: C.textTertiary, display: 'flex', alignItems: 'center', gap: 4 }}>
                          <Calendar size={11} />
                          {p.valid_from ? new Date(p.valid_from).toLocaleDateString() : '...'}
                          {' — '}
                          {p.valid_until ? new Date(p.valid_until).toLocaleDateString() : '...'}
                        </span>
                      )}
                    </div>

                    {/* Applicable services */}
                    {applicableNames.length > 0 && (
                      <div style={{ marginTop: 6, fontSize: 11, color: C.textTertiary }}>
                        Услуги: {applicableNames.join(', ')}
                      </div>
                    )}

                    {/* Usage bar */}
                    {p.max_uses && (
                      <div style={{ marginTop: 8, height: 4, borderRadius: 2, background: C.border, overflow: 'hidden', maxWidth: 200 }}>
                        <div
                          style={{
                            width: `${usagePct}%`, height: '100%', borderRadius: 2,
                            background: usagePct >= 90 ? C.danger : C.accent,
                            transition: 'width 0.3s',
                          }}
                        />
                      </div>
                    )}
                  </div>

                  {/* Right: actions */}
                  <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
                    <IconBtn onClick={() => copyCode(p.code)} title="Копировать" C={C}>
                      <Copy size={14} />
                    </IconBtn>
                    <IconBtn onClick={() => openEdit(p)} title="Редактировать" C={C}>
                      <Pencil size={14} />
                    </IconBtn>
                    <button
                      onClick={() => toggleActive(p)}
                      style={{
                        padding: '6px 12px', borderRadius: 6, fontSize: 12, fontWeight: 500,
                        border: `1px solid ${C.border}`, background: 'transparent',
                        color: p.is_active ? C.warning : C.success, cursor: 'pointer',
                      }}
                    >
                      {p.is_active ? 'Пауза' : 'Вкл'}
                    </button>
                    <IconBtn onClick={() => remove(p.id)} title="Удалить" C={C} danger>
                      <Trash2 size={14} />
                    </IconBtn>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ── sub-components ────────────────────────────────────── */

function StatCard({
  icon, label, value, color, C,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  color?: string;
  C: Record<string, string>;
}) {
  return (
    <div
      style={{
        background: C.surface, border: `1px solid ${C.border}`,
        borderRadius: 12, padding: '16px 20px',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
        <span style={{ color: color ?? C.accent }}>{icon}</span>
        <span style={{ fontSize: 11, color: C.textSecondary, fontWeight: 500 }}>{label}</span>
      </div>
      <div style={{ fontSize: 18, fontWeight: 700, color: color ?? C.text }}>{value}</div>
    </div>
  );
}

function IconBtn({
  children, onClick, title, C, danger,
}: {
  children: React.ReactNode;
  onClick: () => void;
  title: string;
  C: Record<string, string>;
  danger?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      title={title}
      style={{
        width: 32, height: 32, borderRadius: 6, border: `1px solid ${C.border}`,
        background: 'transparent', cursor: 'pointer',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        color: danger ? C.danger : C.textTertiary,
      }}
    >
      {children}
    </button>
  );
}
