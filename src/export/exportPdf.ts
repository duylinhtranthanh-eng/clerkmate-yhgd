/**
 * Export helpers.
 *
 * The PDF is produced through the browser's own print pipeline (`print.css`).
 * That keeps Vietnamese diacritics and selectable vector text without bundling
 * a font, and "Lưu thành PDF" / "Share" is available on iOS Safari, Android
 * Chrome and every desktop browser. Swapping in a jsPDF-style generator later
 * only means adding another function here.
 */

import type { CaseRecord } from '../types/case'
import type { LearnerProfile } from '../types/profile'
import { stripDiacritics } from '../parsing/text'

const slug = (s: string) => stripDiacritics(s).replace(/[^A-Za-z0-9]+/g, '-').replace(/^-|-$/g, '')

/** e.g. `ClerkMate_21YHGD001_Ba-H_2026-09-08` — a teacher can sort by student id. */
export function buildFileName(record: CaseRecord, profile: LearnerProfile | null = null): string {
  const who = record.patient.name || record.patient.caseLabel || 'benh-an'
  const date = (record.visit.date || record.createdAt).slice(0, 10)
  const student = profile?.studentId ? `${slug(profile.studentId)}_` : ''
  return `ClerkMate_${student}${slug(who)}_${date}`
}

/** Opens the browser print dialog on the currently rendered review document. */
export function printRecord(record: CaseRecord, profile: LearnerProfile | null = null): void {
  const previous = document.title
  document.title = buildFileName(record, profile)
  const restore = () => {
    document.title = previous
    window.removeEventListener('afterprint', restore)
  }
  window.addEventListener('afterprint', restore)
  window.print()
  // Safari does not always fire afterprint; restore defensively.
  window.setTimeout(restore, 4000)
}

export function downloadJson(record: CaseRecord): void {
  const blob = new Blob([JSON.stringify(record, null, 2)], { type: 'application/json' })
  triggerDownload(blob, `${buildFileName(record)}.json`)
}

export function triggerDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  window.setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export function canShare(): boolean {
  return typeof navigator !== 'undefined' && typeof navigator.share === 'function'
}

/** Shares a short plain-text summary — enough for a quick handover message. */
export async function shareSummary(
  record: CaseRecord,
  profile: LearnerProfile | null = null,
): Promise<boolean> {
  if (!canShare()) return false
  const dx = record.diagnosis.primary?.label ?? 'chưa có chẩn đoán'
  const lines = [
    `ClerkMate — ${record.patient.caseLabel || 'Bệnh án YHGĐ'}`,
    profile ? `${profile.fullName} · ${profile.studentId} · ${profile.level}` : '',
    record.patient.ageYears !== null ? `${record.patient.ageYears} tuổi` : '',
    record.history.chiefComplaint ? `Lý do khám: ${record.history.chiefComplaint}` : '',
    `Chẩn đoán: ${dx}`,
    record.completeness ? `Mức hoàn chỉnh: ${record.completeness.percent}%` : '',
  ].filter(Boolean)
  try {
    await navigator.share({ title: buildFileName(record, profile), text: lines.join('\n') })
    return true
  } catch {
    return false
  }
}
