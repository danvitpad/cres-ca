/** --- YAML
 * name: Superadmin layout
 * description: Server-side email gate for /superadmin/*. Non-superadmin users get notFound() (404, not 403) so the route appears not to exist.
 * created: 2026-04-19
 * --- */

import { notFound, redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { isSuperadminEmail } from '@/lib/superadmin/access';
import { SuperadminShell } from '@/components/superadmin/superadmin-shell';


export default async function SuperadminLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('email')
    .eq('id', user.id)
    .maybeSingle();

  if (!isSuperadminEmail(profile?.email ?? user.email ?? null)) {
    notFound();
  }

  return <SuperadminShell email={profile?.email ?? user.email ?? ''}>{children}</SuperadminShell>;
}
