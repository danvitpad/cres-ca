/** --- YAML
 * name: ClientDisplayMode
 * description: Правило отображения салон/мастер для клиентских экранов (CRES-CA-CLIENT-PATCH.md).
 *              Solo-мастер → имя primary. Мастер в салоне → название салона primary, имя мастера secondary.
 *              Салон без мастера → только название салона.
 * created: 2026-04-19
 * --- */

export type DisplayMode = 'solo' | 'salon_with_master' | 'salon_only';

export interface MasterRef {
  id: string;
  display_name?: string | null;
  full_name?: string | null;
  specialization?: string | null;
  avatar_url?: string | null;
  rating?: number | null;
  salon_id?: string | null;
}

export interface SalonRef {
  id: string;
  name: string;
  logo_url?: string | null;
  city?: string | null;
  rating?: number | null;
  total_reviews?: number | null;
}

/**
 * Определяет режим отображения для связки (мастер, салон).
 *
 * - `solo` — salon отсутствует → имя мастера primary.
 * - `salon_with_master` — оба есть → название салона primary, имя мастера secondary.
 * - `salon_only` — только салон → название салона primary, без конкретного мастера.
 */
export function getDisplayMode(
  master: MasterRef | null | undefined,
  salon: SalonRef | null | undefined,
): DisplayMode {
  if (!salon) return 'solo';
  if (master) return 'salon_with_master';
  return 'salon_only';
}

/** Читаемое имя мастера из любого допустимого shape (display_name → full_name). */
export function resolveMasterName(master: MasterRef | null | undefined): string {
  if (!master) return '';
  return (master.display_name?.trim() || master.full_name?.trim() || '').trim();
}

/**
 * Основной визуальный payload для карточки.
 * - `primary` — крупный заголовок (имя мастера для solo, название салона для salon_*)
 * - `secondary` — подзаголовок (специализация для solo, имя мастера для salon_with_master)
 * - `avatarSrc` — аватар: мастера для solo/salon_with_master, логотип салона для salon_only
 * - `avatarName` — fallback для инициалов
 */
export function resolveCardDisplay(
  master: MasterRef | null | undefined,
  salon: SalonRef | null | undefined,
  labels: { masterPlaceholder: string; salonPlaceholder: string; managerAssigned: string },
): {
  mode: DisplayMode;
  primary: string;
  secondary: string | null;
  avatarSrc: string | null;
  avatarName: string;
  rating: number | null;
} {
  const mode = getDisplayMode(master, salon);
  const masterName = resolveMasterName(master) || labels.masterPlaceholder;
  const salonName = salon?.name?.trim() || labels.salonPlaceholder;

  if (mode === 'solo') {
    return {
      mode,
      primary: masterName,
      secondary: master?.specialization?.trim() || null,
      avatarSrc: master?.avatar_url ?? null,
      avatarName: masterName,
      rating: master?.rating ?? null,
    };
  }
  if (mode === 'salon_with_master') {
    return {
      mode,
      primary: salonName,
      secondary: masterName,
      avatarSrc: master?.avatar_url ?? salon?.logo_url ?? null,
      avatarName: masterName,
      rating: master?.rating ?? salon?.rating ?? null,
    };
  }
  // salon_only
  return {
    mode,
    primary: salonName,
    secondary: labels.managerAssigned,
    avatarSrc: salon?.logo_url ?? null,
    avatarName: salonName,
    rating: salon?.rating ?? null,
  };
}
