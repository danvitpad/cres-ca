/** --- YAML
 * name: PublicCresIdBadge
 * description: Чип «CRES-CA ID: <handle>» под hero карточкой публичной страницы.
 *              Для гостей — клик копирует полный URL страницы. Для владельца —
 *              справа карандашик, по клику строка превращается в input + Save/Cancel.
 *              Валидация и проверка уникальности — на сервере (PATCH
 *              /api/me/master-customization), сообщения об ошибках человеко-читаемые.
 * created: 2026-05-05
 * updated: 2026-05-06
 * --- */

'use client';

import { useEffect, useState } from 'react';
import { Copy, Check, Pencil, Loader2, X } from 'lucide-react';
import { toast } from 'sonner';
import { createClient } from '@/lib/supabase/client';

export function PublicCresIdBadge({
  handle,
  masterProfileId,
}: {
  handle: string;
  masterProfileId?: string | null;
}) {
  const [copied, setCopied] = useState(false);
  const [isOwner, setIsOwner] = useState(false);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(handle);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!masterProfileId) return;
    let cancelled = false;
    createClient().auth.getUser().then(({ data }) => {
      if (cancelled) return;
      if (data.user?.id === masterProfileId) setIsOwner(true);
    }).catch(() => {});
    return () => { cancelled = true; };
  }, [masterProfileId]);

  function copyUrl() {
    if (typeof window === 'undefined') return;
    const url = `${window.location.origin}/m/${handle}`;
    navigator.clipboard.writeText(url).then(() => {
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    });
  }

  async function save() {
    setError(null);
    const next = draft.trim().toLowerCase();
    if (!next) { setError('Введите CRES-CA ID'); return; }
    if (next === handle) { setEditing(false); return; }

    setSaving(true);
    try {
      const res = await fetch('/api/me/master-customization', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slug: next }),
      });
      const data = await res.json().catch(() => ({})) as { error?: string; field?: string };
      if (!res.ok) {
        // Сервер уже различает 409 (slug занят) от 400 (валидация) и
        // отдаёт человеко-читаемый error.
        setError(data.error || 'Не удалось сохранить');
        return;
      }
      toast.success('CRES-CA ID обновлён. Обновите ссылку у клиентов!');
      // Редирект на новый handle, иначе текущий URL даст 404.
      setTimeout(() => { window.location.href = `/m/${next}`; }, 400);
    } finally {
      setSaving(false);
    }
  }

  function startEdit() {
    setDraft(handle);
    setError(null);
    setEditing(true);
  }

  function cancel() {
    setEditing(false);
    setDraft(handle);
    setError(null);
  }

  // ─── EDIT MODE ───
  if (editing) {
    return (
      <div className="flex flex-col items-stretch gap-1.5">
        <div
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            padding: '4px 6px 4px 12px',
            borderRadius: 999,
            border: error ? '1px solid #ef4444' : '1px solid var(--m-accent)',
            background: 'var(--m-surface)',
            fontSize: 12,
            fontWeight: 500,
          }}
        >
          <span style={{ color: 'var(--m-text-tertiary)', whiteSpace: 'nowrap' }}>CRES-CA ID:</span>
          <input
            type="text"
            value={draft}
            onChange={(e) => {
              setDraft(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''));
              setError(null);
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') save();
              if (e.key === 'Escape') cancel();
            }}
            autoFocus
            maxLength={32}
            style={{
              flex: 1,
              minWidth: 80,
              border: 'none',
              outline: 'none',
              background: 'transparent',
              color: 'var(--m-text)',
              fontSize: 12,
              fontWeight: 600,
              fontFamily: 'inherit',
            }}
          />
          <button
            type="button"
            onClick={save}
            disabled={saving || !draft.trim() || draft === handle}
            title="Сохранить"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: 24,
              height: 24,
              borderRadius: 999,
              border: 'none',
              background: 'var(--m-accent)',
              color: 'white',
              cursor: saving ? 'default' : 'pointer',
              opacity: saving || !draft.trim() || draft === handle ? 0.4 : 1,
            }}
          >
            {saving ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />}
          </button>
          <button
            type="button"
            onClick={cancel}
            disabled={saving}
            title="Отмена"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: 24,
              height: 24,
              borderRadius: 999,
              border: '1px solid var(--m-border)',
              background: 'transparent',
              color: 'var(--m-text-secondary)',
              cursor: saving ? 'default' : 'pointer',
            }}
          >
            <X size={12} />
          </button>
        </div>
        {error && (
          <div style={{ fontSize: 11, color: '#ef4444', textAlign: 'center', padding: '0 8px' }}>
            {error}
          </div>
        )}
      </div>
    );
  }

  // ─── VIEW MODE ───
  return (
    <button
      type="button"
      onClick={isOwner ? startEdit : copyUrl}
      title={isOwner ? 'Изменить CRES-CA ID' : 'Скопировать ссылку'}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        padding: '6px 12px',
        borderRadius: 999,
        border: '1px solid var(--m-border)',
        background: 'var(--m-surface)',
        color: 'var(--m-text-secondary)',
        fontSize: 12,
        fontWeight: 500,
        cursor: 'pointer',
        fontFamily: 'inherit',
        transition: 'border-color 0.15s, color 0.15s',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.borderColor = 'var(--m-accent)';
        e.currentTarget.style.color = 'var(--m-text)';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.borderColor = 'var(--m-border)';
        e.currentTarget.style.color = 'var(--m-text-secondary)';
      }}
    >
      <span style={{ color: 'var(--m-text-tertiary)' }}>CRES-CA ID:</span>
      <span style={{ fontWeight: 600 }}>{handle}</span>
      {isOwner ? <Pencil size={12} /> : copied ? <Check size={12} /> : <Copy size={12} />}
    </button>
  );
}
