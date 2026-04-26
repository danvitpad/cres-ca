/** --- YAML
 * name: Banned page
 * description: Shown to users whose profile_id is in platform_blacklist. Fetches reason, then signs them out.
 * created: 2026-04-21
 * --- */

import { BannedClient } from '@/components/banned-client';


export default function BannedPage() {
  return <BannedClient />;
}
