/** --- YAML
 * name: Verified badge
 * description: Shows blue checkmark (identity verified) + amber star (expertise verified) next to master name.
 * created: 2026-04-24
 * --- */

import { BadgeCheck, Award } from 'lucide-react';

export function VerifiedBadge({
  identityVerified,
  expertiseVerified,
  size = 14,
}: {
  identityVerified?: boolean;
  expertiseVerified?: boolean;
  size?: number;
}) {
  if (!identityVerified && !expertiseVerified) return null;
  return (
    <span className="inline-flex items-center gap-1" aria-label="Verified master">
      {identityVerified && (
        <span title="Личность подтверждена" className="text-sky-400">
          <BadgeCheck size={size} fill="currentColor" stroke="#0b0d17" strokeWidth={2} />
        </span>
      )}
      {expertiseVerified && (
        <span title="Сертификация подтверждена" className="text-amber-400">
          <Award size={size} fill="currentColor" stroke="#0b0d17" strokeWidth={2} />
        </span>
      )}
    </span>
  );
}
