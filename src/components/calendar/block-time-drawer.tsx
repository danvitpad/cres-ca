/** --- YAML
 * name: BlockTimeDrawerContent
 * description: Block time drawer — type selector (custom / lunch), title, date + start/end picker. Uses site dashboard theme. Simplified per product feedback (no duration dropdown, no team-member picker, no summary footer).
 * created: 2026-04-13
 * updated: 2026-04-18
 * --- */

'use client';

import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { createClient } from '@/lib/supabase/client';
import { toast } from 'sonner';
import { Pencil, UtensilsCrossed, X } from 'lucide-react';
import { usePageTheme, FONT, FONT_FEATURES } from '@/lib/dashboard-theme';

type BlockType = 'custom' | 'lunch';

interface BlockTimeDrawerContentProps {
  /** Kept for API compatibility with calendar page, ignored internally. Theme is taken from usePageTheme now. */
  theme?: 'light' | 'dark';
  masterId: string;
  masterName?: string;
  date: Date;
  defaultTime?: string; // "HH:MM"
  onSaved: () => void;
  onClose: () => void;
  /** If editing existing block */
  editBlock?: { id: string; starts_at: string; ends_at: string; reason: string | null };
}

function formatDateLabel(d: Date): string {
  const days = ['вс', 'пн', 'вт', 'ср', 'чт', 'пт', 'сб'];
  const months = ['янв.', 'февр.', 'март', 'апр.', 'мая', 'июня', 'июля', 'авг.', 'сент.', 'окт.', 'нояб.', 'дек.'];
  return `${days[d.getDay()]}, ${d.getDate()} ${months[d.getMonth()]}`;
}

function timeToMinutes(t: string): number {
  const [h, m] = t.split(':').map(Number);
  return h * 60 + m;
}

function minutesToTime(mins: number): string {
  const safe = Math.max(0, Math.min(mins, 24 * 60 - 1));
  const h = Math.floor(safe / 60);
  const m = safe % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

export function BlockTimeDrawerContent({
  masterId,
  date,
  defaultTime,
  onSaved,
  onClose,
  editBlock,
}: BlockTimeDrawerContentProps) {
  const t = useTranslations('calendar');
  const { C } = usePageTheme();

  const [blockType, setBlockType] = useState<BlockType>(
    editBlock?.reason === 'lunch' ? 'lunch' : 'custom'
  );
  const [title, setTitle] = useState(editBlock?.reason && editBlock.reason !== 'lunch' ? editBlock.reason : '');

  const initialStart = editBlock
    ? `${String(new Date(editBlock.starts_at).getHours()).padStart(2, '0')}:${String(new Date(editBlock.starts_at).getMinutes()).padStart(2, '0')}`
    : defaultTime || '12:00';
  const initialEnd = editBlock
    ? `${String(new Date(editBlock.ends_at).getHours()).padStart(2, '0')}:${String(new Date(editBlock.ends_at).getMinutes()).padStart(2, '0')}`
    : minutesToTime(timeToMinutes(initialStart) + 60);

  const [startTime, setStartTime] = useState(initialStart);
  const [endTime, setEndTime] = useState(initialEnd);
  const [saving, setSaving] = useState(false);

  // Keep end >= start when user edits start
  useEffect(() => {
    if (timeToMinutes(endTime) <= timeToMinutes(startTime)) {
      setEndTime(minutesToTime(timeToMinutes(startTime) + 30));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [startTime]);

  // Lunch default — 60 min block, clear title
  useEffect(() => {
    if (blockType === 'lunch' && !editBlock) {
      setTitle('');
      setEndTime(minutesToTime(timeToMinutes(startTime) + 60));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [blockType]);

  async function handleSave() {
    if (timeToMinutes(endTime) <= timeToMinutes(startTime)) {
      toast.error('Время конца должно быть позже начала');
      return;
    }
    setSaving(true);
    const [sh, sm] = startTime.split(':').map(Number);
    const [eh, em] = endTime.split(':').map(Number);
    const start = new Date(date);
    start.setHours(sh, sm, 0, 0);
    const end = new Date(date);
    end.setHours(eh, em, 0, 0);

    const supabase = createClient();
    const reason = blockType === 'lunch' ? 'lunch' : (title.trim() || null);

    if (editBlock) {
      const { error } = await supabase.from('blocked_times')
        .update({ starts_at: start.toISOString(), ends_at: end.toISOString(), reason })
        .eq('id', editBlock.id);
      if (error) { toast.error(error.message); setSaving(false); return; }
      toast.success(t('timeBlockUpdated') || 'Блокировка обновлена');
    } else {
      const { error } = await supabase.from('blocked_times').insert({
        master_id: masterId,
        starts_at: start.toISOString(),
        ends_at: end.toISOString(),
        reason,
      });
      if (error) { toast.error(error.message); setSaving(false); return; }
      toast.success(t('timeBlocked') || 'Время заблокировано');
    }

    setSaving(false);
    onSaved();
    onClose();
  }

  async function handleDelete() {
    if (!editBlock) return;
    setSaving(true);
    const supabase = createClient();
    const { error } = await supabase.from('blocked_times').delete().eq('id', editBlock.id);
    if (error) { toast.error(error.message); setSaving(false); return; }
    toast.success(t('timeUnblocked') || 'Время разблокировано');
    setSaving(false);
    onSaved();
    onClose();
  }

  const inputStyle: React.CSSProperties = {
    width: '100%',
    padding: '10px 12px',
    borderRadius: 10,
    border: `1px solid ${C.border}`,
    backgroundColor: C.surface,
    color: C.text,
    fontSize: 14,
    fontFamily: FONT,
    fontFeatureSettings: FONT_FEATURES,
    outline: 'none',
  };

  const labelStyle: React.CSSProperties = {
    fontSize: 13,
    fontWeight: 500,
    color: C.textSecondary,
    marginBottom: 6,
    display: 'block',
    fontFamily: FONT,
  };

  return (
    <div style={{ padding: '0 16px 24px', fontFamily: FONT, fontFeatureSettings: FONT_FEATURES }}>
      {/* ─── Block type selector ─── */}
      <div style={{ marginBottom: 20, paddingTop: 16 }}>
        <span style={labelStyle}>{t('blockTimeType') || 'Тип заблокированного времени'}</span>
        <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
          {([
            { key: 'custom' as BlockType, icon: Pencil, label: t('blockTypeCustom') || 'Настроить' },
            { key: 'lunch' as BlockType, icon: UtensilsCrossed, label: t('blockTypeLunch') || 'Обед' },
          ]).map(item => {
            const active = blockType === item.key;
            return (
              <button
                key={item.key}
                onClick={() => setBlockType(item.key)}
                style={{
                  flex: 1,
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: 6,
                  padding: '14px 8px',
                  borderRadius: 12,
                  border: `1.5px solid ${active ? C.accent : C.border}`,
                  backgroundColor: active ? C.accentSoft : C.surface,
                  color: active ? C.accent : C.text,
                  cursor: 'pointer',
                  transition: 'all 150ms',
                  fontFamily: FONT,
                }}
              >
                <item.icon style={{ width: 20, height: 20, color: active ? C.accent : C.textSecondary }} />
                <span style={{ fontSize: 13, fontWeight: 500 }}>{item.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* ─── Title (custom only) ─── */}
      {blockType === 'custom' && (
        <div style={{ marginBottom: 20 }}>
          <span style={labelStyle}>{t('blockTimeTitle') || 'Заголовок (необязательно)'}</span>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder={t('blockTimeTitlePlaceholder') || 'Например, деловой обед'}
            style={inputStyle}
          />
        </div>
      )}

      {/* ─── Date (display only) ─── */}
      <div style={{ marginBottom: 20 }}>
        <span style={labelStyle}>{t('blockTimeDate') || 'Дата'}</span>
        <div style={{ ...inputStyle, display: 'flex', alignItems: 'center', cursor: 'default' }}>
          {formatDateLabel(date)}
        </div>
      </div>

      {/* ─── Start / End time — both editable ─── */}
      <div style={{ marginBottom: 24 }}>
        <span style={labelStyle}>{t('blockTimeRange') || 'Начало / Конец'}</span>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <input
            type="time"
            value={startTime}
            onChange={(e) => setStartTime(e.target.value)}
            style={{ ...inputStyle, textAlign: 'center', flex: 1 }}
          />
          <span style={{ color: C.textSecondary, fontSize: 14, flexShrink: 0 }}>—</span>
          <input
            type="time"
            value={endTime}
            onChange={(e) => setEndTime(e.target.value)}
            style={{ ...inputStyle, textAlign: 'center', flex: 1 }}
          />
        </div>
      </div>

      {/* Duration / team-member / summary blocks removed per product decision */}

      {/* ─── Delete button (edit mode) ─── */}
      {editBlock && (
        <button
          onClick={handleDelete}
          disabled={saving}
          style={{
            width: '100%',
            padding: '12px',
            borderRadius: 10,
            border: `1px solid ${C.danger}`,
            backgroundColor: C.dangerSoft,
            color: C.danger,
            fontSize: 14,
            fontWeight: 600,
            fontFamily: FONT,
            cursor: saving ? 'wait' : 'pointer',
            marginBottom: 10,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
          }}
        >
          <X style={{ width: 16, height: 16 }} />
          {t('unblockTime') || 'Разблокировать'}
        </button>
      )}

      {/* ─── Save button ─── */}
      <button
        onClick={handleSave}
        disabled={saving}
        style={{
          width: '100%',
          padding: '12px',
          borderRadius: 10,
          border: 'none',
          backgroundColor: C.accent,
          color: '#ffffff',
          fontSize: 15,
          fontWeight: 600,
          fontFamily: FONT,
          cursor: saving ? 'wait' : 'pointer',
          opacity: saving ? 0.6 : 1,
          transition: 'opacity 150ms',
        }}
      >
        {saving
          ? '...'
          : editBlock
            ? (t('save') || 'Сохранить')
            : (t('blockTimeConfirm') || 'Заблокировать')
        }
      </button>
    </div>
  );
}
