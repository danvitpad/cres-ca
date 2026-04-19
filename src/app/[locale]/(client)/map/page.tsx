/** --- YAML
 * name: MapRedirect
 * description: Legacy /map → /search?view=map (Phase 3 merged map + search).
 * updated: 2026-04-19
 * --- */

import { redirect } from 'next/navigation';

export default function MapPage() {
  redirect('/search?view=map');
}
