/** --- YAML
 * name: MasterTasksList
 * description: Mini App master "My Tasks" — minute-precision todo list. Tabs:
 *              Активные / История. Each pending task shows title, when it'll
 *              fire, optional description. Tap to mark done. Plus floating +
 *              CTA to create a new task.
 * created: 2026-05-01
 * --- */

'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, Check, Trash2, Bell, Clock3, ListTodo, CheckCircle2 } from 'lucide-react';
import { T, R, TYPE, SPRING, FONT_BASE } from '@/components/miniapp/design';
import { useTelegram } from '@/components/miniapp/telegram-provider';

interface Task {
  id: string;
  title: string;
  description: string | null;
  remind_at: string;
  status: 'pending' | 'fired' | 'completed' | 'cancelled';
  fired_at: string | null;
  channels: string[];
}

type Tab = 'active' | 'history';

function formatRemindAt(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const diffMs = d.getTime() - now.getTime();
  const diffMin = Math.round(diffMs / 60000);
  if (diffMin < -60 * 24) {
    return d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' });
  }
  if (diffMin < -60) return `${Math.abs(Math.round(diffMin / 60))} ч назад`;
  if (diffMin < 0) return `${Math.abs(diffMin)} мин назад`;
  if (diffMin === 0) return 'сейчас';
  if (diffMin < 60) return `через ${diffMin} мин`;
  if (diffMin < 60 * 24) return `через ${Math.round(diffMin / 60)} ч`;
  // Same week — show weekday and time
  const day = d.toLocaleDateString('ru-RU', { weekday: 'short', day: 'numeric', month: 'short' });
  const time = d.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
  return `${day} в ${time}`;
}

export default function MasterTasksPage() {
  const { haptic } = useTelegram();
  const [tab, setTab] = useState<Tab>('active');
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchTasks = useCallback(async () => {
    setLoading(true);
    const status = tab === 'active' ? 'pending' : 'all';
    const res = await fetch(`/api/tasks?status=${status}`);
    if (res.ok) {
      const json = await res.json();
      let list = (json.tasks ?? []) as Task[];
      if (tab === 'history') {
        list = list.filter((t) => t.status !== 'pending');
      }
      setTasks(list);
    }
    setLoading(false);
  }, [tab]);

  useEffect(() => { void fetchTasks(); }, [fetchTasks]);

  const markDone = async (id: string) => {
    haptic('medium');
    await fetch(`/api/tasks/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'completed' }),
    });
    void fetchTasks();
  };

  const remove = async (id: string) => {
    haptic('medium');
    await fetch(`/api/tasks/${id}`, { method: 'DELETE' });
    void fetchTasks();
  };

  return (
    <div style={{ ...FONT_BASE, padding: '20px 16px 100px', minHeight: '100dvh' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <h1 style={{ ...TYPE.h1, color: T.text, margin: 0 }}>Задачи</h1>
        <Link
          href="/telegram/m/tasks/new"
          onClick={() => haptic('light')}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            padding: '10px 16px',
            background: T.accent,
            color: T.accentText,
            borderRadius: R.pill,
            fontSize: 14,
            fontWeight: 600,
            textDecoration: 'none',
          }}
        >
          <Plus size={16} />
          Новая
        </Link>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 4, padding: 4, background: T.surfaceElevated, borderRadius: R.pill, marginBottom: 20 }}>
        {(['active', 'history'] as Tab[]).map((k) => (
          <button
            key={k}
            type="button"
            onClick={() => { setTab(k); haptic('light'); }}
            style={{
              flex: 1,
              padding: '8px 12px',
              borderRadius: R.pill,
              background: tab === k ? T.surface : 'transparent',
              color: tab === k ? T.text : T.textSecondary,
              fontSize: 13,
              fontWeight: 600,
              border: 'none',
              cursor: 'pointer',
              boxShadow: tab === k ? '0 1px 3px rgba(0,0,0,0.06)' : 'none',
              transition: 'all 0.15s ease',
            }}
          >
            {k === 'active' ? 'Активные' : 'История'}
          </button>
        ))}
      </div>

      {loading ? (
        <div style={{ ...TYPE.caption, color: T.textTertiary, textAlign: 'center', paddingTop: 60 }}>
          Загружаю…
        </div>
      ) : tasks.length === 0 ? (
        <EmptyState tab={tab} />
      ) : (
        <ul style={{ display: 'flex', flexDirection: 'column', gap: 10, listStyle: 'none', margin: 0, padding: 0 }}>
          <AnimatePresence mode="popLayout">
            {tasks.map((t) => (
              <motion.li
                key={t.id}
                layout
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.98 }}
                transition={SPRING.default}
                style={{
                  background: T.surface,
                  border: `1px solid ${T.border}`,
                  borderRadius: R.lg,
                  padding: '14px 16px',
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: 12,
                }}
              >
                <button
                  type="button"
                  onClick={() => markDone(t.id)}
                  disabled={t.status !== 'pending' && t.status !== 'fired'}
                  aria-label="Отметить выполненной"
                  style={{
                    flexShrink: 0,
                    width: 24,
                    height: 24,
                    borderRadius: 12,
                    border: t.status === 'completed'
                      ? `2px solid ${T.accent}`
                      : `2px solid ${T.borderSubtle}`,
                    background: t.status === 'completed' ? T.accent : 'transparent',
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: t.status === 'completed' ? 'default' : 'pointer',
                    marginTop: 2,
                  }}
                >
                  {t.status === 'completed' && <Check size={14} color="#fff" strokeWidth={3} />}
                </button>

                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{
                    ...TYPE.bodyStrong,
                    color: t.status === 'completed' ? T.textTertiary : T.text,
                    textDecoration: t.status === 'completed' ? 'line-through' : 'none',
                    margin: 0,
                  }}>
                    {t.title}
                  </p>
                  {t.description && (
                    <p style={{ ...TYPE.caption, color: T.textSecondary, margin: '4px 0 0' }}>
                      {t.description}
                    </p>
                  )}
                  <div style={{ display: 'inline-flex', alignItems: 'center', gap: 4, marginTop: 8 }}>
                    {t.status === 'pending' ? (
                      <Bell size={11} style={{ color: T.accent }} />
                    ) : t.status === 'fired' ? (
                      <CheckCircle2 size={11} style={{ color: T.success }} />
                    ) : (
                      <Clock3 size={11} style={{ color: T.textTertiary }} />
                    )}
                    <span style={{ ...TYPE.micro, color: t.status === 'pending' ? T.accent : T.textTertiary }}>
                      {t.status === 'fired' ? 'Напоминание отправлено' : formatRemindAt(t.remind_at)}
                    </span>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => remove(t.id)}
                  aria-label="Удалить"
                  style={{
                    flexShrink: 0,
                    background: 'transparent',
                    border: 'none',
                    color: T.textTertiary,
                    cursor: 'pointer',
                    padding: 4,
                  }}
                >
                  <Trash2 size={16} />
                </button>
              </motion.li>
            ))}
          </AnimatePresence>
        </ul>
      )}
    </div>
  );
}

function EmptyState({ tab }: { tab: Tab }) {
  return (
    <div style={{ paddingTop: 60, textAlign: 'center' }}>
      <div style={{
        margin: '0 auto 16px',
        width: 64,
        height: 64,
        borderRadius: R.xl,
        background: T.accentSoft,
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}>
        <ListTodo size={28} style={{ color: T.accent }} />
      </div>
      <p style={{ ...TYPE.h3, color: T.text, margin: 0 }}>
        {tab === 'active' ? 'Нет активных задач' : 'История пуста'}
      </p>
      <p style={{ ...TYPE.caption, color: T.textSecondary, margin: '8px auto 0', maxWidth: 280 }}>
        {tab === 'active'
          ? 'Создай первую задачу — напомним точно в нужный момент в Telegram.'
          : 'Здесь появятся выполненные и отправленные напоминания.'}
      </p>
      {tab === 'active' && (
        <Link
          href="/telegram/m/tasks/new"
          style={{
            marginTop: 20,
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            padding: '10px 18px',
            background: T.accent,
            color: T.accentText,
            borderRadius: R.pill,
            fontSize: 14,
            fontWeight: 600,
            textDecoration: 'none',
          }}
        >
          <Plus size={16} />
          Создать задачу
        </Link>
      )}
    </div>
  );
}
