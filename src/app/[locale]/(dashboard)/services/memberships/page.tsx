/** --- YAML
 * name: MembershipsPage
 * description: Fresha-exact memberships/subscriptions catalog — CRUD for service packages (N visits for price)
 * created: 2026-04-12
 * updated: 2026-04-16
 * --- */

'use client';

import { useState, useEffect, useCallback } from 'react';
import { useTranslations } from 'next-intl';
import { motion } from 'framer-motion';
import { Plus, CreditCard, Trash2, X, Check } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { useMaster } from '@/hooks/use-master';
import { usePageTheme, FONT, FONT_FEATURES, CURRENCY } from '@/lib/dashboard-theme';

interface ServicePackage {
  id: string;
  name: string;
  description: string | null;
  service_id: string | null;
  total_visits: number;
  bonus_visits: number;
  price: number;
  currency: string;
  validity_days: number;
  is_active: boolean;
  service?: { name: string } | null;
}

interface ServiceOption {
  id: string;
  name: string;
}

export default function MembershipsPage() {
  const t = useTranslations('catalogue');
  const { C, isDark, mounted } = usePageTheme();

  const { master } = useMaster();
  const [packages, setPackages] = useState<ServicePackage[]>([]);
  const [services, setServices] = useState<ServiceOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);

  // Form state
  const [name, setName] = useState('');
  const [serviceId, setServiceId] = useState('');
  const [totalVisits, setTotalVisits] = useState('10');
  const [bonusVisits, setBonusVisits] = useState('0');
  const [price, setPrice] = useState('');
  const [validityDays, setValidityDays] = useState('90');

  const load = useCallback(async () => {
    if (!master?.id) return;
    setLoading(true);
    const supabase = createClient();
    const [{ data: pkgs }, { data: svcs }] = await Promise.all([
      supabase
        .from('service_packages')
        .select('id, name, description, service_id, total_visits, bonus_visits, price, currency, validity_days, is_active, service:services(name)')
        .eq('master_id', master.id)
        .order('created_at', { ascending: false }),
      supabase
        .from('services')
        .select('id, name')
        .eq('master_id', master.id)
        .eq('is_active', true)
        .order('name'),
    ]);
    setPackages((pkgs as unknown as ServicePackage[]) ?? []);
    setServices((svcs as ServiceOption[]) ?? []);
    setLoading(false);
  }, [master?.id]);

  useEffect(() => { load(); }, [load]);

  const createPackage = useCallback(async () => {
    if (!master?.id || !name || !price) return;
    const supabase = createClient();
    const { data, error } = await supabase
      .from('service_packages')
      .insert({
        master_id: master.id,
        name,
        service_id: serviceId || null,
        total_visits: Number(totalVisits) || 10,
        bonus_visits: Number(bonusVisits) || 0,
        price: Number(price),
        validity_days: Number(validityDays) || 90,
      })
      .select('id, name, description, service_id, total_visits, bonus_visits, price, currency, validity_days, is_active, service:services(name)')
      .single();
    if (!error && data) {
      setPackages(prev => [data as unknown as ServicePackage, ...prev]);
      setName('');
      setPrice('');
      setServiceId('');
      setTotalVisits('10');
      setBonusVisits('0');
      setValidityDays('90');
      setShowForm(false);
    }
  }, [master?.id, name, serviceId, totalVisits, bonusVisits, price, validityDays]);

  const toggleActive = useCallback(async (id: string, currentActive: boolean) => {
    const supabase = createClient();
    await supabase.from('service_packages').update({ is_active: !currentActive }).eq('id', id);
    setPackages(prev => prev.map(p => p.id === id ? { ...p, is_active: !currentActive } : p));
  }, []);

  const deletePackage = useCallback(async (id: string) => {
    const supabase = createClient();
    await supabase.from('service_packages').delete().eq('id', id);
    setPackages(prev => prev.filter(p => p.id !== id));
  }, []);

  const inputStyle = {
    width: '100%', padding: '8px 12px', borderRadius: 8,
    border: `1px solid ${C.border}`, background: C.surface, color: C.text,
    fontSize: 13, fontFamily: FONT, outline: 'none',
  };

  return (
    <div style={{ fontFamily: FONT, fontFeatureSettings: FONT_FEATURES, padding: '32px 40px', background: C.bg }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
        <h1 style={{ fontSize: 28, fontWeight: 600, color: C.text, margin: 0 }}>
          {t('memberships')}
        </h1>
        <button
          type="button"
          onClick={() => setShowForm(s => !s)}
          style={{
            display: 'flex', alignItems: 'center', gap: 8,
            padding: '10px 20px', fontSize: 14, fontWeight: 500,
            backgroundColor: C.accent, color: '#ffffff',
            border: 'none', borderRadius: 999, cursor: 'pointer',
            fontFamily: FONT,
          }}
        >
          <Plus size={16} />
          {t('addMembership')}
        </button>
      </div>
      <p style={{ fontSize: 15, color: C.textSecondary, margin: '0 0 32px', lineHeight: '22px' }}>
        {t('membershipsDesc')}
      </p>

      {/* Create form */}
      {showForm && (
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          style={{
            background: C.surface, border: `1px solid ${C.border}`, borderRadius: 12,
            padding: 20, marginBottom: 24,
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <div style={{ fontSize: 16, fontWeight: 600, color: C.text }}>{t('addMembership')}</div>
            <button onClick={() => setShowForm(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.textSecondary }}><X size={16} /></button>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <div style={{ fontSize: 12, color: C.textSecondary, marginBottom: 4 }}>{t('name') ?? 'Name'}</div>
              <input value={name} onChange={e => setName(e.target.value)} placeholder="VIP 10 visits" style={inputStyle} />
            </div>
            <div>
              <div style={{ fontSize: 12, color: C.textSecondary, marginBottom: 4 }}>{t('service') ?? 'Service'}</div>
              <select value={serviceId} onChange={e => setServiceId(e.target.value)} style={inputStyle}>
                <option value="">— {t('all') ?? 'All services'} —</option>
                {services.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
            <div>
              <div style={{ fontSize: 12, color: C.textSecondary, marginBottom: 4 }}>{t('totalVisits') ?? 'Total visits'}</div>
              <input type="number" value={totalVisits} onChange={e => setTotalVisits(e.target.value)} style={inputStyle} />
            </div>
            <div>
              <div style={{ fontSize: 12, color: C.textSecondary, marginBottom: 4 }}>{t('bonusVisits') ?? 'Bonus visits'}</div>
              <input type="number" value={bonusVisits} onChange={e => setBonusVisits(e.target.value)} style={inputStyle} />
            </div>
            <div>
              <div style={{ fontSize: 12, color: C.textSecondary, marginBottom: 4 }}>{t('price') ?? 'Price'} ({CURRENCY})</div>
              <input type="number" value={price} onChange={e => setPrice(e.target.value)} placeholder="5000" style={inputStyle} />
            </div>
            <div>
              <div style={{ fontSize: 12, color: C.textSecondary, marginBottom: 4 }}>{t('validityDays') ?? 'Validity (days)'}</div>
              <input type="number" value={validityDays} onChange={e => setValidityDays(e.target.value)} style={inputStyle} />
            </div>
          </div>
          <div style={{ marginTop: 16, display: 'flex', gap: 8 }}>
            <button
              onClick={createPackage}
              disabled={!name || !price}
              style={{
                padding: '8px 20px', borderRadius: 8, border: 'none',
                background: C.accent, color: '#fff', fontSize: 13, fontWeight: 600,
                cursor: !name || !price ? 'not-allowed' : 'pointer', opacity: !name || !price ? 0.5 : 1,
                fontFamily: FONT,
              }}
            >
              {t('add') ?? 'Create'}
            </button>
          </div>
        </motion.div>
      )}

      {/* Content */}
      {loading ? (
        <div style={{ background: C.surface, borderRadius: 12, padding: '40px 20px' }}>
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} style={{ height: 48, borderRadius: 8, background: C.border, marginBottom: 8 }} />
          ))}
        </div>
      ) : packages.length === 0 && !showForm ? (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          style={{
            backgroundColor: C.surface,
            border: `1px dashed ${C.border}`,
            borderRadius: 12,
            padding: '64px 32px',
            textAlign: 'center',
          }}
        >
          <div style={{
            width: 64, height: 64, borderRadius: 999,
            backgroundColor: C.accent + '15',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            margin: '0 auto 20px',
          }}>
            <CreditCard size={28} color={C.accent} />
          </div>
          <div style={{ fontSize: 18, fontWeight: 600, color: C.text, marginBottom: 8 }}>
            {t('noMemberships')}
          </div>
          <div style={{ fontSize: 15, color: C.textSecondary, maxWidth: 400, margin: '0 auto', lineHeight: '22px' }}>
            {t('noMembershipsDesc')}
          </div>
        </motion.div>
      ) : packages.length > 0 ? (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          style={{ background: C.surface, borderRadius: 12, overflow: 'hidden' }}
        >
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: `1px solid ${C.border}` }}>
                <th style={{ padding: '12px 20px', textAlign: 'left', fontSize: 12, fontWeight: 500, color: C.textTertiary }}>{t('name') ?? 'Name'}</th>
                <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: 12, fontWeight: 500, color: C.textTertiary }}>{t('service') ?? 'Service'}</th>
                <th style={{ padding: '12px 16px', textAlign: 'right', fontSize: 12, fontWeight: 500, color: C.textTertiary }}>{t('totalVisits') ?? 'Visits'}</th>
                <th style={{ padding: '12px 16px', textAlign: 'right', fontSize: 12, fontWeight: 500, color: C.textTertiary }}>{t('price') ?? 'Price'}</th>
                <th style={{ padding: '12px 16px', textAlign: 'right', fontSize: 12, fontWeight: 500, color: C.textTertiary }}>{t('validityDays') ?? 'Days'}</th>
                <th style={{ padding: '12px 16px', textAlign: 'center', fontSize: 12, fontWeight: 500, color: C.textTertiary }}>{t('status')}</th>
                <th style={{ padding: '12px 16px', width: 80 }} />
              </tr>
            </thead>
            <tbody>
              {packages.map((pkg, i) => (
                <motion.tr
                  key={pkg.id}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: i * 0.02 }}
                  style={{ borderBottom: `1px solid ${C.border}` }}
                >
                  <td style={{ padding: '12px 20px', fontSize: 13, color: C.text, fontWeight: 500 }}>{pkg.name}</td>
                  <td style={{ padding: '12px 16px', fontSize: 13, color: C.textTertiary }}>{pkg.service?.name ?? (t('all') ?? 'All')}</td>
                  <td style={{ padding: '12px 16px', textAlign: 'right', fontSize: 13, color: C.text }}>
                    {pkg.total_visits}{pkg.bonus_visits > 0 ? ` +${pkg.bonus_visits}` : ''}
                  </td>
                  <td style={{ padding: '12px 16px', textAlign: 'right', fontSize: 13, fontWeight: 600, color: C.text }}>
                    {pkg.price.toLocaleString()} {pkg.currency}
                  </td>
                  <td style={{ padding: '12px 16px', textAlign: 'right', fontSize: 13, color: C.textTertiary }}>{pkg.validity_days}d</td>
                  <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                    <button
                      onClick={() => toggleActive(pkg.id, pkg.is_active)}
                      style={{
                        display: 'inline-flex', alignItems: 'center', gap: 4,
                        padding: '4px 10px', borderRadius: 6, border: 'none',
                        fontSize: 12, fontWeight: 500, cursor: 'pointer',
                        background: pkg.is_active ? 'rgba(16,185,129,0.12)' : 'rgba(220,38,38,0.12)',
                        color: pkg.is_active ? '#34d399' : '#ef4444',
                      }}
                    >
                      {pkg.is_active ? <Check size={12} /> : <X size={12} />}
                      {pkg.is_active ? (t('active') ?? 'Active') : (t('inactive') ?? 'Inactive')}
                    </button>
                  </td>
                  <td style={{ padding: '12px 8px', textAlign: 'right' }}>
                    <button
                      onClick={() => deletePackage(pkg.id)}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.textTertiary, padding: 4 }}
                    >
                      <Trash2 size={14} />
                    </button>
                  </td>
                </motion.tr>
              ))}
            </tbody>
          </table>
        </motion.div>
      ) : null}
    </div>
  );
}
