/**
 * Learner-level configuration.
 *
 * These are demo rules for the competition MVP and are meant to be edited by
 * the teaching team. A level inherits everything from `extends` and may then
 * promote an item to a stricter tier (recommended -> mandatory) or add new ones.
 */

import type { LearnerLevel, RequirementTier } from '../types/case'

export interface LevelDef {
  id: LearnerLevel
  label: string
  description: string
  /**
   * What a learner at this level is expected to be able to do.
   *
   * Written from the level's own `mandatory` list, so it says what the app will
   * actually ask for. A count would be a worse answer to the same question:
   * "nineteen items" tells a fifth-year nothing, "hỏi được cờ đỏ và ICE" does.
   */
  expects: string
  extends: LearnerLevel | null
  mandatory: string[]
  recommended: string[]
  optional: string[]
}

/** Weights used to turn the checklist into a single percentage. */
export const TIER_WEIGHTS: Record<RequirementTier, number> = {
  mandatory: 3,
  recommended: 2,
  optional: 1,
}

export const LEVELS: Record<LearnerLevel, LevelDef> = {
  Y2: {
    id: 'Y2',
    label: 'Y2 — Tiền lâm sàng',
    description: 'Hỏi bệnh cơ bản, đo sinh hiệu, và đánh giá gia đình bằng APGAR và SCREEM.',
    expects:
      'Hỏi được lý do đến khám, kể lại được diễn tiến bệnh sử, đo và ghi sinh hiệu, khám cơ bản, ' +
      'và đánh giá được gia đình bằng Family APGAR và SCREEM.',
    extends: null,
    mandatory: [
      'patient.identity',
      'visit.reason',
      'history.chiefComplaint',
      'history.hpi',
      'exam.vitals',
      'exam.systemsBasic',
      // Family Medicine's own two instruments. They are what makes this a
      // family record rather than a short internal-medicine one, so they are
      // asked for from the first year the student sees a patient.
      'fm.apgar',
      'fm.screem',
    ],
    recommended: [
      'patient.social',
      'history.socrates',
      'past.medical',
      'lifestyle.core',
      'exam.general',
    ],
    optional: ['history.ice', 'family.history', 'exam.anthropometry', 'reflection.learned'],
  },

  Y5: {
    id: 'Y5',
    label: 'Y5 — Lâm sàng YHGĐ',
    description: 'Bệnh án đầy đủ: cờ đỏ, ICE, tiền căn, cận lâm sàng, chẩn đoán, xử trí, phả hệ.',
    expects:
      'Thêm: hỏi cờ đỏ và ICE, khai thác tiền căn và lối sống, đề nghị cận lâm sàng, ' +
      'vẽ được phả hệ, đặt được chẩn đoán chính và kế hoạch xử trí.',
    extends: 'Y2',
    mandatory: [
      'attachments.privacy',
      'risk.emergency',
      'history.redFlags',
      'history.ice',
      'past.medical',
      'past.allergies',
      'family.history',
      'lifestyle.core',
      'exam.general',
      'inv.proposed',
      'dx.primary',
      'mx.nonPharm',
      'mx.followUpPlan',
      'genogram.members',
    ],
    recommended: [
      'reflection.learned',
      'history.socrates',
      'past.reproductive',
      'lifestyle.full',
      'exam.systemsRelevant',
      'exam.anthropometry',
      'inv.results',
      'inv.perResult',
      'inv.interpretation',
      'dx.coding',
      'dx.comorbidities',
      'meds.list',
      'mx.education',
    ],
    optional: [
      'history.systemsReview',
      'risk.factors',
      'prev.screenings',
      'attachments.any',
      'fm.familyType',
    ],
    // Emergency risk review is a safety habit, so it starts early.
  },

  Y6: {
    id: 'Y6',
    label: 'Y6 — Thực hành tổng hợp',
    description: 'Thêm đánh giá nguy cơ, chẩn đoán phân biệt có biện luận, và dự phòng.',
    expects:
      'Thêm: rà soát yếu tố nguy cơ và tầm soát, chẩn đoán phân biệt có biện luận, ' +
      'kế hoạch dự phòng và tư vấn.',
    extends: 'Y5',
    mandatory: [
      'attachments.privacy',
      'inv.interpretation',
      'reflection.learned',
      'risk.factors',
      'risk.cancerScreening',
      'risk.depressionScreen',
      'dx.comorbidities',
      'dx.differentials',
      'dx.coding',
      'mx.education',
      'prev.counselling',
      'exam.systemsRelevant',
      'inv.results',
    ],
    recommended: [
      'inv.impact',
      'reflection.nextTime',
      'risk.overall',
      'risk.geriatric',
      'risk.psychosocial',
      'risk.fallsGraded',
      'risk.cvd',
      'dx.comorbidityControl',
      'dx.reasoning',
      'prev.screenings',
      'prev.vaccinations',
      'mx.referral',
      'meds.complete',
      'fm.familyType',
    ],
    // fm.apgar, fm.screem and genogram.members are inherited as mandatory from
    // Y2 and Y5; a level can only tighten what it inherits, never loosen it, so
    // they are not repeated here.
    optional: ['fm.lifeCycle', 'followUp.entries', 'attachments.any', 'mx.goals'],
  },

  SDH: {
    id: 'SDH',
    label: 'SDH — Sau đại học',
    description: 'Quản lý ca theo thời gian: mục tiêu điều trị, tái khám, đáp ứng, chăm sóc liên tục.',
    expects:
      'Thêm: quản lý ca theo thời gian — đặt mục tiêu điều trị, hẹn và ghi lần tái khám, ' +
      'đánh giá đáp ứng điều trị và mức kiểm soát bệnh đồng mắc, chăm sóc liên tục.',
    extends: 'Y6',
    mandatory: [
      // Managing the case over time is what separates this level from Y6:
      // a goal, a review date, what happened at it, and whether the chronic
      // problems are actually under control.
      'mx.goals',
      'mx.referral',
      'meds.complete',
      'followUp.entries',
      'followUp.response',
      'dx.comorbidityControl',
      'fm.continuity',
      'fm.familyType',
      'fm.lifeCycle',
      'inv.impact',
      'reflection.nextTime',
      'risk.psychosocial',
      'risk.geriatric',
      'risk.fallsGraded',
      'risk.cognitiveScreen',
      'risk.cvd',
      'prev.screenings',
      'prev.vaccinations',
      'risk.overall',
      'dx.reasoning',
    ],
    recommended: ['fm.homeEnvironment', 'history.systemsReview'],
    optional: ['patient.beliefs', 'attachments.any', 'risk.environmental'],
  },
}

export const LEVEL_ORDER: LearnerLevel[] = ['Y2', 'Y5', 'Y6', 'SDH']

/**
 * Flatten a level's inheritance chain into one id -> tier map.
 * The most senior level in the chain wins, and within a level a stricter tier
 * always overrides a looser one already inherited.
 */
export function resolveLevelRequirements(level: LearnerLevel): Map<string, RequirementTier> {
  const chain: LevelDef[] = []
  let cursor: LearnerLevel | null = level
  while (cursor) {
    const def: LevelDef = LEVELS[cursor]
    chain.unshift(def)
    cursor = def.extends
  }

  const out = new Map<string, RequirementTier>()
  const rank: Record<RequirementTier, number> = { optional: 1, recommended: 2, mandatory: 3 }

  for (const def of chain) {
    const assign = (ids: string[], tier: RequirementTier) => {
      for (const id of ids) {
        const existing = out.get(id)
        if (!existing || rank[tier] > rank[existing]) out.set(id, tier)
      }
    }
    assign(def.optional, 'optional')
    assign(def.recommended, 'recommended')
    assign(def.mandatory, 'mandatory')
  }
  return out
}
