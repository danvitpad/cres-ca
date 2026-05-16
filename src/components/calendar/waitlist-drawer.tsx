/** --- YAML
 * name: WaitlistDrawer
 * description: Список очікування мастера — завантажує реальні записи з waitlist, показує статистику, картки клієнтів, bottom-sheet для деталей та додавання
 * created: 2026-04-13
 * updated: 2026-05-16
 * --- */

'use client';

import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Plus, Clock, CalendarDays, Coins, Phone, X } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { useMaster } from '@/hooks/use-master';
import { humanizeError } from '@/lib/format/error';

interface WaitEntry {
  id: string;
  client_name: string;
  client_phone?: string | null;
  service_name?: string | null;
  service_duration?: number | null;
  service_price?: number | null;
  preferred_time_window: string;
  status: string;
  expires_at: string;
  created_at: string;
}

const TIME_LABEL: Record<string, string> = {
  any: 'будь-який час',
  morning: 'вранці',
  afternoon: 'вдень',
  evening: 'вечір',
};

const AVATAR_COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899', '#06b6d4', '#ef4444'];

function initials(name: string) {
  return name.split(' ').slice(0, 2).map((w) => w[0] ?? '').join('').toUpperCase();
}

function avatarColor(name: string) {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) % AVATAR_COLORS.length;
  return AVATAR_COLORS[h];
}

type WaitlistDrawerProps = {
  theme: 'light' | 'dark';
};

export function WaitlistDrawerContent({ theme }: WaitlistDrawerProps) {
  const supabase = createClient();
  const { master } = useMaster();
  const [entries, setEntries] = useState<WaitEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<WaitEntry | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [form, setForm] = useState({ client: '', service: '', dateFrom: '', dateTo: '', time: '' });
  const [saving, setSaving] = useState(false);

  const accent = '#2563eb';
  const bg = theme === 'dark' ? '#0f172a' : '#ffffff';
  const surface = theme === 'dark' ? '#1e293b' : '#f8fafc';
  const border = theme === 'dark' ? '#1e293b' : '#f1f5f9';
  const text = theme === 'dark' ? '#f1f5f9' : '#0f172a';
  const muted = theme === 'dark' ? '#94a3b8' : '#64748b';

  const load = useCallback(async () => {
    if (!master?.id) return;
    setLoading(true);
    const { data, error } = await supabase
      .from('waitlist')
      .select(`
        id, preferred_time_window, status, expires_at, created_at,
        profiles:client_profile_id ( full_name, phone ),
        services:service_id ( name, duration_minutes, price )
      `)
      .eq('master_id', master.id)
      .in('status', ['waiting', 'matched'])
      .order('created_at', { ascending: true });

    if (error) { toast.error(humanizeError(error)); }
    else {
      setEntries(
        (data ?? []).map((row: Record<string, unknown>) => {
          const p = row.profiles as Record<string, unknown> | null;
          const s = row.services as Record<string, unknown> | null;
          return {
            id: row.id as string,
            client_name: (p?.full_name as string | null) ?? 'Клієнт',
            client_phone: p?.phone as string | null,
            service_name: s?.name as string | null,
            service_duration: s?.duration_minutes as number | null,
            service_price: s?.price as number | null,
            preferred_time_window: row.preferred_time_window as string,
            status: row.status as string,
            expires_at: row.expires_at as string,
            created_at: row.created_at as string,
          };
        })
      );
    }
    setLoading(false);
  }, [supabase, master?.id]);

  useEffect(() => { load(); }, [load]);

  async function removeEntry(id: string) {
    await supabase.from('waitlist').delete().eq('id', id);
    setEntries((prev) => prev.filter((e) => e.id !== id));
    setSelected(null);
    toast.success('Видалено зі списку');
  }

  async function addEntry() {
    if (!master?.id || !form.client.trim()) return;
    setSaving(true);
    const { error } = await supabase.from('waitlist').insert({
      master_id: master.id,
      client_profile_id: master.profile_id,
      preferred_time_window: form.time || 'any',
      expires_at: form.dateTo ? new Date(form.dateTo).toISOString() : new Date(Date.now() + 30 * 864e5).toISOString(),
    });
    setSaving(false);
    if (error) { toast.error(humanizeError(error)); return; }
    toast.success('Додано до черги');
    setAddOpen(false);
    setForm({ client: '', service: '', dateFrom: '', dateTo: '', time: '' });
    load();
  }

  const waiting = entries.filter((e) => e.status === 'waiting');
  const potentialRevenue = entries.reduce((sum, e) => sum + (e.service_price ?? 0), 0);

  const inputStyle: React.CSSProperties = {
    width: '100%',
    padding: '10px 12px',
    borderRadius: 10,
    border: `1px solid ${border}`,
    background: surface,
    color: text,
    fontSize: 14,
    outline: 'none',
    boxSizing: 'border-box',
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: bg, color: text }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', borderBottom: `1px solid ${border}` }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: text }}>Список очікування</div>
        <button
          type="button"
          onClick={() => setAddOpen(true)}
          style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '6px 12px', borderRadius: 8, border: 'none', background: accent, color: '#fff', fontSize: 12, fontWeight: 500, cursor: 'pointer' }}
        >
          <Plus style={{ width: 13, height: 13 }} />
          Додати
        </button>
      </div>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 1, background: border }}>
        {[
          { label: 'Очікують', value: String(waiting.length), color: text },
          { label: 'Вільні слоти', value: '—', color: '#10b981' },
          { label: 'Потенційно', value: potentialRevenue > 0 ? `₴${potentialRevenue.toLocaleString()}` : '—', color: text },
        ].map((s) => (
          <div key={s.label} style={{ background: bg, padding: '10px 8px', textAlign: 'center' }}>
            <div style={{ fontSize: 16, fontWeight: 700, color: s.color }}>{s.value}</div>
            <div style={{ fontSize: 10, color: muted, marginTop: 1 }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* List */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '8px 0' }}>
        {loading && (
          <div style={{ padding: 24, textAlign: 'center', fontSize: 13, color: muted }}>Завантаження…</div>
        )}
        {!loading && entries.length === 0 && (
          <div style={{ padding: '32px 24px', textAlign: 'center' }}>
            <Clock style={{ width: 40, height: 40, color: muted, opacity: 0.4, marginBottom: 12 }} />
            <div style={{ fontSize: 14, fontWeight: 500, color: text }}>Черга порожня</div>
            <div style={{ fontSize: 12, color: muted, marginTop: 4 }}>Клієнти з'являться тут, коли запишуться в очікування</div>
          </div>
        )}
        {entries.map((entry, idx) => {
          const color = avatarColor(entry.client_name);
          return (
            <button
              key={entry.id}
              type="button"
              onClick={() => setSelected(entry)}
              style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', background: 'transparent', border: 'none', cursor: 'pointer', textAlign: 'left', borderBottom: `1px solid ${border}` }}
            >
              <div style={{ flexShrink: 0, width: 28, height: 28, borderRadius: '50%', background: `${accent}18`, color: accent, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 700 }}>
                {idx + 1}
              </div>
              <div style={{ width: 36, height: 36, borderRadius: '50%', background: color, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 600, flexShrink: 0 }}>
                {initials(entry.client_name)}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{entry.client_name}</div>
                <div style={{ fontSize: 11, color: muted }}>{entry.service_name ?? 'Послуга не вказана'}</div>
              </div>
              <div style={{ textAlign: 'right', flexShrink: 0 }}>
                <div style={{ fontSize: 11, color: muted }}>{TIME_LABEL[entry.preferred_time_window] ?? entry.preferred_time_window}</div>
              </div>
            </button>
          );
        })}
      </div>

      {/* Detail sheet */}
      {selected && (
        <div
          style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 50, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end' }}
          onClick={() => setSelected(null)}
        >
          <div
            style={{ background: bg, borderRadius: '16px 16px 0 0', padding: '16px 20px 32px' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ width: 36, height: 4, borderRadius: 2, background: border, margin: '0 auto 16px' }} />
            <div style={{ fontSize: 17, fontWeight: 700, color: text, marginBottom: 6 }}>{selected.client_name}</div>
            <div style={{ display: 'flex', gap: 6, marginBottom: 16 }}>
              <span style={{ padding: '2px 8px', borderRadius: 6, background: `${accent}15`, color: accent, fontSize: 11, fontWeight: 500 }}>#{entries.indexOf(selected) + 1} в черзі</span>
              {selected.service_name && <span style={{ padding: '2px 8px', borderRadius: 6, background: surface, color: muted, fontSize: 11 }}>{selected.service_name}</span>}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 20 }}>
              {[
                { icon: Clock, label: 'Зручний час', value: TIME_LABEL[selected.preferred_time_window] ?? selected.preferred_time_window },
                ...(selected.service_duration ? [{ icon: CalendarDays, label: 'Тривалість', value: `${selected.service_duration} хв` }] : []),
                ...(selected.service_price ? [{ icon: Coins, label: 'Вартість', value: `₴${selected.service_price}` }] : []),
                ...(selected.client_phone ? [{ icon: Phone, label: 'Телефон', value: selected.client_phone }] : []),
              ].map(({ icon: Icon, label, value }) => (
                <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{ width: 32, height: 32, borderRadius: 8, background: `${accent}15`, color: accent, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <Icon style={{ width: 14, height: 14 }} />
                  </div>
                  <div>
                    <div style={{ fontSize: 11, color: muted }}>{label}</div>
                    <div style={{ fontSize: 13, fontWeight: 500, color: text }}>{value}</div>
                  </div>
                </div>
              ))}
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button
                type="button"
                onClick={() => removeEntry(selected.id)}
                style={{ flex: 1, padding: '10px 0', borderRadius: 10, border: `1px solid ${border}`, background: 'transparent', color: '#ef4444', fontSize: 13, fontWeight: 500, cursor: 'pointer' }}
              >
                Видалити
              </button>
              <button
                type="button"
                style={{ flex: 2, padding: '10px 0', borderRadius: 10, border: 'none', background: accent, color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}
              >
                <CalendarDays style={{ width: 14, height: 14 }} />
                Записати
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add sheet */}
      {addOpen && (
        <div
          style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 50, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end' }}
          onClick={() => setAddOpen(false)}
        >
          <div
            style={{ background: bg, borderRadius: '16px 16px 0 0', padding: '16px 20px 32px' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
              <div style={{ fontSize: 16, fontWeight: 700, color: text }}>Додати до черги</div>
              <button type="button" onClick={() => setAddOpen(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: muted }}>
                <X style={{ width: 18, height: 18 }} />
              </button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <input style={inputStyle} placeholder="Ім'я або номер клієнта" value={form.client} onChange={(e) => setForm({ ...form, client: e.target.value })} />
              <input style={inputStyle} placeholder="Послуга" value={form.service} onChange={(e) => setForm({ ...form, service: e.target.value })} />
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                <input style={inputStyle} type="date" placeholder="Дата від" value={form.dateFrom} onChange={(e) => setForm({ ...form, dateFrom: e.target.value })} />
                <input style={inputStyle} type="date" placeholder="Дата до" value={form.dateTo} onChange={(e) => setForm({ ...form, dateTo: e.target.value })} />
              </div>
              <select style={inputStyle} value={form.time} onChange={(e) => setForm({ ...form, time: e.target.value })}>
                <option value="">Зручний час</option>
                <option value="any">Будь-який</option>
                <option value="morning">Ранок</option>
                <option value="afternoon">День</option>
                <option value="evening">Вечір</option>
              </select>
            </div>
            <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
              <button type="button" onClick={() => setAddOpen(false)} style={{ flex: 1, padding: '10px 0', borderRadius: 10, border: `1px solid ${border}`, background: 'transparent', color: muted, fontSize: 13, cursor: 'pointer' }}>
                Скасувати
              </button>
              <button type="button" onClick={addEntry} disabled={saving || !form.client.trim()} style={{ flex: 2, padding: '10px 0', borderRadius: 10, border: 'none', background: accent, color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer', opacity: saving ? 0.7 : 1 }}>
                {saving ? 'Збереження…' : 'Додати'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
