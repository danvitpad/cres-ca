/** --- YAML
 * name: MastersSearchPage
 * description: Search/browse masters by name, phone, or invite code with animated cards
 * --- */

'use client';

import { useEffect, useState, useCallback } from 'react';
import { useTranslations } from 'next-intl';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Search, Star, MapPin, X, Loader2, Users } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { createClient } from '@/lib/supabase/client';
import { Input } from '@/components/ui/input';
import { buttonVariants } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

interface MasterResult {
  id: string;
  specialization: string | null;
  rating: number;
  city: string | null;
  is_active: boolean;
  invite_code: string | null;
  display_name: string | null;
  avatar_url: string | null;
  profiles: {
    full_name: string;
    avatar_url: string | null;
  } | null;
  services: { id: string; name: string; price: number; currency: string }[];
}

export default function MastersPage() {
  const t = useTranslations('map');
  const tc = useTranslations('common');
  const searchParams = useSearchParams();
  const [query, setQuery] = useState(searchParams.get('q') ?? '');

  useEffect(() => {
    const q = searchParams.get('q');
    if (q !== null) setQuery(q);
  }, [searchParams]);
  const [masters, setMasters] = useState<MasterResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);

  const searchMasters = useCallback(async (searchQuery: string) => {
    if (!searchQuery.trim()) {
      setMasters([]);
      setHasSearched(false);
      return;
    }

    setIsLoading(true);
    setHasSearched(true);
    const supabase = createClient();
    const q = searchQuery.trim();

    // Search by name, invite code, or city
    const { data } = await supabase
      .from('masters')
      .select('id, specialization, rating, city, is_active, invite_code, display_name, avatar_url, profiles(full_name, avatar_url), services(id, name, price, currency)')
      .eq('is_active', true)
      .or(`invite_code.eq.${q},display_name.ilike.%${q}%,city.ilike.%${q}%`)
      .limit(20);

    setMasters((data as unknown as MasterResult[]) || []);
    setIsLoading(false);
  }, []);

  // Debounced search
  useEffect(() => {
    const timer = setTimeout(() => searchMasters(query), 400);
    return () => clearTimeout(timer);
  }, [query, searchMasters]);

  // Load featured masters on mount
  useEffect(() => {
    async function loadFeatured() {
      setIsLoading(true);
      const supabase = createClient();
      const { data } = await supabase
        .from('masters')
        .select('id, specialization, rating, city, is_active, invite_code, display_name, avatar_url, profiles(full_name, avatar_url), services(id, name, price, currency)')
        .eq('is_active', true)
        .order('rating', { ascending: false })
        .limit(12);

      setMasters((data as unknown as MasterResult[]) || []);
      setIsLoading(false);
    }
    loadFeatured();
  }, []);

  return (
    <div className="flex flex-col min-h-[calc(100vh-8rem)]">
      {/* Header with search */}
      <div className="sticky top-0 z-10 bg-background/80 backdrop-blur-xl border-b border-border/50 px-4 py-4 space-y-3">
        <div className="flex items-center gap-2">
          <Users className="size-5 text-primary" />
          <h2 className="text-lg font-semibold">{t('nearbyMasters')}</h2>
        </div>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={tc('search') + '...'}
            className="pl-9 pr-9 h-11 rounded-xl bg-muted/50 border-border/50"
          />
          {query && (
            <button
              onClick={() => setQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
            >
              <X className="size-4" />
            </button>
          )}
        </div>
      </div>

      {/* Results */}
      <div className="flex-1 px-4 py-4">
        {isLoading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="size-6 animate-spin text-primary" />
          </div>
        ) : masters.length === 0 && hasSearched ? (
          <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
            <Search className="size-10 mb-3 opacity-40" />
            <p className="text-sm">{t('searchArea')}</p>
          </div>
        ) : (
          <motion.div
            layout
            className="grid grid-cols-1 sm:grid-cols-2 gap-3"
          >
            <AnimatePresence mode="popLayout">
              {masters.map((master, i) => (
                <motion.div
                  key={master.id}
                  layout
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0, transition: { delay: i * 0.05 } }}
                  exit={{ opacity: 0, scale: 0.95 }}
                >
                  <MasterCard master={master} />
                </motion.div>
              ))}
            </AnimatePresence>
          </motion.div>
        )}
      </div>
    </div>
  );
}

function MasterCard({ master }: { master: MasterResult }) {
  const minPrice = master.services?.length
    ? Math.min(...master.services.map((s) => s.price))
    : null;
  const name = master.display_name ?? master.profiles?.full_name ?? 'Master';
  const avatar = master.avatar_url ?? master.profiles?.avatar_url ?? null;

  return (
    <Link href={`/masters/${master.id}`} className="block">
      <div className="group relative rounded-2xl border border-border/50 bg-card/80 backdrop-blur p-4 transition-all duration-300 hover:shadow-lg hover:-translate-y-0.5 hover:border-primary/20">
        {/* Subtle dot pattern on hover */}
        <div className="absolute inset-0 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-300">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(0,0,0,0.02)_1px,transparent_1px)] dark:bg-[radial-gradient(circle_at_center,rgba(255,255,255,0.02)_1px,transparent_1px)] bg-[length:4px_4px] rounded-2xl" />
        </div>

        <div className="relative flex items-start gap-3">
          {/* Avatar */}
          <div className="relative shrink-0">
            <div className="flex size-14 items-center justify-center overflow-hidden rounded-full bg-primary/10 text-primary font-bold text-xl group-hover:bg-primary/15 transition-colors">
              {avatar ? (
                <img src={avatar} alt={name} className="size-full object-cover" />
              ) : (
                name[0].toUpperCase()
              )}
            </div>
            {/* Online indicator */}
            <div className="absolute -bottom-0.5 -right-0.5 size-3.5 rounded-full bg-emerald-500 border-2 border-card" />
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <h3 className="font-semibold truncate group-hover:text-primary transition-colors">
                {name}
              </h3>
              {master.rating >= 4.5 && (
                <Badge variant="outline" className="shrink-0 text-[10px] px-1.5 py-0 rounded-full border-amber-300 text-amber-600 dark:text-amber-400">
                  TOP
                </Badge>
              )}
            </div>

            {master.specialization && (
              <p className="text-sm text-muted-foreground truncate">{master.specialization}</p>
            )}

            <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
              <span className="flex items-center gap-1">
                <Star className="size-3.5 fill-amber-400 text-amber-400" />
                {(master.rating || 0).toFixed(1)}
              </span>
              {master.city && (
                <span className="flex items-center gap-1">
                  <MapPin className="size-3.5" />
                  {master.city}
                </span>
              )}
              {minPrice !== null && (
                <span className="ml-auto font-medium text-foreground">
                  from {minPrice} {master.services[0]?.currency || 'UAH'}
                </span>
              )}
            </div>

            {/* Service tags */}
            {master.services?.length > 0 && (
              <div className="flex gap-1.5 mt-2.5 overflow-hidden">
                {master.services.slice(0, 3).map((s) => (
                  <span
                    key={s.id}
                    className="text-[10px] px-2 py-0.5 rounded-md bg-muted/80 text-muted-foreground truncate max-w-[100px]"
                  >
                    {s.name}
                  </span>
                ))}
                {master.services.length > 3 && (
                  <span className="text-[10px] px-2 py-0.5 rounded-md bg-muted/80 text-muted-foreground">
                    +{master.services.length - 3}
                  </span>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </Link>
  );
}
