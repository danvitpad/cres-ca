/** --- YAML
 * name: Services Page
 * description: Fresha-exact service catalog — categories card, service rows with left border accent, three-dot menus, inline Fresha theming
 * --- */

'use client';

import { useState, useEffect, useCallback } from 'react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/client';
import { useMaster } from '@/hooks/use-master';
import { useConfirm } from '@/hooks/use-confirm';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { CategoryManager, type Category } from '@/components/shared/category-manager';
import { Plus, MoreVertical, Search, SlidersHorizontal, ArrowUpDown, Briefcase } from 'lucide-react';
import { motion } from 'framer-motion';
import { usePageTheme, FONT, FONT_FEATURES, CURRENCY, pageContainer } from '@/lib/dashboard-theme';

const serviceSchema = z.object({
  name: z.string().min(1),
  duration_minutes: z.number().int().min(5).max(480),
  price: z.number().min(0),
  currency: z.string().default('UAH'),
  category_id: z.string().uuid().nullable().optional(),
  requires_prepayment: z.boolean().default(false),
  prepayment_amount: z.number().min(0).default(0),
  color: z.string().default('#6366f1'),
  upsell_services: z.array(z.string().uuid()).default([]),
  preparation: z.string().nullable().optional(),
  aftercare: z.string().nullable().optional(),
  faq: z.array(z.object({ q: z.string(), a: z.string() })).default([]),
  checklist: z.array(z.string()).default([]),
});

interface FaqItem {
  q: string;
  a: string;
}

interface ServiceRow {
  id: string;
  name: string;
  duration_minutes: number;
  price: number;
  currency: string;
  color: string;
  category_id: string | null;
  requires_prepayment: boolean;
  prepayment_amount: number;
  is_active: boolean;
  upsell_services: string[] | null;
  preparation: string | null;
  aftercare: string | null;
  faq: FaqItem[] | null;
  category: { name: string; color: string } | null;
}

function ServicesCatalogueView() {
  const t = useTranslations('services');
  const tp = useTranslations('profile');
  const tc = useTranslations('common');
  const confirm = useConfirm();
  const { C, isDark, mounted } = usePageTheme();
  const { master, loading: masterLoading } = useMaster();
  const [services, setServices] = useState<ServiceRow[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<ServiceRow | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [menuOpenId, setMenuOpenId] = useState<string | null>(null);

  const loadServices = useCallback(async () => {
    if (!master) return;
    const supabase = createClient();
    const { data } = await supabase
      .from('services')
      .select('*, category:service_categories(name, color)')
      .eq('master_id', master.id)
      .order('created_at');
    if (data) setServices(data as unknown as ServiceRow[]);
    setLoading(false);
  }, [master]);

  useEffect(() => { loadServices(); }, [loadServices]);

  // Realtime — auto-refresh on service changes
  useEffect(() => {
    if (!master?.id) return;
    const supabase = createClient();
    const channel = supabase
      .channel(`services_rt_${master.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'services', filter: `master_id=eq.${master.id}` }, () => { loadServices(); })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [master?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  function openEdit(service: ServiceRow) {
    setEditing(service);
    setDialogOpen(true);
  }

  function openNew() {
    setEditing(null);
    setDialogOpen(true);
  }

  async function handleDelete(id: string) {
    const ok = await confirm({
      title: 'Удалить услугу?',
      description: 'Услугу нельзя будет восстановить. Прошлые записи с ней останутся.',
      confirmLabel: 'Удалить',
      destructive: true,
    });
    if (!ok) return;
    const supabase = createClient();
    const { error } = await supabase.from('services').delete().eq('id', id);
    if (error) toast.error(error.message);
    else loadServices();
  }

  if (masterLoading || loading) {
    return (
      <div style={{ padding: '32px 40px', fontFamily: FONT, fontFeatureSettings: FONT_FEATURES, background: C.bg }}>
        <div style={{ height: 32, width: 200, backgroundColor: C.surfaceElevated, borderRadius: 8, marginBottom: 16 }} />
        <div style={{ height: 200, width: '100%', backgroundColor: C.surfaceElevated, borderRadius: 12 }} />
      </div>
    );
  }

  if (!master) return null;

  // Group services by category
  const grouped = new Map<string, { category: { name: string; color: string } | null; services: ServiceRow[] }>();
  const uncategorized: ServiceRow[] = [];

  for (const s of services) {
    if (s.category) {
      const key = s.category_id || 'none';
      if (!grouped.has(key)) {
        grouped.set(key, { category: s.category, services: [] });
      }
      grouped.get(key)!.services.push(s);
    } else {
      uncategorized.push(s);
    }
  }

  // Filter by selected category + search
  let filteredServices = selectedCategory === 'all'
    ? services
    : selectedCategory === 'none'
      ? uncategorized
      : services.filter((s) => s.category_id === selectedCategory);

  if (searchQuery.trim()) {
    const q = searchQuery.toLowerCase();
    filteredServices = filteredServices.filter((s) => s.name.toLowerCase().includes(q));
  }

  // Get active category name
  const activeCatName = selectedCategory === 'all'
    ? null
    : selectedCategory === 'none'
      ? t('uncategorized')
      : Array.from(grouped.entries()).find(([k]) => k === selectedCategory)?.[1]?.category?.name;

  // Duration formatter
  function formatDuration(min: number): string {
    const h = Math.floor(min / 60);
    const m = min % 60;
    if (h === 0) return `${m} ${t('duration')}`;
    if (m === 0) return `${h} ${t('hours') || 'ч'}`;
    return `${h} ${t('hours') || 'ч'} ${m} ${t('duration')}`;
  }

  return (
    <div style={{ padding: '32px 40px', fontFamily: FONT, fontFeatureSettings: FONT_FEATURES, background: C.bg }}>
      {/* ── Page header (Fresha style) ── */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 28, fontWeight: 700, color: C.text, margin: 0, lineHeight: 1.2 }}>
            {t('serviceMenu')}
          </h1>
          <p style={{ fontSize: 14, color: C.textSecondary, marginTop: 6, lineHeight: 1.5 }}>
            {t('servicesDescription') || `${services.length} ${t('servicesCount')}`}
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <button
            onClick={openNew}
            style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '10px 20px', borderRadius: 999, border: `1.5px solid ${C.accent}`,
              backgroundColor: 'transparent', color: C.accent,
              fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: FONT,
              transition: 'all 150ms',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = C.accentSoft; }}
            onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; }}
          >
            <Plus style={{ width: 16, height: 16 }} />
            {t('addService')}
          </button>
        </div>
      </div>

      {/* ── Search bar (Fresha style) ── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 28 }}>
        <div style={{
          display: 'flex', alignItems: 'center', gap: 8, flex: 1, maxWidth: 400,
          padding: '10px 14px', borderRadius: 999,
          backgroundColor: C.surfaceElevated, border: `1px solid ${C.border}`,
        }}>
          <Search style={{ width: 16, height: 16, color: C.textTertiary, flexShrink: 0 }} />
          <input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={t('searchPlaceholder') || 'Поиск по названию услуги'}
            style={{
              border: 'none', outline: 'none', backgroundColor: 'transparent',
              fontSize: 14, color: C.text, width: '100%', fontFamily: FONT,
            }}
          />
        </div>
        <button style={{
          display: 'flex', alignItems: 'center', gap: 6,
          padding: '10px 16px', borderRadius: 999,
          border: `1px solid ${C.border}`, backgroundColor: 'transparent',
          color: C.text, fontSize: 14, fontWeight: 500, cursor: 'pointer', fontFamily: FONT,
        }}>
          <SlidersHorizontal style={{ width: 14, height: 14 }} />
          {t('filters') || 'Фильтры'}
        </button>
        <div style={{ flex: 1 }} />
        <button style={{
          display: 'flex', alignItems: 'center', gap: 6,
          padding: '10px 16px', borderRadius: 999,
          border: `1px solid ${C.border}`, backgroundColor: 'transparent',
          color: C.text, fontSize: 14, fontWeight: 500, cursor: 'pointer', fontFamily: FONT,
        }}>
          <ArrowUpDown style={{ width: 14, height: 14 }} />
          {t('reorder') || 'Изменить порядок'}
        </button>
      </div>

      {/* ── Main content: categories card + service rows ── */}
      <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap' }}>
        {/* Categories card (Fresha style) */}
        <div style={{
          width: 280, flexShrink: 0, maxWidth: '100%',
          border: `1px solid ${C.border}`, borderRadius: 12,
          padding: '20px 0', alignSelf: 'flex-start',
        }}>
          <h3 style={{ fontSize: 18, fontWeight: 700, color: C.text, margin: '0 20px 16px', fontFamily: FONT }}>
            {t('categories') || 'Категории'}
          </h3>
          {/* All categories */}
          <button
            onClick={() => setSelectedCategory('all')}
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              width: '100%', padding: '10px 20px', border: 'none', cursor: 'pointer',
              backgroundColor: selectedCategory === 'all' ? C.accentSoft : 'transparent',
              borderLeft: selectedCategory === 'all' ? `3px solid ${C.accent}` : '3px solid transparent',
              color: selectedCategory === 'all' ? C.accent : C.text,
              fontSize: 14, fontWeight: selectedCategory === 'all' ? 600 : 400,
              fontFamily: FONT, transition: 'all 150ms',
            }}
          >
            <span>{t('allCategories') || 'Все категории'}</span>
            <span style={{
              fontSize: 12, fontWeight: 500, color: C.textTertiary,
              backgroundColor: C.surfaceElevated, borderRadius: 999, padding: '2px 8px',
            }}>
              {services.length}
            </span>
          </button>
          {Array.from(grouped.entries()).map(([key, { category, services: catServices }]) => (
            <button
              key={key}
              onClick={() => setSelectedCategory(key)}
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                width: '100%', padding: '10px 20px', border: 'none', cursor: 'pointer',
                backgroundColor: selectedCategory === key ? C.accentSoft : 'transparent',
                borderLeft: selectedCategory === key ? `3px solid ${C.accent}` : '3px solid transparent',
                color: selectedCategory === key ? C.accent : C.text,
                fontSize: 14, fontWeight: selectedCategory === key ? 600 : 400,
                fontFamily: FONT, transition: 'all 150ms',
              }}
            >
              <span>{category?.name}</span>
              <span style={{
                fontSize: 12, fontWeight: 500, color: C.textTertiary,
                backgroundColor: C.surfaceElevated, borderRadius: 999, padding: '2px 8px',
              }}>
                {catServices.length}
              </span>
            </button>
          ))}
          {uncategorized.length > 0 && (
            <button
              onClick={() => setSelectedCategory('none')}
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                width: '100%', padding: '10px 20px', border: 'none', cursor: 'pointer',
                backgroundColor: selectedCategory === 'none' ? C.accentSoft : 'transparent',
                borderLeft: selectedCategory === 'none' ? `3px solid ${C.accent}` : '3px solid transparent',
                color: selectedCategory === 'none' ? C.accent : C.text,
                fontSize: 14, fontWeight: selectedCategory === 'none' ? 600 : 400,
                fontFamily: FONT, transition: 'all 150ms',
              }}
            >
              <span>{t('uncategorized')}</span>
              <span style={{
                fontSize: 12, fontWeight: 500, color: C.textTertiary,
                backgroundColor: C.surfaceElevated, borderRadius: 999, padding: '2px 8px',
              }}>
                {uncategorized.length}
              </span>
            </button>
          )}
          <div style={{ padding: '12px 20px 0' }}>
            <CategoryManager masterId={master.id} onCategoriesChange={setCategories} />
          </div>
        </div>

        {/* Service rows (Fresha style — left border accent) */}
        <div style={{ flex: 1, minWidth: 0 }}>
          {/* Category group header */}
          {activeCatName && (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
              <h2 style={{ fontSize: 20, fontWeight: 700, color: C.text, fontFamily: FONT }}>{activeCatName}</h2>
            </div>
          )}

          {filteredServices.length === 0 ? (
            <div style={{
              display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
              padding: '80px 0', textAlign: 'center',
            }}>
              <Briefcase style={{ width: 48, height: 48, color: C.textTertiary, marginBottom: 12 }} />
              <p style={{ fontSize: 16, fontWeight: 600, color: C.text, fontFamily: FONT }}>{t('noServices')}</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {filteredServices.map((s, i) => (
                <motion.div
                  key={s.id}
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.03 }}
                  style={{
                    display: 'flex', alignItems: 'center',
                    padding: '16px 20px', borderRadius: 10,
                    border: `1px solid ${C.border}`,
                    borderLeft: `4px solid ${s.color}`,
                    backgroundColor: C.bg,
                    cursor: 'pointer', transition: 'background-color 150ms',
                    position: 'relative',
                  }}
                  onClick={() => openEdit(s)}
                  onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = C.rowHover; }}
                  onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = C.bg; }}
                >
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 15, fontWeight: 600, color: C.text, fontFamily: FONT }}>
                      {s.name}
                    </div>
                    <div style={{ fontSize: 13, color: C.textSecondary, marginTop: 3, fontFamily: FONT }}>
                      {formatDuration(s.duration_minutes)}
                    </div>
                  </div>
                  <div style={{ fontSize: 15, fontWeight: 600, color: C.text, marginRight: 12, whiteSpace: 'nowrap', fontFamily: FONT }}>
                    {s.price.toLocaleString()} ₴
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setMenuOpenId(menuOpenId === s.id ? null : s.id);
                    }}
                    style={{
                      width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center',
                      borderRadius: 6, border: 'none', backgroundColor: 'transparent',
                      cursor: 'pointer', color: C.textSecondary, transition: 'color 100ms',
                    }}
                  >
                    <MoreVertical style={{ width: 18, height: 18 }} />
                  </button>
                  {/* Three-dot dropdown menu */}
                  {menuOpenId === s.id && (
                    <div
                      style={{
                        position: 'absolute', right: 8, top: '100%', zIndex: 50,
                        backgroundColor: C.surface, border: `1px solid ${C.border}`,
                        borderRadius: 10, boxShadow: '0 8px 24px rgba(0,0,0,0.15)',
                        overflow: 'hidden', minWidth: 160, fontFamily: FONT,
                      }}
                      onClick={(e) => e.stopPropagation()}
                    >
                      <button
                        onClick={() => { setMenuOpenId(null); openEdit(s); }}
                        style={{
                          display: 'block', width: '100%', padding: '10px 16px',
                          border: 'none', backgroundColor: 'transparent', textAlign: 'left',
                          fontSize: 14, color: C.text, cursor: 'pointer', fontFamily: FONT,
                          transition: 'background-color 100ms',
                        }}
                        onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = C.rowHover; }}
                        onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; }}
                      >
                        {tp('editService') || 'Редактировать'}
                      </button>
                      <button
                        onClick={() => { setMenuOpenId(null); handleDelete(s.id); }}
                        style={{
                          display: 'block', width: '100%', padding: '10px 16px',
                          border: 'none', backgroundColor: 'transparent', textAlign: 'left',
                          fontSize: 14, color: '#d4163a', cursor: 'pointer', fontFamily: FONT,
                          transition: 'background-color 100ms',
                        }}
                        onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = C.rowHover; }}
                        onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; }}
                      >
                        {tc('delete') || 'Удалить'}
                      </button>
                    </div>
                  )}
                </motion.div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── Edit/Add dialog ── */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="!max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? tp('editService') : t('addService')}</DialogTitle>
          </DialogHeader>
          <ServiceForm
            masterId={master.id}
            categories={categories}
            allServices={services}
            editing={editing}
            onSaved={() => { setDialogOpen(false); loadServices(); }}
            onCancel={() => setDialogOpen(false)}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}

function ServiceForm({
  masterId,
  categories,
  allServices,
  editing,
  onSaved,
  onCancel,
}: {
  masterId: string;
  categories: Category[];
  allServices: ServiceRow[];
  editing: ServiceRow | null;
  onSaved: () => void;
  onCancel: () => void;
}) {
  const t = useTranslations('services');
  const tp = useTranslations('profile');
  const tc = useTranslations('common');
  const [saving, setSaving] = useState(false);
  const [name, setName] = useState(editing?.name ?? '');
  const [duration, setDuration] = useState(String(editing?.duration_minutes ?? 60));
  const [price, setPrice] = useState(String(editing?.price ?? 0));
  const [currency, setCurrency] = useState(editing?.currency ?? 'UAH');
  const [categoryId, setCategoryId] = useState<string | null>(editing?.category_id ?? null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [recommendedMasterId, setRecommendedMasterId] = useState<string | null>(((editing as any)?.recommended_master_id as string | null | undefined) ?? null);
  const [partners, setPartners] = useState<{ id: string; full_name: string }[]>([]);
  const [color, setColor] = useState(editing?.color ?? '#6366f1');
  const [requiresPrepayment, setRequiresPrepayment] = useState(editing?.requires_prepayment ?? false);
  const [prepaymentAmount, setPrepaymentAmount] = useState(String(editing?.prepayment_amount ?? 0));
  const [upsellServices, setUpsellServices] = useState<string[]>(editing?.upsell_services ?? []);
  const [isMobile, setIsMobile] = useState<boolean>(((editing as unknown) as { is_mobile?: boolean } | null)?.is_mobile ?? false);
  const [travelBuffer, setTravelBuffer] = useState<string>(String(((editing as unknown) as { travel_buffer_minutes?: number } | null)?.travel_buffer_minutes ?? 0));
  const [preparation, setPreparation] = useState(editing?.preparation ?? '');
  const [aftercare, setAftercare] = useState(editing?.aftercare ?? '');
  const [checklistText, setChecklistText] = useState(
    ((editing as unknown as { checklist?: string[] } | null)?.checklist ?? []).join('\n'),
  );
  const [faqText, setFaqText] = useState(
    (editing?.faq ?? []).map((f) => `${f.q} :: ${f.a}`).join('\n'),
  );
  const upsellCandidates = allServices.filter((s) => s.id !== editing?.id);

  const [inventoryItems, setInventoryItems] = useState<
    { id: string; name: string; unit: string }[]
  >([]);
  const [recipeMap, setRecipeMap] = useState<Record<string, number>>({});

  useEffect(() => {
    const supabase = createClient();
    (async () => {
      const { data } = await supabase
        .from('inventory_items')
        .select('id, name, unit')
        .eq('master_id', masterId)
        .order('name');
      setInventoryItems((data ?? []) as { id: string; name: string; unit: string }[]);
      if (editing) {
        const { data: recs } = await supabase
          .from('service_recipes')
          .select('item_id, quantity')
          .eq('service_id', editing.id);
        const map: Record<string, number> = {};
        for (const r of (recs ?? []) as { item_id: string; quantity: number }[]) {
          map[r.item_id] = Number(r.quantity);
        }
        setRecipeMap(map);
      }

      // Load active partners for the "recommend another master" dropdown
      try {
        const res = await fetch('/api/partners/list');
        if (res.ok) {
          const json = await res.json();
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const list = (json.active as any[] || []).map(p => ({
            id: p.partner.id,
            full_name: p.partner.full_name || 'Без имени',
          }));
          setPartners(list);
        }
      } catch { /* partners optional */ }
    })();
  }, [masterId, editing]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const parsed = serviceSchema.safeParse({
      name,
      duration_minutes: parseInt(duration),
      price: parseFloat(price),
      currency,
      category_id: categoryId || null,
      color,
      requires_prepayment: requiresPrepayment,
      prepayment_amount: parseFloat(prepaymentAmount) || 0,
      upsell_services: upsellServices,
      preparation: preparation.trim() || null,
      aftercare: aftercare.trim() || null,
      faq: faqText
        .split('\n')
        .map((l) => l.trim())
        .filter(Boolean)
        .map((l) => {
          const [q, ...rest] = l.split('::');
          return { q: q.trim(), a: rest.join('::').trim() };
        })
        .filter((f) => f.q && f.a),
      checklist: checklistText
        .split('\n')
        .map((l) => l.trim())
        .filter(Boolean),
    });

    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? tc('error'));
      return;
    }

    setSaving(true);
    const supabase = createClient();
    const payload = { ...parsed.data, master_id: masterId, is_mobile: isMobile, travel_buffer_minutes: Number(travelBuffer) || 0, recommended_master_id: recommendedMasterId };

    const { error } = editing
      ? await supabase.from('services').update(payload).eq('id', editing.id)
      : await supabase.from('services').insert(payload);

    setSaving(false);
    if (error) { toast.error(error.message); return; }

    // Sync service_recipes
    const serviceId = editing?.id ??
      (await supabase
        .from('services')
        .select('id')
        .eq('master_id', masterId)
        .eq('name', parsed.data.name)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()).data?.id;
    if (serviceId) {
      await supabase.from('service_recipes').delete().eq('service_id', serviceId);
      const recipeRows = Object.entries(recipeMap)
        .filter(([, q]) => q > 0)
        .map(([item_id, quantity]) => ({ service_id: serviceId, item_id, quantity }));
      if (recipeRows.length > 0) {
        await supabase.from('service_recipes').insert(recipeRows);
      }
    }

    toast.success(tc('success'));
    onSaved();
  }

  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [categoryDialogOpen, setCategoryDialogOpen] = useState(false);

  return (
    <>
    <form onSubmit={handleSubmit} className="space-y-5">
      {/* Name */}
      <div className="space-y-1.5">
        <Label htmlFor="sname" className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Название услуги
        </Label>
        <Input
          id="sname"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Напр.: Женская стрижка"
          required
          className="border-2 border-border focus-visible:border-primary"
        />
      </div>

      {/* Duration + Price */}
      <div className="grid gap-4 grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="sdur" className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Время сеанса, мин
          </Label>
          <Input
            id="sdur"
            type="number"
            min={5}
            max={480}
            step="5"
            value={duration}
            onChange={(e) => setDuration(e.target.value)}
            placeholder="60"
            className="border-2 border-border focus-visible:border-primary"
            list="duration-suggestions"
          />
          <datalist id="duration-suggestions">
            <option value="15" />
            <option value="30" />
            <option value="45" />
            <option value="60" />
            <option value="90" />
            <option value="120" />
            <option value="180" />
            <option value="240" />
          </datalist>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="sprice" className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Цена, ₴
          </Label>
          <Input
            id="sprice"
            type="number"
            min={0}
            step="1"
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            placeholder="500"
            className="border-2 border-border focus-visible:border-primary"
          />
        </div>
      </div>

      {/* Category with inline "add new" */}
      <div className="space-y-1.5">
        <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Категория
        </Label>
        <div className="flex gap-2">
          <Select
            value={categoryId ?? ''}
            onValueChange={(v) => v && setCategoryId(v)}
          >
            <SelectTrigger className="flex-1 border-2 border-border">
              <SelectValue placeholder={categories.length === 0 ? 'Сначала создайте категорию →' : 'Выберите категорию'} />
            </SelectTrigger>
            <SelectContent>
              {categories.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  <span className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full" style={{ background: c.color || '#64748b' }} />
                    {c.name}
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            type="button"
            variant="outline"
            className="border-2 border-border"
            onClick={() => setCategoryDialogOpen(true)}
          >
            + Создать
          </Button>
        </div>
        <p className="text-[11px] text-muted-foreground">
          Цвет услуги в календаре определяется категорией.
        </p>
      </div>

      {/* Recommend partner with this service */}
      {partners.length > 0 && (
        <div className="space-y-1.5">
          <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Рекомендовать мастера
          </Label>
          <Select
            value={recommendedMasterId ?? ''}
            onValueChange={(v) => setRecommendedMasterId(v || null)}
          >
            <SelectTrigger className="flex-1 border-2 border-border">
              <SelectValue placeholder="Никого не рекомендовать" />
            </SelectTrigger>
            <SelectContent>
              {partners.map(p => (
                <SelectItem key={p.id} value={p.id}>{p.full_name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-[11px] text-muted-foreground">
            Партнёр будет показан как «Также рекомендую» на публичной карточке услуги.
          </p>
          {recommendedMasterId && (
            <button
              type="button"
              onClick={() => setRecommendedMasterId(null)}
              className="text-[11px] text-primary hover:underline"
            >
              × Убрать рекомендацию
            </button>
          )}
        </div>
      )}

      {/* Toggles */}
      <div className="flex flex-col gap-3 rounded-lg border-2 border-border p-3">
        <label className="flex items-center justify-between cursor-pointer">
          <span className="text-sm">Выездная услуга (я еду к клиенту)</span>
          <Switch checked={isMobile} onCheckedChange={setIsMobile} />
        </label>
        {isMobile && (
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Буфер на дорогу, мин</Label>
            <Input
              type="number" min={0} max={180}
              value={travelBuffer}
              onChange={(e) => setTravelBuffer(e.target.value)}
              className="border-2 border-border h-9"
            />
          </div>
        )}

        <label className="flex items-center justify-between cursor-pointer">
          <span className="text-sm">Предоплата обязательна</span>
          <Switch checked={requiresPrepayment} onCheckedChange={setRequiresPrepayment} />
        </label>
        {requiresPrepayment && (
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Сумма предоплаты, ₴</Label>
            <Input
              type="number" min={0} step="1"
              value={prepaymentAmount}
              onChange={(e) => setPrepaymentAmount(e.target.value)}
              className="border-2 border-border h-9"
            />
          </div>
        )}
      </div>

      {/* Advanced — collapsed by default */}
      <div>
        <button
          type="button"
          onClick={() => setAdvancedOpen(!advancedOpen)}
          className="text-sm text-primary font-medium hover:underline"
        >
          {advancedOpen ? '− Скрыть' : '+ Расширенные настройки'}
        </button>
        {advancedOpen && (
          <div className="mt-3 space-y-4">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Как подготовиться              </Label>
              <Textarea
                rows={2}
                value={preparation}
                onChange={(e) => setPreparation(e.target.value)}
                placeholder="Приходи без макияжа, волосы чистые и сухие"
                className="border-2 border-border focus-visible:border-primary"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Уход после              </Label>
              <Textarea
                rows={2}
                value={aftercare}
                onChange={(e) => setAftercare(e.target.value)}
                placeholder="Не мыть голову первые 24 часа"
                className="border-2 border-border focus-visible:border-primary"
              />
            </div>
            {inventoryItems.length > 0 && (
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Расходники на визит                </Label>
                <p className="text-[11px] text-muted-foreground -mt-1">
                  Автоматически спишется со склада когда услуга завершена.
                </p>
                <div className="max-h-44 space-y-1 overflow-y-auto rounded-md border-2 border-border p-2">
                  {inventoryItems.map((it) => (
                    <div key={it.id} className="flex items-center gap-2 text-sm">
                      <span className="flex-1 truncate">{it.name}</span>
                      <Input
                        type="number" min={0} step="0.01"
                        className="h-7 w-20 border border-border"
                        value={recipeMap[it.id] ?? ''}
                        placeholder="0"
                        onChange={(e) => {
                          const v = e.target.value;
                          setRecipeMap((prev) => {
                            const next = { ...prev };
                            if (v === '') delete next[it.id]; else next[it.id] = parseFloat(v) || 0;
                            return next;
                          });
                        }}
                      />
                      <span className="w-8 text-[11px] text-muted-foreground">{it.unit}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="flex gap-2 justify-end pt-2 border-t border-border">
        <Button type="button" variant="outline" onClick={onCancel}>{tc('cancel')}</Button>
        <Button type="submit" disabled={saving}>
          {saving ? tc('loading') : editing ? 'Сохранить' : 'Создать услугу'}
        </Button>
      </div>
    </form>

    {/* Category creation dialog */}
    <CategoryDialog
      open={categoryDialogOpen}
      onOpenChange={setCategoryDialogOpen}
      masterId={masterId}
      onCreated={(newId) => {
        setCategoryId(newId);
        setCategoryDialogOpen(false);
        // Trigger parent to refetch categories
        window.dispatchEvent(new Event('services:refresh'));
      }}
    />
    </>
  );
}

/* ─── Category Dialog — name + color swatches ─── */
function CategoryDialog({
  open,
  onOpenChange,
  masterId,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  masterId: string;
  onCreated: (id: string) => void;
}) {
  const [name, setName] = useState('');
  const [color, setColor] = useState('#7c3aed');
  const [saving, setSaving] = useState(false);

  const SWATCHES = [
    '#7c3aed', '#ec4899', '#ef4444', '#f59e0b',
    '#10b981', '#06b6d4', '#3b82f6', '#6366f1',
    '#8b5cf6', '#f43f5e', '#64748b', '#0f172a',
  ];

  async function save() {
    if (!name.trim()) { toast.error('Введите название категории'); return; }
    setSaving(true);
    const supabase = createClient();
    const { data, error } = await supabase
      .from('service_categories')
      .insert({ master_id: masterId, name: name.trim(), color })
      .select('id')
      .single();
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success('Категория создана');
    setName('');
    setColor('#7c3aed');
    if (data?.id) onCreated(data.id);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="!max-w-md">
        <DialogHeader>
          <DialogTitle>Новая категория услуг</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Название категории
            </Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Напр.: Стрижки и укладки"
              autoFocus
              className="border-2 border-border focus-visible:border-primary"
            />
          </div>
          <div className="space-y-2">
            <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Цвет
            </Label>
            <div className="flex flex-wrap gap-2">
              {SWATCHES.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setColor(c)}
                  style={{
                    width: 32, height: 32, borderRadius: 999,
                    background: c,
                    border: color === c ? '3px solid #fff' : '2px solid transparent',
                    boxShadow: color === c ? `0 0 0 2px ${c}` : '0 0 0 1px rgba(0,0,0,0.1)',
                    cursor: 'pointer',
                  }}
                  aria-label={c}
                />
              ))}
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2 border-t border-border">
            <Button variant="outline" onClick={() => onOpenChange(false)}>Отмена</Button>
            <Button onClick={save} disabled={saving || !name.trim()}>
              {saving ? 'Сохранение...' : 'Создать'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/* ─── Catalogue tab router: Услуги / Склад / Постоянные расходы ─── */
import { useSearchParams, useRouter, usePathname } from 'next/navigation';
import { Scissors as ScissorsIcon, Package as PackageIcon, Repeat as RepeatIcon } from 'lucide-react';
import InventoryPage from '../inventory/page';
import { RecurringExpensesTab } from '@/components/catalogue/recurring-expenses-tab';

type CatalogueTab = 'services' | 'inventory' | 'recurring';

const CAT_TABS: { key: CatalogueTab; label: string; icon: typeof ScissorsIcon }[] = [
  { key: 'services',  label: 'Услуги',              icon: ScissorsIcon },
  { key: 'inventory', label: 'Склад',               icon: PackageIcon },
  { key: 'recurring', label: 'Постоянные расходы',  icon: RepeatIcon },
];

export default function ServicesPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const { C } = usePageTheme();

  const raw = searchParams.get('tab') || 'services';
  const active = (CAT_TABS.some(t => t.key === raw) ? raw : 'services') as CatalogueTab;

  function setTab(key: CatalogueTab) {
    const params = new URLSearchParams(searchParams.toString());
    if (key === 'services') params.delete('tab');
    else params.set('tab', key);
    const qs = params.toString();
    router.replace(`${pathname}${qs ? `?${qs}` : ''}`, { scroll: false });
  }

  return (
    <div style={{ ...pageContainer, background: C.bg, color: C.text, minHeight: '100%' }}>
      {/* Tab bar — pill style like /finance and /marketing */}
      <div style={{
        display: 'flex', gap: 2, flexWrap: 'wrap',
        background: C.surface, border: `1px solid ${C.border}`,
        borderRadius: 12, padding: 4, marginBottom: 24,
      }}>
        {CAT_TABS.map(tab => {
          const Icon = tab.icon;
          const isActive = active === tab.key;
          return (
            <button
              key={tab.key}
              onClick={() => setTab(tab.key)}
              style={{
                display: 'flex', alignItems: 'center', gap: 7,
                padding: '10px 20px', border: 'none',
                background: isActive ? C.accent : 'transparent',
                cursor: 'pointer',
                fontSize: 13, fontWeight: 550,
                fontFamily: FONT, fontFeatureSettings: FONT_FEATURES,
                color: isActive ? '#ffffff' : C.textTertiary,
                borderRadius: 8, transition: 'all 0.2s ease',
                flex: 1, justifyContent: 'center',
              }}
            >
              <Icon size={16} style={{ opacity: isActive ? 1 : 0.6 }} />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Tab content */}
      {active === 'services' && <ServicesCatalogueView />}
      {active === 'inventory' && <InventoryPage />}
      {active === 'recurring' && <RecurringExpensesTab />}
    </div>
  );
}
