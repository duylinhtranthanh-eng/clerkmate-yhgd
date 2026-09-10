/** Pure scoring helpers for the rating scales. No React, no storage. */

import type { CaseRecord, ScaleInstance } from '../types/case'
import { SCALES } from '../config/scales'
import type { ScaleBand, ScaleDef, ScaleId } from '../config/scales'

export function findInstance(record: CaseRecord, scaleId: ScaleId): ScaleInstance | null {
  return record.riskAssessment.scales.find((s) => s.scaleId === scaleId) ?? null
}

export function emptyInstance(def: ScaleDef): ScaleInstance {
  const licensedSingle = def.availability === 'licensed' && (def.subscales ?? []).length === 0
  return {
    scaleId: def.id,
    answers: def.items.map(() => null),
    subscaleTotals: licensedSingle
      ? { total: null }
      : Object.fromEntries((def.subscales ?? []).map((s) => [s.id, null])),
    note: '',
    updatedAt: new Date().toISOString(),
  }
}

/** Highest achievable total, respecting per-item option sets. */
export function scaleMaxScore(def: ScaleDef): number {
  if (def.maxScore !== undefined) return def.maxScore
  return def.items.reduce((sum, item) => {
    const options = item.options ?? def.options
    return sum + Math.max(0, ...options.map((o) => o.value))
  }, 0)
}

/** Total for an item-based scale; null until every item is answered. */
export function scaleTotal(def: ScaleDef, inst: ScaleInstance | null): number | null {
  if (!inst || def.items.length === 0) return null
  if (inst.answers.length < def.items.length) return null
  if (inst.answers.slice(0, def.items.length).some((a) => a === null)) return null
  return inst.answers.slice(0, def.items.length).reduce<number>((sum, a) => sum + (a ?? 0), 0)
}

export function bandFor(bands: ScaleBand[], total: number | null): ScaleBand | null {
  if (total === null) return null
  return bands.find((b) => total <= b.max) ?? bands[bands.length - 1] ?? null
}

export function answeredCount(def: ScaleDef, inst: ScaleInstance | null): number {
  if (!inst) return 0
  return inst.answers.slice(0, def.items.length).filter((a) => a !== null).length
}

export function isPositive(def: ScaleDef, total: number | null): boolean {
  return def.positiveAt !== null && total !== null && total >= def.positiveAt
}

/** True when the safety item (PHQ-9 item 9) was scored above zero. */
export function safetyFlagRaised(def: ScaleDef, inst: ScaleInstance | null): boolean {
  if (def.safetyItemIndex === undefined || !inst) return false
  const v = inst.answers[def.safetyItemIndex]
  return typeof v === 'number' && v > 0
}

export interface ScaleSummary {
  def: ScaleDef
  inst: ScaleInstance | null
  total: number | null
  band: ScaleBand | null
  positive: boolean
  answered: number
  safety: boolean
}

export function summarise(record: CaseRecord, scaleId: ScaleId): ScaleSummary {
  const def = SCALES[scaleId]
  const inst = findInstance(record, scaleId)
  // A licensed instrument scored as one total (ISI) has no item answers, so its
  // band comes from the total the learner entered.
  const licensedSingle = def.availability === 'licensed' && (def.subscales ?? []).length === 0
  const total = licensedSingle ? (inst?.subscaleTotals.total ?? null) : scaleTotal(def, inst)
  return {
    def,
    inst,
    total,
    band: bandFor(def.bands, total),
    positive: isPositive(def, total),
    answered: answeredCount(def, inst),
    safety: safetyFlagRaised(def, inst),
  }
}

/** Scales with a recorded result, for the export and the summary strip. */
export function completedScales(record: CaseRecord): ScaleSummary[] {
  return record.riskAssessment.scales
    .map((s) => summarise(record, s.scaleId as ScaleId))
    .filter((s) => {
      if (!s.def) return false
      if (s.def.availability === 'licensed') {
        return Object.values(s.inst?.subscaleTotals ?? {}).some((v) => v !== null)
      }
      if (s.def.items.length === 0) return false
      return s.total !== null
    })
}
