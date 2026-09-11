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

/**
 * e.g. `ClerkMate_21YHGD001_Ba-H_2026-09-11`.
 *
 * Carries the learner's code, the case, and the date, so a teacher collecting a
 * class's worth of files can sort them. The case is named the way the learner
 * named it — in practice an abbreviation such as "Bà H." rather than a full
 * name, which is how these records are written — falling back to the submission
 * code, then the learner's own label.
 */
export function buildFileName(record: CaseRecord, profile: LearnerProfile | null = null): string {
  const date = (record.visit.date || record.createdAt).slice(0, 10)
  const learner = slug(profile?.studentId ?? '') || 'nguoi-hoc'
  const caseRef =
    slug(record.patient.name) ||
    slug(record.submission.code) ||
    slug(record.patient.caseLabel) ||
    `ca-${record.id.slice(-6)}`
  return `ClerkMate_${learner}_${caseRef}_${date}`
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

/**
 * Opens the learner's mail client with the subject and body written.
 *
 * Not "send the PDF by email": a `mailto:` link cannot attach a local file, in
 * any browser, and saying otherwise would have learners send empty mails to
 * their teacher. The PDF is saved by the print dialog and the body says so, in
 * the learner's own voice, so they know to attach it themselves.
 */
export function openEmailDraft(record: CaseRecord, profile: LearnerProfile | null = null): void {
  const learner = profile?.studentId || 'chưa có mã số'
  const caseRef = record.submission.code || record.patient.caseLabel || record.patient.name || 'bệnh án'
  const subject = `Bệnh án học tập ClerkMate — ${learner} — ${caseRef}`
  const body = [
    'Em gửi Thầy/Cô bệnh án học tập được xuất từ ClerkMate.',
    '',
    `Tệp PDF đã được tải về thiết bị (${buildFileName(record, profile)}.pdf).`,
    'Vui lòng đính kèm tệp vào email này nếu chưa xuất hiện tự động — trình duyệt không tự đính kèm được.',
  ].join('\n')
  window.location.href = `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`
}

/**
 * Whether the device can share an actual file.
 *
 * Always false today, and deliberately so: the PDF is produced by the browser's
 * own print pipeline, which hands the file to the operating system and never to
 * the page, so there is no Blob to pass to `navigator.share`. Until the record
 * is rendered by a PDF writer of our own, offering "share the PDF" would be a
 * promise the app cannot keep.
 */
export function canShareFile(): boolean {
  return false
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
