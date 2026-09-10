/**
 * Condition → hatch pattern assignment for the genogram.
 *
 * Deterministic: conditions are sorted with a Vietnamese collator and take
 * patterns in that order, so the same family always produces the same key.
 * Patterns (not colours) carry the meaning, so the drawing survives black-and-
 * white printing.
 */

import type { FamilyMember } from '../types/case'

export type PatternKind =
  | 'diagonal'
  | 'diagonalBack'
  | 'crossHatch'
  | 'horizontal'
  | 'vertical'
  | 'dots'
  | 'solid'
  | 'checker'

export const PATTERN_ORDER: PatternKind[] = [
  'diagonal',
  'diagonalBack',
  'crossHatch',
  'horizontal',
  'vertical',
  'dots',
  'checker',
  'solid',
]

export const PATTERN_LABEL: Record<PatternKind, string> = {
  diagonal: 'Gạch chéo ／',
  diagonalBack: 'Gạch chéo ＼',
  crossHatch: 'Gạch ô chéo',
  horizontal: 'Gạch ngang',
  vertical: 'Gạch dọc',
  dots: 'Chấm',
  checker: 'Ô vuông',
  solid: 'Tô đặc',
}

/** Maximum condition bands drawn inside one symbol; the rest stay in the notes. */
export const MAX_BANDS = 4

export interface ConditionKeyEntry {
  condition: string
  pattern: PatternKind
}

const collator = new Intl.Collator('vi')

export function buildConditionKey(members: FamilyMember[]): ConditionKeyEntry[] {
  const distinct = Array.from(
    new Set(members.flatMap((m) => m.conditions.map((c) => c.trim()).filter(Boolean))),
  ).sort(collator.compare)

  return distinct.map((condition, i) => ({
    condition,
    // Wrap round rather than run out: a ninth condition reuses the first
    // pattern, and the legend still names both.
    pattern: PATTERN_ORDER[i % PATTERN_ORDER.length],
  }))
}

export function patternFor(
  key: ConditionKeyEntry[],
  condition: string,
): PatternKind | null {
  return key.find((k) => k.condition === condition.trim())?.pattern ?? null
}
