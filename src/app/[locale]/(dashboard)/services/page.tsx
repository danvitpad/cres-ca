/** --- YAML
 * name: Services Page
 * description: Fresha-exact service catalog — categories card, service rows with left border accent, three-dot menus, inline Fresha theming
 * --- */

'use client';

import { useState, useEffect, useCallback } from 'react';
import { useTranslations } from 'next-intl';
import { useTheme } from 'next-themes';
import { toast } from 'sonner';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/client';
import { useMaster } from '@/hooks/use-master';
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

const FONT = '"Roobert PRO", AktivGroteskVF, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';

const LIGHT = {
  bg: '#ffffff', cardBg: '#ffffff', cardBorder: '#e5e5e5',
  text: '#0d0d0d', textMuted: '#737373', textLight: '#a3a3a3',
  accent: '#6950f3', accentSoft: 'rgba(105,80,243,0.08)',
  rowBorder: '#f0f0f0', rowHover: '#fafafa',
  catBg: '#f5f5f5', catBorder: '#e5e5e5', catActive: '#6950f3', catActiveBg: 'rgba(105,80,243,0.12)',
  badgeBg: '#f0f0f0', badgeText: '#737373',
  searchBg: '#f5f5f5', searchBorder: '#e5e5e5',
  btnBorder: '#e5e5e5', btnHover: '#fafafa',
};

const DARK = {
  bg: '#000000', cardBg: '#111111', cardBorder: '#2a2a2a',
  text: '#f0f0f0', textMuted: '#b3b3b3', textLight: '#666666',
  accent: '#8b7cf6', accentSoft: 'rgba(139,124,246,0.12)',
  rowBorder: '#1a1a1a', rowHover: '#0d0d0d',
  catBg: '#111111', catBorder: '#2a2a2a', catActive: '#8b7cf6', catActiveBg: 'rgba(139,124,246,0.15)',
  badgeBg: '#222222', badgeText: '#999999',
  searchBg: '#111111', searchBorder: '#2a2a2a',
  btnBorder: '#333333', btnHover: '#1a1a1a',
};

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

export default function ServicesPage() {
  const t = useTranslations('services');
  const tp = useTranslations('profile');
  const tc = useTranslations('common');
  const { resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const { master, loading: masterLoading } = useMaster();
  const [services, setServices] = useState<ServiceRow[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<ServiceRow | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [menuOpenId, setMenuOpenId] = useState<string | null>(null);
  useEffect(() => setMounted(true), []);
  const C = mounted && resolvedTheme === 'dark' ? DARK : LIGHT;

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

  function openEdit(service: ServiceRow) {
    setEditing(service);
    setDialogOpen(true);
  }

  function openNew() {
    setEditing(null);
    setDialogOpen(true);
  }

  async function handleDelete(id: string) {
    if (!confirm(tp('deleteConfirm'))) return;
    const supabase = createClient();
    const { error } = await supabase.from('services').delete().eq('id', id);
    if (error) toast.error(error.message);
    else loadServices();
  }

  if (masterLoading || loading) {
    return (
      <div style={{ padding: '32px 40px', fontFamily: FONT }}>
        <div style={{ height: 32, width: 200, backgroundColor: C.catBg, borderRadius: 8, marginBottom: 16 }} />
        <div style={{ height: 200, width: '100%', backgroundColor: C.catBg, borderRadius: 12 }} />
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
    <div style={{ padding: '32px 40px', fontFamily: FONT }}>
      {/* ── Page header (Fresha style) ── */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 28, fontWeight: 700, color: C.text, margin: 0, lineHeight: 1.2 }}>
            {t('serviceMenu')}
          </h1>
          <p style={{ fontSize: 14, color: C.textMuted, marginTop: 6, lineHeight: 1.5 }}>
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
          backgroundColor: C.searchBg, border: `1px solid ${C.searchBorder}`,
        }}>
          <Search style={{ width: 16, height: 16, color: C.textLight, flexShrink: 0 }} />
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
          border: `1px solid ${C.btnBorder}`, backgroundColor: 'transparent',
          color: C.text, fontSize: 14, fontWeight: 500, cursor: 'pointer', fontFamily: FONT,
        }}>
          <SlidersHorizontal style={{ width: 14, height: 14 }} />
          {t('filters') || 'Фильтры'}
        </button>
        <div style={{ flex: 1 }} />
        <button style={{
          display: 'flex', alignItems: 'center', gap: 6,
          padding: '10px 16px', borderRadius: 999,
          border: `1px solid ${C.btnBorder}`, backgroundColor: 'transparent',
          color: C.text, fontSize: 14, fontWeight: 500, cursor: 'pointer', fontFamily: FONT,
        }}>
          <ArrowUpDown style={{ width: 14, height: 14 }} />
          {t('reorder') || 'Изменить порядок'}
        </button>
      </div>

      {/* ── Main content: categories card + service rows ── */}
      <div style={{ display: 'flex', gap: 24 }}>
        {/* Categories card (Fresha style) */}
        <div style={{
          width: 280, flexShrink: 0,
          border: `1px solid ${C.catBorder}`, borderRadius: 12,
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
              backgroundColor: selectedCategory === 'all' ? C.catActiveBg : 'transparent',
              borderLeft: selectedCategory === 'all' ? `3px solid ${C.catActive}` : '3px solid transparent',
              color: selectedCategory === 'all' ? C.catActive : C.text,
              fontSize: 14, fontWeight: selectedCategory === 'all' ? 600 : 400,
              fontFamily: FONT, transition: 'all 150ms',
            }}
          >
            <span>{t('allCategories') || 'Все категории'}</span>
            <span style={{
              fontSize: 12, fontWeight: 500, color: C.badgeText,
              backgroundColor: C.badgeBg, borderRadius: 999, padding: '2px 8px',
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
                backgroundColor: selectedCategory === key ? C.catActiveBg : 'transparent',
                borderLeft: selectedCategory === key ? `3px solid ${C.catActive}` : '3px solid transparent',
                color: selectedCategory === key ? C.catActive : C.text,
                fontSize: 14, fontWeight: selectedCategory === key ? 600 : 400,
                fontFamily: FONT, transition: 'all 150ms',
              }}
            >
              <span>{category?.name}</span>
              <span style={{
                fontSize: 12, fontWeight: 500, color: C.badgeText,
                backgroundColor: C.badgeBg, borderRadius: 999, padding: '2px 8px',
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
                backgroundColor: selectedCategory === 'none' ? C.catActiveBg : 'transparent',
                borderLeft: selectedCategory === 'none' ? `3px solid ${C.catActive}` : '3px solid transparent',
                color: selectedCategory === 'none' ? C.catActive : C.text,
                fontSize: 14, fontWeight: selectedCategory === 'none' ? 600 : 400,
                fontFamily: FONT, transition: 'all 150ms',
              }}
            >
              <span>{t('uncategorized')}</span>
              <span style={{
                fontSize: 12, fontWeight: 500, color: C.badgeText,
                backgroundColor: C.badgeBg, borderRadius: 999, padding: '2px 8px',
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
              <Briefcase style={{ width: 48, height: 48, color: C.textLight, marginBottom: 12 }} />
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
                    border: `1px solid ${C.rowBorder}`,
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
                    <div style={{ fontSize: 13, color: C.textMuted, marginTop: 3, fontFamily: FONT }}>
                      {formatDuration(s.duration_minutes)}
                    </div>
                  </div>
                  <div style={{ fontSize: 15, fontWeight: 600, color: C.text, marginRight: 12, whiteSpace: 'nowrap', fontFamily: FONT }}>
                    {s.price.toLocaleString()} {s.currency}
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setMenuOpenId(menuOpenId === s.id ? null : s.id);
                    }}
                    style={{
                      width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center',
                      borderRadius: 6, border: 'none', backgroundColor: 'transparent',
                      cursor: 'pointer', color: C.textMuted, transition: 'color 100ms',
                    }}
                  >
                    <MoreVertical style={{ width: 18, height: 18 }} />
                  </button>
                  {/* Three-dot dropdown menu */}
                  {menuOpenId === s.id && (
                    <div
                      style={{
                        position: 'absolute', right: 8, top: '100%', zIndex: 50,
                        backgroundColor: C.cardBg, border: `1px solid ${C.cardBorder}`,
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
        <DialogContent>
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
    const payload = { ...parsed.data, master_id: masterId, is_mobile: isMobile, travel_buffer_minutes: Number(travelBuffer) || 0 };

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

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label>{t('serviceName')}</Label>
        <Input value={name} onChange={(e) => setName(e.target.value)} required />
      </div>

      <div className="grid gap-4 grid-cols-2">
        <div className="space-y-2">
          <Label>{t('duration')}</Label>
          <Input type="number" min={5} max={480} value={duration} onChange={(e) => setDuration(e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label>{t('price')}</Label>
          <Input type="number" min={0} step="0.01" value={price} onChange={(e) => setPrice(e.target.value)} />
        </div>
      </div>

      <div className="grid gap-4 grid-cols-2">
        <div className="space-y-2">
          <Label>{tp('currency')}</Label>
          <Select value={currency} onValueChange={(v) => v && setCurrency(v)}>
            <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="UAH">UAH</SelectItem>
              <SelectItem value="USD">USD</SelectItem>
              <SelectItem value="EUR">EUR</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>{t('category')}</Label>
          <Select value={categoryId ?? '__none'} onValueChange={(v) => v && setCategoryId(v === '__none' ? null : v)}>
            <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="__none">—</SelectItem>
              {categories.map((c) => (
                <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <Label>{tp('color')}</Label>
        <input type="color" value={color} onChange={(e) => setColor(e.target.value)} className="h-8 w-8 cursor-pointer rounded border" />
      </div>

      <div className="flex items-center gap-3">
        <Switch checked={requiresPrepayment} onCheckedChange={setRequiresPrepayment} />
        <Label>{tp('prepayment')}</Label>
      </div>

      <div className="flex items-center gap-3">
        <Switch checked={isMobile} onCheckedChange={setIsMobile} />
        <Label>Выездная услуга</Label>
      </div>

      {isMobile && (
        <div className="space-y-2">
          <Label>Буфер на дорогу (мин)</Label>
          <Input type="number" min={0} max={180} value={travelBuffer} onChange={(e) => setTravelBuffer(e.target.value)} />
        </div>
      )}

      {requiresPrepayment && (
        <div className="space-y-2">
          <Label>{tp('prepaymentAmount')}</Label>
          <Input type="number" min={0} step="0.01" value={prepaymentAmount} onChange={(e) => setPrepaymentAmount(e.target.value)} />
        </div>
      )}

      {upsellCandidates.length > 0 && (
        <div className="space-y-2">
          <Label>{t('upsellServicesLabel')}</Label>
          <p className="text-xs text-muted-foreground">{t('upsellServicesHint')}</p>
          <div className="max-h-44 space-y-1 overflow-y-auto rounded-md border p-2">
            {upsellCandidates.map((s) => {
              const checked = upsellServices.includes(s.id);
              return (
                <label
                  key={s.id}
                  className="flex cursor-pointer items-center justify-between gap-2 rounded px-2 py-1.5 text-sm hover:bg-muted"
                >
                  <span className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() =>
                        setUpsellServices((prev) =>
                          prev.includes(s.id) ? prev.filter((id) => id !== s.id) : [...prev, s.id],
                        )
                      }
                    />
                    <span>{s.name}</span>
                  </span>
                  <span className="text-xs text-muted-foreground">
                    +{s.duration_minutes}m · +{Number(s.price).toFixed(0)} {s.currency}
                  </span>
                </label>
              );
            })}
          </div>
        </div>
      )}

      <div className="space-y-2">
        <Label>Как подготовиться</Label>
        <Textarea
          rows={3}
          value={preparation}
          onChange={(e) => setPreparation(e.target.value)}
          placeholder="Напр.: Приходи без макияжа, волосы чистые и сухие"
        />
      </div>

      <div className="space-y-2">
        <Label>Уход после</Label>
        <Textarea
          rows={3}
          value={aftercare}
          onChange={(e) => setAftercare(e.target.value)}
          placeholder="Напр.: Не мыть голову первые 24 часа"
        />
      </div>

      <div className="space-y-2">
        <Label>FAQ — одна пара на строку: «Вопрос :: Ответ»</Label>
        <Textarea
          rows={4}
          value={faqText}
          onChange={(e) => setFaqText(e.target.value)}
          placeholder="Сколько держится? :: В среднем 3-4 недели"
        />
      </div>

      <div className="space-y-2">
        <Label>Чеклист визита — один пункт на строку</Label>
        <Textarea
          rows={4}
          value={checklistText}
          onChange={(e) => setChecklistText(e.target.value)}
          placeholder={'Поздороваться и предложить воду\nЗафиксировать до-фото\nПровести процедуру\nСнять после-фото\nОбъяснить домашний уход'}
        />
        <p className="text-xs text-muted-foreground">
          Эти пункты будут показаны во время визита — ничего не забудешь.
        </p>
      </div>

      {inventoryItems.length > 0 && (
        <div className="space-y-2">
          <Label>Рецепт (авто-списание со склада после визита)</Label>
          <p className="text-xs text-muted-foreground">
            Укажите сколько каждого материала расходуется на одну услугу. Пустое = не тратится.
          </p>
          <div className="max-h-52 space-y-1 overflow-y-auto rounded-md border p-2">
            {inventoryItems.map((it) => (
              <div key={it.id} className="flex items-center justify-between gap-2 rounded px-2 py-1.5 text-sm">
                <span className="flex-1 truncate">{it.name}</span>
                <Input
                  type="number"
                  min={0}
                  step="0.01"
                  className="h-7 w-24"
                  value={recipeMap[it.id] ?? ''}
                  onChange={(e) => {
                    const v = e.target.value;
                    setRecipeMap((prev) => {
                      const next = { ...prev };
                      if (v === '') delete next[it.id];
                      else next[it.id] = parseFloat(v) || 0;
                      return next;
                    });
                  }}
                />
                <span className="w-10 text-xs text-muted-foreground">{it.unit}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="flex gap-2 justify-end">
        <Button type="button" variant="outline" onClick={onCancel}>{tc('cancel')}</Button>
        <Button type="submit" disabled={saving}>{saving ? tc('loading') : tc('save')}</Button>
      </div>
    </form>
  );
}
