/** --- YAML
 * name: WebPushToggle
 * description: Settings card with «Включить уведомления на компьютере» button.
 *              Uses useWebPush hook. Shows status and lets user enable/disable.
 * created: 2026-05-01
 * --- */

'use client';

import { Bell, BellOff, Loader2 } from 'lucide-react';
import { useWebPush } from '@/hooks/use-web-push';
import { usePageTheme } from '@/lib/dashboard-theme';

export function WebPushToggle() {
  const { state, enable, disable } = useWebPush();
  const { C } = usePageTheme();

  const labelByState: Record<typeof state, string> = {
    unsupported: 'Браузер не поддерживает push-уведомления',
    denied: 'Уведомления запрещены — измени в настройках браузера',
    idle: 'Уведомления выключены',
    enabled: 'Уведомления включены ✓',
    busy: 'Подключаю…',
  };

  const isEnabled = state === 'enabled';
  const isBusy = state === 'busy';
  const canToggle = state === 'idle' || state === 'enabled';

  return (
    <div
      style={{
        background: C.surface,
        border: `1px solid ${C.border}`,
        borderRadius: 14,
        padding: '20px 22px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 16,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, minWidth: 0 }}>
        <div
          style={{
            width: 40,
            height: 40,
            borderRadius: 10,
            background: isEnabled ? C.successSoft : C.accentSoft,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
          }}
        >
          {isEnabled
            ? <Bell size={18} style={{ color: C.success }} />
            : <BellOff size={18} style={{ color: C.accent }} />}
        </div>
        <div style={{ minWidth: 0 }}>
          <p style={{ fontSize: 15, fontWeight: 600, color: C.text, margin: 0 }}>
            Уведомления на компьютере
          </p>
          <p style={{ fontSize: 13, color: C.textSecondary, margin: '4px 0 0' }}>
            {labelByState[state]}
          </p>
          <p style={{ fontSize: 12, color: C.textTertiary, margin: '6px 0 0' }}>
            Записи, отмены, отзывы и задачи будут приходить как обычные системные уведомления — даже если вкладка закрыта.
          </p>
        </div>
      </div>

      <button
        type="button"
        disabled={!canToggle || isBusy}
        onClick={() => (isEnabled ? disable() : enable())}
        style={{
          padding: '10px 18px',
          background: isEnabled ? 'transparent' : C.accent,
          color: isEnabled ? C.textSecondary : C.surface,
          border: isEnabled ? `1px solid ${C.border}` : 'none',
          borderRadius: 8,
          fontSize: 13,
          fontWeight: 600,
          cursor: canToggle && !isBusy ? 'pointer' : 'not-allowed',
          opacity: canToggle && !isBusy ? 1 : 0.5,
          flexShrink: 0,
          display: 'inline-flex',
          alignItems: 'center',
          gap: 6,
        }}
      >
        {isBusy && <Loader2 size={14} className="animate-spin" />}
        {isEnabled ? 'Выключить' : 'Включить'}
      </button>
    </div>
  );
}
