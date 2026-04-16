/** --- YAML
 * name: QuickSaleDrawer
 * description: Fresha-style quick sale drawer — category tabs, service/product cards, cart sidebar, 3-step breadcrumb. Products loaded from Supabase with stock decrement on checkout.
 * --- */

'use client';

import { useState, useEffect, useCallback } from 'react';
import { useTranslations } from 'next-intl';
import { X, Search, ShoppingCart, Plus, Minus, Trash2, Loader2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import { createClient } from '@/lib/supabase/client';
import { useMaster } from '@/hooks/use-master';

const FONT = '"Roobert PRO", AktivGroteskVF, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';

const LIGHT = {
  bg: '#ffffff',
  cardBg: '#ffffff',
  border: '#e5e5e5',
  text: '#000000',
  textMuted: '#737373',
  accent: '#6950f3',
  accentSoft: '#f0eefe',
  danger: '#d4163a',
  btnBg: '#000000',
  btnText: '#ffffff',
  categoryBg: '#f5f5f5',
  categoryActive: '#000000',
  categoryActiveText: '#ffffff',
  cartBg: '#f9f9f9',
  emptyText: '#a3a3a3',
  breadcrumbActive: '#000000',
  breadcrumbInactive: '#a3a3a3',
  overlay: 'rgba(0,0,0,0.3)',
  stockBadge: '#f59e0b',
  successBg: '#ecfdf5',
  successText: '#059669',
};

const DARK = {
  bg: '#000000',
  cardBg: '#000000',
  border: '#1a1a1a',
  text: '#e5e5e5',
  textMuted: '#8a8a8a',
  accent: '#8b7cf6',
  accentSoft: '#2a2545',
  danger: '#ef4444',
  btnBg: '#ffffff',
  btnText: '#000000',
  categoryBg: '#000000',
  categoryActive: '#ffffff',
  categoryActiveText: '#000000',
  cartBg: '#000000',
  emptyText: '#555555',
  breadcrumbActive: '#e5e5e5',
  breadcrumbInactive: '#555555',
  overlay: 'rgba(0,0,0,0.6)',
  stockBadge: '#d97706',
  successBg: '#064e3b',
  successText: '#6ee7b7',
};

interface CartItem {
  id: string;
  name: string;
  price: number;
  quantity: number;
  color: string;
  type: 'service' | 'product';
  maxStock?: number;
}

interface Product {
  id: string;
  name: string;
  price: number;
  currency: string;
  stock: number;
  is_active: boolean;
}

interface QuickSaleDrawerProps {
  open: boolean;
  onClose: () => void;
  theme?: 'light' | 'dark';
  services: Array<{ id: string; name: string; price: number; color: string; currency: string }>;
  appointmentId?: string | null;
  clientId?: string | null;
}

const CATEGORIES = [
  { key: 'appointments', label: 'Записи' },
  { key: 'services', label: 'Услуги' },
  { key: 'products', label: 'Товары' },
  { key: 'subscriptions', label: 'Абонементы' },
  { key: 'giftCards', label: 'Подарочные карты' },
] as const;

const STEPS = ['Корзина', 'Чаевые', 'Платеж'] as const;

export function QuickSaleDrawer({ open, onClose, theme = 'light', services, appointmentId, clientId }: QuickSaleDrawerProps) {
  const t = useTranslations('calendar');
  const C = theme === 'dark' ? DARK : LIGHT;
  const { master } = useMaster();
  const [activeCategory, setActiveCategory] = useState<string>('services');
  const [search, setSearch] = useState('');
  const [cart, setCart] = useState<CartItem[]>([]);
  const [step, setStep] = useState(0);
  const [products, setProducts] = useState<Product[]>([]);
  const [productsLoading, setProductsLoading] = useState(false);
  const [checkoutBusy, setCheckoutBusy] = useState(false);

  const loadProducts = useCallback(async () => {
    if (!master?.id) return;
    setProductsLoading(true);
    const supabase = createClient();
    const { data } = await supabase
      .from('products')
      .select('id, name, price, currency, stock, is_active')
      .eq('master_id', master.id)
      .eq('is_active', true)
      .order('name');
    setProducts((data as Product[]) || []);
    setProductsLoading(false);
  }, [master?.id]);

  useEffect(() => {
    if (!open) { setCart([]); setStep(0); setSearch(''); setActiveCategory('services'); }
  }, [open]);

  useEffect(() => {
    if (open && activeCategory === 'products' && products.length === 0) {
      loadProducts();
    }
  }, [open, activeCategory, products.length, loadProducts]);

  const filteredServices = services.filter((s) =>
    !search || s.name.toLowerCase().includes(search.toLowerCase())
  );

  const filteredProducts = products.filter((p) =>
    !search || p.name.toLowerCase().includes(search.toLowerCase())
  );

  function addToCart(item: { id: string; name: string; price: number; color: string }, type: 'service' | 'product', maxStock?: number) {
    setCart((prev) => {
      const existing = prev.find((i) => i.id === item.id);
      if (existing) {
        if (type === 'product' && maxStock !== undefined && existing.quantity >= maxStock) {
          toast.error(t('outOfStock'));
          return prev;
        }
        return prev.map((i) => i.id === item.id ? { ...i, quantity: i.quantity + 1 } : i);
      }
      return [...prev, { id: item.id, name: item.name, price: item.price, quantity: 1, color: item.color, type, maxStock }];
    });
  }

  function updateQty(id: string, delta: number) {
    setCart((prev) => prev.map((i) => {
      if (i.id !== id) return i;
      const next = i.quantity + delta;
      if (i.type === 'product' && i.maxStock !== undefined && next > i.maxStock) {
        toast.error(t('outOfStock'));
        return i;
      }
      return { ...i, quantity: Math.max(0, next) };
    }).filter((i) => i.quantity > 0));
  }

  function removeFromCart(id: string) {
    setCart((prev) => prev.filter((i) => i.id !== id));
  }

  const total = cart.reduce((sum, i) => sum + i.price * i.quantity, 0);

  async function handleCheckout() {
    if (!master?.id || total <= 0) return;
    setCheckoutBusy(true);
    const supabase = createClient();

    try {
      const productItems = cart.filter((i) => i.type === 'product');

      // Create payment record
      const { error: payError } = await supabase.from('payments').insert({
        master_id: master.id,
        appointment_id: appointmentId || null,
        client_id: clientId || null,
        amount: total,
        currency: 'UAH',
        type: 'full',
        status: 'completed',
        description: `[PRODUCT] ${cart.map((i) => `${i.name} x${i.quantity}`).join(', ')}`,
      });
      if (payError) throw payError;

      // Decrement stock for product items
      for (const item of productItems) {
        const { data: prod } = await supabase
          .from('products')
          .select('stock')
          .eq('id', item.id)
          .single();
        if (prod) {
          await supabase.from('products').update({
            stock: Math.max(0, prod.stock - item.quantity),
          }).eq('id', item.id);
        }

        // Create product_order record
        if (clientId) {
          await supabase.from('product_orders').insert({
            client_id: clientId,
            product_id: item.id,
            quantity: item.quantity,
            total_price: item.price * item.quantity,
            status: 'paid',
          });
        }
      }

      toast.success(t('saleComplete'));
      onClose();
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setCheckoutBusy(false);
    }
  }

  return (
    <AnimatePresence>
      {open && (
        <>
          <style>{`@keyframes qsd-spin { to { transform: rotate(360deg) } }`}</style>
          {/* Overlay */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            style={{
              position: 'fixed',
              inset: 0,
              backgroundColor: C.overlay,
              zIndex: 90,
            }}
          />
          {/* Drawer */}
          <motion.div
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', stiffness: 400, damping: 35 }}
            style={{
              position: 'fixed',
              top: 0,
              right: 0,
              bottom: 0,
              width: 720,
              maxWidth: '100vw',
              backgroundColor: C.bg,
              zIndex: 91,
              display: 'flex',
              flexDirection: 'column',
              fontFamily: FONT,
              boxShadow: '-4px 0 24px rgba(0,0,0,0.12)',
            }}
          >
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px', borderBottom: `1px solid ${C.border}` }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 24 }}>
                {STEPS.map((s, i) => (
                  <button
                    key={s}
                    onClick={() => i <= step && setStep(i)}
                    style={{
                      fontSize: 14,
                      fontWeight: i === step ? 700 : 400,
                      color: i === step ? C.breadcrumbActive : C.breadcrumbInactive,
                      border: 'none',
                      backgroundColor: 'transparent',
                      cursor: i <= step ? 'pointer' : 'default',
                      padding: 0,
                      fontFamily: FONT,
                      textDecoration: i === step ? 'underline' : 'none',
                      textUnderlineOffset: 4,
                    }}
                  >
                    {s}
                  </button>
                ))}
              </div>
              <button
                onClick={onClose}
                style={{ width: 36, height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 8, border: 'none', backgroundColor: 'transparent', cursor: 'pointer', color: C.text }}
              >
                <X style={{ width: 20, height: 20 }} />
              </button>
            </div>

            {/* Body */}
            <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
              {/* Left: browse */}
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', borderRight: `1px solid ${C.border}` }}>
                {/* Search */}
                <div style={{ padding: '12px 16px' }}>
                  <div style={{ position: 'relative' }}>
                    <Search style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', width: 16, height: 16, color: C.textMuted }} />
                    <input
                      type="text"
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      placeholder="Поиск..."
                      style={{
                        width: '100%', padding: '10px 14px 10px 36px', fontSize: 14, borderRadius: 10,
                        border: `1px solid ${C.border}`, backgroundColor: C.cardBg, color: C.text, outline: 'none', fontFamily: FONT,
                      }}
                    />
                  </div>
                </div>

                {/* Category pills */}
                <div style={{ display: 'flex', gap: 6, padding: '0 16px 12px', overflowX: 'auto', flexShrink: 0 }}>
                  {CATEGORIES.map((cat) => (
                    <button
                      key={cat.key}
                      onClick={() => setActiveCategory(cat.key)}
                      style={{
                        padding: '6px 14px',
                        borderRadius: 999,
                        fontSize: 13,
                        fontWeight: 600,
                        whiteSpace: 'nowrap',
                        border: 'none',
                        cursor: 'pointer',
                        fontFamily: FONT,
                        backgroundColor: activeCategory === cat.key ? C.categoryActive : C.categoryBg,
                        color: activeCategory === cat.key ? C.categoryActiveText : C.text,
                        transition: 'all 0.15s',
                      }}
                    >
                      {cat.label}
                    </button>
                  ))}
                </div>

                {/* Items grid */}
                <div style={{ flex: 1, overflowY: 'auto', padding: '0 16px 16px' }}>
                  {activeCategory === 'services' ? (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 10 }}>
                      {filteredServices.map((svc) => (
                        <button
                          key={svc.id}
                          onClick={() => addToCart(svc, 'service')}
                          style={{
                            display: 'flex',
                            flexDirection: 'column',
                            padding: '12px 14px',
                            borderRadius: 10,
                            border: `1px solid ${C.border}`,
                            borderLeft: `4px solid ${svc.color}`,
                            backgroundColor: C.cardBg,
                            cursor: 'pointer',
                            textAlign: 'left',
                            fontFamily: FONT,
                            transition: 'box-shadow 0.15s',
                          }}
                          onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.boxShadow = '0 2px 8px rgba(0,0,0,0.08)'; }}
                          onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.boxShadow = 'none'; }}
                        >
                          <span style={{ fontSize: 14, fontWeight: 600, color: C.text, marginBottom: 4 }}>{svc.name}</span>
                          <span style={{ fontSize: 13, fontWeight: 700, color: C.accent }}>{svc.price} {svc.currency}</span>
                        </button>
                      ))}
                    </div>
                  ) : activeCategory === 'products' ? (
                    productsLoading ? (
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: C.textMuted }}>
                        <Loader2 style={{ width: 20, height: 20, animation: 'qsd-spin 1s linear infinite' }} />
                      </div>
                    ) : filteredProducts.length === 0 ? (
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', color: C.emptyText, fontSize: 14 }}>
                        {t('noProducts')}
                      </div>
                    ) : (
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 10 }}>
                        {filteredProducts.map((prod) => {
                          const outOfStock = prod.stock <= 0;
                          return (
                            <button
                              key={prod.id}
                              onClick={() => !outOfStock && addToCart({ id: prod.id, name: prod.name, price: prod.price, color: C.accent }, 'product', prod.stock)}
                              disabled={outOfStock}
                              style={{
                                display: 'flex',
                                flexDirection: 'column',
                                padding: '12px 14px',
                                borderRadius: 10,
                                border: `1px solid ${C.border}`,
                                borderLeft: `4px solid ${outOfStock ? C.danger : C.accent}`,
                                backgroundColor: C.cardBg,
                                cursor: outOfStock ? 'not-allowed' : 'pointer',
                                textAlign: 'left',
                                fontFamily: FONT,
                                opacity: outOfStock ? 0.5 : 1,
                                transition: 'box-shadow 0.15s',
                              }}
                              onMouseEnter={(e) => { if (!outOfStock) (e.currentTarget as HTMLElement).style.boxShadow = '0 2px 8px rgba(0,0,0,0.08)'; }}
                              onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.boxShadow = 'none'; }}
                            >
                              <span style={{ fontSize: 14, fontWeight: 600, color: C.text, marginBottom: 4 }}>{prod.name}</span>
                              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
                                <span style={{ fontSize: 13, fontWeight: 700, color: C.accent }}>{prod.price} {prod.currency}</span>
                                <span style={{
                                  fontSize: 11,
                                  fontWeight: 600,
                                  padding: '1px 6px',
                                  borderRadius: 4,
                                  backgroundColor: outOfStock ? C.danger + '20' : C.accentSoft,
                                  color: outOfStock ? C.danger : C.textMuted,
                                }}>
                                  {outOfStock ? t('outOfStock') : `${prod.stock} ${t('inStock')}`}
                                </span>
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    )
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', color: C.emptyText, fontSize: 14 }}>
                      Нет элементов
                    </div>
                  )}
                </div>
              </div>

              {/* Right: cart */}
              <div style={{ width: 280, flexShrink: 0, display: 'flex', flexDirection: 'column', backgroundColor: C.cartBg }}>
                <div style={{ padding: '16px', borderBottom: `1px solid ${C.border}`, display: 'flex', alignItems: 'center', gap: 8 }}>
                  <ShoppingCart style={{ width: 18, height: 18, color: C.text }} />
                  <span style={{ fontSize: 16, fontWeight: 700, color: C.text }}>Корзина</span>
                  {cart.length > 0 && (
                    <span style={{ fontSize: 12, fontWeight: 600, color: C.accent, backgroundColor: C.accentSoft, padding: '2px 8px', borderRadius: 999 }}>
                      {cart.length}
                    </span>
                  )}
                </div>

                <div style={{ flex: 1, overflowY: 'auto', padding: '8px 12px' }}>
                  {cart.length === 0 ? (
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', color: C.emptyText, fontSize: 13 }}>
                      Корзина пуста
                    </div>
                  ) : (
                    cart.map((item) => (
                      <div key={item.id} style={{ padding: '10px 8px', borderBottom: `1px solid ${C.border}`, display: 'flex', flexDirection: 'column', gap: 6 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                          <div style={{ flex: 1 }}>
                            <span style={{ fontSize: 13, fontWeight: 600, color: C.text }}>{item.name}</span>
                            {item.type === 'product' && (
                              <span style={{ fontSize: 10, color: C.textMuted, marginLeft: 6, padding: '1px 4px', borderRadius: 3, backgroundColor: C.accentSoft }}>
                                {t('product')}
                              </span>
                            )}
                          </div>
                          <button onClick={() => removeFromCart(item.id)} style={{ border: 'none', backgroundColor: 'transparent', cursor: 'pointer', color: C.textMuted, padding: 2 }}>
                            <Trash2 style={{ width: 14, height: 14 }} />
                          </button>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <button onClick={() => updateQty(item.id, -1)} style={{ width: 26, height: 26, borderRadius: 6, border: `1px solid ${C.border}`, backgroundColor: C.cardBg, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: C.text }}>
                              <Minus style={{ width: 12, height: 12 }} />
                            </button>
                            <span style={{ fontSize: 13, fontWeight: 600, color: C.text, minWidth: 20, textAlign: 'center' }}>{item.quantity}</span>
                            <button onClick={() => updateQty(item.id, 1)} style={{ width: 26, height: 26, borderRadius: 6, border: `1px solid ${C.border}`, backgroundColor: C.cardBg, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: C.text }}>
                              <Plus style={{ width: 12, height: 12 }} />
                            </button>
                          </div>
                          <span style={{ fontSize: 13, fontWeight: 700, color: C.text }}>{item.price * item.quantity} ₴</span>
                        </div>
                      </div>
                    ))
                  )}
                </div>

                {/* Footer total + checkout */}
                {cart.length > 0 && (
                  <div style={{ padding: '12px 16px', borderTop: `1px solid ${C.border}` }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
                      <span style={{ fontSize: 14, fontWeight: 600, color: C.text }}>Всего</span>
                      <span style={{ fontSize: 16, fontWeight: 700, color: C.text }}>{total} ₴</span>
                    </div>
                    <button
                      onClick={() => {
                        if (step < 2) setStep(step + 1);
                        else handleCheckout();
                      }}
                      disabled={checkoutBusy}
                      style={{
                        width: '100%', padding: '12px', borderRadius: 10, border: 'none',
                        backgroundColor: C.btnBg, color: C.btnText, fontSize: 15, fontWeight: 700,
                        cursor: checkoutBusy ? 'wait' : 'pointer', fontFamily: FONT, transition: 'opacity 0.15s',
                        opacity: checkoutBusy ? 0.6 : 1,
                        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                      }}
                      onMouseEnter={(e) => { if (!checkoutBusy) (e.currentTarget as HTMLElement).style.opacity = '0.85'; }}
                      onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.opacity = checkoutBusy ? '0.6' : '1'; }}
                    >
                      {checkoutBusy && <Loader2 style={{ width: 16, height: 16, animation: 'qsd-spin 1s linear infinite' }} />}
                      {step === 0 ? 'Далее' : step === 1 ? 'К оплате' : 'Оформить'}
                    </button>
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
