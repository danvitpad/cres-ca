/** --- YAML
 * name: Profile Edit API
 * description: PATCH {fullName?, bio?, slug?, avatarUrl?, phone?, email?} — обновляет профиль. Email обновляется через supabase.auth.updateUser (потребует подтверждение).
 * --- */

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

const SLUG_RE = /^[a-z0-9][a-z0-9_.-]{2,31}$/;

export async function PATCH(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const body = (await req.json().catch(() => ({}))) as {
    fullName?: string;
    bio?: string;
    slug?: string;
    avatarUrl?: string;
    phone?: string;
    email?: string;
    password?: string;
  };

  let passwordChanged = false;
  if (typeof body.password === 'string' && body.password.length > 0) {
    if (body.password.length < 6) {
      return NextResponse.json({ error: 'password_too_short' }, { status: 400 });
    }
    const { error: pwErr } = await supabase.auth.updateUser({ password: body.password });
    if (pwErr) {
      return NextResponse.json({ error: 'password_update_failed', detail: pwErr.message }, { status: 400 });
    }
    passwordChanged = true;
  }

  const update: Record<string, unknown> = {};
  if (typeof body.fullName === 'string' && body.fullName.trim()) update.full_name = body.fullName.trim();
  if (typeof body.bio === 'string') update.bio = body.bio.slice(0, 280);
  if (typeof body.avatarUrl === 'string') update.avatar_url = body.avatarUrl;

  if (typeof body.phone === 'string') {
    const raw = body.phone.replace(/\D/g, '');
    if (raw === '') {
      update.phone = null;
    } else {
      const normalized = raw.startsWith('380') ? `+${raw}` : raw.length === 9 ? `+380${raw}` : `+${raw}`;
      if (!/^\+\d{10,15}$/.test(normalized)) {
        return NextResponse.json({ error: 'invalid_phone' }, { status: 400 });
      }
      update.phone = normalized;
    }
  }

  if (typeof body.email === 'string') {
    const email = body.email.trim().toLowerCase();
    if (email && !/^[\w.+-]+@[\w-]+\.[\w.-]+$/.test(email)) {
      return NextResponse.json({ error: 'invalid_email' }, { status: 400 });
    }
    if (email && email !== user.email) {
      const { error: authErr } = await supabase.auth.updateUser({ email });
      if (authErr) {
        return NextResponse.json({ error: 'email_update_failed', detail: authErr.message }, { status: 400 });
      }
      update.email = email;
    }
  }

  if (typeof body.slug === 'string') {
    const slug = body.slug.trim().toLowerCase();
    if (slug === '') {
      update.slug = null;
    } else {
      if (!SLUG_RE.test(slug)) {
        return NextResponse.json({ error: 'invalid_slug' }, { status: 400 });
      }
      const { data: clash } = await supabase
        .from('profiles')
        .select('id')
        .eq('slug', slug)
        .neq('id', user.id)
        .maybeSingle();
      if (clash) return NextResponse.json({ error: 'slug_taken' }, { status: 409 });
      update.slug = slug;
    }
  }

  if (Object.keys(update).length === 0) {
    if (passwordChanged) {
      return NextResponse.json({ ok: true, updated: ['password'] });
    }
    return NextResponse.json({ error: 'nothing_to_update' }, { status: 400 });
  }

  const { error } = await supabase.from('profiles').update(update).eq('id', user.id);
  if (error) return NextResponse.json({ error: 'update_failed', detail: error.message }, { status: 500 });

  const updated = Object.keys(update);
  if (passwordChanged) updated.push('password');
  return NextResponse.json({ ok: true, updated });
}
