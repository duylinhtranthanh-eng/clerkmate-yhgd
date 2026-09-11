/**
 * Processing states for a learning record.
 *
 * Five of the eight states are *derived* from the record's own content, so the
 * badge cannot lie: a record shows "hoàn chỉnh" only while no mandatory item is
 * missing, and drops back the moment one is removed. Only `submitted`,
 * `returned` and `accepted` are caused by a person, and all three are stored.
 */

import type { CaseRecord, CaseStatus, CompletenessSnapshot } from '../types/case'
import { nonEmpty } from '../utils/format'
import {
  faceDeclaredPresent,
  faceUnanswered,
  hasDerivative,
  isSubmissionSafe,
} from './privacy'

export interface StatusDef {
  id: CaseStatus
  label: string
  /** What the learner should do next. */
  next: string
  tone: 'muted' | 'info' | 'warn' | 'ok' | 'danger' | 'brand'
}

export const STATUS: Record<CaseStatus, StatusDef> = {
  new: {
    id: 'new',
    label: 'Mới tạo',
    next: 'Bắt đầu bằng một ghi chú nhanh trong buổi khám.',
    tone: 'muted',
  },
  noting: {
    id: 'noting',
    label: 'Đang ghi chú',
    next: 'Bấm “Sắp xếp vào bệnh án” để đưa ghi chú vào các phần có cấu trúc.',
    tone: 'info',
  },
  inProgress: {
    id: 'inProgress',
    label: 'Đang hoàn thiện',
    next: 'Xem tab Hoàn chỉnh để biết còn thiếu mục bắt buộc nào.',
    tone: 'warn',
  },
  complete: {
    id: 'complete',
    label: 'Hoàn chỉnh',
    next: 'Còn ảnh chưa qua kiểm tra riêng tư — xử lý trước, nếu không ảnh sẽ không được in vào PDF.',
    tone: 'warn',
  },
  readyToSubmit: {
    id: 'readyToSubmit',
    label: 'Sẵn sàng nộp',
    next: 'Vào tab Xem trước để xuất PDF rồi gửi giảng viên.',
    tone: 'ok',
  },
  submitted: {
    id: 'submitted',
    label: 'Đã nộp',
    next: 'Ca đã khoá sửa. Gửi tệp PDF cho giảng viên nếu bạn chưa gửi.',
    tone: 'brand',
  },
  accepted: {
    id: 'accepted',
    label: 'Giảng viên đã nhận',
    next: 'Đọc nhận xét của giảng viên. Ca vẫn khoá sửa.',
    tone: 'ok',
  },
  returned: {
    id: 'returned',
    label: 'Trả lại để bổ sung',
    next: 'Đọc nhận xét của giảng viên, bổ sung rồi nộp lại.',
    tone: 'danger',
  },
}

/** True when the learner has put something into the structured record. */
function hasStructuredContent(c: CaseRecord): boolean {
  return (
    nonEmpty(c.history.chiefComplaint) ||
    nonEmpty(c.history.hpi) ||
    c.patient.ageYears !== null ||
    nonEmpty(c.examination.vitals.systolic) ||
    c.personalHistory.pastMedical.length > 0 ||
    !!c.diagnosis.primary
  )
}

export function latestReview(c: CaseRecord) {
  const reviews = c.submission.reviews
  return reviews.length > 0 ? reviews[reviews.length - 1] : null
}

export function caseStatus(c: CaseRecord, completeness: CompletenessSnapshot): CaseStatus {
  const review = latestReview(c)
  // A reviewer's decision describes the record it was made on, and governs the
  // badge until the learner answers it by resubmitting or reopening. Tracked by
  // review id, not by timestamp: the two sides of this exchange are different
  // devices keeping their own clocks, and a reviewer whose clock runs slow must
  // not have their decision silently ignored.
  if (review && !c.submission.answeredReviewIds.includes(review.id)) {
    // A return outranks everything: it is an instruction to the learner.
    return review.decision === 'returned' ? 'returned' : 'accepted'
  }
  if (nonEmpty(c.submission.submittedAt)) return 'submitted'

  const mandatoryMissing = completeness.mandatoryTotal - completeness.mandatorySatisfied
  const imagesClean = c.attachments.every(isSubmissionSafe)

  if (mandatoryMissing === 0 && imagesClean) return 'readyToSubmit'
  if (mandatoryMissing === 0) return 'complete'
  if (hasStructuredContent(c)) return 'inProgress'
  if (c.quickNotes.length > 0) return 'noting'
  return 'new'
}

/** Blocks reaching `submitted` while something is genuinely missing. */
export function submitBlockers(c: CaseRecord, completeness: CompletenessSnapshot): string[] {
  const out: string[] = []
  const missing = completeness.mandatoryTotal - completeness.mandatorySatisfied
  if (missing > 0) out.push(`Còn ${missing} mục bắt buộc chưa đạt`)
  const unanswered = c.attachments.filter(faceUnanswered).length
  if (unanswered > 0) out.push(`Còn ${unanswered} ảnh lâm sàng chưa trả lời câu hỏi khuôn mặt`)
  const faces = c.attachments.filter(faceDeclaredPresent).length
  if (faces > 0) out.push(`Còn ${faces} ảnh có khuôn mặt bệnh nhân — phải cắt bỏ hoặc xoá ảnh`)
  const dirty = c.attachments.filter((a) => !hasDerivative(a) && !faceDeclaredPresent(a)).length
  if (dirty > 0) out.push(`Còn ${dirty} ảnh chưa che hoặc chưa xác nhận thông tin định danh`)
  return out
}
