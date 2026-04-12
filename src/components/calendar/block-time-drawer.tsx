/** --- YAML
 * name: BlockTimeDrawerContent
 * description: Fresha-style block time drawer — type selector, title, date/time pickers, team member, frequency, save
 * --- */

'use client';

import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { createClient } from '@/lib/supabase/client';
import { toast } from 'sonner';
import { Pencil, UtensilsCrossed, Clock, ChevronDown, Repeat, X } from 'lucide-react';

const FONT = '"Roobert PRO", AktivGroteskVF, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';

const LIGHT = {
  bg: '#ffffff',
  cardBg: '#f5f5f5',
  cardActiveBg: '#f0f0ff',
  cardActiveBorder: '#6950f3',
  border: '#e5e5e5',
  text: '#000000',
  textMuted: '#737373',
  textPlaceholder: '#a3a3a3',
  accent: '#6950f3',
  inputBg: '#ffffff',
  inputBorder: '#e5e5e5',
  btnBg: '#000000',
  btnText: '#f5f5f5',
  dangerBg: '#fef2f2',
  dangerText: '#d4163a',
  dangerBorder: '#fecaca',
};

const DARK = {
  bg: '#000000',
  cardBg: '#000000',
  cardActiveBg: 'rgba(105,80,243,0.15)',
  cardActiveBorder: '#8b7cf6',
  border: '#1a1a1a',
  text: '#e5e5e5',
  textMuted: '#8a8a8a',
  textPlaceholder: '#666666',
  accent: '#8b7cf6',
  inputBg: '#000000',
  inputBorder: '#3a3a3a',
  btnBg: '#e5e5e5',
  btnText: '#000000',
  dangerBg: 'rgba(212,22,58,0.12)',
  dangerText: '#ef4444',
  dangerBorder: 'rgba(212,22,58,0.25)',
};

type BlockType = 'custom' | 'lunch';

const DURATIONS = [15, 30, 45, 60, 90, 120, 180, 240];

interface BlockTimeDrawerContentProps {
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

function formatDateLabel(d: Date, locale: string): string {
  const days = ['вс', 'пн', 'вт', 'ср', 'чт', 'пт', 'сб'];
  const months = ['янв.', 'февр.', 'март', 'апр.', 'мая', 'июня', 'июля', 'авг.', 'сент.', 'окт.', 'нояб.', 'дек.'];
  return `${days[d.getDay()]}, ${d.getDate()} ${months[d.getMonth()]}`;
}

function timeToMinutes(t: string): number {
  const [h, m] = t.split(':').map(Number);
  return h * 60 + m;
}

function minutesToTime(mins: number): string {
  const h = Math.floor(mins / 60) % 24;
  const m = mins % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

function formatDuration(mins: number): string {
  if (mins < 60) return `${mins} мин`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  if (m === 0) return `${h} ч`;
  return `${h} ч ${m} мин`;
}

function formatTime12(time: string): string {
  const [h, m] = time.split(':').map(Number);
  const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
  const period = h < 12 ? 'AM' : 'PM';
  return `${h12}:${String(m).padStart(2, '0')} ${period}`;
}

export function BlockTimeDrawerContent({
  theme = 'light',
  masterId,
  masterName,
  date,
  defaultTime,
  onSaved,
  onClose,
  editBlock,
}: BlockTimeDrawerContentProps) {
  const t = useTranslations('calendar');
  const C = theme === 'dark' ? DARK : LIGHT;

  const [blockType, setBlockType] = useState<BlockType>(
    editBlock?.reason === 'lunch' ? 'lunch' : 'custom'
  );
  const [title, setTitle] = useState(editBlock?.reason || '');
  const [startTime, setStartTime] = useState(
    editBlock
      ? `${String(new Date(editBlock.starts_at).getHours()).padStart(2, '0')}:${String(new Date(editBlock.starts_at).getMinutes()).padStart(2, '0')}`
      : defaultTime || '12:00'
  );
  const [duration, setDuration] = useState(() => {
    if (editBlock) {
      const ms = new Date(editBlock.ends_at).getTime() - new Date(editBlock.starts_at).getTime();
      return Math.round(ms / 60000);
    }
    return 30;
  });
  const [saving, setSaving] = useState(false);
  const [showDurationPicker, setShowDurationPicker] = useState(false);

  const endTime = minutesToTime(timeToMinutes(startTime) + duration);

  // If lunch type, auto-set defaults
  useEffect(() => {
    if (blockType === 'lunch' && !editBlock) {
      setTitle('');
      setDuration(60);
    }
  }, [blockType, editBlock]);

  async function handleSave() {
    setSaving(true);
    const [h, m] = startTime.split(':').map(Number);
    const start = new Date(date);
    start.setHours(h, m, 0, 0);
    const end = new Date(start);
    end.setMinutes(end.getMinutes() + duration);

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
    border: `1px solid ${C.inputBorder}`,
    backgroundColor: C.inputBg,
    color: C.text,
    fontSize: 14,
    fontFamily: FONT,
    outline: 'none',
  };

  const labelStyle: React.CSSProperties = {
    fontSize: 13,
    fontWeight: 500,
    color: C.textMuted,
    marginBottom: 6,
    display: 'block',
    fontFamily: FONT,
  };

  return (
    <div style={{ padding: '0 16px 24px', fontFamily: FONT }}>

      {/* ─── Block type selector ─── */}
      <div style={{ marginBottom: 20, paddingTop: 16 }}>
        <span style={labelStyle}>
          {t('blockTimeType') || 'Тип заблокированного времени'}
        </span>
        <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
          {([
            { key: 'custom' as BlockType, icon: Pencil, label: t('blockTypeCustom') || 'Настроить' },
            { key: 'lunch' as BlockType, icon: UtensilsCrossed, label: t('blockTypeLunch') || 'Обід' },
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
                  border: `1.5px solid ${active ? C.cardActiveBorder : C.border}`,
                  backgroundColor: active ? C.cardActiveBg : C.cardBg,
                  cursor: 'pointer',
                  transition: 'all 150ms',
                }}
              >
                <item.icon style={{ width: 20, height: 20, color: active ? C.accent : C.textMuted }} />
                <span style={{ fontSize: 13, fontWeight: 500, color: active ? C.accent : C.text }}>
                  {item.label}
                </span>
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
            style={{
              ...inputStyle,
              color: title ? C.text : C.textPlaceholder,
            }}
          />
        </div>
      )}

      {/* ─── Date ─── */}
      <div style={{ marginBottom: 20 }}>
        <span style={labelStyle}>{t('blockTimeDate') || 'Дата'}</span>
        <div style={{
          ...inputStyle,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          cursor: 'default',
        }}>
          <span>{formatDateLabel(date, 'ru')}</span>
        </div>
      </div>

      {/* ─── Start / End time with duration ─── */}
      <div style={{ marginBottom: 20 }}>
        <span style={labelStyle}>{t('blockTimeRange') || 'Начало / Конец'}</span>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          {/* Start time */}
          <div style={{ flex: 1 }}>
            <input
              type="time"
              value={startTime}
              onChange={(e) => setStartTime(e.target.value)}
              style={{
                ...inputStyle,
                textAlign: 'center',
              }}
            />
          </div>
          <span style={{ color: C.textMuted, fontSize: 14, flexShrink: 0 }}>—</span>
          {/* End time (read-only, calculated) */}
          <div style={{ flex: 1 }}>
            <div style={{
              ...inputStyle,
              textAlign: 'center',
              cursor: 'default',
              opacity: 0.7,
            }}>
              {endTime}
            </div>
          </div>
        </div>
      </div>

      {/* ─── Duration picker ─── */}
      <div style={{ marginBottom: 20 }}>
        <span style={labelStyle}>
          {t('blockTimeDuration') || 'Длительность'}
        </span>
        <div style={{ position: 'relative' }}>
          <button
            onClick={() => setShowDurationPicker(!showDurationPicker)}
            style={{
              ...inputStyle,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              cursor: 'pointer',
              textAlign: 'left',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Clock style={{ width: 16, height: 16, color: C.accent }} />
              <span>{formatDuration(duration)}</span>
            </div>
            <ChevronDown style={{
              width: 16, height: 16, color: C.textMuted,
              transform: showDurationPicker ? 'rotate(180deg)' : 'none',
              transition: 'transform 150ms',
            }} />
          </button>

          {showDurationPicker && (
            <>
              <div
                onClick={() => setShowDurationPicker(false)}
                style={{ position: 'fixed', inset: 0, zIndex: 10 }}
              />
              <div style={{
                position: 'absolute',
                top: '100%',
                left: 0,
                right: 0,
                marginTop: 4,
                backgroundColor: C.bg,
                border: `1px solid ${C.border}`,
                borderRadius: 10,
                boxShadow: '0 4px 20px rgba(0,0,0,0.12)',
                zIndex: 11,
                padding: 6,
                maxHeight: 200,
                overflowY: 'auto',
              }}>
                {DURATIONS.map(d => (
                  <button
                    key={d}
                    onClick={() => { setDuration(d); setShowDurationPicker(false); }}
                    style={{
                      width: '100%',
                      padding: '8px 10px',
                      borderRadius: 6,
                      border: 'none',
                      backgroundColor: duration === d ? C.cardActiveBg : 'transparent',
                      color: duration === d ? C.accent : C.text,
                      fontWeight: duration === d ? 600 : 400,
                      fontSize: 14,
                      fontFamily: FONT,
                      cursor: 'pointer',
                      textAlign: 'left',
                      transition: 'background 100ms',
                    }}
                  >
                    {formatDuration(d)}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      {/* ─── Team member ─── */}
      <div style={{ marginBottom: 20 }}>
        <span style={labelStyle}>{t('blockTimeTeamMember') || 'Участник команды'}</span>
        <div style={{
          ...inputStyle,
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          cursor: 'default',
        }}>
          <div style={{
            width: 28, height: 28, borderRadius: 999,
            backgroundColor: C.accent + '20',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 12, fontWeight: 600, color: C.accent,
            flexShrink: 0,
          }}>
            {masterName ? masterName.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase() : '?'}
          </div>
          <span style={{ fontSize: 14 }}>{masterName || '—'}</span>
        </div>
      </div>

      {/* ─── Summary ─── */}
      <div style={{
        marginBottom: 24,
        padding: '12px 14px',
        borderRadius: 10,
        backgroundColor: C.cardActiveBg,
        border: `1px solid ${C.cardActiveBorder}`,
      }}>
        <div style={{ fontSize: 13, color: C.accent, fontWeight: 600, marginBottom: 4 }}>
          {blockType === 'lunch' ? (t('blockTypeLunch') || 'Обід') : (title || t('blockTimeCustomLabel') || 'Блокировка')}
        </div>
        <div style={{ fontSize: 12, color: C.textMuted }}>
          {formatDateLabel(date, 'ru')} · {startTime} — {endTime} ({formatDuration(duration)})
        </div>
      </div>

      {/* ─── Delete button (edit mode) ─── */}
      {editBlock && (
        <button
          onClick={handleDelete}
          disabled={saving}
          style={{
            width: '100%',
            padding: '12px',
            borderRadius: 10,
            border: `1px solid ${C.dangerBorder}`,
            backgroundColor: C.dangerBg,
            color: C.dangerText,
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
          backgroundColor: C.btnBg,
          color: C.btnText,
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
