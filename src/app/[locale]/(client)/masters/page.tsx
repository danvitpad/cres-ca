/** --- YAML
 * name: MastersRedirect
 * description: Legacy /masters → /search (Phase 3 unified search). Individual master pages remain at /masters/[id].
 * updated: 2026-04-19
 * --- */

import { redirect } from 'next/navigation';

interface Props {
  searchParams: Promise<{ q?: string }>;
}

export default async function MastersRedirect({ searchParams }: Props) {
  const { q } = await searchParams;
  redirect(q ? `/search?q=${encodeURIComponent(q)}` : '/search');
}
