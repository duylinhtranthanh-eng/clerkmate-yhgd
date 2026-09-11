/**
 * The department's paper record, transcribed.
 *
 * Every list here is copied from `docs/reference/mau-benh-an-yhgd.pdf` — the
 * form the Family Medicine teaching clinic actually uses — and exists so the
 * exported PDF can be that form rather than a report of our own design. The row
 * labels, their order, and the reference columns of the screening schedule are
 * the department's wording, not ours, so they are data rather than prose in a
 * component: when the form is revised, this file is what changes.
 */

import type { CaseRecord } from '../types/case'

/** Rows of "Các vấn đề đã và hiện có", page 1. */
export const FORM_PROBLEM_ROWS: string[] = [
  'Dị ứng',
  'Thói quen lối sống',
  'Tim mạch',
  'Hô hấp',
  'Tiêu hoá',
  'Nội tiết',
  'Cơ – xương - khớp',
  'Thận - tiết niệu',
  'Da liễu',
  'Huyết học',
  'Mắt',
  'TMH - RHM',
  'Thần kinh',
  'Tâm thần',
  'Ngoại khoa',
  'Sản khoa',
  'Khác',
]

/** Rows of "Tiền sử gia đình", page 1. */
export const FORM_FAMILY_ROWS: string[] = [
  'Đái tháo đường',
  'Tăng huyết áp',
  'Rối loạn lipid máu',
  'Lao',
  'Ung thư',
  'Khác',
]

/**
 * Rows of "Khám hệ cơ quan", page 2, paired with the app's own examination
 * systems where one exists.
 *
 * Two of the form's rows have no counterpart in the record — the form examines
 * "Đầu mặt cổ" and "Vú" as single rows — and two of the app's systems (da liễu,
 * nội tiết) have no row on the form. Nothing is dropped: the unmatched systems
 * print underneath, listed as additions.
 */
export const FORM_EXAM_ROWS: { label: string; systemId: string | null }[] = [
  { label: 'Tổng trạng', systemId: null },
  { label: 'Đầu mặt cổ', systemId: 'ent' },
  { label: 'Hô hấp', systemId: 'respiratory' },
  { label: 'Tim mạch', systemId: 'cardiovascular' },
  { label: 'Bụng', systemId: 'abdomen' },
  { label: 'Vú', systemId: null },
  { label: 'Niệu sinh dục', systemId: 'genitourinary' },
  { label: 'Cơ xương khớp', systemId: 'musculoskeletal' },
  { label: 'Thần kinh', systemId: 'neurological' },
  { label: 'Tâm lý', systemId: 'mental' },
]

/** App systems the form has no row for; printed after the table so nothing is lost. */
export const FORM_EXAM_EXTRA_SYSTEM_IDS = ['skin', 'endocrine']

/** Rows of the "Cận lâm sàng | Kết quả" table on the follow-up page. */
export const FORM_LAB_ROWS: { label: string; match: RegExp }[] = [
  { label: 'CTM, nhóm máu, Ferritin', match: /công thức máu|ctm|ferritin|nhóm máu|hemoglobin|hb\b/i },
  { label: 'Đường huyết', match: /đường huyết|glucose|hba1c/i },
  { label: 'Lipid máu', match: /lipid|cholesterol|triglyceride|ldl|hdl/i },
  { label: 'Chức năng gan', match: /gan|ast|alt|sgot|sgpt|bilirubin/i },
  { label: 'Chức năng thận', match: /thận|creatinin|ure|egfr/i },
  { label: 'Viêm gan', match: /viêm gan|hbsag|anti-hcv/i },
  { label: 'Acid uric', match: /acid uric|urat/i },
  { label: 'Nước tiểu', match: /nước tiểu|tổng phân tích nước tiểu|urine/i },
  { label: 'ECG', match: /ecg|điện tâm đồ/i },
  { label: 'X-quang', match: /x-?quang|xquang|x-?ray/i },
  { label: 'Siêu âm', match: /siêu âm/i },
  { label: 'Ct-scan/MRI', match: /ct[- ]?scan|mri|cắt lớp|cộng hưởng từ/i },
  { label: 'Nội soi', match: /nội soi/i },
]

/**
 * "Lịch can thiệp tầm soát", page 4.
 *
 * The cycle and age columns are the department's own reference text and are
 * printed as they stand; only the last column is filled from the record.
 */
export const FORM_SCREENING_SCHEDULE: {
  label: string
  cycle: string
  age: string
  /** Which of the app's screening items, if any, fills the last column. */
  screeningId: string | null
}[] = [
  { label: 'Tầm soát tăng huyết áp', cycle: 'Mỗi 2 năm', age: 'Từ 18 tuổi', screeningId: 'bp' },
  { label: 'Răng', cycle: 'Mỗi 1 năm', age: 'Từ 18 tuổi', screeningId: null },
  { label: 'Thị lực, Glaucoma', cycle: 'Mỗi 2 – 4 năm', age: 'Từ 40 tuổi', screeningId: 'vision' },
  { label: 'Tuyến giáp', cycle: '', age: '', screeningId: null },
  { label: 'Vú (nhũ ảnh)', cycle: 'Mỗi 1-2 năm', age: 'Từ 40 – 75 tuổi', screeningId: 'mammo' },
  { label: 'Pap smear', cycle: 'Mỗi 1 – 3 năm', age: 'Từ 20 tuổi', screeningId: 'pap' },
  { label: 'Tiền liệt tuyến', cycle: 'Mỗi 1 năm', age: 'Từ 50 tuổi', screeningId: null },
  { label: 'Phổi (hút thuốc lá)', cycle: 'Mỗi 1 năm', age: 'Từ 50 tuổi', screeningId: 'tb' },
  {
    label: 'Ung thư đại tràng',
    cycle: 'Mỗi 10 năm với nội soi đại tràng',
    age: 'Từ 45 – 75 tuổi',
    screeningId: 'crc',
  },
  { label: 'Cholesterol', cycle: 'Mỗi 5 năm', age: 'Từ 18 tuổi', screeningId: 'lipid' },
  {
    label:
      'Tham vấn: hút thuốc lá, rượu, hành vi tình dục, phơi nhiễm HIV, dinh dưỡng, ' +
      'hoạt động thể lực, bạo lực và súng, kế hoạch hoá gia đình, chấn thương, sức khoẻ nghề nghiệp',
    cycle: 'Tuỳ từng giai đoạn',
    age: 'Từ 19 tuổi',
    screeningId: null,
  },
  {
    label: 'Hoá dự phòng: Folate (nữ), Aspirin (nam 40+), Eostrogen (nữ 45+)',
    cycle: 'Tuỳ từng giai đoạn',
    age: 'Từ 19 tuổi',
    screeningId: null,
  },
]

/**
 * The learner's entry for a form row that names a body system.
 *
 * Rows the learner never filed under a system stay in the record and are
 * printed on the "Khác" row rather than disappearing.
 */
export function problemsForRow(record: CaseRecord, row: string): CaseRecord['personalHistory']['pastMedical'] {
  const all = [...record.personalHistory.pastMedical, ...record.personalHistory.pastSurgical]
  if (row === 'Khác') {
    return all.filter((m) => !FORM_PROBLEM_ROWS.includes(m.system))
  }
  if (row === 'Dị ứng') return []
  return all.filter((m) => m.system === row)
}
