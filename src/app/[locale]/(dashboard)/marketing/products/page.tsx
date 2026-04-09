/** --- YAML
 * name: ProductsManagementPage
 * description: Master CRUD for products in the storefront
 * --- */

'use client';

import { useCallback, useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, Pencil, Trash2, Package, X } from 'lucide-react';
import { toast } from 'sonner';
import { createClient } from '@/lib/supabase/client';
import { useMaster } from '@/hooks/use-master';
import { EmptyState } from '@/components/shared/primitives/empty-state';

interface Product {
  id: string;
  name: string;
  description: string | null;
  price: number;
  currency: string;
  image_url: string | null;
  is_active: boolean;
  created_at: string;
}

export default function ProductsPage() {
  const t = useTranslations('products');
  const { master } = useMaster();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Product | null>(null);

  // Form state
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [price, setPrice] = useState('');
  const [imageUrl, setImageUrl] = useState('');

  const fetchProducts = useCallback(async () => {
    if (!master) return;
    const supabase = createClient();
    const { data } = await supabase
      .from('products')
      .select('*')
      .eq('master_id', master.id)
      .order('created_at', { ascending: false });
    setProducts((data ?? []) as Product[]);
    setLoading(false);
  }, [master]);

  useEffect(() => {
    fetchProducts();
  }, [fetchProducts]);

  function openForm(product?: Product) {
    if (product) {
      setEditing(product);
      setName(product.name);
      setDescription(product.description ?? '');
      setPrice(String(product.price));
      setImageUrl(product.image_url ?? '');
    } else {
      setEditing(null);
      setName('');
      setDescription('');
      setPrice('');
      setImageUrl('');
    }
    setShowForm(true);
  }

  function closeForm() {
    setShowForm(false);
    setEditing(null);
  }

  async function saveProduct() {
    if (!name.trim() || !price || !master) return;
    const supabase = createClient();
    const payload = {
      master_id: master.id,
      name: name.trim(),
      description: description.trim() || null,
      price: parseFloat(price),
      image_url: imageUrl.trim() || null,
    };

    if (editing) {
      await supabase.from('products').update(payload).eq('id', editing.id);

    } else {
      // Also create a feed post for new product
      const { data: newProduct } = await supabase.from('products').insert(payload).select().single();
      if (newProduct) {
        await supabase.from('feed_posts').insert({
          master_id: master.id,
          type: 'update',
          title: `New product: ${name.trim()}`,
          body: description.trim() || null,
          image_url: imageUrl.trim() || null,
        });
      }
    }

    toast.success(editing ? t('updated') : t('created'));
    closeForm();
    fetchProducts();
  }

  async function toggleActive(product: Product) {
    const supabase = createClient();
    await supabase
      .from('products')
      .update({ is_active: !product.is_active })
      .eq('id', product.id);
    fetchProducts();
  }

  async function deleteProduct(id: string) {
    const supabase = createClient();
    await supabase.from('products').delete().eq('id', id);
    toast.success(t('deleted'));
    fetchProducts();
  }

  if (loading) return null;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">{t('title')}</h2>
        <button
          onClick={() => openForm()}
          className="inline-flex items-center gap-1.5 rounded-[var(--radius-button)] bg-[var(--ds-accent)] px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-[var(--ds-accent-hover)]"
        >
          <Plus className="h-4 w-4" />
          {t('addProduct')}
        </button>
      </div>

      {/* Form */}
      <AnimatePresence>
        {showForm && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="space-y-3 rounded-[var(--radius-card)] border bg-card p-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold">{editing ? t('editProduct') : t('addProduct')}</h3>
                <button onClick={closeForm} className="p-1 text-muted-foreground hover:text-foreground">
                  <X className="h-4 w-4" />
                </button>
              </div>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={t('productName')}
                className="w-full rounded-lg border bg-background px-3 py-2 text-sm outline-none ring-ring focus:ring-2"
              />
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder={t('productDescription')}
                rows={2}
                className="w-full rounded-lg border bg-background px-3 py-2 text-sm outline-none ring-ring focus:ring-2"
              />
              <div className="flex gap-3">
                <input
                  value={price}
                  onChange={(e) => setPrice(e.target.value)}
                  placeholder={t('price')}
                  type="number"
                  step="0.01"
                  className="w-32 rounded-lg border bg-background px-3 py-2 text-sm outline-none ring-ring focus:ring-2"
                />
                <input
                  value={imageUrl}
                  onChange={(e) => setImageUrl(e.target.value)}
                  placeholder={t('imageUrl')}
                  className="flex-1 rounded-lg border bg-background px-3 py-2 text-sm outline-none ring-ring focus:ring-2"
                />
              </div>
              <button
                onClick={saveProduct}
                disabled={!name.trim() || !price}
                className="rounded-[var(--radius-button)] bg-[var(--ds-accent)] px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
              >
                {editing ? t('save') : t('create')}
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Product list */}
      {products.length === 0 ? (
        <EmptyState
          icon={<Package className="h-7 w-7" />}
          title={t('emptyTitle')}
          description={t('emptyDescription')}
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <AnimatePresence>
            {products.map((product) => (
              <motion.div
                key={product.id}
                layout
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="overflow-hidden rounded-[var(--radius-card)] border bg-card shadow-[var(--shadow-card)]"
              >
                {product.image_url && (
                  <div className="aspect-[4/3] w-full bg-muted">
                    <img src={product.image_url} alt={product.name} className="h-full w-full object-cover" />
                  </div>
                )}
                <div className="p-3 space-y-2">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-sm font-semibold">{product.name}</p>
                      {product.description && (
                        <p className="text-xs text-muted-foreground line-clamp-2">{product.description}</p>
                      )}
                    </div>
                    <span className="text-sm font-bold text-[var(--ds-accent)]">
                      {product.price} {product.currency}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 pt-1">
                    <button
                      onClick={() => toggleActive(product)}
                      className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${
                        product.is_active
                          ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400'
                          : 'bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400'
                      }`}
                    >
                      {product.is_active ? t('active') : t('inactive')}
                    </button>
                    <div className="flex-1" />
                    <button
                      onClick={() => openForm(product)}
                      className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                    <button
                      onClick={() => deleteProduct(product.id)}
                      className="rounded-lg p-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}
