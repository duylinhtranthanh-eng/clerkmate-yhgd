/**
 * Turning the lines off a result slip into something the record can hold.
 *
 * Two jobs, and the first one matters more than the second.
 *
 * The first is to notice which lines carry the patient's identity. A Vietnamese
 * result slip prints the name, the date of birth, often the address and the
 * insurance number across the header, and those lines come out of the recogniser
 * exactly like any other. They are marked here so the review sheet can switch
 * them off before the learner sees a single ticked box — the safe state is the
 * default, and including a name has to be a decision somebody makes on purpose.
 *
 * The second is to read the analyte rows. A suggestion is only ever a
 * suggestion: nothing in this file writes to a record. The learner confirms each
 * row, because optical character recognition on a phone photograph of a printed
 * form gets digits wrong, and a wrong potassium in a teaching record is worse
 * than no potassium at all.
 */

import { stripDiacritics } from '../parsing/text'

/** What a line looks like it is. */
export type LineKind = 'identifier' | 'result' | 'other'

export interface ParsedLine {
  /** Index in the recogniser's output, so the sheet can keep the slip's order. */
  index: number
  text: string
  confidence: number
  kind: LineKind
  /** Present when `kind` is `result`. */
  result?: ParsedResult
}

export interface ParsedResult {
  name: string
  value: string
  unit: string
  /** The reference interval as printed, kept verbatim for the learner to see. */
  reference: string
  /**
   * What the printed interval says about this value.
   *
   * Empty when the slip printed no interval, or when it could not be read. The
   * app never guesses a flag from the analyte name alone: that would be reading
   * a reference range out of thin air and attaching a clinical judgement to it.
   */
  flag: '' | 'normal' | 'abnormal'
}

/**
 * Header fields that identify a person.
 *
 * Matched against the line with its diacritics removed, because JavaScript's
 * `\b` is defined over `[A-Za-z0-9_]`: against "Địa chỉ" it finds no word
 * boundary at either end and the pattern silently never fires. Stripping the
 * diacritics first also means a slip printed without them, or read without them
 * by the recogniser, is caught just the same.
 *
 * Deliberately broad. A false positive costs the learner one tap to switch a
 * line back on; a false negative puts a patient's name into a teaching record
 * that gets emailed to a lecturer.
 */
const IDENTIFIER_PATTERNS: RegExp[] = [
  /\bho\s*(va\s*)?ten\b/i,
  /\bten\s*(benh\s*nhan|bn)\b/i,
  /\bbenh\s*nhan\b/i,
  /\bngay\s*sinh\b/i,
  /\bnam\s*sinh\b/i,
  /\bdia\s*chi\b/i,
  /\b(so\s*)?dien\s*thoai\b/i,
  /\bsdt\b/i,
  /\b(cmnd|cccd|can\s*cuoc)\b/i,
  /\bma\s*(bn|benh\s*nhan|so|y\s*te)\b/i,
  /\bso\s*(benh\s*an|phieu|the)\b/i,
  /\bbhyt\b/i,
  /\bbac\s*si\b/i,
  /\bnguoi\s*(lay\s*mau|chi\s*dinh)\b/i,
  /\bgioi\s*tinh\b/i,
]

/** Units that actually appear on Vietnamese laboratory slips. */
const UNIT = String.raw`(?:mmol\/L|µmol\/L|umol\/L|nmol\/L|pmol\/L|mg\/dL|mg\/L|g\/L|g\/dL|µg\/L|ng\/mL|pg\/mL|pg|fL|U\/L|UI\/L|IU\/L|mUI\/L|mIU\/L|µIU\/mL|T\/L|G\/L|M\/L|K\/µL|\/µL|10\^\d+\/L|%|mmHg|mm\/h|s|giây|tế bào\/µL)`

/**
 * One analyte row.
 *
 * Built to be strict rather than clever: a name, then a number, and from there
 * only things a slip actually prints. A loose pattern would turn the clinic's
 * address into a potassium result.
 */
const RESULT_LINE = new RegExp(
  String.raw`^(?<name>[A-Za-zÀ-ỹ][A-Za-zÀ-ỹ0-9 .()\-\/+']{1,38}?)\s*[:\-–]?\s+` +
    String.raw`(?<value>[<>]?\s*\d{1,6}(?:[.,]\d{1,3})?)\s*` +
    String.raw`(?<unit>${UNIT})?\s*` +
    String.raw`(?<reference>.*)$`,
  'i',
)

/** `3,9 - 6,4`, `< 40`, `> 1.5`, `3.9 – 6.4 mmol/L`. */
const RANGE_BETWEEN = /(\d{1,6}(?:[.,]\d{1,3})?)\s*[-–—]\s*(\d{1,6}(?:[.,]\d{1,3})?)/
const RANGE_BELOW = /[<≤]\s*(\d{1,6}(?:[.,]\d{1,3})?)/
const RANGE_ABOVE = /[>≥]\s*(\d{1,6}(?:[.,]\d{1,3})?)/

/** Vietnamese slips write decimals with a comma as often as with a dot. */
export function toNumber(text: string): number | null {
  const cleaned = text.replace(/[<>≤≥\s]/g, '').replace(',', '.')
  if (!/^\d+(\.\d+)?$/.test(cleaned)) return null
  return Number(cleaned)
}

export function looksLikeIdentifier(text: string): boolean {
  const plain = stripDiacritics(text)
  return IDENTIFIER_PATTERNS.some((p) => p.test(plain))
}

/** Whether a trailing fragment is actually a reference interval. */
function looksLikeReference(text: string): boolean {
  return RANGE_BETWEEN.test(text) || RANGE_BELOW.test(text) || RANGE_ABOVE.test(text)
}

/**
 * Compares a value against the interval printed beside it.
 *
 * Returns `''` whenever the interval cannot be read with confidence. Saying
 * nothing is correct here; a wrong "bình thường" beside an abnormal potassium
 * is the kind of error this whole app exists to avoid.
 */
export function flagAgainstReference(value: string, reference: string): ParsedResult['flag'] {
  const v = toNumber(value)
  if (v === null || !reference.trim()) return ''

  const between = reference.match(RANGE_BETWEEN)
  if (between) {
    const low = toNumber(between[1])
    const high = toNumber(between[2])
    if (low === null || high === null || low >= high) return ''
    return v < low || v > high ? 'abnormal' : 'normal'
  }

  const below = reference.match(RANGE_BELOW)
  if (below) {
    const limit = toNumber(below[1])
    return limit === null ? '' : v >= limit ? 'abnormal' : 'normal'
  }

  const above = reference.match(RANGE_ABOVE)
  if (above) {
    const limit = toNumber(above[1])
    return limit === null ? '' : v <= limit ? 'abnormal' : 'normal'
  }

  return ''
}

export function parseResultLine(text: string): ParsedResult | null {
  if (looksLikeIdentifier(text)) return null
  const m = RESULT_LINE.exec(text)
  if (!m?.groups) return null

  const name = m.groups.name.trim().replace(/[:\-–]+$/, '').trim()
  const value = m.groups.value.replace(/\s+/g, '')
  const unit = (m.groups.unit ?? '').trim()
  const reference = (m.groups.reference ?? '').trim()

  // Without a unit, the only thing that makes a row a result is a printed
  // reference interval. Accepting any trailing text instead would read
  // "Số điện thoại: 0903 123 456" as an analyte called "Số điện thoại" whose
  // value is 0903 — a telephone number entered into a medical record.
  if (!unit && !looksLikeReference(reference)) return null
  // A name that is only digits is not an analyte.
  if (!/[A-Za-zÀ-ỹ]{2}/.test(name)) return null

  return { name, value, unit, reference, flag: flagAgainstReference(value, reference) }
}

/**
 * Classifies every line the recogniser produced.
 *
 * Order is preserved so the review sheet reads down the slip the way the slip
 * reads, which is how a person checks that nothing was missed.
 */
export function parseOcrLines(
  lines: { text: string; confidence: number }[],
): ParsedLine[] {
  return lines.map((line, index) => {
    if (looksLikeIdentifier(line.text)) {
      return { index, text: line.text, confidence: line.confidence, kind: 'identifier' as const }
    }
    const result = parseResultLine(line.text)
    if (result) {
      return { index, text: line.text, confidence: line.confidence, kind: 'result' as const, result }
    }
    return { index, text: line.text, confidence: line.confidence, kind: 'other' as const }
  })
}

/** How many lines look like they carry identity. Drives the warning in the sheet. */
export function identifierCount(parsed: ParsedLine[]): number {
  return parsed.filter((l) => l.kind === 'identifier').length
}
