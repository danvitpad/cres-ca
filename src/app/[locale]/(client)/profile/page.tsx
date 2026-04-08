/** --- YAML
 * name: Client Profile Page
 * description: Client's own profile — personal info, allergies, language preference, linked masters
 * --- */

import { useTranslations } from 'next-intl';

export default function ProfilePage() {
  const t = useTranslations('profile');

  return (
    <div className="p-4 space-y-6">
      <h2 className="text-2xl font-bold">{t('editProfile')}</h2>
      <div className="rounded-lg border p-8 text-center text-muted-foreground">
        Profile form
      </div>
    </div>
  );
}
