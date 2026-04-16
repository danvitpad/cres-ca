/** --- YAML
 * name: GlobalSearchBar
 * description: Universal search across all entities (clients, masters, salons) with filter tabs and follow actions.
 * created: 2026-04-16
 * --- */

'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useTranslations } from 'next-intl';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, X, User, Scissors, Building2, UserPlus, UserCheck, Loader2 } from 'lucide-react';

type EntityType = 'client' | 'master' | 'salon';
type FilterType = 'all' | 'client' | 'master' | 'salon';

interface SearchResult {
  profileId: string;
  fullName: string;
  avatarUrl: string | null;
  entityType: EntityType;
  entityMeta: { specialization?: string; salonName?: string; city?: string; rating?: number } | null;
  isFollowing: boolean;
}

const ENTITY_ICON: Record<EntityType, typeof User> = {
  client: User,
  master: Scissors,
  salon: Building2,
};

const ENTITY_COLOR: Record<EntityType, string> = {
  client: '#3b82f6',
  master: '#8b5cf6',
  salon: '#10b981',
};

function getInitials(name: string) {
  return name.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase();
}

function hashColor(name: string) {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  const colors = ['#3b82f6', '#8b5cf6', '#10b981', '#f59e0b', '#ef4444', '#06b6d4', '#6366f1', '#ec4899'];
  return colors[Math.abs(hash) % colors.length];
}

export function GlobalSearchBar() {
  const tf = useTranslations('followSystem');
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<FilterType>('all');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const search = useCallback(async (q: string, f: FilterType) => {
    if (!q.trim() || q.trim().length < 2) {
      setResults([]);
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`/api/search/global?q=${encodeURIComponent(q.trim())}&filter=${f}&limit=20`);
      const json = await res.json();
      setResults(json.results ?? []);
    } catch {
      setResults([]);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => search(query, filter), 300);
    return () => clearTimeout(timer);
  }, [query, filter, search]);

  // Close on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const toggleFollow = async (profileId: string) => {
    await fetch('/api/follow', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ targetId: profileId }),
    });
    // Toggle local state
    setResults(prev => prev.map(r =>
      r.profileId === profileId ? { ...r, isFollowing: !r.isFollowing } : r,
    ));
  };

  const filters: { key: FilterType; label: string }[] = [
    { key: 'all', label: tf('filterAll') },
    { key: 'client', label: tf('filterClients') },
    { key: 'master', label: tf('filterMasters') },
    { key: 'salon', label: tf('filterSalons') },
  ];

  return (
    <div ref={containerRef} style={{ position: 'relative', width: '100%', maxWidth: 560, marginBottom: 20 }}>
      {/* Search input */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 8,
        padding: '10px 14px', borderRadius: 12,
        backgroundColor: 'var(--muted, rgba(255,255,255,0.04))',
        border: '1px solid var(--border, rgba(255,255,255,0.08))',
        transition: 'border-color 150ms',
      }}>
        <Search style={{ width: 16, height: 16, color: 'var(--muted-foreground, #8a8f98)', flexShrink: 0 }} />
        <input
          value={query}
          onChange={e => { setQuery(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
          placeholder={tf('searchGlobal')}
          style={{
            border: 'none', outline: 'none', backgroundColor: 'transparent',
            fontSize: 14, color: 'var(--foreground, #f0f0f0)', width: '100%',
          }}
        />
        {query && (
          <button
            onClick={() => { setQuery(''); setResults([]); }}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted-foreground)', padding: 0 }}
          >
            <X style={{ width: 14, height: 14 }} />
          </button>
        )}
      </div>

      {/* Dropdown */}
      <AnimatePresence>
        {open && query.trim().length >= 2 && (
          <motion.div
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.15 }}
            style={{
              position: 'absolute', top: '100%', left: 0, right: 0,
              marginTop: 6, borderRadius: 12, overflow: 'hidden',
              backgroundColor: 'var(--card, #0f1011)',
              border: '1px solid var(--border, rgba(255,255,255,0.08))',
              boxShadow: '0 8px 32px rgba(0,0,0,0.2)',
              zIndex: 100, maxHeight: 420, overflowY: 'auto',
            }}
          >
            {/* Filter tabs */}
            <div style={{
              display: 'flex', gap: 0, padding: '4px 8px',
              borderBottom: '1px solid var(--border, rgba(255,255,255,0.06))',
            }}>
              {filters.map(f => (
                <button
                  key={f.key}
                  onClick={() => setFilter(f.key)}
                  style={{
                    padding: '6px 12px', fontSize: 12, fontWeight: 500,
                    color: filter === f.key ? 'var(--foreground)' : 'var(--muted-foreground, #8a8f98)',
                    backgroundColor: filter === f.key ? 'rgba(94,106,210,0.1)' : 'transparent',
                    border: 'none', borderRadius: 6, cursor: 'pointer',
                    transition: 'all 100ms',
                  }}
                >
                  {f.label}
                </button>
              ))}
            </div>

            {/* Results */}
            {loading ? (
              <div style={{ display: 'flex', justifyContent: 'center', padding: 24 }}>
                <Loader2 style={{ width: 20, height: 20, color: 'var(--muted-foreground)', animation: 'spin 1s linear infinite' }} />
              </div>
            ) : results.length === 0 ? (
              <div style={{ padding: '24px 16px', textAlign: 'center', fontSize: 13, color: 'var(--muted-foreground)' }}>
                {tf('noFollowers')}
              </div>
            ) : (
              results.map((r, i) => {
                const Icon = ENTITY_ICON[r.entityType];
                const eColor = ENTITY_COLOR[r.entityType];
                return (
                  <div
                    key={r.profileId}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 12,
                      padding: '10px 14px',
                      borderBottom: i < results.length - 1 ? '1px solid var(--border, rgba(255,255,255,0.04))' : 'none',
                      transition: 'background-color 100ms',
                      cursor: 'pointer',
                    }}
                    onMouseEnter={e => { e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.03)'; }}
                    onMouseLeave={e => { e.currentTarget.style.backgroundColor = 'transparent'; }}
                  >
                    {/* Avatar */}
                    {r.avatarUrl ? (
                      <img src={r.avatarUrl} alt="" style={{ width: 36, height: 36, borderRadius: 999, objectFit: 'cover', flexShrink: 0 }} />
                    ) : (
                      <div style={{
                        width: 36, height: 36, borderRadius: 999, flexShrink: 0,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        backgroundColor: hashColor(r.fullName), color: '#fff', fontSize: 13, fontWeight: 600,
                      }}>
                        {getInitials(r.fullName || '?')}
                      </div>
                    )}

                    {/* Info */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--foreground)' }}>{r.fullName}</span>
                        <span style={{
                          display: 'inline-flex', alignItems: 'center', gap: 2,
                          fontSize: 9, fontWeight: 600, padding: '1px 6px', borderRadius: 999,
                          backgroundColor: `${eColor}18`, color: eColor,
                        }}>
                          <Icon style={{ width: 9, height: 9 }} />
                          {tf(`entity${r.entityType.charAt(0).toUpperCase() + r.entityType.slice(1)}` as 'entityClient' | 'entityMaster' | 'entitySalon')}
                        </span>
                      </div>
                      {r.entityMeta?.specialization && (
                        <span style={{ fontSize: 11, color: 'var(--muted-foreground, #62666d)' }}>{r.entityMeta.specialization}</span>
                      )}
                      {r.entityMeta?.city && (
                        <span style={{ fontSize: 11, color: 'var(--muted-foreground, #62666d)', marginLeft: 8 }}>{r.entityMeta.city}</span>
                      )}
                    </div>

                    {/* Follow button */}
                    <button
                      onClick={(e) => { e.stopPropagation(); toggleFollow(r.profileId); }}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 4,
                        padding: '5px 12px', borderRadius: 6,
                        border: r.isFollowing ? '1px solid var(--border)' : 'none',
                        backgroundColor: r.isFollowing ? 'transparent' : '#5e6ad2',
                        color: r.isFollowing ? 'var(--muted-foreground)' : '#fff',
                        fontSize: 11, fontWeight: 600, cursor: 'pointer',
                        transition: 'opacity 100ms',
                      }}
                    >
                      {r.isFollowing
                        ? <><UserCheck style={{ width: 11, height: 11 }} />{tf('unfollow')}</>
                        : <><UserPlus style={{ width: 11, height: 11 }} />{tf('follow')}</>
                      }
                    </button>
                  </div>
                );
              })
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
