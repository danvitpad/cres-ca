/** --- YAML
 * name: IntakeFieldsPerVertical
 * description: Dynamic intake/anamnesis field definitions per vertical. Used by the Health tab on client detail page to render relevant fields based on the master's industry.
 * created: 2026-04-16
 * updated: 2026-04-16
 * --- */

import type { VerticalKey } from './default-services';

export type IntakeFieldType = 'text' | 'boolean' | 'tags' | 'number' | 'select';

export interface IntakeFieldDef {
  key: string;
  labelKey: string; // i18n key under clients.intake.*
  type: IntakeFieldType;
  options?: string[]; // for select type
}

/**
 * Per-vertical intake field configs.
 * - beauty: skin type, allergens, past procedures
 * - health: full medical (allergies, chronic, meds, pregnancy, contraindications)
 * - auto: no anamnesis (empty)
 * - pets: breed, weight, vaccinations
 * - tattoo: skin sensitivity, allergies, blood thinners
 * - fitness: injuries, chronic conditions, goals
 * - other verticals: basic allergies + contraindications
 */
export const INTAKE_FIELDS: Record<VerticalKey, IntakeFieldDef[]> = {
  beauty: [
    { key: 'skin_type', labelKey: 'skinType', type: 'select', options: ['normal', 'dry', 'oily', 'combination', 'sensitive'] },
    { key: 'allergens', labelKey: 'allergens', type: 'text' },
    { key: 'past_procedures', labelKey: 'pastProcedures', type: 'text' },
    { key: 'allergies', labelKey: 'allergies', type: 'text' },
    { key: 'contraindications', labelKey: 'contraindications', type: 'text' },
  ],
  health: [
    { key: 'allergies', labelKey: 'allergies', type: 'text' },
    { key: 'chronic_conditions', labelKey: 'chronicConditions', type: 'text' },
    { key: 'medications', labelKey: 'medications', type: 'text' },
    { key: 'pregnancy', labelKey: 'pregnancy', type: 'boolean' },
    { key: 'contraindications', labelKey: 'contraindications', type: 'text' },
  ],
  auto: [],
  tattoo: [
    { key: 'skin_sensitivity', labelKey: 'skinSensitivity', type: 'select', options: ['normal', 'sensitive', 'keloid_prone'] },
    { key: 'allergies', labelKey: 'allergies', type: 'text' },
    { key: 'blood_thinners', labelKey: 'bloodThinners', type: 'boolean' },
    { key: 'contraindications', labelKey: 'contraindications', type: 'text' },
  ],
  pets: [
    { key: 'breed', labelKey: 'breed', type: 'text' },
    { key: 'weight', labelKey: 'weight', type: 'number' },
    { key: 'vaccinations', labelKey: 'vaccinations', type: 'text' },
    { key: 'allergies', labelKey: 'allergies', type: 'text' },
    { key: 'contraindications', labelKey: 'contraindications', type: 'text' },
  ],
  craft: [
    { key: 'allergies', labelKey: 'allergies', type: 'text' },
    { key: 'contraindications', labelKey: 'contraindications', type: 'text' },
  ],
  fitness: [
    { key: 'injuries', labelKey: 'injuries', type: 'text' },
    { key: 'chronic_conditions', labelKey: 'chronicConditions', type: 'text' },
    { key: 'contraindications', labelKey: 'contraindications', type: 'text' },
  ],
  events: [],
  education: [],
  other: [
    { key: 'allergies', labelKey: 'allergies', type: 'text' },
    { key: 'contraindications', labelKey: 'contraindications', type: 'text' },
  ],
};

export function getIntakeFields(vertical: string | null | undefined): IntakeFieldDef[] {
  if (!vertical) return INTAKE_FIELDS.other;
  return INTAKE_FIELDS[vertical as VerticalKey] ?? INTAKE_FIELDS.other;
}
