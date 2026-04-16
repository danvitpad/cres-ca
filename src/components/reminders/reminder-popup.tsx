/** --- YAML
 * name: ReminderPopup
 * description: Polls for due reminders and shows toast-like popup in bottom-right corner. Respects notify_web setting.
 * created: 2026-04-16
 * --- */

'use client';

import { useEffect, useState, useCallback } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Bell, X, Check, Mic } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { useMaster } from '@/hooks/use-master';

interface DueReminder {
  id: string;
  text: string;
  due_at: string;
  source: string;
}

const POLL_INTERVAL = 60_000; // check every 60s

export function ReminderPopup() {
  const { master } = useMaster();
  const [popup, setPopup] = useState<DueReminder | null>(null);
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());

  const checkReminders = useCallback(async () => {
    if (!master?.id) return;

    // Check if web notifications are enabled
    const notifyWeb = (master as Record<string, unknown>).notify_web;
    if (notifyWeb === false) return;

    const supabase = createClient();
    const { data } = await supabase
      .from('reminders')
      .select('id, text, due_at, source')
      .eq('master_id', master.id)
      .eq('completed', false)
      .not('due_at', 'is', null)
      .lte('due_at', new Date().toISOString())
      .order('due_at', { ascending: true })
      .limit(1);

    if (data?.length) {
      const rem = data[0] as DueReminder;
      if (!dismissed.has(rem.id)) {
        setPopup(rem);
      }
    }
  }, [master?.id, master, dismissed]);

  useEffect(() => {
    checkReminders();
    const interval = setInterval(checkReminders, POLL_INTERVAL);
    return () => clearInterval(interval);
  }, [checkReminders]);

  const handleDismiss = () => {
    if (popup) {
      setDismissed(prev => new Set(prev).add(popup.id));
    }
    setPopup(null);
  };

  const handleComplete = async () => {
    if (!popup) return;
    const supabase = createClient();
    await supabase.from('reminders').update({
      completed: true,
      completed_at: new Date().toISOString(),
    }).eq('id', popup.id);
    setDismissed(prev => new Set(prev).add(popup.id));
    setPopup(null);
  };

  return (
    <AnimatePresence>
      {popup && (
        <motion.div
          initial={{ opacity: 0, y: 20, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 10, scale: 0.95 }}
          transition={{ duration: 0.25, ease: [0.23, 1, 0.32, 1] }}
          style={{
            position: 'fixed',
            bottom: 24,
            right: 24,
            zIndex: 9999,
            width: 340,
            borderRadius: 14,
            overflow: 'hidden',
            boxShadow: '0 8px 32px rgba(0,0,0,0.18), 0 2px 8px rgba(0,0,0,0.1)',
          }}
        >
          {/* Accent top bar */}
          <div style={{
            height: 3,
            background: 'linear-gradient(90deg, #5e6ad2, #8b5cf6)',
          }} />

          <div style={{
            padding: '16px 18px',
            backgroundColor: 'var(--card, #0f1011)',
            border: '1px solid var(--border, rgba(255,255,255,0.08))',
            borderTop: 'none',
            borderRadius: '0 0 14px 14px',
          }}>
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{
                  width: 28, height: 28, borderRadius: 8,
                  background: 'linear-gradient(135deg, rgba(94,106,210,0.2), rgba(139,92,246,0.15))',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <Bell style={{ width: 14, height: 14, color: '#5e6ad2' }} />
                </div>
                <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--muted-foreground, #8a8f98)', letterSpacing: '0.3px', textTransform: 'uppercase' }}>
                  Напоминание
                </span>
                {popup.source === 'voice' && (
                  <Mic style={{ width: 11, height: 11, color: 'var(--muted-foreground, #8a8f98)' }} />
                )}
              </div>
              <button
                onClick={handleDismiss}
                style={{
                  width: 24, height: 24, borderRadius: 6, border: 'none',
                  backgroundColor: 'transparent', cursor: 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: 'var(--muted-foreground, #8a8f98)',
                  transition: 'background-color 150ms',
                }}
                onMouseEnter={e => { e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.06)'; }}
                onMouseLeave={e => { e.currentTarget.style.backgroundColor = 'transparent'; }}
              >
                <X style={{ width: 14, height: 14 }} />
              </button>
            </div>

            {/* Body */}
            <p style={{
              fontSize: 14, fontWeight: 500,
              color: 'var(--foreground, #f7f8f8)',
              margin: 0, lineHeight: '20px',
            }}>
              {popup.text}
            </p>

            {popup.due_at && (
              <p style={{
                fontSize: 11, color: 'var(--muted-foreground, #62666d)',
                margin: '6px 0 0',
              }}>
                {new Date(popup.due_at).toLocaleString('ru-RU', {
                  timeZone: 'Europe/Kyiv',
                  day: 'numeric', month: 'short',
                  hour: '2-digit', minute: '2-digit',
                })}
              </p>
            )}

            {/* Actions */}
            <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
              <button
                onClick={handleComplete}
                style={{
                  flex: 1, padding: '8px 0', borderRadius: 8, border: 'none',
                  backgroundColor: '#5e6ad2', color: '#ffffff',
                  fontSize: 12, fontWeight: 600, cursor: 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                  transition: 'opacity 150ms',
                }}
                onMouseEnter={e => { e.currentTarget.style.opacity = '0.85'; }}
                onMouseLeave={e => { e.currentTarget.style.opacity = '1'; }}
              >
                <Check style={{ width: 13, height: 13 }} />
                Выполнено
              </button>
              <button
                onClick={handleDismiss}
                style={{
                  padding: '8px 16px', borderRadius: 8,
                  border: '1px solid var(--border, rgba(255,255,255,0.08))',
                  backgroundColor: 'transparent',
                  color: 'var(--muted-foreground, #8a8f98)',
                  fontSize: 12, fontWeight: 500, cursor: 'pointer',
                  transition: 'background-color 150ms',
                }}
                onMouseEnter={e => { e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.04)'; }}
                onMouseLeave={e => { e.currentTarget.style.backgroundColor = 'transparent'; }}
              >
                Позже
              </button>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
