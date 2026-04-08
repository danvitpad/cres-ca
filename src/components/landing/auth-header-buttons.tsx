/** --- YAML
 * name: AuthHeaderButtons
 * description: Header buttons that show user name + dashboard link when logged in, or sign in/up when not
 * --- */

'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { createClient } from '@/lib/supabase/client';
import { buttonVariants } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { User } from 'lucide-react';

export function AuthHeaderButtons() {
  const ta = useTranslations('auth');
  const [user, setUser] = useState<{ name: string; role: string } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const supabase = createClient();

    async function check() {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('full_name, role')
          .eq('id', session.user.id)
          .single();
        if (profile) {
          setUser({ name: profile.full_name || session.user.email || '', role: profile.role });
        }
      }
      setLoading(false);
    }

    check();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session) {
        setUser(null);
      } else {
        check();
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  if (loading) {
    return <div className="w-20 h-8" />;
  }

  if (user) {
    const dashboardUrl = user.role === 'client' ? '/book' : '/calendar';
    return (
      <Link
        href={dashboardUrl}
        className={cn(buttonVariants({ size: 'sm' }), 'gap-2')}
      >
        <User className="size-4" />
        {user.name}
      </Link>
    );
  }

  return (
    <>
      <Link href="/login" className={cn(buttonVariants({ size: 'sm', variant: 'ghost' }))}>
        {ta('signIn')}
      </Link>
      <Link href="/register" className={cn(buttonVariants({ size: 'sm' }))}>
        {ta('signUp')}
      </Link>
    </>
  );
}
