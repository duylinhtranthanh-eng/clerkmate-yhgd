/**
 * Clinical reference lists used to seed a new case and to power pickers.
 *
 * These are STARTER lists for the teaching demo, not complete classifications.
 * Every picker also accepts free text, so extending these lists is additive and
 * never blocks a learner.
 */

import type { AttachmentCategory, ScreemDomain } from '../types/case'

/**
 * `normal` is the phrase written when the learner taps "Bình thường".
 * It is a one-tap confirmation, not an auto-fill: nothing is written until the
 * learner chooses it, and the text stays editable afterwards.
 */
export const EXAM_SYSTEMS: { id: string; label: string; normal: string }[] = [
  {
    id: 'cardiovascular',
    label: 'Tim mạch',
    normal: 'Tim đều, T1 T2 rõ, không âm thổi bệnh lý. Mạch ngoại biên bắt rõ, đối xứng.',
  },
  {
    id: 'respiratory',
    label: 'Hô hấp',
    normal: 'Lồng ngực cân đối, phổi trong, rì rào phế nang êm dịu hai bên, không rale.',
  },
  {
    id: 'abdomen',
    label: 'Tiêu hóa — bụng',
    normal: 'Bụng mềm, không chướng, không điểm đau khu trú, gan lách không sờ chạm.',
  },
  {
    id: 'neurological',
    label: 'Thần kinh',
    normal: 'Tỉnh, định hướng tốt, không dấu thần kinh khu trú, không dấu màng não.',
  },
  {
    id: 'musculoskeletal',
    label: 'Cơ xương khớp',
    normal: 'Các khớp không sưng nóng đỏ, tầm vận động trong giới hạn bình thường, không teo cơ.',
  },
  {
    id: 'ent',
    label: 'Tai mũi họng',
    normal: 'Tai mũi họng không viêm, không xuất tiết, hạch ngoại biên không to.',
  },
  {
    id: 'skin',
    label: 'Da — niêm mạc',
    normal: 'Da niêm hồng, không ban, không xuất huyết dưới da, không phù.',
  },
  {
    id: 'genitourinary',
    label: 'Tiết niệu — sinh dục',
    normal: 'Không cầu bàng quang, không đau vùng hố thận, không rối loạn đi tiểu.',
  },
  {
    id: 'endocrine',
    label: 'Nội tiết — tuyến giáp',
    normal: 'Tuyến giáp không to, không lồi mắt, không run tay, không rối loạn dung nạp nhiệt.',
  },
  {
    id: 'mental',
    label: 'Tâm thần kinh',
    normal: 'Tiếp xúc tốt, khí sắc bình thường, không rối loạn tri giác hay hành vi.',
  },
]

export const EXAM_NORMAL_BY_ID: Record<string, string> = Object.fromEntries(
  EXAM_SYSTEMS.map((s) => [s.id, s.normal]),
)

export const SCREENING_ITEMS: { id: string; name: string }[] = [
  { id: 'bp', name: 'Đo huyết áp' },
  { id: 'glucose', name: 'Đường huyết đói / HbA1c' },
  { id: 'lipid', name: 'Bộ mỡ máu' },
  { id: 'bmi', name: 'BMI và vòng eo' },
  { id: 'pap', name: 'Pap smear (nữ)' },
  { id: 'mammo', name: 'Chụp nhũ ảnh (nữ)' },
  { id: 'crc', name: 'Tầm soát ung thư đại trực tràng' },
  { id: 'tb', name: 'Tầm soát lao (khi có nguy cơ)' },
  { id: 'vision', name: 'Thị lực — thính lực (người cao tuổi)' },
  { id: 'depression', name: 'Sàng lọc trầm cảm (PHQ-2)' },
]

export const VACCINATION_ITEMS: { id: string; name: string }[] = [
  { id: 'influenza', name: 'Cúm mùa' },
  { id: 'pneumococcal', name: 'Phế cầu' },
  { id: 'tdap', name: 'Uốn ván — bạch hầu' },
  { id: 'hepb', name: 'Viêm gan B' },
  { id: 'covid', name: 'COVID-19' },
  { id: 'hpv', name: 'HPV' },
  { id: 'zoster', name: 'Zona thần kinh' },
]

/**
 * Family life cycle.
 *
 * Duvall's eight stages start at marriage, so they have no place for an adult
 * who has not married, or who lives alone after a divorce or bereavement. Stage
 * 0 below is Carter & McGoldrick's "leaving home: single young adults", added
 * so those patients are not forced into a stage that does not describe them.
 */
export const FAMILY_LIFE_CYCLE_STAGES: string[] = [
  '0. Người trưởng thành độc thân — rời gia đình gốc',
  '1. Vợ chồng mới cưới, chưa có con',
  '2. Gia đình có con nhỏ (0 — 30 tháng)',
  '3. Gia đình có con tuổi mẫu giáo (2,5 — 6 tuổi)',
  '4. Gia đình có con tuổi đi học (6 — 13 tuổi)',
  '5. Gia đình có con vị thành niên (13 — 20 tuổi)',
  '6. Gia đình có con trưởng thành rời nhà',
  '7. Gia đình trung niên — tổ ấm trống',
  '8. Gia đình cao tuổi — nghỉ hưu',
  '9. Sống một mình sau ly hôn hoặc mất vợ/chồng',
]

export const FAMILY_TYPES: string[] = [
  'Gia đình hạt nhân',
  'Gia đình mở rộng',
  'Gia đình đơn thân',
  'Gia đình ghép / tái hôn',
  'Gia đình không con',
  'Sống một mình',
  'Gia đình nhiều thế hệ',
]

export const APGAR_ITEMS: {
  key: 'adaptation' | 'partnership' | 'growth' | 'affection' | 'resolve'
  label: string
  question: string
}[] = [
  {
    key: 'adaptation',
    label: 'Adaptation — Thích nghi',
    question: 'Tôi hài lòng vì có thể nhờ gia đình giúp đỡ khi gặp khó khăn.',
  },
  {
    key: 'partnership',
    label: 'Partnership — Hợp tác',
    question: 'Tôi hài lòng với cách gia đình bàn bạc và chia sẻ vấn đề với tôi.',
  },
  {
    key: 'growth',
    label: 'Growth — Trưởng thành',
    question: 'Tôi hài lòng vì gia đình chấp nhận và ủng hộ những mong muốn mới của tôi.',
  },
  {
    key: 'affection',
    label: 'Affection — Tình cảm',
    question: 'Tôi hài lòng với cách gia đình bày tỏ tình cảm và đáp lại cảm xúc của tôi.',
  },
  {
    key: 'resolve',
    label: 'Resolve — Gắn bó',
    question: 'Tôi hài lòng với thời gian gia đình dành cho nhau.',
  },
]

export const APGAR_OPTIONS: { value: 0 | 1 | 2; label: string }[] = [
  { value: 0, label: 'Hầu như không' },
  { value: 1, label: 'Thỉnh thoảng' },
  { value: 2, label: 'Hầu như luôn luôn' },
]

/** 0–3 rối loạn chức năng nặng, 4–6 rối loạn nhẹ, 7–10 chức năng tốt. */
export function interpretApgar(total: number): string {
  if (total >= 7) return 'Chức năng gia đình tốt'
  if (total >= 4) return 'Rối loạn chức năng gia đình mức nhẹ'
  return 'Rối loạn chức năng gia đình mức nặng'
}

export const SCREEM_DOMAINS: { key: ScreemDomain; label: string; prompt: string }[] = [
  { key: 'social', label: 'Social — Xã hội', prompt: 'Mạng lưới bạn bè, hàng xóm, đoàn thể.' },
  { key: 'cultural', label: 'Cultural — Văn hóa', prompt: 'Niềm tin, phong tục, ngôn ngữ.' },
  { key: 'religious', label: 'Religious — Tôn giáo', prompt: 'Sinh hoạt tôn giáo, hỗ trợ tinh thần.' },
  { key: 'economic', label: 'Economic — Kinh tế', prompt: 'Thu nhập, bảo hiểm, khả năng chi trả.' },
  { key: 'educational', label: 'Educational — Giáo dục', prompt: 'Học vấn, hiểu biết về sức khỏe.' },
  { key: 'medical', label: 'Medical — Y tế', prompt: 'Khả năng tiếp cận và sử dụng dịch vụ y tế.' },
]

/**
 * The rows of "Các vấn đề đã và hiện có" on the department's paper form.
 *
 * The form lists a body system per row and leaves the diagnosis itself to the
 * "Phân loại" column, which is why a past problem carries both: the system it
 * belongs to, and what it actually is.
 */
export const PROBLEM_SYSTEMS: string[] = [
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

/** The five the paper form prints as fixed rows of the family-history table. */
export const FAMILY_HISTORY_CONDITIONS: string[] = [
  'Đái tháo đường',
  'Tăng huyết áp',
  'Rối loạn lipid máu',
  'Lao',
  'Ung thư',
]

export const RED_FLAG_LIBRARY: { group: string; items: string[] }[] = [
  {
    group: 'Toàn thân',
    items: [
      'Sụt cân không chủ ý',
      'Sốt kéo dài không rõ nguyên nhân',
      'Đổ mồ hôi đêm',
      'Tiền căn ung thư',
      'Suy giảm miễn dịch',
      'Mệt mỏi tiến triển nhanh',
    ],
  },
  {
    group: 'Đau ngực',
    items: [
      'Đau ngực khi gắng sức',
      'Đau lan tay trái / hàm',
      'Khó thở kèm vã mồ hôi',
      'Ngất hoặc gần ngất',
      'Hồi hộp kèm tụt huyết áp',
    ],
  },
  {
    group: 'Đau đầu',
    items: [
      'Đau đầu dữ dội khởi phát đột ngột',
      'Đau đầu kèm sốt và cứng gáy',
      'Dấu thần kinh khu trú',
      'Thay đổi tri giác',
      'Đau đầu nặng lên khi ho / gắng sức',
    ],
  },
  {
    group: 'Đau bụng',
    items: [
      'Đề kháng thành bụng',
      'Nôn ra máu / tiêu phân đen',
      'Vàng da',
      'Bụng chướng, bí trung đại tiện',
      'Đau bụng ở người cao tuổi kèm tụt huyết áp',
    ],
  },
  {
    group: 'Đau lưng — khớp',
    items: [
      'Đau về đêm đánh thức bệnh nhân',
      'Rối loạn cơ vòng',
      'Tê yếu chi tiến triển',
      'Chấn thương đáng kể gần đây',
      'Sưng nóng đỏ khớp kèm sốt',
    ],
  },
  {
    group: 'Hô hấp',
    items: [
      'Ho ra máu',
      'Khó thở khi nghỉ',
      'Tím tái',
      'SpO₂ giảm',
      'Ho kéo dài trên 3 tuần ở vùng dịch tễ lao',
    ],
  },
]

/**
 * Abbreviated demo code list. Learners may also type any code manually —
 * this list is a convenience, not the authoritative classification.
 */
export const DIAGNOSIS_CODES: { label: string; icd10: string; icpc2: string }[] = [
  { label: 'Tăng huyết áp nguyên phát', icd10: 'I10', icpc2: 'K86' },
  { label: 'Đái tháo đường típ 2', icd10: 'E11', icpc2: 'T90' },
  { label: 'Thoái hóa khớp gối', icd10: 'M17', icpc2: 'L90' },
  { label: 'Rối loạn lipid máu', icd10: 'E78', icpc2: 'T93' },
  { label: 'Hen phế quản', icd10: 'J45', icpc2: 'R96' },
  { label: 'Bệnh phổi tắc nghẽn mạn tính', icd10: 'J44', icpc2: 'R95' },
  { label: 'Đau thắt lưng', icd10: 'M54.5', icpc2: 'L03' },
  { label: 'Đau đầu', icd10: 'R51', icpc2: 'N01' },
  { label: 'Rối loạn lo âu', icd10: 'F41', icpc2: 'P74' },
  { label: 'Giai đoạn trầm cảm', icd10: 'F32', icpc2: 'P76' },
  { label: 'Béo phì', icd10: 'E66', icpc2: 'T82' },
  { label: 'Nhiễm trùng tiểu', icd10: 'N39.0', icpc2: 'U71' },
  { label: 'Nhiễm khuẩn hô hấp trên cấp', icd10: 'J06.9', icpc2: 'R74' },
  { label: 'Viêm dạ dày ruột nhiễm khuẩn', icd10: 'A09', icpc2: 'D73' },
  { label: 'Bệnh tim thiếu máu cục bộ mạn', icd10: 'I25', icpc2: 'K76' },
  { label: 'Suy giáp', icd10: 'E03.9', icpc2: 'T86' },
  { label: 'Bệnh thận mạn', icd10: 'N18', icpc2: 'U99' },
  { label: 'Trào ngược dạ dày — thực quản', icd10: 'K21', icpc2: 'D84' },
  { label: 'Ho', icd10: 'R05', icpc2: 'R05' },
  { label: 'Sốt chưa rõ nguyên nhân', icd10: 'R50.9', icpc2: 'A03' },
]

export const COMMON_INVESTIGATIONS: string[] = [
  'Công thức máu',
  'Đường huyết đói',
  'HbA1c',
  'Bộ mỡ máu',
  'AST — ALT',
  'Creatinin — eGFR',
  'Tổng phân tích nước tiểu',
  'Điện tâm đồ',
  'X-quang ngực thẳng',
  'X-quang khớp gối',
  'Siêu âm bụng tổng quát',
  'TSH — FT4',
  'Acid uric',
  'Ion đồ',
]

export const ATTACHMENT_CATEGORIES: { id: AttachmentCategory; label: string; icon: string }[] = [
  { id: 'lab', label: 'Xét nghiệm', icon: '🧪' },
  { id: 'ecg', label: 'Điện tâm đồ', icon: '💓' },
  { id: 'imaging', label: 'Chẩn đoán hình ảnh', icon: '🩻' },
  { id: 'prescription', label: 'Toa thuốc cũ', icon: '📄' },
  { id: 'clinical_photo', label: 'Ảnh lâm sàng', icon: '📷' },
  { id: 'other', label: 'Khác', icon: '📁' },
]

/**
 * Shown before the camera opens for a clinical photo, not after.
 *
 * A photograph of a lesion is a different privacy problem from a photograph of
 * a lab slip: the identifying feature can be the patient themselves, and no
 * amount of painting over it afterwards undoes having taken it.
 */
export const CLINICAL_PHOTO_WARNING =
  'Không chụp mặt hoặc đặc điểm nhận diện người bệnh. ' +
  'Chỉ chụp vùng tổn thương cần thiết cho mục đích học tập.'

/** Minimum questions a clinical photo has to answer before it may be used. */
export const CLINICAL_PHOTO_CHECKS: { key: 'noFace' | 'noIdText' | 'cropped'; label: string }[] = [
  { key: 'noFace', label: 'Không có khuôn mặt người bệnh' },
  { key: 'noIdText', label: 'Không có tên, mã hồ sơ, vòng tay định danh' },
  { key: 'cropped', label: 'Đã cắt chỉ còn vùng cần thiết' },
]

export const MEDICATION_ROUTES = ['Uống', 'Tiêm bắp', 'Tiêm tĩnh mạch', 'Bôi ngoài da', 'Hít', 'Nhỏ mắt', 'Đặt']
export const MEDICATION_FREQUENCIES = ['1 lần/ngày', '2 lần/ngày', '3 lần/ngày', 'Khi cần', 'Mỗi tuần']
