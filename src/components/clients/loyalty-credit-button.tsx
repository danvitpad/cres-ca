/** --- YAML
 * name: LoyaltyCreditButton
 * description: Master-side widget — loyalty balance adjustment. TEMPORARILY HIDDEN
 *              (loyalty/bonuses feature is disabled). Returns null. Original code
 *              preserved in git history.
 * created: 2026-04-26
 * updated: 2026-05-05
 * --- */

'use client';

interface Props {
  masterId: string;
  profileId: string | null;
  onChanged?: () => void;
}

// HIDDEN: loyalty/bonuses temporarily disabled — returns null everywhere
export function LoyaltyCreditButton(_props: Props) {
  return null;
}
