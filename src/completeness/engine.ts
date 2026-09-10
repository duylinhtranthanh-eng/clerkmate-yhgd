/**
 * Completeness engine.
 *
 * Pure function over a CaseRecord. It never writes to the record and never
 * invents clinical content — it only reports what the learner has not yet
 * documented for their level.
 */

import type {
  CaseRecord,
  CompletenessItemResult,
  CompletenessSnapshot,
  LearnerLevel,
  RequirementTier,
} from '../types/case'
import { REQUIREMENT_BY_ID } from '../config/requirements'
import { TIER_WEIGHTS, resolveLevelRequirements } from '../config/levels'
import type { SectionId } from '../config/sections'

export function evaluateCompleteness(
  record: CaseRecord,
  level: LearnerLevel = record.learnerLevel,
): CompletenessSnapshot {
  const resolved = resolveLevelRequirements(level)
  const items: CompletenessItemResult[] = []

  let weighted = 0
  let weightedMax = 0
  const totals: Record<RequirementTier, { total: number; satisfied: number }> = {
    mandatory: { total: 0, satisfied: 0 },
    recommended: { total: 0, satisfied: 0 },
    optional: { total: 0, satisfied: 0 },
  }

  for (const [id, tier] of resolved) {
    const def = REQUIREMENT_BY_ID[id]
    if (!def) continue
    if (def.appliesTo && !def.appliesTo(record)) continue

    let satisfied = false
    try {
      satisfied = def.isSatisfied(record)
    } catch {
      satisfied = false
    }

    items.push({
      id,
      label: def.label,
      sectionId: def.sectionId,
      tier,
      satisfied,
      hint: def.hint,
    })

    const w = TIER_WEIGHTS[tier]
    weightedMax += w
    if (satisfied) weighted += w
    totals[tier].total += 1
    if (satisfied) totals[tier].satisfied += 1
  }

  const percent = weightedMax === 0 ? 0 : Math.round((weighted / weightedMax) * 100)

  const tierRank: Record<RequirementTier, number> = { mandatory: 0, recommended: 1, optional: 2 }
  items.sort((a, b) => {
    if (a.satisfied !== b.satisfied) return a.satisfied ? 1 : -1
    return tierRank[a.tier] - tierRank[b.tier]
  })

  return {
    level,
    percent,
    mandatoryTotal: totals.mandatory.total,
    mandatorySatisfied: totals.mandatory.satisfied,
    recommendedTotal: totals.recommended.total,
    recommendedSatisfied: totals.recommended.satisfied,
    optionalTotal: totals.optional.total,
    optionalSatisfied: totals.optional.satisfied,
    items,
    computedAt: new Date().toISOString(),
  }
}

export function missingByTier(
  snapshot: CompletenessSnapshot,
  tier: RequirementTier,
): CompletenessItemResult[] {
  return snapshot.items.filter((i) => i.tier === tier && !i.satisfied)
}

export interface SectionProgress {
  sectionId: SectionId
  total: number
  satisfied: number
  mandatoryMissing: number
}

/** Per-section rollup used to badge the structured-record index. */
export function sectionProgress(snapshot: CompletenessSnapshot): Map<SectionId, SectionProgress> {
  const map = new Map<SectionId, SectionProgress>()
  for (const item of snapshot.items) {
    const key = item.sectionId as SectionId
    const cur =
      map.get(key) ?? { sectionId: key, total: 0, satisfied: 0, mandatoryMissing: 0 }
    cur.total += 1
    if (item.satisfied) cur.satisfied += 1
    else if (item.tier === 'mandatory') cur.mandatoryMissing += 1
    map.set(key, cur)
  }
  return map
}
