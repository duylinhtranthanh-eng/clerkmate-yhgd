/**
 * Single source of truth for the person at the centre of the genogram.
 *
 * The patient's name, sex and age live in `record.patient`. The `self` entry in
 * `familyMembers` exists only so the layout has a node to hang relationships
 * from, so its identity fields are resolved from the patient here rather than
 * stored twice — storing them twice is how the genogram ended up drawing a
 * diamond for a patient already recorded as female.
 */

import type { CaseRecord, FamilyMember } from '../types/case'

export function resolveFamilyMembers(record: CaseRecord): FamilyMember[] {
  return record.familyMembers.map((m) =>
    m.relation === 'self'
      ? {
          ...m,
          name: record.patient.name.trim() || 'Bệnh nhân',
          sex: record.patient.sex,
          ageYears: record.patient.ageYears,
        }
      : m,
  )
}
