/** --- YAML
 * name: ExportMenu
 * description: Кнопка "Экспорт" с дропдауном (PDF / Excel / CSV) для финансовых отчётов.
 *              Скачивает /api/reports/export?format=...&from=...&to=...
 * created: 2026-04-19
 * --- */

'use client';

import { useState, useRef, useEffect } from 'react';
import { Download, FileText, FileSpreadsheet, FileDown } from 'lucide-react';

interface Props {
  from: string;
  to: string;
  C: { text: string; border: string; surface: string; bg: string; textSecondary: string };
}

export function ExportMenu({ from, to, C }: Props) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    if (open) document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, [open]);

  function go(format: 'pdf' | 'excel' | 'csv') {
    window.open(`/api/reports/export?format=${format}&from=${from}&to=${to}`, '_blank');
    setOpen(false);
  }

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 6,
          padding: '8px 14px',
          borderRadius: 999,
          border: `1px solid ${C.border}`,
          background: C.surface,
          color: C.text,
          fontSize: 13,
          fontWeight: 500,
          cursor: 'pointer',
        }}
      >
        <Download size={14} />
        Экспорт
      </button>
      {open && (
        <div
          style={{
            position: 'absolute',
            top: 'calc(100% + 4px)',
            right: 0,
            minWidth: 180,
            padding: 4,
            borderRadius: 12,
            border: `1px solid ${C.border}`,
            background: C.surface,
            boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
            zIndex: 50,
          }}
        >
          {[
            { key: 'pdf' as const, icon: FileText, label: 'PDF — отчёт' },
            { key: 'excel' as const, icon: FileSpreadsheet, label: 'Excel — таблица' },
            { key: 'csv' as const, icon: FileDown, label: 'CSV — raw' },
          ].map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.key}
                type="button"
                onClick={() => go(item.key)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  width: '100%',
                  padding: '8px 12px',
                  borderRadius: 8,
                  border: 'none',
                  background: 'transparent',
                  color: C.text,
                  fontSize: 13,
                  textAlign: 'left',
                  cursor: 'pointer',
                }}
                onMouseEnter={(e) => ((e.target as HTMLElement).style.background = C.bg)}
                onMouseLeave={(e) => ((e.target as HTMLElement).style.background = 'transparent')}
              >
                <Icon size={14} />
                {item.label}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
