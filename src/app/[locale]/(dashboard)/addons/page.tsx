/** --- YAML
 * name: AddonsRedirect
 * description: Backwards-compat redirect — /addons was renamed to /integrations in Phase 6.5.
 * created: 2026-04-18
 * updated: 2026-04-18
 * --- */

import { redirect } from 'next/navigation';

export default async function AddonsRedirect({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  redirect(`/${locale}/integrations`);
}
