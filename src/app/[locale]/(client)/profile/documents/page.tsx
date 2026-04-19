/** --- YAML
 * name: ClientProfileDocumentsRedirect
 * description: Legacy redirect — раздел «Мои документы» удалён (Phase 8, plan).
 * created: 2026-04-19
 * --- */

import { redirect } from 'next/navigation';

export default function DocumentsRedirect() {
  redirect('/profile');
}
