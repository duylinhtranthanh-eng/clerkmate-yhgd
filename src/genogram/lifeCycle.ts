/**
 * Deterministic family life-cycle suggestion from genogram data.
 *
 * This only ever *suggests* — `FAMILY_LIFE_CYCLE_STAGES` stays the source of
 * truth and the learner has to accept the stage before it is written. Rules
 * follow Duvall's eight stages as taught in the Family Medicine curriculum.
 */

import type { FamilyMember } from '../types/case'
import { FAMILY_LIFE_CYCLE_STAGES } from '../config/clinical'

export interface LifeCycleSuggestion {
  stage: string
  /** Why this stage, so the learner can judge the suggestion. */
  rationale: string
}

export function suggestLifeCycleStage(
  members: FamilyMember[],
  patientAge: number | null,
): LifeCycleSuggestion | null {
  const spouse = members.filter((m) => m.relation === 'spouse')
  const children = members.filter((m) => m.relation === 'child')
  const childAges = children.map((c) => c.ageYears).filter((a): a is number => a !== null)

  if (children.length === 0) {
    if (spouse.length === 0) {
      // No spouse and no children recorded: single adult, or living alone
      // after a loss. Age decides which of the two is more likely.
      if (patientAge !== null && patientAge >= 60) {
        return {
          stage: FAMILY_LIFE_CYCLE_STAGES[9],
          rationale: `Bệnh nhân ${patientAge} tuổi, chưa ghi nhận vợ/chồng và con trong phả hệ.`,
        }
      }
      return {
        stage: FAMILY_LIFE_CYCLE_STAGES[0],
        rationale: 'Chưa ghi nhận vợ/chồng và con trong phả hệ.',
      }
    }
    return {
      stage: FAMILY_LIFE_CYCLE_STAGES[1],
      rationale: 'Có vợ/chồng trong phả hệ và chưa ghi nhận con.',
    }
  }

  if (childAges.length === 0) {
    return {
      stage: FAMILY_LIFE_CYCLE_STAGES[4],
      rationale: 'Có con trong phả hệ nhưng chưa nhập tuổi — hãy bổ sung tuổi con để gợi ý chính xác hơn.',
    }
  }

  const youngest = Math.min(...childAges)
  const oldest = Math.max(...childAges)

  if (youngest < 3) {
    return { stage: FAMILY_LIFE_CYCLE_STAGES[2], rationale: `Con nhỏ nhất ${youngest} tuổi.` }
  }
  if (youngest < 6) {
    return { stage: FAMILY_LIFE_CYCLE_STAGES[3], rationale: `Con nhỏ nhất ${youngest} tuổi — tuổi mẫu giáo.` }
  }
  if (youngest < 13) {
    return { stage: FAMILY_LIFE_CYCLE_STAGES[4], rationale: `Con nhỏ nhất ${youngest} tuổi — tuổi đi học.` }
  }
  if (youngest < 20) {
    return { stage: FAMILY_LIFE_CYCLE_STAGES[5], rationale: `Con nhỏ nhất ${youngest} tuổi — vị thành niên.` }
  }

  // Every child is an adult: launching, empty nest, or aging family.
  if (patientAge !== null && patientAge >= 65) {
    return {
      stage: FAMILY_LIFE_CYCLE_STAGES[8],
      rationale: `Bệnh nhân ${patientAge} tuổi, các con đã trưởng thành.`,
    }
  }
  if (youngest < 25) {
    return {
      stage: FAMILY_LIFE_CYCLE_STAGES[6],
      rationale: `Con nhỏ nhất ${youngest} tuổi — giai đoạn con rời nhà.`,
    }
  }
  return {
    stage: FAMILY_LIFE_CYCLE_STAGES[7],
    rationale: `Các con đã trưởng thành (${youngest}–${oldest} tuổi)${
      patientAge !== null ? `, bệnh nhân ${patientAge} tuổi` : ''
    }.`,
  }
}
