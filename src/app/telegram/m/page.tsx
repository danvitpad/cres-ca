/** --- YAML
 * name: MasterMiniAppRoot
 * description: Корень мастер-Mini-App — редирект на «Главную» дашборд.
 *              До 2026-05-11 редиректил на /calendar (главной не было);
 *              после возврата дашборда — /home как landing.
 * created: 2026-05-07
 * updated: 2026-05-11
 * --- */

import { redirect } from 'next/navigation';

export default function MasterMiniAppRoot() {
  redirect('/telegram/m/home');
}
