/** --- YAML
 * name: MasterMiniAppHome (deprecated)
 * description: Старая «Главная» мастера. После редизайна 2026-05-07 главной
 *              больше нет — мастер сразу попадает в Календарь. Эту страницу
 *              оставляем как тонкий редирект чтобы старые ссылки и кнопки
 *              "/telegram/m/home" продолжали работать.
 * created: 2026-04-13
 * updated: 2026-05-07
 * --- */

import { redirect } from 'next/navigation';

export default function MasterMiniAppHomeRedirect() {
  redirect('/telegram/m/calendar');
}
