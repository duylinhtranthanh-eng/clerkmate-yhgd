/**
 * Fake investigation slips for the demo cases.
 *
 * Drawn on a canvas at seed time rather than shipped as image files: no binary
 * in the repo, and the identifiers are obviously invented. One slip is left
 * *unredacted* on purpose, so anyone trying the app has something to practise
 * the redaction tool on — which is impossible to demonstrate with an empty
 * attachment list.
 */

import type { Attachment, CaseRecord } from '../../types/case'
import { makeThumbnail } from '../../utils/image'
import { uid } from '../../utils/id'
import { todayIso } from '../../utils/format'

export interface DemoAttachment {
  attachment: Attachment
  blob: Blob
}

const FONT = "'Helvetica Neue', Arial, sans-serif"

/**
 * The identifiers printed on the slip.
 *
 * Derived from the record rather than hard-coded: a mock slip that says
 * "NGUYỄN THỊ MINH, sinh 1968" inside a case about a 74-year-old man is worse
 * than no slip at all — it teaches learners not to read what they attach.
 */
export interface SlipPatient {
  name: string
  birthYear: string
  patientId: string
}

/**
 * Builds the header from whatever the case actually records.
 *
 * `nameOverride` lets a demo case print a fuller version of its own patient —
 * "TRẦN THỊ H." rather than "BÀ H." — while staying the same person, same sex
 * and same year of birth as the record.
 */
function slipPatientFrom(record: CaseRecord, nameOverride?: string): SlipPatient {
  const year = new Date().getFullYear()
  const birthYear = record.patient.dateOfBirth.trim()
    ? record.patient.dateOfBirth.trim()
    : record.patient.ageYears !== null
      ? String(year - record.patient.ageYears)
      : '—'
  return {
    name: (nameOverride || record.patient.name || 'Bệnh nhân giả lập').toUpperCase(),
    birthYear,
    // Stable per case, obviously invented, never a real identifier scheme.
    patientId: `HC-${record.id.replace(/\D/g, '').slice(0, 6).padEnd(6, '0')}`,
  }
}

function canvasToBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('toBlob failed'))), 'image/jpeg', 0.9),
  )
}

/** A lab report with the identifier band Vietnamese forms actually print. */
function drawLabSlip(
  rows: [string, string, string][],
  title: string,
  patient: SlipPatient,
): HTMLCanvasElement {
  const canvas = document.createElement('canvas')
  canvas.width = 760
  canvas.height = 560
  const ctx = canvas.getContext('2d')
  if (!ctx) return canvas

  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, canvas.width, canvas.height)

  // Identifier band — the part that has to be covered before submitting.
  ctx.fillStyle = '#F2F5F7'
  ctx.fillRect(0, 0, canvas.width, 100)
  ctx.fillStyle = '#101820'
  ctx.font = `bold 21px ${FONT}`
  ctx.fillText('PHÒNG KHÁM Y HỌC GIA ĐÌNH (GIẢ LẬP)', 28, 38)
  ctx.font = `17px ${FONT}`
  ctx.fillText(`Họ tên: ${patient.name}`, 28, 66)
  ctx.fillText(`Mã BN: ${patient.patientId}      Năm sinh: ${patient.birthYear}`, 28, 90)

  ctx.strokeStyle = '#C9D3DA'
  ctx.lineWidth = 1
  ctx.beginPath()
  ctx.moveTo(0, 100.5)
  ctx.lineTo(canvas.width, 100.5)
  ctx.stroke()

  ctx.fillStyle = '#101820'
  ctx.font = `bold 19px ${FONT}`
  ctx.fillText(title, 28, 138)

  ctx.font = `bold 14px ${FONT}`
  ctx.fillStyle = '#5A6B78'
  ctx.fillText('XÉT NGHIỆM', 28, 176)
  ctx.fillText('KẾT QUẢ', 380, 176)
  ctx.fillText('TRỊ SỐ BÌNH THƯỜNG', 540, 176)
  ctx.beginPath()
  ctx.moveTo(28, 186)
  ctx.lineTo(canvas.width - 28, 186)
  ctx.stroke()

  ctx.font = `16px ${FONT}`
  rows.forEach(([name, value, reference], i) => {
    const y = 216 + i * 34
    ctx.fillStyle = '#101820'
    ctx.fillText(name, 28, y)
    ctx.fillText(value, 380, y)
    ctx.fillStyle = '#5A6B78'
    ctx.fillText(reference, 540, y)
  })

  ctx.fillStyle = '#5A6B78'
  ctx.font = `13px ${FONT}`
  ctx.fillText('Ảnh mô phỏng dùng cho demo ClerkMate — số liệu và thông tin đều giả lập.', 28, canvas.height - 24)

  return canvas
}

/** Paints the identifier band out, exactly as the redaction tool does. */
function redactBand(canvas: HTMLCanvasElement): HTMLCanvasElement {
  const ctx = canvas.getContext('2d')
  if (ctx) {
    ctx.fillStyle = '#000000'
    ctx.fillRect(0, 0, canvas.width, Math.round(canvas.height * 0.18))
  }
  return canvas
}

async function build(
  canvas: HTMLCanvasElement,
  meta: { title: string; note: string; category: Attachment['category']; redacted: boolean },
): Promise<DemoAttachment> {
  const blob = await canvasToBlob(canvas)
  const thumbnail = await makeThumbnail(blob)
  const blobKey = uid('blob')
  return {
    blob,
    attachment: {
      id: uid('att'),
      category: meta.category,
      title: meta.title,
      date: todayIso(),
      note: meta.note,
      mimeType: 'image/jpeg',
      thumbnail,
      blobKey,
      // The already-redacted demo slip has been through the same canvas
      // re-encode a real redaction produces, so it is submission-safe and
      // points at the one artifact that exists. The un-redacted one has no
      // safe derivative yet — which is the state the demo is there to teach.
      sanitizedBlobKey: meta.redacted ? blobKey : '',
      redacted: meta.redacted,
      privacyChecked: meta.redacted,
      faceCheck: '',
      createdAt: new Date().toISOString(),
    },
  }
}

/** Knee case: one slip left unredacted, to practise on. */
export async function buildKneeAttachments(record: CaseRecord): Promise<DemoAttachment[]> {
  const slip = drawLabSlip(
    [
      ['Glucose (đói)', '5,6 mmol/L', '3,9 — 5,6'],
      ['Cholesterol toàn phần', '5,4 mmol/L', '< 5,2'],
      ['LDL-C', '3,8 mmol/L', '< 3,0'],
      ['Triglyceride', '1,9 mmol/L', '< 1,7'],
      ['Creatinin', '0,8 mg/dL', '0,5 — 1,1'],
      ['AST / ALT', '22 / 19 U/L', '< 40'],
    ],
    'KẾT QUẢ SINH HÓA MÁU',
    slipPatientFrom(record, 'Trần Thị H. (giả lập)'),
  )
  return [
    await build(slip, {
      title: 'Phiếu sinh hóa máu',
      // The note is printed in the exported record, so it has to stay true after
      // the learner redacts the image. "Hãy thử nút che" was an instruction that
      // survived into the PDF and contradicted the attachment's own status line.
      // The prompt to try the tool is carried by the red "chưa che" tag and the
      // warning on the attachments screen instead.
      note: 'Ảnh mô phỏng — dùng để thử công cụ che thông tin định danh.',
      category: 'lab',
      redacted: false,
    }),
  ]
}

/**
 * A sample slip any case can pull in.
 *
 * Exists because the redaction tool cannot be tried without an image, and the
 * people most likely to be trying it — a learner testing the app, a teacher
 * evaluating it — are exactly the people with no lab photo to hand.
 */
export async function buildSampleAttachment(record: CaseRecord): Promise<DemoAttachment> {
  // Prefer the case's own results, so the slip never contradicts the record it
  // is attached to. Fall back to a generic panel when nothing is typed yet.
  const fromRecord = record.investigations.results
    .filter((r) => r.name.trim() && r.value.trim())
    .slice(0, 8)
    .map((r) => [r.name, `${r.value} ${r.unit}`.trim(), '—'] as [string, string, string])

  const rows: [string, string, string][] =
    fromRecord.length > 0
      ? fromRecord
      : [
          ['Glucose (đói)', '6,4 mmol/L', '3,9 — 5,6'],
          ['HbA1c', '6,8 %', '< 5,7'],
          ['Cholesterol toàn phần', '5,9 mmol/L', '< 5,2'],
          ['LDL-C', '3,6 mmol/L', '< 3,0'],
          ['Creatinin', '1,0 mg/dL', '0,5 — 1,1'],
          ['Acid uric', '420 µmol/L', '150 — 420'],
        ]

  const slip = drawLabSlip(rows, 'KẾT QUẢ SINH HÓA MÁU', slipPatientFrom(record))
  return build(slip, {
    title: 'Phiếu xét nghiệm (ảnh mẫu)',
    note: 'Ảnh mô phỏng để thử công cụ che thông tin định danh. Không phải bệnh nhân thật.',
    category: 'lab',
    redacted: false,
  })
}

/** Elderly case: already redacted, showing what a finished attachment looks like. */
export async function buildElderlyAttachments(record: CaseRecord): Promise<DemoAttachment[]> {
  const slip = redactBand(
    drawLabSlip(
      [
        ['HbA1c', '8,4 %', '< 7,0'],
        ['Creatinin', '1,4 mg/dL', '0,7 — 1,3'],
        ['eGFR', '48 mL/ph/1,73m²', '> 60'],
        ['Kali', '3,4 mmol/L', '3,5 — 5,1'],
        ['Hemoglobin', '11,8 g/dL', '13,0 — 17,0'],
      ],
      'KẾT QUẢ SINH HÓA — HUYẾT HỌC',
      slipPatientFrom(record, 'Lê Văn T. (giả lập)'),
    ),
  )
  return [
    await build(slip, {
      title: 'Phiếu sinh hóa — huyết học',
      note: 'Đã che dải thông tin định danh trước khi lưu.',
      category: 'lab',
      redacted: true,
    }),
  ]
}
