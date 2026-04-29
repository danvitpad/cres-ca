/** --- YAML
 * name: WaitlistDrawer
 * description: Fresha-style waitlist drawer — tabs (Open/Expired/Booked) + add button + empty state
 * --- */

'use client';

import { useState } from 'react';
import { Plus, MoreHorizontal, Clock, CalendarCheck, AlertCircle } from 'lucide-react';

type WaitlistDrawerProps = {
  theme: 'light' | 'dark';
};

const LIGHT = {
  text: '#000000',
  textMuted: '#737373',
  border: '#e5e5e5',
  tabActive: '#000000',
  tabInactive: '#737373',
  tabIndicator: '#000000',
  bgSubtle: '#f9f9f9',
  accent: 'var(--color-accent)',
  btnBg: '#000000',
  btnText: '#ffffff',
};

const DARK = {
  text: '#e5e5e5',
  textMuted: '#8a8a8a',
  border: '#1a1a1a',
  tabActive: '#e5e5e5',
  tabInactive: '#8a8a8a',
  tabIndicator: '#e5e5e5',
  bgSubtle: '#000000',
  accent: '#2dd4bf',
  btnBg: 'var(--color-accent)',
  btnText: '#ffffff',
};

type Tab = 'open' | 'expired' | 'booked';

export function WaitlistDrawerContent({ theme }: WaitlistDrawerProps) {
  const C = theme === 'dark' ? DARK : LIGHT;
  const [activeTab, setActiveTab] = useState<Tab>('open');

  const tabs: { key: Tab; label: string }[] = [
    { key: 'open', label: 'Открытые' },
    { key: 'expired', label: 'Срок истек' },
    { key: 'booked', label: 'Забронировано' },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Top controls */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', borderBottom: `0.8px solid ${C.border}` }}>
        <button
          type="button"
          style={{
            height: 32,
            padding: '0 12px',
            borderRadius: 999,
            border: 'none',
            backgroundColor: C.btnBg,
            color: C.btnText,
            fontSize: 13,
            fontWeight: 500,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: 6,
          }}
        >
          <Plus style={{ width: 14, height: 14 }} />
          Добавить
        </button>
        <button
          type="button"
          style={{
            width: 32,
            height: 32,
            borderRadius: 8,
            border: 'none',
            backgroundColor: 'transparent',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: C.text,
          }}
        >
          <MoreHorizontal style={{ width: 18, height: 18 }} />
        </button>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', borderBottom: `0.8px solid ${C.border}` }}>
        {tabs.map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => setActiveTab(tab.key)}
            style={{
              flex: 1,
              padding: '12px 0',
              fontSize: 13,
              fontWeight: activeTab === tab.key ? 600 : 400,
              color: activeTab === tab.key ? C.tabActive : C.tabInactive,
              backgroundColor: 'transparent',
              border: 'none',
              borderBottom: activeTab === tab.key ? `2px solid ${C.tabIndicator}` : '2px solid transparent',
              cursor: 'pointer',
              transition: 'all 150ms',
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Empty state */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '48px 24px', textAlign: 'center' }}>
        {activeTab === 'open' && (
          <>
            <Clock style={{ width: 48, height: 48, color: C.textMuted, opacity: 0.4, marginBottom: 16 }} />
            <div style={{ fontSize: 15, fontWeight: 500, color: C.text, marginBottom: 4 }}>
              Нет открытых записей в листе ожидания
            </div>
            <div style={{ fontSize: 13, color: C.textMuted }}>
              Клиенты смогут записаться в лист ожидания, если свободных слотов нет
            </div>
          </>
        )}
        {activeTab === 'expired' && (
          <>
            <AlertCircle style={{ width: 48, height: 48, color: C.textMuted, opacity: 0.4, marginBottom: 16 }} />
            <div style={{ fontSize: 15, fontWeight: 500, color: C.text, marginBottom: 4 }}>
              Нет истекших записей
            </div>
            <div style={{ fontSize: 13, color: C.textMuted }}>
              Записи из листа ожидания, у которых истек срок, появятся здесь
            </div>
          </>
        )}
        {activeTab === 'booked' && (
          <>
            <CalendarCheck style={{ width: 48, height: 48, color: C.textMuted, opacity: 0.4, marginBottom: 16 }} />
            <div style={{ fontSize: 15, fontWeight: 500, color: C.text, marginBottom: 4 }}>
              Нет забронированных из листа ожидания
            </div>
            <div style={{ fontSize: 13, color: C.textMuted }}>
              Клиенты, забронировавшие из листа ожидания, появятся здесь
            </div>
          </>
        )}
      </div>
    </div>
  );
}
