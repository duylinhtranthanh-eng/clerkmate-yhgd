/**
 * The submission flow, without a server.
 *
 * The competition form asks about step transitions, return-for-revision and
 * notifications — all of which normally imply a server, accounts and roles.
 * ClerkMate keeps its local-first architecture and moves the record instead of
 * the user: the learner exports a submission file, the reviewer opens that file
 * in the same app, records a decision, and exports it back. The state and the
 * comment travel inside the record.
 *
 * No authentication is involved and none is claimed: the reviewer simply types
 * their name.
 */

import type { CaseRecord, FacultyReview } from '../types/case'
import { uid } from '../utils/id'
import { stripDiacritics } from '../parsing/text'
import { withExportSafeAttachments } from './privacy'

/** Short, human-readable, and stable for one submission. */
export function makeSubmissionCode(record: CaseRecord, studentId: string): string {
  // The tail is what distinguishes two ids in a cohort (…001 vs …002), so trim
  // from the front, never the back.
  const student = stripDiacritics(studentId || 'SV').replace(/[^A-Za-z0-9]/g, '').slice(-10) || 'SV'
  const stamp = new Date().toISOString().slice(2, 10).replace(/-/g, '')
  const tail = record.id.replace(/\D/g, '').slice(-3).padStart(3, '0')
  return `${student}-${stamp}-${tail}`.toUpperCase()
}

export function submit(record: CaseRecord, studentId: string): CaseRecord {
  const next = structuredClone(record)
  next.submission.code = next.submission.code || makeSubmissionCode(record, studentId)
  next.submission.submittedAt = new Date().toISOString()
  next.submission.locked = true
  // Submitting is acting on the feedback, so an outstanding comment stops being
  // an outstanding comment — and stops governing the status badge.
  const ids = next.submission.reviews.map((r) => r.id)
  next.submission.acknowledgedReviewIds = ids
  next.submission.answeredReviewIds = ids
  return next
}

/** Reopening is allowed but recorded, so a resubmission is visible as one. */
export function reopen(record: CaseRecord): CaseRecord {
  const next = structuredClone(record)
  next.submission.reopenedAt.push(new Date().toISOString())
  next.submission.submittedAt = ''
  next.submission.locked = false
  // A pending return has been acted on once the learner reopens the record.
  const ids = next.submission.reviews.map((r) => r.id)
  next.submission.acknowledgedReviewIds = ids
  next.submission.answeredReviewIds = ids
  return next
}

export function recordReview(
  record: CaseRecord,
  reviewer: string,
  decision: FacultyReview['decision'],
  comment: string,
): CaseRecord {
  const next = structuredClone(record)
  next.submission.reviews.push({
    id: uid('rv'),
    at: new Date().toISOString(),
    reviewer,
    decision,
    comment,
  })
  if (decision === 'returned') {
    // Returned records unlock so the learner can act on the comment.
    next.submission.locked = false
    next.submission.submittedAt = ''
  } else {
    next.submission.locked = true
  }
  return next
}

/** Reviews the learner has not yet seen — the app announces these. */
export function unreadReviews(record: CaseRecord): FacultyReview[] {
  const seen = new Set(record.submission.acknowledgedReviewIds)
  return record.submission.reviews.filter((r) => !seen.has(r.id))
}

export function acknowledgeReviews(record: CaseRecord): CaseRecord {
  const next = structuredClone(record)
  next.submission.acknowledgedReviewIds = next.submission.reviews.map((r) => r.id)
  return next
}

/**
 * Applies a reviewer's file to the learner's own copy.
 *
 * Only the submission block travels back. The reviewer never edits clinical
 * content, so the learner's local record — which may already be newer — stays
 * authoritative for everything else.
 */
export function mergeReview(local: CaseRecord, incoming: CaseRecord): CaseRecord {
  const next = structuredClone(local)
  const keep = (ids: string[]) =>
    ids.filter((id) => incoming.submission.reviews.some((r) => r.id === id))
  next.submission = {
    ...incoming.submission,
    // Anything the reviewer just added is unread, and unanswered, by definition.
    acknowledgedReviewIds: keep(local.submission.acknowledgedReviewIds),
    answeredReviewIds: keep(local.submission.answeredReviewIds),
  }
  return next
}

/** Records that a PDF was produced, which is the actual hand-in artefact. */
export function markExported(record: CaseRecord): CaseRecord {
  const next = structuredClone(record)
  next.submission.exportedAt = new Date().toISOString()
  return next
}

// --- the file that moves between learner and reviewer ----------------------

export interface SubmissionBundle {
  app: 'clerkmate'
  kind: 'submission'
  version: 1
  code: string
  student: { fullName: string; studentId: string; level: string; classGroup: string }
  exportedAt: string
  record: CaseRecord
}

export function buildBundle(
  record: CaseRecord,
  student: SubmissionBundle['student'],
): SubmissionBundle {
  return {
    app: 'clerkmate',
    kind: 'submission',
    version: 1,
    code: record.submission.code,
    student,
    exportedAt: new Date().toISOString(),
    record: withExportSafeAttachments(record),
  }
}

export function parseBundle(text: string): SubmissionBundle {
  const data = JSON.parse(text) as SubmissionBundle
  if (data?.app !== 'clerkmate' || data?.kind !== 'submission' || !data.record) {
    throw new Error('Tệp không phải bài nộp ClerkMate.')
  }
  return data
}

export function bundleFileName(bundle: SubmissionBundle, suffix = ''): string {
  const code = bundle.code || 'BAI-NOP'
  return `ClerkMate_${code}${suffix ? `_${suffix}` : ''}.json`
}
