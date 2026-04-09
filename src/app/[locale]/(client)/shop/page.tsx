/** --- YAML
 * name: ShopPage
 * description: Client-facing product shop to browse and buy products from followed masters
 * --- */

'use client';

import { useCallback, useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { motion } from 'framer-motion';
import { ShoppingBag, Filter } from 'lucide-react';
import { toast } from 'sonner';
import { createClient } from '@/lib/supabase/client';
import { AvatarRing } from '@/components/shared/primitives/avatar-ring';
import { EmptyState } from '@/components/shared/primitives/empty-state';
import { ShimmerSkeleton } from '@/components/shared/primitives/shimmer-skeleton';

interface ShopProduct {
  id: string;
  name: string;
  description: string | null;
  price: number;
  currency: string;
  image_url: string | null;
  master: {
    id: string;
    profile: { full_name: string; avatar_url: string | null };
  };
}

export default function ShopPage() {
  const t = useTranslations('shop');
  const [products, setProducts] = useState<ShopProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterMaster, setFilterMaster] = useState<string | null>(null);
  const [masters, setMasters] = useState<{ id: string; name: string }[]>([]);

  const fetchProducts = useCallback(async () => {
    const supabase = createClient();
    let query = supabase
      .from('products')
      .select('id, name, description, price, currency, image_url, master:masters!inner(id, profile:profiles!inner(full_name, avatar_url))')
      .eq('is_active', true)
      .order('created_at', { ascending: false });

    if (filterMaster) {
      query = query.eq('master_id', filterMaster);
    }

    const { data } = await query.limit(50);
    const items = (data ?? []) as unknown as ShopProduct[];
    setProducts(items);

    // Extract unique masters for filter
    const uniqueMasters = new Map<string, string>();
    for (const p of items) {
      if (!uniqueMasters.has(p.master.id)) {
        uniqueMasters.set(p.master.id, p.master.profile.full_name);
      }
    }
    setMasters(Array.from(uniqueMasters, ([id, name]) => ({ id, name })));
    setLoading(false);
  }, [filterMaster]);

  useEffect(() => {
    fetchProducts();
  }, [fetchProducts]);

  async function orderProduct(product: ShopProduct) {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      toast.error(t('loginRequired'));
      return;
    }

    // Find client record for this master
    const { data: client } = await supabase
      .from('clients')
      .select('id')
      .eq('profile_id', user.id)
      .eq('master_id', product.master.id)
      .single();

    if (!client) {
      toast.error(t('followFirst'));
      return;
    }

    await supabase.from('product_orders').insert({
      client_id: client.id,
      product_id: product.id,
      quantity: 1,
      total_price: product.price,
      status: 'pending',
    });

    toast.success(t('orderPlaced'));
  }

  if (loading) {
    return (
      <div className="space-y-4 p-[var(--space-page)]">
        <div className="grid gap-4 grid-cols-2">
          {Array.from({ length: 4 }, (_, i) => (
            <ShimmerSkeleton key={i} className="h-52 w-full" rounded="lg" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4 p-[var(--space-page)]">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold">{t('title')}</h2>
      </div>

      {/* Master filter */}
      {masters.length > 1 && (
        <div className="flex gap-2 overflow-x-auto scrollbar-thin pb-1">
          <button
            onClick={() => setFilterMaster(null)}
            className={`shrink-0 rounded-full px-3 py-1 text-xs font-medium transition-colors ${
              !filterMaster
                ? 'bg-[var(--ds-accent)] text-white'
                : 'bg-muted text-muted-foreground hover:bg-muted/80'
            }`}
          >
            <Filter className="mr-1 inline h-3 w-3" />
            {t('all')}
          </button>
          {masters.map((m) => (
            <button
              key={m.id}
              onClick={() => setFilterMaster(m.id)}
              className={`shrink-0 rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                filterMaster === m.id
                  ? 'bg-[var(--ds-accent)] text-white'
                  : 'bg-muted text-muted-foreground hover:bg-muted/80'
              }`}
            >
              {m.name}
            </button>
          ))}
        </div>
      )}

      {/* Products grid */}
      {products.length === 0 ? (
        <EmptyState
          icon={<ShoppingBag className="h-7 w-7" />}
          title={t('emptyTitle')}
          description={t('emptyDescription')}
        />
      ) : (
        <div className="grid gap-3 grid-cols-2">
          {products.map((product, i) => (
            <motion.div
              key={product.id}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
              className="overflow-hidden rounded-[var(--radius-card)] border bg-card shadow-[var(--shadow-card)]"
            >
              {product.image_url ? (
                <div className="aspect-square w-full bg-muted">
                  <img src={product.image_url} alt={product.name} className="h-full w-full object-cover" />
                </div>
              ) : (
                <div className="flex aspect-square w-full items-center justify-center bg-muted">
                  <ShoppingBag className="h-8 w-8 text-muted-foreground/40" />
                </div>
              )}
              <div className="p-2.5 space-y-1.5">
                <p className="text-sm font-semibold line-clamp-1">{product.name}</p>
                {product.description && (
                  <p className="text-[11px] text-muted-foreground line-clamp-2">{product.description}</p>
                )}
                <div className="flex items-center gap-1.5">
                  <AvatarRing
                    src={product.master.profile.avatar_url}
                    name={product.master.profile.full_name}
                    size={20}
                  />
                  <span className="text-[10px] text-muted-foreground truncate">
                    {product.master.profile.full_name}
                  </span>
                </div>
                <div className="flex items-center justify-between pt-1">
                  <span className="text-sm font-bold">{product.price} {product.currency}</span>
                  <button
                    onClick={() => orderProduct(product)}
                    className="rounded-[var(--radius-button)] bg-[var(--ds-accent)] px-2.5 py-1 text-[11px] font-medium text-white transition-colors hover:bg-[var(--ds-accent-hover)]"
                  >
                    {t('buy')}
                  </button>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}
