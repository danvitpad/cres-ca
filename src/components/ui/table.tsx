/** --- YAML
 * name: Table
 * description: Vercel-style compound Table — inline styles driven by PageTheme (C), scoped CSS for hover/striped/rounded corners via useId. Thead border-bottom only; no row separators. Variants: striped, interactive.
 * created: 2026-04-18
 * updated: 2026-04-18
 * --- */

'use client';

import React, { createContext, useContext, useId } from 'react';
import { FONT, FONT_FEATURES, type PageTheme } from '@/lib/dashboard-theme';

type Ctx = { C: PageTheme; scope: string };
const TableCtx = createContext<Ctx | null>(null);

function useTableCtx(): Ctx {
  const ctx = useContext(TableCtx);
  if (!ctx) throw new Error('Table subcomponents must be used inside <Table>');
  return ctx;
}

/* ─── Root ─── */
type TableProps = {
  C: PageTheme;
  children: React.ReactNode;
  padding?: number;
  minWidth?: number;
};

export function Table({ C, children, padding = 24, minWidth = 248 }: TableProps) {
  const scope = useId().replace(/[^a-zA-Z0-9_-]/g, '');
  return (
    <TableCtx.Provider value={{ C, scope }}>
      <div
        data-cres-table={scope}
        style={{
          width: '100%',
          overflow: 'auto',
          minWidth,
          padding,
          borderRadius: 12,
          border: `1px solid ${C.border}`,
          background: C.surface,
          position: 'relative',
        }}
      >
        <style>{`
          [data-cres-table="${scope}"] table {
            width: 100%;
            border-collapse: collapse;
            font-family: ${FONT};
            font-feature-settings: ${FONT_FEATURES};
            font-size: 14px;
            color: ${C.text};
          }
          [data-cres-table="${scope}"] thead {
            border-bottom: 1px solid ${C.border};
          }
          [data-cres-table="${scope}"] tbody tr {
            transition: background 0.12s ease;
          }
          [data-cres-table="${scope}"] tbody tr td:first-child {
            border-top-left-radius: 4px;
            border-bottom-left-radius: 4px;
          }
          [data-cres-table="${scope}"] tbody tr td:last-child {
            border-top-right-radius: 4px;
            border-bottom-right-radius: 4px;
          }
          [data-cres-table="${scope}"] tbody.cres-body-striped tr:nth-of-type(odd) > td {
            background: ${C.surfaceElevated};
          }
          [data-cres-table="${scope}"] tbody.cres-body-interactive tr:hover > td {
            background: ${C.rowHover};
          }
          [data-cres-table="${scope}"] tfoot {
            border-top: 1px solid ${C.border};
          }
        `}</style>
        <table>{children}</table>
      </div>
    </TableCtx.Provider>
  );
}

/* ─── Colgroup / Col ─── */
Table.Colgroup = function TableColgroup({ children }: { children: React.ReactNode }) {
  return <colgroup>{children}</colgroup>;
};

Table.Col = function TableCol({ style, width }: { style?: React.CSSProperties; width?: string | number }) {
  return <col style={{ ...(width ? { width } : {}), ...style }} />;
};

/* ─── Header ─── */
Table.Header = function TableHeader({ children }: { children: React.ReactNode }) {
  return <thead>{children}</thead>;
};

/* ─── Body ─── */
type BodyProps = {
  children: React.ReactNode;
  striped?: boolean;
  interactive?: boolean;
};

Table.Body = function TableBody({ children, striped, interactive }: BodyProps) {
  const cls = [
    striped ? 'cres-body-striped' : '',
    interactive ? 'cres-body-interactive' : '',
  ].filter(Boolean).join(' ');
  return (
    <>
      {/* spacer tbody — mimics Vercel thead/body gap */}
      <tbody aria-hidden="true">
        <tr style={{ height: 12 }} />
      </tbody>
      <tbody className={cls}>{children}</tbody>
    </>
  );
};

/* ─── Row ─── */
type RowProps = {
  children: React.ReactNode;
  onClick?: () => void;
  style?: React.CSSProperties;
};

Table.Row = function TableRow({ children, onClick, style }: RowProps) {
  return (
    <tr
      onClick={onClick}
      style={{ cursor: onClick ? 'pointer' : undefined, ...style }}
    >
      {children}
    </tr>
  );
};

/* ─── Head cell ─── */
type HeadProps = {
  children?: React.ReactNode;
  align?: 'left' | 'right' | 'center';
  colSpan?: number;
  width?: number | string;
  style?: React.CSSProperties;
};

Table.Head = function TableHead({ children, align = 'left', colSpan, width, style }: HeadProps) {
  const { C } = useTableCtx();
  return (
    <th
      colSpan={colSpan}
      style={{
        height: 40,
        padding: '0 8px',
        textAlign: align,
        verticalAlign: 'middle',
        fontWeight: 500,
        fontSize: 13,
        color: C.textTertiary,
        whiteSpace: 'nowrap',
        ...(width !== undefined ? { width } : {}),
        ...style,
      }}
    >
      {children}
    </th>
  );
};

/* ─── Cell ─── */
type CellProps = {
  children?: React.ReactNode;
  align?: 'left' | 'right' | 'center';
  colSpan?: number;
  style?: React.CSSProperties;
  onClick?: React.MouseEventHandler<HTMLTableCellElement>;
};

Table.Cell = function TableCell({ children, align = 'left', colSpan, style, onClick }: CellProps) {
  return (
    <td
      colSpan={colSpan}
      onClick={onClick}
      style={{
        padding: '10px 8px',
        textAlign: align,
        verticalAlign: 'middle',
        fontSize: 14,
        ...style,
      }}
    >
      {children}
    </td>
  );
};

/* ─── Footer ─── */
Table.Footer = function TableFooter({ children }: { children: React.ReactNode }) {
  return <tfoot>{children}</tfoot>;
};
