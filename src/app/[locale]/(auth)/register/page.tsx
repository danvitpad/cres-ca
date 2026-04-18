/** --- YAML
 * name: Register Page (redirect)
 * description: Legacy /register route — redirected to unified /login?mode=signup. Preserves ?role / ?email search params.
 * created: 2026-04-15
 * updated: 2026-04-18
 * --- */

import { redirect } from 'next/navigation';

export default async function RegisterPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const params = new URLSearchParams();
  params.set('mode', 'signup');
  if (typeof sp.role === 'string') params.set('role', sp.role);
  if (typeof sp.email === 'string') params.set('email', sp.email);
  redirect(`/login?${params.toString()}`);
}
