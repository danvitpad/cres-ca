/** --- YAML
 * name: NewAppointmentDrawer
 * description: Side panel (Fresha-style) для создания записи. 2 секции — клиенты (кружочки)
 *              и услуги (список с цветной полоской). Поддерживает group booking — несколько
 *              клиентов = N parallel appointments. Стилизован под site theme.
 * created: 2026-04-25
 * --- */

'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { Search, Check, X, Calendar, Clock } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { usePageTheme, FONT, FONT_FEATURES } from '@/lib/dashboard-theme';
import { useEnterSubmit } from '@/hooks/use-keyboard-shortcuts';

interface ClientOption {
  id: string;
  full_name: string;
  no_show_count?: number;
}

interface ServiceOption {
  id: string;
  name: string;
  duration_minutes: number;
  price: number;
  currency: string;
  color: string | null;
  total_uses?: number | null;
}

interface Props {
  masterId: string;
  defaultDate?: string;
  defaultTime?: string;
  defaultClientId?: string;
  defaultServiceId?: string;
  /** If true — opens straight in multi-client mode (group booking) */
  groupMode?: boolean;
  onSaved: () => void;
  onClose: () => void;
  createdByRole?: 'master' | 'admin' | 'receptionist';
}

function clientInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return (parts[0]![0] + parts[1]![0]).toUpperCase();
}

const AVATAR_COLORS = ['#0d9488', '#ec4899', '#10b981', '#f59e0b', '#06b6d4', '#3b82f6', '#f43f5e', '#2dd4bf'];
function avatarColor(id: string): string {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) | 0;
  return AVATAR_COLORS[Math.abs(h) % AVATAR_COLORS.length]!;
}

export function NewAppointmentDrawer({
  masterId, defaultDate, defaultTime, defaultClientId, defaultServiceId,
  groupMode: initialGroupMode = false,
  onSaved, onClose, createdByRole = 'master',
}: Props) {
  const { C } = usePageTheme();

  const [clients, setClients] = useState<ClientOption[]>([]);
  const [services, setServices] = useState<ServiceOption[]>([]);
  const [selectedClientIds, setSelectedClientIds] = useState<string[]>(defaultClientId ? [defaultClientId] : []);
  const [selectedServiceId, setSelectedServiceId] = useState(defaultServiceId ?? '');
  const [date, setDate] = useState(defaultDate ?? new Date().toISOString().split('T')[0]);
  const [time, setTime] = useState(defaultTime ?? '09:00');
  const [notes, setNotes] = useState('');
  const [clientSearch, setClientSearch] = useState('');
  const [serviceSearch, setServiceSearch] = useState('');
  const [saving, setSaving] = useState(false);

  // Групповая запись определяется автоматически по числу выбранных клиентов:
  // 1 = одиночная, 2+ = групповая. Никаких ручных тумблеров.
  const isGroup = selectedClientIds.length > 1;
  void initialGroupMode; // сигнатура сохраняется для обратной совместимости

  useEffect(() => {
    (async () => {
      const supabase = createClient();
      const [clientsRes, servicesRes] = await Promise.all([
        supabase.from('clients').select('id, full_name, no_show_count').eq('master_id', masterId).order('full_name').limit(500),
        supabase
          .from('services')
          .select('id, name, duration_minutes, price, currency, color, total_uses')
          .eq('master_id', masterId)
          .eq('is_active', true)
          .order('total_uses', { ascending: false, nullsFirst: false })
          .order('name'),
      ]);
      if (clientsRes.data) setClients(clientsRes.data as ClientOption[]);
      if (servicesRes.data) setServices(servicesRes.data as ServiceOption[]);
    })();
  }, [masterId]);

  const filteredClients = useMemo(() => {
    const q = clientSearch.trim().toLowerCase();
    if (!q) return clients;
    return clients.filter((c) => c.full_name.toLowerCase().includes(q));
  }, [clients, clientSearch]);

  // Топ-5 услуг по числу использований. При поиске блок «Частые» скрывается,
  // поэтому фильтрация для основного списка (без поиска) исключает quickServices —
  // иначе одна и та же услуга появлялась бы и в чипах, и в карточках.
  const quickServices = useMemo(() => {
    return services.filter((s) => (s.total_uses ?? 0) > 0).slice(0, 5);
  }, [services]);

  const filteredServices = useMemo(() => {
    const q = serviceSearch.trim().toLowerCase();
    if (q) return services.filter((s) => s.name.toLowerCase().includes(q));
    if (quickServices.length === 0) return services;
    const quickIds = new Set(quickServices.map((s) => s.id));
    return services.filter((s) => !quickIds.has(s.id));
  }, [services, serviceSearch, quickServices]);

  function toggleClient(id: string) {
    setSelectedClientIds((prev) => {
      if (prev.includes(id)) return prev.filter((cid) => cid !== id);
      // Авто-групповой режим: разрешаем добавлять любого, кол-во определяет тип записи.
      return [...prev, id];
    });
  }

  const handleSave = useCallback(async () => {
    if (!selectedServiceId) { toast.error('Выберите услугу'); return; }
    if (selectedClientIds.length === 0) { toast.error('Добавьте хотя бы одного клиента'); return; }

    const service = services.find((s) => s.id === selectedServiceId);
    if (!service) { toast.error('Услуга не найдена'); return; }

    if (!date || !time) { toast.error('Укажите дату и время'); return; }
    const startsAt = new Date(`${date}T${time}:00`);
    if (Number.isNaN(startsAt.getTime())) { toast.error('Некорректные дата/время'); return; }
    const endsAt = new Date(startsAt.getTime() + service.duration_minutes * 60 * 1000);

    setSaving(true);
    const supabase = createClient();

    try {
      const { data: masterRow } = await supabase.from('masters').select('salon_id').eq('id', masterId).maybeSingle();
      const masterSalonId = (masterRow as { salon_id: string | null } | null)?.salon_id ?? null;

      const rows = selectedClientIds.map((cid) => ({
        client_id: cid,
        master_id: masterId,
        service_id: selectedServiceId,
        salon_id: masterSalonId,
        starts_at: startsAt.toISOString(),
        ends_at: endsAt.toISOString(),
        price: service.price,
        currency: service.currency,
        notes: notes || null,
        status: 'booked',
        booked_via: 'manual',
        created_by_role: createdByRole,
      }));

      const { error } = await supabase.from('appointments').insert(rows);
      setSaving(false);
      if (error) {
        // Surface friendly message for our overlap trigger
        const msg = error.message || '';
        if (msg.includes('time_slot_taken')) {
          toast.error('Это время уже занято — выбери другое');
        } else if (msg.includes('time_slot_blocked')) {
          toast.error('Это время заблокировано (обед / перерыв)');
        } else {
          toast.error(msg || 'Не удалось создать запись');
        }
        return;
      }
      toast.success(selectedClientIds.length > 1 ? 'Групповая запись создана' : 'Запись создана');
      onSaved();
      onClose();
    } catch (err) {
      setSaving(false);
      toast.error((err as Error).message || 'Ошибка при создании записи');
    }
  }, [selectedServiceId, selectedClientIds, services, date, time, notes, masterId, createdByRole, onSaved, onClose]);

  // Cmd/Ctrl+Enter — submit. Escape — закрытие — обрабатывает родительский CalendarDrawer.
  useEnterSubmit(
    !saving && !!selectedServiceId && selectedClientIds.length > 0,
    handleSave,
    { withModifier: true },
  );

  return (
    <div style={{ fontFamily: FONT, fontFeatureSettings: FONT_FEATURES, color: C.text, display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{ flex: 1, overflowY: 'auto', padding: '24px 24px 32px', display: 'flex', flexDirection: 'column', gap: 22 }}>

        {/* Date + Time row — иконка слева внутри инпута, без подписи сверху
            (Calendar/Clock-иконки самодостаточны, текст «Дата» / «Время» был лишним) */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <IconInput icon={<Calendar size={15} />} C={C}>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              style={{
                width: '100%', height: 44, padding: '0 12px 0 38px',
                borderRadius: 10,
                background: C.surface, border: `0.8px solid ${C.border}`,
                color: C.text, fontSize: 14, outline: 'none', fontFamily: FONT,
              }}
            />
          </IconInput>
          <IconInput icon={<Clock size={15} />} C={C}>
            <input
              type="time"
              value={time}
              onChange={(e) => setTime(e.target.value)}
              step={300}
              style={{
                width: '100%', height: 44, padding: '0 12px 0 38px',
                borderRadius: 10,
                background: C.surface, border: `0.8px solid ${C.border}`,
                color: C.text, fontSize: 14, outline: 'none', fontFamily: FONT,
              }}
            />
          </IconInput>
        </div>

        {/* CLIENTS section. Автогрупповой режим: 2+ клиентов = групповая запись. */}
        <Section
          title={isGroup ? `Клиенты (${selectedClientIds.length})` : 'Клиент'}
          C={C}
        >
          {/* Selected client chips */}
          {selectedClientIds.length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 10 }}>
              {selectedClientIds.map((cid) => {
                const c = clients.find((x) => x.id === cid);
                if (!c) return null;
                return (
                  <span
                    key={cid}
                    style={{
                      display: 'inline-flex', alignItems: 'center', gap: 6,
                      padding: '4px 6px 4px 4px',
                      borderRadius: 999,
                      background: C.surface,
                      border: `0.8px solid ${C.border}`,
                      fontSize: 12,
                    }}
                  >
                    <span style={avatarStyle(cid, 22)}>{clientInitials(c.full_name)}</span>
                    <span style={{ paddingRight: 4 }}>{c.full_name}</span>
                    <button
                      type="button"
                      onClick={() => toggleClient(cid)}
                      style={{
                        background: 'transparent', border: 'none',
                        color: C.textSecondary, cursor: 'pointer',
                        display: 'flex', alignItems: 'center',
                      }}
                      aria-label="Убрать"
                    >
                      <X size={12} />
                    </button>
                  </span>
                );
              })}
            </div>
          )}

          {/* Search */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: 8,
            padding: '8px 10px', borderRadius: 10,
            background: C.surface, border: `0.8px solid ${C.border}`,
            marginBottom: 10,
          }}>
            <Search size={14} style={{ color: C.textSecondary }} />
            <input
              type="text"
              value={clientSearch}
              onChange={(e) => setClientSearch(e.target.value)}
              placeholder="Поиск клиента..."
              style={{
                flex: 1, border: 'none', outline: 'none', background: 'transparent',
                color: C.text, fontSize: 14, fontFamily: FONT,
              }}
            />
          </div>

          {/* Avatar circles grid */}
          <div style={{
            display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(56px, 1fr))',
            gap: 10, maxHeight: 220, overflowY: 'auto', paddingRight: 4,
          }}>
            {filteredClients.map((c) => {
              const isSelected = selectedClientIds.includes(c.id);
              return (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => toggleClient(c.id)}
                  title={c.full_name}
                  style={{
                    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
                    padding: 6, borderRadius: 12,
                    background: isSelected ? C.accentSoft : 'transparent',
                    border: isSelected ? `1px solid ${C.accent}` : '1px solid transparent',
                    cursor: 'pointer', transition: 'all 0.15s',
                  }}
                >
                  <div style={{ ...avatarStyle(c.id, 40), position: 'relative' }}>
                    {clientInitials(c.full_name)}
                    {isSelected && (
                      <span style={{
                        position: 'absolute', bottom: -2, right: -2,
                        width: 16, height: 16, borderRadius: 999,
                        background: C.accent, color: '#fff',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        border: `2px solid ${C.surfaceElevated}`,
                      }}>
                        <Check size={10} />
                      </span>
                    )}
                  </div>
                  <span style={{
                    fontSize: 11, color: C.text, lineHeight: 1.2,
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    maxWidth: 64, textAlign: 'center',
                  }}>
                    {c.full_name.split(' ')[0]}
                  </span>
                </button>
              );
            })}
            {filteredClients.length === 0 && (
              <div style={{
                gridColumn: '1 / -1', textAlign: 'center', padding: 16,
                color: C.textSecondary, fontSize: 13,
              }}>
                Никто не найден
              </div>
            )}
          </div>
        </Section>

        {/* SERVICES section. Поиск + блок «Частые» — мастер не должен скроллить
            простыню из 50 услуг, чтобы найти нужную. */}
        <Section title="Услуга" C={C}>
          {/* Search */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: 8,
            padding: '8px 10px', borderRadius: 10,
            background: C.surface, border: `0.8px solid ${C.border}`,
            marginBottom: 10,
          }}>
            <Search size={14} style={{ color: C.textSecondary }} />
            <input
              type="text"
              value={serviceSearch}
              onChange={(e) => setServiceSearch(e.target.value)}
              placeholder="Поиск услуги..."
              style={{
                flex: 1, border: 'none', outline: 'none', background: 'transparent',
                color: C.text, fontSize: 14, fontFamily: FONT,
              }}
            />
          </div>

          {/* Quick services — топ-5 по использованию, скрываются при поиске */}
          {!serviceSearch.trim() && quickServices.length > 0 && (
            <div style={{ marginBottom: 10 }}>
              <div style={{
                fontSize: 10, fontWeight: 600, color: C.textTertiary,
                textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6,
              }}>
                Частые
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {quickServices.map((s) => {
                  const isSelected = selectedServiceId === s.id;
                  return (
                    <button
                      key={`q-${s.id}`}
                      type="button"
                      onClick={() => setSelectedServiceId(s.id)}
                      style={{
                        display: 'inline-flex', alignItems: 'center', gap: 6,
                        padding: '6px 10px', borderRadius: 999,
                        background: isSelected ? C.accentSoft : C.surface,
                        border: `1px solid ${isSelected ? C.accent : C.border}`,
                        color: C.text, fontSize: 12, cursor: 'pointer',
                        fontFamily: FONT,
                      }}
                    >
                      <span style={{
                        width: 6, height: 6, borderRadius: 999,
                        background: s.color || '#6366f1',
                      }} />
                      {s.name}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {filteredServices.map((s) => {
              const isSelected = selectedServiceId === s.id;
              const stripe = s.color || '#6366f1';
              return (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => setSelectedServiceId(s.id)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 12,
                    padding: '10px 12px',
                    borderRadius: 10,
                    background: isSelected ? C.accentSoft : C.surfaceElevated,
                    border: `1px solid ${isSelected ? C.accent : C.border}`,
                    cursor: 'pointer',
                    textAlign: 'left',
                    transition: 'all 0.15s',
                  }}
                >
                  {/* color stripe */}
                  <span style={{
                    width: 4, alignSelf: 'stretch', borderRadius: 4,
                    background: stripe, flexShrink: 0,
                  }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 14, fontWeight: 500, color: C.text }}>{s.name}</div>
                    <div style={{ fontSize: 12, color: C.textSecondary, marginTop: 2 }}>
                      {s.duration_minutes} мин · {s.price} {s.currency}
                    </div>
                  </div>
                  {isSelected && <Check size={16} style={{ color: C.accent }} />}
                </button>
              );
            })}
            {filteredServices.length === 0 && (
              <div style={{ padding: 16, textAlign: 'center', color: C.textSecondary, fontSize: 13 }}>
                {serviceSearch.trim() ? 'Не нашлось — измени запрос' : 'Нет услуг — добавь их в разделе «Услуги»'}
              </div>
            )}
          </div>
        </Section>

        {/* Notes */}
        <Section title="Заметки (опционально)" C={C}>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Особенности визита, пожелания клиента..."
            rows={3}
            style={{
              width: '100%', resize: 'vertical', minHeight: 60,
              padding: 10, borderRadius: 10,
              background: C.surface, border: `0.8px solid ${C.border}`,
              color: C.text, fontSize: 13, fontFamily: FONT,
              outline: 'none',
            }}
          />
        </Section>
      </div>

      {/* Footer */}
      <div style={{
        padding: '12px 22px',
        borderTop: `0.8px solid ${C.border}`,
        background: C.surfaceElevated,
        display: 'flex', gap: 8, justifyContent: 'flex-end',
      }}>
        <button
          type="button"
          onClick={onClose}
          style={{
            height: 38, padding: '0 18px', borderRadius: 999,
            border: `0.8px solid ${C.borderStrong}`,
            background: 'transparent', color: C.text,
            fontSize: 14, cursor: 'pointer', fontFamily: FONT,
          }}
        >
          Отмена
        </button>
        <button
          type="button"
          onClick={handleSave}
          disabled={saving || !selectedServiceId || selectedClientIds.length === 0}
          style={{
            height: 38, padding: '0 22px', borderRadius: 999,
            border: 'none',
            background: C.accent, color: '#fff',
            fontSize: 14, fontWeight: 500, cursor: 'pointer', fontFamily: FONT,
            opacity: (saving || !selectedServiceId || selectedClientIds.length === 0) ? 0.5 : 1,
          }}
        >
          {saving ? 'Сохранение...' : isGroup ? 'Создать групповую запись' : 'Создать'}
        </button>
      </div>
    </div>
  );
}

function avatarStyle(id: string, size: number): React.CSSProperties {
  return {
    width: size, height: size, borderRadius: 999,
    background: avatarColor(id),
    color: '#fff',
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
    fontWeight: 600, fontSize: Math.round(size * 0.4),
    flexShrink: 0,
  };
}

function Section({
  title, right, children, C,
}: {
  title: string;
  right?: React.ReactNode;
  children: React.ReactNode;
  C: ReturnType<typeof usePageTheme>['C'];
}) {
  return (
    <div>
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        marginBottom: 8,
      }}>
        <h3 style={{
          fontSize: 11, fontWeight: 600, color: C.textSecondary,
          textTransform: 'uppercase', letterSpacing: 0.5, margin: 0,
        }}>{title}</h3>
        {right}
      </div>
      {children}
    </div>
  );
}

/** Input wrapper с иконкой слева внутри поля. Заменяет старый Field+label —
    календарь/часы-иконки самодостаточны, дублирующая подпись «Дата» / «Время»
    больше не нужна. */
function IconInput({
  icon, children, C,
}: {
  icon: React.ReactNode;
  children: React.ReactNode;
  C: ReturnType<typeof usePageTheme>['C'];
}) {
  return (
    <div style={{ position: 'relative' }}>
      <span style={{
        position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)',
        color: C.textSecondary, pointerEvents: 'none',
        display: 'flex', alignItems: 'center',
      }}>
        {icon}
      </span>
      {children}
    </div>
  );
}
