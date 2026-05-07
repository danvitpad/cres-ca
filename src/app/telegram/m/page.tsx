/** --- YAML
 * name: MasterMiniAppRoot
 * description: Корень мастер-Mini-App — мгновенный редирект на Календарь (default
 *              landing мастера). Старый /home теперь тоже шлёт сюда → /calendar.
 * created: 2026-05-07
 * --- */

import { redirect } from 'next/navigation';

export default function MasterMiniAppRoot() {
  redirect('/telegram/m/calendar');
}
