/** Diacritic-insensitive helpers so "khong hut thuoc" matches "không hút thuốc". */

export function stripDiacritics(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
}

export function norm(s: string): string {
  return stripDiacritics(s).toLowerCase()
}

/**
 * Split a note into clause-sized chunks. Periods only split when followed by
 * whitespace or end of string, so "38.5" and "SpO2 96.5%" survive intact.
 */
export function clauses(text: string): string[] {
  return text
    .split(/[\n;,]+|\.(?=\s|$)|\s+-\s+/g)
    .map((c) => c.trim())
    .filter((c) => c.length > 0)
}

const NEGATORS = [
  // Vietnamese bedside shorthand, including the single letter learners use.
  // "chua" negates the clause it is in, but it says "not yet" rather than
  // "never": a caller turning it into a lifetime negative would be reading in
  // more than was said, which is why nothing here infers history.
  'khong', 'ko', 'k', 'chua', 'phu nhan', 'chua ghi nhan', 'khong co',
  'no', 'not', 'denies', 'denied', 'negative', 'without',
]

/** True when the clause negates its content ("không hút thuốc", "denies fever"). */
export function isNegated(clause: string): boolean {
  const words = norm(clause).split(/\s+/)
  return words.some((w, i) => i < 4 && NEGATORS.includes(w))
}

export function titleCase(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1)
}
