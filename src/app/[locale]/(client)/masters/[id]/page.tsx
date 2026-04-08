/** --- YAML
 * name: Master Public Profile
 * description: Public page showing master info, services list, rating, and booking buttons
 * --- */

'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { motion } from 'framer-motion';
import { createClient } from '@/lib/supabase/client';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { buttonVariants } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { Star, Clock, MapPin, ArrowLeft } from 'lucide-react';

interface MasterProfile {
  id: string;
  specialization: string | null;
  bio: string | null;
  address: string | null;
  city: string | null;
  rating: number;
  total_reviews: number;
  profile: {
    full_name: string;
    avatar_url: string | null;
  };
  services: ServiceItem[];
}

interface ServiceItem {
  id: string;
  name: string;
  description: string | null;
  duration_minutes: number;
  price: number;
  currency: string;
  color: string;
  category: { name: string } | null;
}

export default function MasterProfilePage() {
  const params = useParams();
  const masterId = params.id as string;
  const t = useTranslations('masterProfile');
  const tb = useTranslations('booking');
  const tc = useTranslations('common');
  const [master, setMaster] = useState<MasterProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const supabase = createClient();
      const { data } = await supabase
        .from('masters')
        .select(`
          id, specialization, bio, address, city, rating, total_reviews,
          profile:profiles(full_name, avatar_url),
          services(id, name, description, duration_minutes, price, currency, color, category:service_categories(name))
        `)
        .eq('id', masterId)
        .eq('is_active', true)
        .single();

      if (data) {
        const { services: rawServices, ...rest } = data;
        const activeServices = (rawServices as unknown as (ServiceItem & { is_active?: boolean })[])
          ?.filter((s) => s.is_active !== false) ?? [];
        setMaster({
          ...rest,
          profile: rest.profile as unknown as MasterProfile['profile'],
          services: activeServices,
        });
      }
      setLoading(false);
    }
    load();
  }, [masterId]);

  if (loading) {
    return (
      <div className="p-4 space-y-4">
        <Skeleton className="h-32 w-full rounded-xl" />
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-20 w-full" />
        <Skeleton className="h-20 w-full" />
      </div>
    );
  }

  if (!master) {
    return (
      <div className="p-4 text-center">
        <p className="text-muted-foreground">{t('notFound')}</p>
        <Link href="/masters" className={cn(buttonVariants({ variant: 'outline' }), 'mt-4')}>
          <ArrowLeft className="size-4" />
          {tc('back')}
        </Link>
      </div>
    );
  }

  const initials = master.profile.full_name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  const grouped = master.services.reduce<Record<string, ServiceItem[]>>((acc, s) => {
    const cat = s.category?.name ?? t('otherServices');
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(s);
    return acc;
  }, {});

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.3 }}
      className="p-4 space-y-6 pb-24"
    >
      <Link href="/masters" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors">
        <ArrowLeft className="size-4" />
        {tc('back')}
      </Link>

      {/* Master header */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.1 }}
        className="flex items-start gap-4"
      >
        <Avatar size="lg" className="size-20">
          {master.profile.avatar_url && (
            <AvatarImage src={master.profile.avatar_url} alt={master.profile.full_name} />
          )}
          <AvatarFallback className="text-lg">{initials}</AvatarFallback>
        </Avatar>
        <div className="flex-1 space-y-1">
          <h1 className="text-xl font-bold">{master.profile.full_name}</h1>
          {master.specialization && (
            <p className="text-sm text-muted-foreground">{master.specialization}</p>
          )}
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1 text-amber-500">
              <Star className="size-4 fill-current" />
              <span className="text-sm font-medium">{Number(master.rating).toFixed(1)}</span>
            </div>
            <span className="text-xs text-muted-foreground">
              ({master.total_reviews} {t('reviews')})
            </span>
          </div>
          {master.city && (
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <MapPin className="size-3" />
              {master.city}{master.address ? `, ${master.address}` : ''}
            </div>
          )}
        </div>
      </motion.div>

      {/* Bio */}
      {master.bio && (
        <Card>
          <CardContent className="pt-4">
            <p className="text-sm whitespace-pre-line">{master.bio}</p>
          </CardContent>
        </Card>
      )}

      {/* Services */}
      <div className="space-y-4">
        <h2 className="text-lg font-semibold">{tb('selectService')}</h2>
        {Object.entries(grouped).map(([category, services]) => (
          <div key={category} className="space-y-2">
            <h3 className="text-sm font-medium text-muted-foreground">{category}</h3>
            {services.map((service) => (
              <Card key={service.id} size="sm">
                <CardContent className="flex items-center justify-between gap-3 pt-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span
                        className="size-2.5 rounded-full shrink-0"
                        style={{ backgroundColor: service.color }}
                      />
                      <span className="font-medium truncate">{service.name}</span>
                    </div>
                    {service.description && (
                      <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{service.description}</p>
                    )}
                    <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Clock className="size-3" />
                        {service.duration_minutes} {t('min')}
                      </span>
                      <span className="font-medium text-foreground">
                        {Number(service.price).toFixed(0)} {service.currency}
                      </span>
                    </div>
                  </div>
                  <Link
                    href={`/book?master_id=${masterId}&service_id=${service.id}`}
                    className={cn(buttonVariants({ size: 'sm' }))}
                  >
                    {tb('bookNow')}
                  </Link>
                </CardContent>
              </Card>
            ))}
          </div>
        ))}
        {master.services.length === 0 && (
          <p className="text-sm text-muted-foreground text-center py-8">{t('noServicesAvailable')}</p>
        )}
      </div>
    </motion.div>
  );
}
