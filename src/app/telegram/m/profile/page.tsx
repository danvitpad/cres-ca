/** --- YAML
 * name: MasterMiniAppProfile (deprecated)
 * description: Раньше тут был отдельный экран Профиля. После редизайна
 *              2026-05-07 у мастера нет «профиля» как отдельной сущности —
 *              всё что в нём было (имя, аватар, тариф, био, контакты) живёт
 *              на публичной странице (открывается тапом на кружок аватара
 *              справа сверху). Этот файл — тонкий редирект на /public-page,
 *              чтобы старые ссылки и закладки продолжали работать.
 * created: 2026-04-13
 * updated: 2026-05-07
 * --- */

import { redirect } from 'next/navigation';

export default function MasterMiniAppProfileRedirect() {
  redirect('/telegram/m/public-page');
}
