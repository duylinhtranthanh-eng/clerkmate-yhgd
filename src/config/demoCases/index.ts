/**
 * Demo case registry.
 *
 * Each entry is a fully worked fictional case chosen to exercise a different
 * part of the record, so the teaching team can show contrast rather than one
 * canonical example.
 */

import type { CaseRecord, LearnerLevel } from '../../types/case'
import { putAttachmentBlob, saveCase } from '../../db/repository'
import { buildKneeOsteoarthritisCase } from './kneeOsteoarthritis'
import { buildElderlyMultimorbidCase } from './elderlyMultimorbid'
import { buildElderlyAttachments, buildKneeAttachments } from './demoAttachments'
import type { DemoAttachment } from './demoAttachments'

export interface DemoCaseDef {
  id: string
  label: string
  /** One line shown on the picker. */
  summary: string
  /** What this case is useful for demonstrating. */
  highlights: string[]
  icon: string
  build: (level?: LearnerLevel) => CaseRecord
  /** Drawn at seed time, so no image files live in the repo. */
  attachments?: (record: CaseRecord) => Promise<DemoAttachment[]>
}

export const DEMO_CASES: DemoCaseDef[] = [
  {
    id: 'knee-oa',
    label: 'Bà H., 58 tuổi — đau khớp gối',
    summary: 'Thoái hóa khớp gối trên nền tăng huyết áp, gia đình hạt nhân, tổ ấm trống.',
    highlights: [
      'SOCRATES và ICE',
      'Family APGAR và SCREEM',
      'Phả hệ ba thế hệ',
      'Có ảnh xét nghiệm chưa che — thử công cụ che',
    ],
    icon: '🦵',
    build: buildKneeOsteoarthritisCase,
    attachments: buildKneeAttachments,
  },
  {
    id: 'elderly-multimorbid',
    label: 'Ông T., 74 tuổi — té ngã tái diễn',
    summary: 'Người cao tuổi sống một mình, bảy vấn đề đang hoạt động, đa thuốc, trầm cảm sau mất vợ.',
    highlights: [
      'Bệnh đồng mắc và thứ tự ưu tiên',
      'Thang té ngã STEADI mức cao',
      'PHQ-2 dương tính chuyển sang PHQ-9',
      'Chu kỳ sống: sống một mình sau mất vợ',
    ],
    icon: '🦯',
    build: buildElderlyMultimorbidCase,
    attachments: buildElderlyAttachments,
  },
]

/**
 * Creates a demo case together with its attachment blobs.
 *
 * The images have to be written to the blob store, so seeding is async and
 * lives here rather than in the pure `build()` functions.
 */
export async function seedDemoCase(
  demo: DemoCaseDef,
  level?: LearnerLevel,
): Promise<CaseRecord | null> {
  // The demo case is measured at the learner's own level, so onboarding as Y2
  // and onboarding as SDH genuinely produce different records — which is the
  // whole claim the app makes about adapting to the learner.
  const record = demo.build(level)
  if (demo.attachments) {
    try {
      for (const item of await demo.attachments(record)) {
        await putAttachmentBlob(item.attachment.blobKey, item.blob)
        record.attachments.push(item.attachment)
      }
    } catch {
      // A browser that cannot draw the slip still gets a usable case.
    }
  }
  return saveCase(record)
}
