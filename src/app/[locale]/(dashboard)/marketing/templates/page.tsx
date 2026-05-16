/** --- YAML
 * name: TemplatesPage
 * description: Dedicated page for editing all message templates (lifecycle + automation).
 *              Desktop: 2-column card grid. Mobile: iOS-style list with chevrons.
 *              Loads saved templates from DB to show "customised" badge per kind.
 * created: 2026-05-16
 * --- */

'use client';

import { useEffect, useState, useCallback } from 'react';
import {
  Bell, Clock, Star, Heart, BarChart3, CheckCircle2,
  CalendarClock, XCircle, ChevronRight, Pencil, RotateCcw,
  ArrowLeft, Gauge,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { usePageTheme } from '@/lib/dashboard-theme';
import { useMaster } from '@/hooks/use-master';
import { createClient } from '@/lib/supabase/client';
import { TemplateEditorDialog, AUTOMATION_KIND_SPECS, type AutomationKindSpec } from '@/components/marketing/template-editor-dialog';

interface SavedKind {
  kind: string;
}

type GroupDef = {
  label: string;
  kinds: string[];
};

const GROUPS: GroupDef[] = [
  {
    label: 'Записи',
    kinds: ['booking_confirmation', 'appointment_rescheduled', 'appointment_cancelled'],
  },
  {
    label: 'Нагадування',
    kinds: ['reminder_24h', 'reminder_2h', 'pre_visit_master'],
  },
  {
    label: 'Автоматика',
    kinds: ['review_request', 'cadence', 'win_back', 'nps'],
  },
];

const KIND_ICON: Record<string, React.ComponentType<{ className?: string; style?: React.CSSProperties }>> = {
  booking_confirmation:   CheckCircle2,
  appointment_rescheduled: CalendarClock,
  appointment_cancelled:  XCircle,
  reminder_24h:           Clock,
  reminder_2h:            Bell,
  pre_visit_master:       CalendarClock,
  review_request:         Star,
  cadence:                BarChart3,
  win_back:               Heart,
  nps:                    Gauge,
};

const KIND_ACCENT: Record<string, string> = {
  booking_confirmation:   '#10b981',
  appointment_rescheduled: '#f59e0b',
  appointment_cancelled:  '#ef4444',
  reminder_24h:           '#6366f1',
  reminder_2h:            '#60a5fa',
  pre_visit_master:       '#22d3ee',
  review_request:         '#f59e0b',
  cadence:                '#10b981',
  win_back:               '#ec4899',
  nps:                    '#06b6d4',
};

export default function TemplatesPage() {
  const { C } = usePageTheme();
  const { master } = useMaster();
  const router = useRouter();
  const [savedKinds, setSavedKinds] = useState<Set<string>>(new Set());
  const [loadingKinds, setLoadingKinds] = useState(true);
  const [editing, setEditing] = useState<AutomationKindSpec | null>(null);
  const [isMobileView, setIsMobileView] = useState(false);

  useEffect(() => {
    const check = () => setIsMobileView(window.innerWidth < 768);
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  const loadSaved = useCallback(async () => {
    if (!master?.id) return;
    const supabase = createClient();
    const { data } = await supabase
      .from('message_templates')
      .select('kind')
      .eq('master_id', master.id);
    if (data) {
      setSavedKinds(new Set((data as SavedKind[]).map((r) => r.kind)));
    }
    setLoadingKinds(false);
  }, [master?.id]);

  useEffect(() => { loadSaved(); }, [loadSaved]);

  if (isMobileView) {
    return (
      <div style={{ minHeight: '100dvh', background: '#f8fafc', paddingBottom: 80 }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '16px 16px 8px', background: '#fff', borderBottom: '1px solid #f1f5f9' }}>
          <button
            type="button"
            onClick={() => router.back()}
            style={{ width: 36, height: 36, borderRadius: '50%', border: '1px solid #e2e8f0', background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0 }}
          >
            <ArrowLeft style={{ width: 16, height: 16, color: '#64748b' }} />
          </button>
          <div>
            <div style={{ fontSize: 17, fontWeight: 700, color: '#0f172a' }}>Шаблони</div>
            <div style={{ fontSize: 12, color: '#64748b' }}>Тексти автоматичних повідомлень</div>
          </div>
        </div>

        {/* Groups */}
        <div style={{ padding: '16px 16px 0' }}>
          {GROUPS.map((group) => {
            const specs = group.kinds
              .map((k) => AUTOMATION_KIND_SPECS[k])
              .filter(Boolean) as AutomationKindSpec[];
            return (
              <div key={group.label} style={{ marginBottom: 20 }}>
                <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: '#94a3b8', marginBottom: 8, paddingLeft: 4 }}>
                  {group.label}
                </div>
                <div style={{ background: '#fff', borderRadius: 14, overflow: 'hidden', border: '1px solid #f1f5f9' }}>
                  {specs.map((spec, idx) => {
                    const Icon = KIND_ICON[spec.kind] ?? Pencil;
                    const accent = KIND_ACCENT[spec.kind] ?? '#6366f1';
                    const isCustom = !loadingKinds && savedKinds.has(spec.kind);
                    const isLast = idx === specs.length - 1;
                    return (
                      <button
                        key={spec.kind}
                        type="button"
                        onClick={() => setEditing(spec)}
                        style={{
                          display: 'flex', alignItems: 'center', gap: 12,
                          width: '100%', padding: '13px 14px',
                          background: 'transparent', border: 'none', cursor: 'pointer',
                          borderBottom: isLast ? 'none' : '1px solid #f8fafc',
                          textAlign: 'left',
                        }}
                      >
                        <div style={{
                          width: 36, height: 36, borderRadius: 10, flexShrink: 0,
                          background: `${accent}18`, display: 'flex', alignItems: 'center', justifyContent: 'center',
                        }}>
                          <Icon style={{ width: 16, height: 16, color: accent }} />
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 14, fontWeight: 600, color: '#0f172a', display: 'flex', alignItems: 'center', gap: 6 }}>
                            {spec.title}
                            {isCustom && (
                              <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 6px', borderRadius: 20, background: '#2563eb18', color: '#2563eb' }}>
                                змінено
                              </span>
                            )}
                          </div>
                          <div style={{ fontSize: 12, color: '#64748b', marginTop: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {spec.description}
                          </div>
                        </div>
                        <ChevronRight style={{ width: 14, height: 14, color: '#cbd5e1', flexShrink: 0 }} />
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>

        {master && editing && (
          <TemplateEditorDialog
            open
            onOpenChange={(v) => { if (!v) { setEditing(null); loadSaved(); } }}
            spec={editing}
            masterId={master.id}
          />
        )}
      </div>
    );
  }

  // ── Desktop ────────────────────────────────────────────────────────────────
  return (
    <div style={{ padding: '28px 28px 60px', maxWidth: 900 }}>
      {/* Header */}
      <div style={{ marginBottom: 28 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: C.text, margin: '0 0 4px' }}>Шаблони повідомлень</h1>
        <p style={{ fontSize: 14, color: C.textSecondary, margin: 0 }}>
          Налаштуйте тексти автоматичних повідомлень клієнтам. Якщо шаблон не змінено — клієнт отримує стандартний текст.
        </p>
      </div>

      {GROUPS.map((group) => {
        const specs = group.kinds
          .map((k) => AUTOMATION_KIND_SPECS[k])
          .filter(Boolean) as AutomationKindSpec[];
        return (
          <div key={group.label} style={{ marginBottom: 28 }}>
            <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: C.textSecondary, marginBottom: 10 }}>
              {group.label}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 12 }}>
              {specs.map((spec) => {
                const Icon = KIND_ICON[spec.kind] ?? Pencil;
                const accent = KIND_ACCENT[spec.kind] ?? '#6366f1';
                const isCustom = !loadingKinds && savedKinds.has(spec.kind);
                return (
                  <button
                    key={spec.kind}
                    type="button"
                    onClick={() => setEditing(spec)}
                    style={{
                      display: 'flex', alignItems: 'flex-start', gap: 12,
                      padding: '16px 16px', borderRadius: 14,
                      background: C.surface, border: `1px solid ${C.border}`,
                      cursor: 'pointer', textAlign: 'left',
                      transition: 'box-shadow 0.15s',
                    }}
                    onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.boxShadow = '0 2px 8px rgba(0,0,0,0.08)'; }}
                    onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.boxShadow = 'none'; }}
                  >
                    <div style={{
                      width: 38, height: 38, borderRadius: 10, flexShrink: 0,
                      background: `${accent}18`, display: 'flex', alignItems: 'center', justifyContent: 'center', marginTop: 1,
                    }}>
                      <Icon style={{ width: 17, height: 17, color: accent }} />
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3, flexWrap: 'wrap' }}>
                        <span style={{ fontSize: 14, fontWeight: 600, color: C.text }}>{spec.title}</span>
                        {isCustom && (
                          <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 6px', borderRadius: 20, background: '#2563eb18', color: '#2563eb' }}>
                            змінено
                          </span>
                        )}
                      </div>
                      <div style={{ fontSize: 12, color: C.textSecondary, lineHeight: 1.4 }}>{spec.description}</div>
                      <div style={{ marginTop: 10, display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 12, fontWeight: 600, color: accent }}>
                        <Pencil style={{ width: 11, height: 11 }} />
                        {isCustom ? 'Редагувати' : 'Налаштувати'}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        );
      })}

      {master && editing && (
        <TemplateEditorDialog
          open
          onOpenChange={(v) => { if (!v) { setEditing(null); loadSaved(); } }}
          spec={editing}
          masterId={master.id}
        />
      )}
    </div>
  );
}
