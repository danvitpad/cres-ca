/** --- YAML
 * name: ClientDetailDrawer
 * description: Fresha-style client detail drawer — avatar, info, nav tabs, overview/appointments/sales/data sections
 * --- */

'use client';

import { useState, useEffect } from 'react';
import { X, Phone, Mail, Calendar, Star, CreditCard, AlertTriangle, Clock } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { createClient } from '@/lib/supabase/client';
import { format } from 'date-fns';
import { FONT } from '@/lib/dashboard-theme';

const LIGHT = {
  bg: '#ffffff',
  text: '#000000',
  textMuted: '#737373',
  border: '#e5e5e5',
  accent: '#0d9488',
  accentSoft: '#f0eefe',
  success: '#22c55e',
  danger: '#d4163a',
  cardBg: '#f9f9f9',
  avatarBg: '#a5dff8',
  avatarText: '#000000',
  overlay: 'rgba(0,0,0,0.3)',
  tabActive: '#000000',
  tabInactive: '#a3a3a3',
  btnBg: '#000000',
  btnText: '#ffffff',
};

const DARK = {
  bg: '#000000',
  text: '#e5e5e5',
  textMuted: '#8a8a8a',
  border: '#1a1a1a',
  accent: '#2dd4bf',
  accentSoft: '#2a2545',
  success: '#22c55e',
  danger: '#ef4444',
  cardBg: '#000000',
  avatarBg: '#1e3a5f',
  avatarText: '#a5dff8',
  overlay: 'rgba(0,0,0,0.6)',
  tabActive: '#e5e5e5',
  tabInactive: '#555555',
  btnBg: '#0d9488',
  btnText: '#ffffff',
};

interface ClientData {
  id: string;
  full_name: string;
  phone: string | null;
  email: string | null;
  total_visits: number;
  avg_check: number;
  total_spent: number;
  last_visit_at: string | null;
  rating: number;
  has_health_alert: boolean;
  notes: string | null;
  date_of_birth: string | null;
  allergies: string[];
  cancellation_count: number;
  no_show_count: number;
}

interface AppointmentRow {
  id: string;
  starts_at: string;
  ends_at: string;
  status: string;
  price: number;
  service: { name: string; color: string } | null;
}

const TABS = [
  { key: 'overview', label: 'Обзор' },
  { key: 'appointments', label: 'Записи' },
  { key: 'sales', label: 'Продажи' },
  { key: 'data', label: 'Данные клиента' },
] as const;

function getInitials(name: string) {
  return name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);
}

interface ClientDetailDrawerProps {
  clientId: string | null;
  open: boolean;
  onClose: () => void;
  theme?: 'light' | 'dark';
}

export function ClientDetailDrawer({ clientId, open, onClose, theme = 'light' }: ClientDetailDrawerProps) {
  const C = theme === 'dark' ? DARK : LIGHT;
  const [client, setClient] = useState<ClientData | null>(null);
  const [appointments, setAppointments] = useState<AppointmentRow[]>([]);
  const [activeTab, setActiveTab] = useState<string>('overview');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!clientId || !open) return;
    setLoading(true);
    setActiveTab('overview');

    async function load() {
      const supabase = createClient();

      const { data: c } = await supabase
        .from('clients')
        .select('id, full_name, phone, email, total_visits, avg_check, total_spent, last_visit_at, rating, has_health_alert, notes, date_of_birth, allergies, cancellation_count, no_show_count')
        .eq('id', clientId!)
        .single();

      if (c) setClient(c as ClientData);

      const { data: appts } = await supabase
        .from('appointments')
        .select('id, starts_at, ends_at, status, price, service:services(name, color)')
        .eq('client_id', clientId!)
        .order('starts_at', { ascending: false })
        .limit(20);

      setAppointments((appts as unknown as AppointmentRow[]) || []);
      setLoading(false);
    }
    load();
  }, [clientId, open]);

  const totalSales = appointments
    .filter(a => a.status === 'completed')
    .reduce((sum, a) => sum + (a.price || 0), 0);

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            style={{ position: 'fixed', inset: 0, backgroundColor: C.overlay, zIndex: 90 }}
          />
          <motion.div
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', stiffness: 400, damping: 35 }}
            style={{
              position: 'fixed',
              top: 0,
              right: 0,
              bottom: 0,
              width: 480,
              maxWidth: '100vw',
              backgroundColor: C.bg,
              zIndex: 91,
              display: 'flex',
              flexDirection: 'column',
              fontFamily: FONT,
              boxShadow: '-4px 0 24px rgba(0,0,0,0.12)',
            }}
          >
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px', borderBottom: `1px solid ${C.border}` }}>
              <span style={{ fontSize: 16, fontWeight: 700, color: C.text }}>Карточка клиента</span>
              <button onClick={onClose} style={{ width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 8, border: 'none', backgroundColor: 'transparent', cursor: 'pointer', color: C.text }}>
                <X style={{ width: 18, height: 18 }} />
              </button>
            </div>

            {loading || !client ? (
              <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <div style={{ width: 32, height: 32, border: `3px solid ${C.border}`, borderTopColor: C.accent, borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
              </div>
            ) : (
              <>
                {/* Client info header */}
                <div style={{ padding: '20px', display: 'flex', alignItems: 'center', gap: 16, borderBottom: `1px solid ${C.border}` }}>
                  <div style={{
                    width: 56, height: 56, borderRadius: '50%',
                    backgroundColor: C.avatarBg, color: C.avatarText,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 18, fontWeight: 700, flexShrink: 0,
                  }}>
                    {getInitials(client.full_name)}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 18, fontWeight: 700, color: C.text }}>{client.full_name}</div>
                    <div style={{ display: 'flex', gap: 12, marginTop: 4 }}>
                      {client.phone && (
                        <span style={{ fontSize: 13, color: C.textMuted, display: 'flex', alignItems: 'center', gap: 4 }}>
                          <Phone style={{ width: 12, height: 12 }} /> {client.phone}
                        </span>
                      )}
                      {client.email && (
                        <span style={{ fontSize: 13, color: C.textMuted, display: 'flex', alignItems: 'center', gap: 4 }}>
                          <Mail style={{ width: 12, height: 12 }} /> {client.email}
                        </span>
                      )}
                    </div>
                    {client.has_health_alert && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 6, color: C.danger, fontSize: 12, fontWeight: 600 }}>
                        <AlertTriangle style={{ width: 14, height: 14 }} /> Есть предупреждения о здоровье
                      </div>
                    )}
                  </div>
                </div>

                {/* Tabs */}
                <div style={{ display: 'flex', borderBottom: `1px solid ${C.border}`, padding: '0 20px' }}>
                  {TABS.map(tab => (
                    <button
                      key={tab.key}
                      onClick={() => setActiveTab(tab.key)}
                      style={{
                        padding: '12px 16px',
                        fontSize: 13,
                        fontWeight: activeTab === tab.key ? 700 : 500,
                        color: activeTab === tab.key ? C.tabActive : C.tabInactive,
                        border: 'none',
                        borderBottom: activeTab === tab.key ? `2px solid ${C.accent}` : '2px solid transparent',
                        backgroundColor: 'transparent',
                        cursor: 'pointer',
                        fontFamily: FONT,
                        marginBottom: -1,
                      }}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>

                {/* Tab content */}
                <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px' }}>
                  {activeTab === 'overview' && (
                    <div>
                      {/* Summary cards */}
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, marginBottom: 20 }}>
                        <StatCard C={C} icon={<CreditCard style={{ width: 16, height: 16 }} />} label="Всего продаж" value={`${totalSales} ₴`} />
                        <StatCard C={C} icon={<Calendar style={{ width: 16, height: 16 }} />} label="Записи" value={String(client.total_visits)} />
                        <StatCard C={C} icon={<Star style={{ width: 16, height: 16 }} />} label="Оценка" value={client.rating > 0 ? client.rating.toFixed(1) : '—'} />
                      </div>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 20 }}>
                        <StatCard C={C} icon={<X style={{ width: 16, height: 16, color: C.danger }} />} label="Отменено" value={String(client.cancellation_count)} />
                        <StatCard C={C} icon={<Clock style={{ width: 16, height: 16, color: C.danger }} />} label="Неявка" value={String(client.no_show_count)} />
                      </div>

                      {/* Recent appointments */}
                      <div style={{ fontSize: 14, fontWeight: 600, color: C.text, marginBottom: 10 }}>Последние записи</div>
                      {appointments.length === 0 ? (
                        <div style={{ fontSize: 13, color: C.textMuted, padding: '20px 0', textAlign: 'center' }}>Нет записей</div>
                      ) : (
                        appointments.slice(0, 5).map(appt => (
                          <ApptRow key={appt.id} appt={appt} C={C} />
                        ))
                      )}
                    </div>
                  )}

                  {activeTab === 'appointments' && (
                    <div>
                      {appointments.length === 0 ? (
                        <div style={{ fontSize: 13, color: C.textMuted, padding: '40px 0', textAlign: 'center' }}>Нет записей</div>
                      ) : (
                        appointments.map(appt => (
                          <ApptRow key={appt.id} appt={appt} C={C} />
                        ))
                      )}
                    </div>
                  )}

                  {activeTab === 'sales' && (
                    <div>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 20 }}>
                        <StatCard C={C} icon={<CreditCard style={{ width: 16, height: 16 }} />} label="Всего потрачено" value={`${client.total_spent} ₴`} />
                        <StatCard C={C} icon={<CreditCard style={{ width: 16, height: 16 }} />} label="Средний чек" value={`${client.avg_check} ₴`} />
                      </div>

                      <div style={{ fontSize: 14, fontWeight: 600, color: C.text, marginBottom: 10 }}>Оплаченные записи</div>
                      {appointments.filter(a => a.status === 'completed').length === 0 ? (
                        <div style={{ fontSize: 13, color: C.textMuted, padding: '20px 0', textAlign: 'center' }}>Нет оплаченных записей</div>
                      ) : (
                        appointments.filter(a => a.status === 'completed').map(appt => (
                          <ApptRow key={appt.id} appt={appt} C={C} showPrice />
                        ))
                      )}
                    </div>
                  )}

                  {activeTab === 'data' && (
                    <div>
                      <DataRow C={C} label="Телефон" value={client.phone || '—'} />
                      <DataRow C={C} label="Email" value={client.email || '—'} />
                      <DataRow C={C} label="Дата рождения" value={client.date_of_birth ? format(new Date(client.date_of_birth), 'dd.MM.yyyy') : '—'} />
                      <DataRow C={C} label="Последний визит" value={client.last_visit_at ? format(new Date(client.last_visit_at), 'dd.MM.yyyy') : '—'} />

                      {client.allergies && client.allergies.length > 0 && (
                        <div style={{ marginTop: 16 }}>
                          <div style={{ fontSize: 13, fontWeight: 600, color: C.text, marginBottom: 8 }}>Аллергии</div>
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                            {client.allergies.map((a, i) => (
                              <span key={i} style={{
                                padding: '4px 10px', borderRadius: 999, fontSize: 12, fontWeight: 500,
                                backgroundColor: C.accentSoft, color: C.accent,
                              }}>
                                {a}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}

                      {client.notes && (
                        <div style={{ marginTop: 16 }}>
                          <div style={{ fontSize: 13, fontWeight: 600, color: C.text, marginBottom: 8 }}>Заметки</div>
                          <div style={{ fontSize: 13, color: C.textMuted, lineHeight: 1.5 }}>{client.notes}</div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </>
            )}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

function StatCard({ C, icon, label, value }: { C: typeof LIGHT; icon: React.ReactNode; label: string; value: string }) {
  return (
    <div style={{ padding: 12, borderRadius: 10, backgroundColor: C.cardBg, border: `1px solid ${C.border}` }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
        <span style={{ color: C.accent }}>{icon}</span>
        <span style={{ fontSize: 11, color: C.textMuted }}>{label}</span>
      </div>
      <div style={{ fontSize: 18, fontWeight: 700, color: C.text }}>{value}</div>
    </div>
  );
}

function ApptRow({ appt, C, showPrice }: { appt: AppointmentRow; C: typeof LIGHT; showPrice?: boolean }) {
  const date = new Date(appt.starts_at);
  const statusColors: Record<string, string> = {
    booked: C.accent,
    confirmed: '#0ea5e9',
    in_progress: '#f59e0b',
    completed: C.success,
    cancelled: C.danger,
    no_show: C.danger,
  };

  const statusLabels: Record<string, string> = {
    booked: 'Забронировано',
    confirmed: 'Подтверждено',
    in_progress: 'В процессе',
    completed: 'Завершено',
    cancelled: 'Отменено',
    no_show: 'Неявка',
  };

  return (
    <div style={{
      display: 'flex', alignItems: 'center', padding: '10px 0',
      borderBottom: `1px solid ${C.border}`, gap: 12,
    }}>
      <div style={{
        width: 4, height: 36, borderRadius: 2,
        backgroundColor: (appt.service as { color?: string } | null)?.color || C.accent,
        flexShrink: 0,
      }} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: C.text }}>{appt.service?.name || '—'}</div>
        <div style={{ fontSize: 12, color: C.textMuted, marginTop: 2 }}>
          {format(date, 'dd.MM.yyyy HH:mm')}
        </div>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
        {showPrice && <span style={{ fontSize: 13, fontWeight: 600, color: C.text }}>{appt.price} ₴</span>}
        <span style={{
          fontSize: 11, fontWeight: 600, padding: '3px 8px', borderRadius: 999,
          color: statusColors[appt.status] || C.textMuted,
          backgroundColor: `${statusColors[appt.status] || C.textMuted}15`,
        }}>
          {statusLabels[appt.status] || appt.status}
        </span>
      </div>
    </div>
  );
}

function DataRow({ C, label, value }: { C: typeof LIGHT; label: string; value: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0', borderBottom: `1px solid ${C.border}` }}>
      <span style={{ fontSize: 13, color: C.textMuted }}>{label}</span>
      <span style={{ fontSize: 13, fontWeight: 500, color: C.text }}>{value}</span>
    </div>
  );
}
