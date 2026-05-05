/** --- YAML
 * name: PublicCresIdBadge
 * description: Маленький блок «CRES-CA ID: <handle>» под hero карточкой публичной
 *              страницы. Клик — копирует полный URL страницы в буфер обмена.
 * created: 2026-05-05
 * --- */

'use client';

import { useState } from 'react';
import { Copy, Check } from 'lucide-react';

export function PublicCresIdBadge({ handle }: { handle: string }) {
  const [copied, setCopied] = useState(false);

  function onClick() {
    if (typeof window === 'undefined') return;
    const url = `${window.location.origin}/m/${handle}`;
    navigator.clipboard.writeText(url).then(() => {
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    });
  }

  return (
    <button
      type="button"
      onClick={onClick}
      title="Скопировать ссылку"
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
      {copied ? <Check size={12} /> : <Copy size={12} />}
    </button>
  );
}
