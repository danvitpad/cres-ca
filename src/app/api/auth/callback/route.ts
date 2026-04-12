/** --- YAML
 * name: Auth Callback
 * description: Handles Supabase email confirmation — exchanges code for session
 * --- */

import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');
  const next = searchParams.get('next');

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      if (next) return NextResponse.redirect(`${origin}${next}`);

      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('role')
          .eq('id', user.id)
          .single();

        if (!profile) {
          return NextResponse.redirect(`${origin}/onboarding/account-type`);
        }
        if (profile.role === 'client') {
          return NextResponse.redirect(`${origin}/feed`);
        }
        return NextResponse.redirect(`${origin}/calendar`);
      }
    }
  }
  return NextResponse.redirect(`${origin}/login?error=auth`);
}
