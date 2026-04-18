/** --- YAML
 * name: TablePagination
 * description: Pagination control for Table — numbered pages with prev/next, ellipsis for gaps, styled via PageTheme C. Returns null when total <= pageSize.
 * created: 2026-04-18
 * updated: 2026-04-18
 * --- */

'use client';

import { ChevronLeft, ChevronRight } from 'lucide-react';
import { FONT, type PageTheme } from '@/lib/dashboard-theme';

type Props = {
  C: PageTheme;
  page: number;
  pageSize?: number;
  total: number;
  onPageChange: (page: number) => void;
  prevLabel?: string;
  nextLabel?: string;
};

function buildPages(current: number, last: number): (number | 'ellipsis')[] {
  if (last <= 7) return Array.from({ length: last }, (_, i) => i + 1);
  const pages = new Set<number>([1, last, current, current - 1, current + 1]);
  const sorted = Array.from(pages).filter((n) => n >= 1 && n <= last).sort((a, b) => a - b);
  const out: (number | 'ellipsis')[] = [];
  for (let i = 0; i < sorted.length; i++) {
    out.push(sorted[i]);
    if (i < sorted.length - 1 && sorted[i + 1] - sorted[i] > 1) out.push('ellipsis');
  }
  return out;
}

export function TablePagination({
  C,
  page,
  pageSize = 20,
  total,
  onPageChange,
  prevLabel,
  nextLabel,
}: Props) {
  const last = Math.max(1, Math.ceil(total / pageSize));
  if (total <= pageSize) return null;

  const pages = buildPages(page, last);
  const btnBase: React.CSSProperties = {
    minWidth: 32,
    height: 32,
    padding: '0 8px',
    borderRadius: 6,
    border: `1px solid ${C.border}`,
    background: C.surface,
    color: C.text,
    fontSize: 13,
    fontFamily: FONT,
    cursor: 'pointer',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    transition: 'background 0.12s, border-color 0.12s',
  };

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'flex-end',
        gap: 4,
        marginTop: 16,
        flexWrap: 'wrap',
      }}
    >
      <button
        type="button"
        onClick={() => onPageChange(Math.max(1, page - 1))}
        disabled={page <= 1}
        style={{
          ...btnBase,
          opacity: page <= 1 ? 0.4 : 1,
          cursor: page <= 1 ? 'not-allowed' : 'pointer',
          paddingLeft: prevLabel ? 10 : 6,
          paddingRight: prevLabel ? 12 : 6,
        }}
        aria-label="Previous page"
      >
        <ChevronLeft size={14} />
        {prevLabel ? <span>{prevLabel}</span> : null}
      </button>

      {pages.map((p, i) =>
        p === 'ellipsis' ? (
          <span
            key={`e${i}`}
            style={{
              minWidth: 24,
              textAlign: 'center',
              color: C.textTertiary,
              fontSize: 13,
              fontFamily: FONT,
            }}
          >
            …
          </span>
        ) : (
          <button
            key={p}
            type="button"
            onClick={() => onPageChange(p)}
            style={{
              ...btnBase,
              background: p === page ? C.accent : C.surface,
              color: p === page ? '#ffffff' : C.text,
              borderColor: p === page ? C.accent : C.border,
              fontWeight: p === page ? 600 : 500,
            }}
            aria-current={p === page ? 'page' : undefined}
          >
            {p}
          </button>
        )
      )}

      <button
        type="button"
        onClick={() => onPageChange(Math.min(last, page + 1))}
        disabled={page >= last}
        style={{
          ...btnBase,
          opacity: page >= last ? 0.4 : 1,
          cursor: page >= last ? 'not-allowed' : 'pointer',
          paddingLeft: nextLabel ? 12 : 6,
          paddingRight: nextLabel ? 10 : 6,
        }}
        aria-label="Next page"
      >
        {nextLabel ? <span>{nextLabel}</span> : null}
        <ChevronRight size={14} />
      </button>
    </div>
  );
}
