/** --- YAML
 * name: ClientProfileFamilyRedirect
 * description: Legacy redirect — семья теперь живёт на /family (top-level).
 * created: 2026-04-19
 * --- */

import { redirect } from 'next/navigation';

export default function FamilyRedirect() {
  redirect('/family');
}
