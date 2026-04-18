/** --- YAML
 * name: TeamModePicker
 * description: Two-card team mode picker for the salon onboarding wizard. Lets the owner choose
 *              between 'unified' (salon controls clients/catalog, masters paid salary/%) and
 *              'marketplace' (masters run their own business, salon collects rent).
 * created: 2026-04-19
 * --- */

'use client';

import { Building2, Users } from 'lucide-react';

export type TeamMode = 'unified' | 'marketplace';

interface Props {
  value: TeamMode | null;
  onChange: (mode: TeamMode) => void;
}

const MODES: Array<{
  id: TeamMode;
  icon: typeof Building2;
  title: string;
  tagline: string;
  bullets: string[];
}> = [
  {
    id: 'unified',
    icon: Building2,
    title: 'Единый бизнес',
    tagline: 'Вы управляете всем, мастера получают зарплату или процент',
    bullets: [
      'Клиенты и каталог услуг — общие на салон',
      'Вы видите все записи и финансы',
      'Мастера получают % от выручки или ставку',
    ],
  },
  {
    id: 'marketplace',
    icon: Users,
    title: 'Коворкинг мастеров',
    tagline: 'Каждый мастер ведёт свой бизнес, вы получаете аренду',
    bullets: [
      'У каждого мастера свой каталог и клиенты',
      'Мастер сам ведёт записи и маркетинг',
      'Вы получаете фикс. аренду или % с выручки',
    ],
  },
];

export default function TeamModePicker({ value, onChange }: Props) {
  return (
    <div className="grid gap-3 md:grid-cols-2">
      {MODES.map((mode) => {
        const Icon = mode.icon;
        const selected = value === mode.id;
        return (
          <button
            key={mode.id}
            type="button"
            onClick={() => onChange(mode.id)}
            className={`flex flex-col gap-3 rounded-xl border p-5 text-left transition-all ${
              selected
                ? 'border-primary bg-primary/5 shadow-sm'
                : 'border-border bg-card hover:border-primary/40'
            }`}
          >
            <div className="flex items-center gap-3">
              <div
                className={`flex size-10 items-center justify-center rounded-lg ${
                  selected ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'
                }`}
              >
                <Icon className="size-5" />
              </div>
              <div>
                <div className="font-semibold">{mode.title}</div>
                <div className="text-xs text-muted-foreground mt-0.5">{mode.tagline}</div>
              </div>
            </div>

            <ul className="space-y-1.5 text-sm text-muted-foreground">
              {mode.bullets.map((b) => (
                <li key={b} className="flex items-start gap-2">
                  <span className="mt-2 size-1 shrink-0 rounded-full bg-muted-foreground/60" />
                  <span>{b}</span>
                </li>
              ))}
            </ul>
          </button>
        );
      })}
    </div>
  );
}
