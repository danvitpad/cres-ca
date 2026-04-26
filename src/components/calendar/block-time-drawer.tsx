/** --- YAML
 * name: BlockTimeDrawerContent
 * description: Drawer заблокированного времени со СТАРТОМ + ДЛИТЕЛЬНОСТЬЮ (не «концом»)
 *              + сохранёнными шаблонами мастера (Обед 40 мин / Приём лекарств 5 мин / ...).
 *              Один клик по шаблону подставляет заголовок и длительность; карандашик
 *              рядом — инлайн-редактирование шаблона. Сохранение пишет в blocked_times
 *              (start_at + ends_at вычисляется как start + duration).
 * created: 2026-04-13
 * updated: 2026-04-26
 * --- */

'use client';

import { useState, useEffect, useCallback } from 'react';
import { useTranslations } from 'next-intl';
import { createClient } from '@/lib/supabase/client';
import { toast } from 'sonner';
import { Pencil, Plus, Trash2, X, Check } from 'lucide-react';
import { usePageTheme, FONT, FONT_FEATURES } from '@/lib/dashboard-theme';
import { useEnterSubmit } from '@/hooks/use-keyboard-shortcuts';

interface BlockTimeTemplate {
  id: string;
  title: string;
  duration_minutes: number;
  emoji: string | null;
  sort_order: number;
}

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

function durationFromBlock(b: { starts_at: string; ends_at: string }): number {
  return Math.max(5, Math.round((new Date(b.ends_at).getTime() - new Date(b.starts_at).getTime()) / 60000));
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

  // Active block state (что сохраним в blocked_times)
  const [title, setTitle] = useState(editBlock?.reason ?? '');
  const initialStart = editBlock
    ? minutesToTime(new Date(editBlock.starts_at).getHours() * 60 + new Date(editBlock.starts_at).getMinutes())
    : defaultTime || '12:00';
  const [startTime, setStartTime] = useState(initialStart);
  const [duration, setDuration] = useState(editBlock ? durationFromBlock(editBlock) : 30);
  const [saving, setSaving] = useState(false);

  // Templates
  const [templates, setTemplates] = useState<BlockTimeTemplate[]>([]);
  const [editingTplId, setEditingTplId] = useState<string | null>(null);
  const [tplDraftTitle, setTplDraftTitle] = useState('');
  const [tplDraftDuration, setTplDraftDuration] = useState(30);
  const [creatingTpl, setCreatingTpl] = useState(false);

  const loadTemplates = useCallback(async () => {
    const supabase = createClient();
    const { data } = await supabase
      .from('block_time_templates')
      .select('id, title, duration_minutes, emoji, sort_order')
      .eq('master_id', masterId)
      .order('sort_order')
      .order('created_at');
    setTemplates((data as BlockTimeTemplate[]) ?? []);
  }, [masterId]);

  useEffect(() => { loadTemplates(); }, [loadTemplates]);

  function applyTemplate(tpl: BlockTimeTemplate) {
    setTitle(tpl.title);
    setDuration(tpl.duration_minutes);
  }

  async function saveTemplate() {
    const trimmed = tplDraftTitle.trim();
    if (!trimmed) { toast.error('Укажите название шаблона'); return; }
    if (tplDraftDuration <= 0) { toast.error('Длительность должна быть > 0'); return; }
    const supabase = createClient();
    if (editingTplId) {
      const { error } = await supabase
        .from('block_time_templates')
        .update({ title: trimmed, duration_minutes: tplDraftDuration })
        .eq('id', editingTplId);
      if (error) { toast.error(error.message); return; }
      toast.success('Шаблон обновлён');
    } else {
      const { error } = await supabase
        .from('block_time_templates')
        .insert({ master_id: masterId, title: trimmed, duration_minutes: tplDraftDuration });
      if (error) { toast.error(error.message); return; }
      toast.success('Шаблон сохранён');
    }
    setEditingTplId(null);
    setCreatingTpl(false);
    setTplDraftTitle('');
    setTplDraftDuration(30);
    loadTemplates();
  }

  async function deleteTemplate(id: string) {
    const supabase = createClient();
    const { error } = await supabase.from('block_time_templates').delete().eq('id', id);
    if (error) { toast.error(error.message); return; }
    toast.success('Шаблон удалён');
    loadTemplates();
  }

  function startEditTpl(tpl: BlockTimeTemplate) {
    setEditingTplId(tpl.id);
    setCreatingTpl(false);
    setTplDraftTitle(tpl.title);
    setTplDraftDuration(tpl.duration_minutes);
  }

  function startCreateTpl() {
    setCreatingTpl(true);
    setEditingTplId(null);
    setTplDraftTitle(title.trim() || '');
    setTplDraftDuration(duration);
  }

  function cancelTplEdit() {
    setEditingTplId(null);
    setCreatingTpl(false);
    setTplDraftTitle('');
    setTplDraftDuration(30);
  }

  const handleSave = useCallback(async () => {
    if (duration <= 0) {
      toast.error('Длительность должна быть > 0');
      return;
    }
    setSaving(true);
    const [sh, sm] = startTime.split(':').map(Number);
    const start = new Date(date);
    start.setHours(sh, sm, 0, 0);
    const end = new Date(start.getTime() + duration * 60 * 1000);

    const supabase = createClient();
    const reason = title.trim() || null;

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
  }, [date, duration, editBlock, masterId, onSaved, onClose, startTime, t, title]);

  // Cmd/Ctrl+Enter — сохранить блокировку (когда не открыт редактор шаблона)
  useEnterSubmit(!saving && !creatingTpl && !editingTplId, handleSave, { withModifier: true });

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
    <div style={{ padding: '16px 16px 24px', fontFamily: FONT, fontFeatureSettings: FONT_FEATURES }}>
      {/* ─── Templates ─── */}
      <div style={{ marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
          <span style={labelStyle}>Шаблоны</span>
          {!creatingTpl && !editingTplId && (
            <button
              type="button"
              onClick={startCreateTpl}
              style={{
                background: 'transparent', border: 'none', cursor: 'pointer',
                color: C.accent, fontSize: 12, fontWeight: 500,
                display: 'inline-flex', alignItems: 'center', gap: 4,
                fontFamily: FONT,
              }}
            >
              <Plus size={14} /> Шаблон
            </button>
          )}
        </div>

        {/* Inline editor — create or edit existing */}
        {(creatingTpl || editingTplId) && (
          <div style={{
            display: 'flex', flexDirection: 'column', gap: 8,
            padding: 10, marginBottom: 8,
            border: `1px dashed ${C.accent}`, borderRadius: 10,
            background: C.accentSoft,
          }}>
            <input
              type="text"
              value={tplDraftTitle}
              onChange={(e) => setTplDraftTitle(e.target.value)}
              placeholder="Название (Обед / Приём лекарств)"
              style={{ ...inputStyle, height: 38 }}
              autoFocus
            />
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <input
                type="number"
                min={1}
                max={24 * 60}
                value={tplDraftDuration}
                onChange={(e) => setTplDraftDuration(Math.max(1, Number(e.target.value) || 0))}
                style={{ ...inputStyle, height: 38, width: 80, textAlign: 'center' }}
              />
              <span style={{ color: C.textSecondary, fontSize: 13 }}>мин</span>
              <div style={{ flex: 1 }} />
              <button
                type="button"
                onClick={cancelTplEdit}
                style={{
                  height: 32, padding: '0 12px', borderRadius: 8,
                  background: 'transparent', border: `1px solid ${C.border}`,
                  color: C.text, fontSize: 13, cursor: 'pointer', fontFamily: FONT,
                }}
              >
                Отмена
              </button>
              <button
                type="button"
                onClick={saveTemplate}
                style={{
                  height: 32, padding: '0 14px', borderRadius: 8,
                  background: C.accent, border: 'none', color: '#fff',
                  fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: FONT,
                  display: 'inline-flex', alignItems: 'center', gap: 4,
                }}
              >
                <Check size={14} /> Сохранить
              </button>
            </div>
          </div>
        )}

        {/* Templates grid */}
        {templates.length > 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {templates.map((tpl) => (
              <div
                key={tpl.id}
                style={{
                  display: 'flex', alignItems: 'center', gap: 8,
                  padding: '8px 10px', borderRadius: 10,
                  background: C.surface, border: `1px solid ${C.border}`,
                }}
              >
                <button
                  type="button"
                  onClick={() => applyTemplate(tpl)}
                  style={{
                    flex: 1, display: 'flex', alignItems: 'center', gap: 8,
                    background: 'transparent', border: 'none', cursor: 'pointer',
                    fontFamily: FONT, color: C.text, fontSize: 14,
                    textAlign: 'left',
                  }}
                  title="Применить шаблон"
                >
                  <span>{tpl.title}</span>
                  <span style={{
                    marginLeft: 'auto', fontSize: 12, color: C.textSecondary,
                    padding: '2px 8px', borderRadius: 999, background: C.surfaceElevated,
                  }}>{tpl.duration_minutes} мин</span>
                </button>
                <button
                  type="button"
                  onClick={() => startEditTpl(tpl)}
                  style={{
                    width: 28, height: 28, borderRadius: 8,
                    border: 'none', background: 'transparent',
                    color: C.textSecondary, cursor: 'pointer',
                    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                  }}
                  title="Редактировать"
                >
                  <Pencil size={14} />
                </button>
                <button
                  type="button"
                  onClick={() => deleteTemplate(tpl.id)}
                  style={{
                    width: 28, height: 28, borderRadius: 8,
                    border: 'none', background: 'transparent',
                    color: C.textTertiary, cursor: 'pointer',
                    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                  }}
                  title="Удалить"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
          </div>
        ) : (
          !creatingTpl && (
            <p style={{
              fontSize: 12, color: C.textTertiary, fontFamily: FONT,
              padding: '8px 0', margin: 0,
            }}>
              Создай шаблон («Обед — 40 мин») — потом одним кликом будешь блокировать это время.
            </p>
          )
        )}
      </div>

      {/* ─── Title ─── */}
      <div style={{ marginBottom: 16 }}>
        <span style={labelStyle}>Заголовок</span>
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Например, обед / приём лекарств"
          style={inputStyle}
        />
      </div>

      {/* ─── Date (display only) ─── */}
      <div style={{ marginBottom: 16 }}>
        <span style={labelStyle}>Дата</span>
        <div style={{ ...inputStyle, display: 'flex', alignItems: 'center', cursor: 'default' }}>
          {formatDateLabel(date)}
        </div>
      </div>

      {/* ─── Start time + Duration ─── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 24 }}>
        <div>
          <span style={labelStyle}>Начало</span>
          <input
            type="time"
            value={startTime}
            onChange={(e) => setStartTime(e.target.value)}
            style={{ ...inputStyle, textAlign: 'center' }}
          />
        </div>
        <div>
          <span style={labelStyle}>Длительность</span>
          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            <input
              type="number"
              min={1}
              max={24 * 60}
              value={duration}
              onChange={(e) => setDuration(Math.max(1, Number(e.target.value) || 0))}
              style={{ ...inputStyle, textAlign: 'center', flex: 1 }}
            />
            <span style={{ color: C.textSecondary, fontSize: 13 }}>мин</span>
          </div>
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
