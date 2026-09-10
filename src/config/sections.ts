/**
 * Section catalogue.
 *
 * Educational content lives here as data, never inside components, so the
 * teaching team can reorder / rename / retire sections without touching the UI.
 */

export type SectionId =
  | 'patient'
  | 'visit'
  | 'history'
  | 'personalHistory'
  | 'lifestyle'
  | 'familyHistory'
  | 'fmAssessment'
  | 'examination'
  | 'investigations'
  | 'risk'
  | 'diagnosis'
  | 'management'
  | 'medications'
  | 'prevention'
  | 'attachments'
  | 'genogram'
  | 'followUp'
  | 'reflection'

export interface SectionDef {
  id: SectionId
  /** Vietnamese label shown in the UI. */
  label: string
  /** English label used in the exported record. */
  labelEn: string
  /** One-line orientation for the learner. */
  blurb: string
  icon: string
  /** Grouping used by the structured-record index screen. */
  group:
    | 'Hành chính'
    | 'Bệnh sử'
    | 'Nền tảng'
    | 'Y học gia đình'
    | 'Lượng giá'
    | 'Xử trí'
    | 'Theo dõi'
    | 'Tự lượng giá'
}

export const SECTIONS: SectionDef[] = [
  {
    id: 'patient',
    label: 'Hành chính',
    labelEn: 'Patient information',
    blurb: 'Tuổi, giới, nghề nghiệp, tôn giáo, nơi ở.',
    icon: '👤',
    group: 'Hành chính',
  },
  {
    id: 'visit',
    label: 'Lần khám',
    labelEn: 'Visit',
    blurb: 'Ngày khám, tuyến khám, lý do đến khám.',
    icon: '📍',
    group: 'Hành chính',
  },
  {
    id: 'history',
    label: 'Bệnh sử',
    labelEn: 'History of present illness',
    blurb: 'Lý do khám, diễn tiến, SOCRATES, cờ đỏ, ICE.',
    icon: '💬',
    group: 'Bệnh sử',
  },
  {
    id: 'personalHistory',
    label: 'Tiền căn',
    labelEn: 'Past & personal history',
    blurb: 'Bệnh nền, phẫu thuật, dị ứng, sản phụ khoa.',
    icon: '📚',
    group: 'Nền tảng',
  },
  {
    id: 'lifestyle',
    label: 'Lối sống',
    labelEn: 'Lifestyle',
    blurb: 'Thuốc lá, rượu bia, vận động, ăn uống, giấc ngủ.',
    icon: '🏃',
    group: 'Nền tảng',
  },
  {
    id: 'familyHistory',
    label: 'Tiền căn gia đình',
    labelEn: 'Family history',
    blurb: 'Bệnh lý di truyền và bệnh mạn tính trong gia đình.',
    icon: '👨‍👩‍👧',
    group: 'Nền tảng',
  },
  {
    id: 'fmAssessment',
    label: 'Đánh giá YHGĐ',
    labelEn: 'Family Medicine assessment',
    blurb: 'Chu kỳ gia đình, Family APGAR, SCREEM.',
    icon: '🏠',
    group: 'Y học gia đình',
  },
  {
    id: 'genogram',
    label: 'Sơ đồ phả hệ',
    labelEn: 'Genogram',
    blurb: 'Vẽ tự động từ dữ liệu thành viên gia đình.',
    icon: '🌳',
    group: 'Y học gia đình',
  },
  {
    id: 'examination',
    label: 'Khám lâm sàng',
    labelEn: 'Physical examination',
    blurb: 'Sinh hiệu và khám theo cơ quan.',
    icon: '🩺',
    group: 'Lượng giá',
  },
  {
    id: 'investigations',
    label: 'Cận lâm sàng',
    labelEn: 'Investigations',
    blurb: 'Đề nghị xét nghiệm và tóm tắt kết quả.',
    icon: '🧪',
    group: 'Lượng giá',
  },
  {
    id: 'attachments',
    label: 'Hình ảnh đính kèm',
    labelEn: 'Attachments',
    blurb: 'Ảnh kết quả xét nghiệm, ECG, X-quang, toa cũ.',
    icon: '📎',
    group: 'Lượng giá',
  },
  {
    id: 'risk',
    label: 'Yếu tố nguy cơ',
    labelEn: 'Health risk factors',
    blurb: 'Nhận diện nguy cơ sức khỏe cần can thiệp.',
    icon: '⚠️',
    group: 'Lượng giá',
  },
  {
    id: 'diagnosis',
    label: 'Chẩn đoán',
    labelEn: 'Diagnosis',
    blurb: 'Chẩn đoán chính, phân biệt, mã ICD-10 / ICPC-2.',
    icon: '🎯',
    group: 'Xử trí',
  },
  {
    id: 'management',
    label: 'Kế hoạch xử trí',
    labelEn: 'Management plan',
    blurb: 'Không dùng thuốc, giáo dục, hẹn tái khám, chuyển tuyến.',
    icon: '🗺️',
    group: 'Xử trí',
  },
  {
    id: 'medications',
    label: 'Thuốc',
    labelEn: 'Medications',
    blurb: 'Danh sách thuốc kèm liều, đường dùng, chỉ định.',
    icon: '💊',
    group: 'Xử trí',
  },
  {
    id: 'prevention',
    label: 'Dự phòng & tư vấn',
    labelEn: 'Prevention & counselling',
    blurb: 'Tầm soát, tiêm chủng, nâng cao sức khỏe.',
    icon: '🛡️',
    group: 'Xử trí',
  },
  {
    id: 'followUp',
    label: 'Theo dõi dọc',
    labelEn: 'Longitudinal follow-up',
    blurb: 'Các lần tái khám, đáp ứng điều trị, tuân thủ.',
    icon: '📈',
    group: 'Theo dõi',
  },
  {
    id: 'reflection',
    label: 'Sau ca này tôi học được gì',
    labelEn: 'Learning reflection',
    blurb: 'Điều học được, chỗ còn khó, lần sau sẽ làm khác gì.',
    icon: '🪞',
    group: 'Tự lượng giá',
  },
]

export const SECTION_BY_ID: Record<SectionId, SectionDef> = Object.fromEntries(
  SECTIONS.map((s) => [s.id, s]),
) as Record<SectionId, SectionDef>

export const SECTION_GROUPS = [
  'Hành chính',
  'Bệnh sử',
  'Nền tảng',
  'Y học gia đình',
  'Lượng giá',
  'Xử trí',
  'Theo dõi',
  'Tự lượng giá',
] as const
