/**
 * Requirement catalogue.
 *
 * Each entry knows how to look at a CaseRecord and decide whether the learner
 * has documented that item. Nothing here decides *which* level needs *which*
 * item — that mapping lives in `levels.ts`, so the two can be edited apart.
 */

import type { CaseRecord } from '../types/case'
import type { SectionId } from './sections'
import { applicableRiskFactors, riskContext } from './risk'
import { isSubmissionSafe } from '../workflow/privacy'

/** Ids of the factors that actually apply to this patient, for a domain. */
function domainFactors(c: CaseRecord, domain: string) {
  const applicable = new Set(applicableRiskFactors(riskContext(c)).map((f) => f.id))
  return c.riskAssessment.factors.filter((f) => f.domain === domain && applicable.has(f.id))
}

export interface RequirementDef {
  id: string
  label: string
  sectionId: SectionId
  /** Shown to the learner when the item is missing. Never auto-fills anything. */
  hint: string
  /** True when the learner has documented this item. */
  isSatisfied: (c: CaseRecord) => boolean
  /** Optional gate: item is excluded from scoring when this returns false. */
  appliesTo?: (c: CaseRecord) => boolean
  /**
   * Must be captured while the patient is still there.
   *
   * These are the items that cannot be reconstructed in the evening: what the
   * patient said and feared, what the blood pressure was, what the knee looked
   * like. Everything else — a genogram, a screening plan, a cardiovascular
   * chart — can be finished afterwards from the notes. Marking them changes no
   * arithmetic; it tells the learner what not to leave the room without.
   */
  bedside?: true
}

const t = (s: string | null | undefined): boolean => !!s && s.trim().length > 0
const anyText = (...xs: (string | null | undefined)[]): boolean => xs.some(t)
const filled = (...xs: (string | null | undefined)[]): number => xs.filter(t).length

export const REQUIREMENTS: RequirementDef[] = [
  // --- Hành chính ---------------------------------------------------------
  {
    id: 'patient.identity',
    bedside: true,
    label: 'Tuổi, giới tính, tên/mã ca',
    sectionId: 'patient',
    hint: 'Nhập tuổi và giới tính của bệnh nhân giả định.',
    isSatisfied: (c) =>
      c.patient.ageYears !== null && c.patient.sex !== 'unknown' && t(c.patient.name),
  },
  {
    id: 'patient.social',
    label: 'Nghề nghiệp, nơi ở',
    sectionId: 'patient',
    hint: 'Bối cảnh xã hội là dữ kiện chẩn đoán trong YHGĐ.',
    isSatisfied: (c) => filled(c.patient.occupation, c.patient.address) >= 2,
  },
  {
    id: 'patient.beliefs',
    label: 'Tôn giáo / tín ngưỡng',
    sectionId: 'patient',
    hint: 'Ghi nhận tôn giáo khi có ảnh hưởng đến quyết định chăm sóc.',
    isSatisfied: (c) => t(c.patient.religion),
  },
  {
    id: 'visit.reason',
    label: 'Lý do đến khám',
    sectionId: 'visit',
    hint: 'Một câu ngắn: bệnh nhân đến vì điều gì hôm nay?',
    isSatisfied: (c) => t(c.visit.reasonForEncounter) || t(c.history.chiefComplaint),
  },

  // --- Bệnh sử ------------------------------------------------------------
  {
    id: 'history.chiefComplaint',
    bedside: true,
    label: 'Lý do chính (chief complaint)',
    sectionId: 'history',
    hint: 'Ghi bằng ngôn ngữ của bệnh nhân, kèm thời gian diễn tiến.',
    isSatisfied: (c) => t(c.history.chiefComplaint),
  },
  {
    id: 'history.hpi',
    bedside: true,
    label: 'Diễn tiến bệnh sử',
    sectionId: 'history',
    hint: 'Kể lại diễn tiến theo trình tự thời gian.',
    isSatisfied: (c) => c.history.hpi.trim().length >= 20,
  },
  {
    id: 'history.socrates',
    label: 'SOCRATES cho triệu chứng chính',
    sectionId: 'history',
    hint: 'Cần ít nhất 4 thành tố SOCRATES để mô tả triệu chứng.',
    isSatisfied: (c) => {
      const s = c.history.socrates
      return (
        filled(
          s.site,
          s.onset,
          s.character,
          s.radiation,
          s.associations,
          s.timeCourse,
          s.exacerbatingRelieving,
          s.severity,
        ) >= 4
      )
    },
  },
  {
    id: 'history.redFlags',
    bedside: true,
    label: 'Cờ đỏ (red flags)',
    sectionId: 'history',
    hint: 'Hỏi và ghi rõ cờ đỏ nào có, cờ đỏ nào đã loại trừ.',
    isSatisfied: (c) =>
      c.history.redFlags.present.length + c.history.redFlags.absent.length > 0 ||
      t(c.history.redFlags.note),
  },
  {
    id: 'history.ice',
    bedside: true,
    label: 'ICE — Ideas, Concerns, Expectations',
    sectionId: 'history',
    hint: 'Bệnh nhân nghĩ bệnh gì, lo điều gì, mong đợi gì ở lần khám này?',
    isSatisfied: (c) => filled(c.history.ice.ideas, c.history.ice.concerns, c.history.ice.expectations) >= 2,
  },
  {
    id: 'history.systemsReview',
    label: 'Khám hệ thống theo cơ quan (review of systems)',
    sectionId: 'history',
    hint: 'Rà soát nhanh các cơ quan liên quan.',
    isSatisfied: (c) => t(c.history.systemsReview),
  },

  // --- Tiền căn -----------------------------------------------------------
  {
    id: 'past.medical',
    bedside: true,
    label: 'Tiền căn bệnh lý',
    sectionId: 'personalHistory',
    hint: 'Liệt kê bệnh nền, hoặc ghi rõ "chưa ghi nhận".',
    isSatisfied: (c) =>
      c.personalHistory.pastMedical.length > 0 ||
      c.personalHistory.noPastMedical ||
      t(c.personalHistory.note),
  },
  {
    id: 'past.allergies',
    label: 'Dị ứng',
    sectionId: 'personalHistory',
    hint: 'Luôn phải hỏi trước khi kê toa. Không có thì chạm “Không ghi nhận dị ứng”.',
    isSatisfied: (c) => c.personalHistory.allergies.length > 0 || c.personalHistory.noAllergies,
  },
  {
    id: 'past.reproductive',
    label: 'Tiền căn sản phụ khoa',
    sectionId: 'personalHistory',
    hint: 'PARA, kinh nguyệt, ngừa thai, mãn kinh khi phù hợp.',
    appliesTo: (c) => c.patient.sex === 'female',
    isSatisfied: (c) => {
      const r = c.personalHistory.reproductive
      if (!r.applicable) return true
      return filled(r.menarcheAge, r.cycle, r.lmp, r.para, r.contraception, r.menopause, r.obstetricNote) >= 2
    },
  },

  // --- Lối sống -----------------------------------------------------------
  {
    id: 'lifestyle.core',
    label: 'Thuốc lá và rượu bia',
    sectionId: 'lifestyle',
    hint: 'Hai yếu tố nguy cơ bắt buộc hỏi ở mọi ca YHGĐ.',
    isSatisfied: (c) => t(c.lifestyle.smoking.status) && t(c.lifestyle.alcohol.status),
  },
  {
    id: 'lifestyle.full',
    label: 'Vận động, dinh dưỡng, giấc ngủ',
    sectionId: 'lifestyle',
    hint: 'Nền tảng cho tư vấn thay đổi lối sống.',
    isSatisfied: (c) => filled(c.lifestyle.physicalActivity, c.lifestyle.diet, c.lifestyle.sleep) >= 2,
  },

  // --- Gia đình -----------------------------------------------------------
  {
    id: 'family.history',
    label: 'Tiền căn gia đình',
    sectionId: 'familyHistory',
    hint: 'Bệnh mạn tính / di truyền ở người thân bậc 1.',
    isSatisfied: (c) =>
      c.familyHistory.entries.length > 0 || c.familyHistory.none || t(c.familyHistory.note),
  },
  {
    id: 'fm.lifeCycle',
    label: 'Chu kỳ sống gia đình',
    sectionId: 'fmAssessment',
    hint: 'Xác định giai đoạn chu kỳ và nhiệm vụ phát triển tương ứng.',
    isSatisfied: (c) => t(c.familyMedicineAssessment.familyLifeCycleStage),
  },
  {
    id: 'fm.familyType',
    label: 'Kiểu gia đình',
    sectionId: 'fmAssessment',
    hint: 'Hạt nhân, mở rộng, đơn thân, ghép...',
    isSatisfied: (c) => t(c.familyMedicineAssessment.familyType),
  },
  {
    id: 'fm.apgar',
    label: 'Family APGAR (đủ 5 mục)',
    sectionId: 'fmAssessment',
    hint: 'Chấm đủ 5 mục Adaptation, Partnership, Growth, Affection, Resolve.',
    isSatisfied: (c) => {
      const a = c.familyMedicineAssessment.apgar
      return [a.adaptation, a.partnership, a.growth, a.affection, a.resolve].every((v) => v !== null)
    },
  },
  {
    id: 'fm.screem',
    label: 'SCREEM (ít nhất 4 lĩnh vực)',
    sectionId: 'fmAssessment',
    hint: 'Ghi nguồn lực và điểm yếu cho từng lĩnh vực.',
    isSatisfied: (c) => {
      const s = c.familyMedicineAssessment.screem
      return Object.values(s).filter((e) => anyText(e.resources, e.pathology)).length >= 4
    },
  },
  {
    id: 'fm.homeEnvironment',
    label: 'Môi trường sống / thăm nhà',
    sectionId: 'fmAssessment',
    hint: 'Điều kiện nhà ở, an toàn, khả năng tiếp cận y tế.',
    isSatisfied: (c) => t(c.familyMedicineAssessment.homeEnvironment),
  },
  {
    id: 'fm.continuity',
    label: 'Tính liên tục trong chăm sóc',
    sectionId: 'fmAssessment',
    hint: 'Ai là bác sĩ gia đình, kế hoạch theo dõi dài hạn ra sao?',
    isSatisfied: (c) => t(c.familyMedicineAssessment.continuityNote),
  },
  {
    id: 'genogram.members',
    label: 'Phả hệ có đủ dữ liệu',
    sectionId: 'genogram',
    hint: 'Cần ít nhất bệnh nhân và 2 thành viên gia đình để vẽ phả hệ.',
    isSatisfied: (c) => c.familyMembers.filter((m) => m.relation !== 'self').length >= 2,
  },

  // --- Khám ---------------------------------------------------------------
  {
    id: 'exam.vitals',
    bedside: true,
    label: 'Sinh hiệu',
    sectionId: 'examination',
    hint: 'Tối thiểu mạch, huyết áp và một chỉ số khác.',
    isSatisfied: (c) => {
      const v = c.examination.vitals
      const hasBp = t(v.systolic) && t(v.diastolic)
      return hasBp && t(v.pulse)
    },
  },
  {
    id: 'exam.anthropometry',
    label: 'Chiều cao, cân nặng, BMI',
    sectionId: 'examination',
    hint: 'BMI cần cho đánh giá nguy cơ chuyển hóa.',
    isSatisfied: (c) => t(c.examination.vitals.heightCm) && t(c.examination.vitals.weightKg),
  },
  {
    id: 'exam.general',
    bedside: true,
    label: 'Khám tổng trạng',
    sectionId: 'examination',
    hint: 'Tri giác, da niêm, phù, dáng đi...',
    isSatisfied: (c) => t(c.examination.generalAppearance),
  },
  {
    id: 'exam.systemsBasic',
    label: 'Khám ít nhất 1 cơ quan',
    sectionId: 'examination',
    hint: 'Khám cơ quan liên quan trực tiếp đến than phiền chính.',
    isSatisfied: (c) => c.examination.systems.some((s) => s.status !== 'unchecked' && t(s.findings)),
  },
  {
    id: 'exam.systemsRelevant',
    bedside: true,
    label: 'Khám ít nhất 3 cơ quan',
    sectionId: 'examination',
    hint: 'Ca YHGĐ cần khám rộng hơn một cơ quan đơn lẻ.',
    isSatisfied: (c) =>
      c.examination.systems.filter((s) => s.status !== 'unchecked' && t(s.findings)).length >= 3,
  },

  // --- Cận lâm sàng -------------------------------------------------------
  {
    id: 'inv.proposed',
    label: 'Đề nghị cận lâm sàng',
    sectionId: 'investigations',
    hint: 'Liệt kê các xét nghiệm cần làm — chỉ cần tên.',
    isSatisfied: (c) => c.investigations.proposed.length > 0,
  },
  {
    id: 'inv.results',
    label: 'Tóm tắt kết quả hiện có',
    sectionId: 'investigations',
    hint: 'Ghi kết quả đã có và diễn giải ý nghĩa.',
    isSatisfied: (c) => c.investigations.results.length > 0 || t(c.investigations.summary),
  },
  {
    id: 'inv.perResult',
    label: 'Lý giải cho từng kết quả',
    sectionId: 'investigations',
    hint: 'Mỗi kết quả — kể cả kết quả chỉ có ảnh chụp — cần một câu lý giải.',
    appliesTo: (c) => c.investigations.results.length > 0,
    isSatisfied: (c) => c.investigations.results.every((r) => t(r.interpretation)),
  },
  {
    id: 'inv.interpretation',
    label: 'Lý giải kết quả cận lâm sàng',
    sectionId: 'investigations',
    hint: 'Kết quả ủng hộ hay không ủng hộ chẩn đoán nào? Đây là phần nối cận lâm sàng với lập luận.',
    appliesTo: (c) => c.investigations.results.length > 0,
    isSatisfied: (c) => c.investigations.interpretation.supportsDiagnosis.trim().length >= 20,
  },
  {
    id: 'inv.impact',
    label: 'Ảnh hưởng của kết quả lên xử trí',
    sectionId: 'investigations',
    hint: 'Nếu một kết quả không làm thay đổi xử trí, hãy tự hỏi có cần chỉ định nó không.',
    appliesTo: (c) => c.investigations.results.length > 0,
    isSatisfied: (c) => t(c.investigations.interpretation.impactOnPlan),
  },
  {
    id: 'attachments.privacy',
    label: 'Đã che thông tin định danh trên ảnh',
    sectionId: 'attachments',
    hint: 'Mọi ảnh đính kèm phải được che tên, mã số, ngày sinh bệnh nhân trước khi nộp.',
    appliesTo: (c) => c.attachments.length > 0,
    isSatisfied: (c) => c.attachments.every(isSubmissionSafe),
  },
  {
    id: 'attachments.any',
    label: 'Đính kèm hình ảnh minh chứng',
    sectionId: 'attachments',
    hint: 'Ảnh kết quả xét nghiệm, ECG, X-quang hoặc toa thuốc cũ.',
    isSatisfied: (c) => c.attachments.length > 0,
  },

  // --- Nguy cơ ------------------------------------------------------------
  {
    id: 'risk.emergency',
    label: 'Rà soát nguy cơ cấp cứu',
    sectionId: 'risk',
    hint: 'Nhóm 1 — trả lời hết các nguy cơ cần xử trí ngay trước khi bàn bệnh mạn tính.',
    isSatisfied: (c) => {
      const items = domainFactors(c, 'emergency')
      return items.length > 0 && items.every((f) => f.present !== 'unknown')
    },
  },
  {
    id: 'risk.factors',
    label: 'Yếu tố nguy cơ hành vi và tim mạch',
    sectionId: 'risk',
    hint: 'Rà soát nhóm 2 và 3: thuốc lá, rượu, vận động, dinh dưỡng, tim mạch — chuyển hóa.',
    isSatisfied: (c) => {
      const items = [...domainFactors(c, 'behavioural'), ...domainFactors(c, 'cardiometabolic')]
      return items.length > 0 && items.filter((f) => f.present !== 'unknown').length >= items.length - 2
    },
  },
  {
    id: 'risk.cancerScreening',
    label: 'Nguy cơ ung thư theo tuổi và giới',
    sectionId: 'risk',
    hint: 'Nhóm 4 — chỉ những mục phù hợp với đối tượng, danh sách đã tự lọc.',
    appliesTo: (c) => domainFactors(c, 'cancer').length > 0,
    isSatisfied: (c) => {
      const items = domainFactors(c, 'cancer')
      return items.length > 0 && items.every((f) => f.present !== 'unknown')
    },
  },
  {
    id: 'risk.geriatric',
    label: 'Hội chứng lão khoa (té ngã, đa thuốc, suy yếu)',
    sectionId: 'risk',
    hint: 'Nhóm 5 và 6 — áp dụng cho bệnh nhân cao tuổi.',
    appliesTo: (c) => domainFactors(c, 'geriatric').length > 0,
    isSatisfied: (c) => {
      const items = [...domainFactors(c, 'geriatric'), ...domainFactors(c, 'cognitive')]
      return items.length > 0 && items.filter((f) => f.present !== 'unknown').length >= items.length - 2
    },
  },
  {
    id: 'risk.psychosocial',
    label: 'Nguy cơ tâm lý',
    sectionId: 'risk',
    hint: 'Nhóm 7 — trầm cảm, lo âu, căng thẳng, gánh nặng người chăm sóc.',
    isSatisfied: (c) => {
      const items = domainFactors(c, 'psychological')
      return items.length > 0 && items.filter((f) => f.present !== 'unknown').length >= items.length - 2
    },
  },
  {
    id: 'risk.depressionScreen',
    label: 'Sàng lọc trầm cảm và lo âu',
    sectionId: 'risk',
    hint: 'Làm PHQ-2 / GAD-2, hoặc trả lời hai mục trầm cảm và lo âu trong nhóm 7.',
    isSatisfied: (c) => {
      const hasScale = c.riskAssessment.scales.some(
        (s) => ['phq2', 'phq9', 'gad2', 'gad7', 'hads'].includes(s.scaleId),
      )
      const asked = c.riskAssessment.factors.filter(
        (f) => ['ps.depression', 'ps.anxiety'].includes(f.id) && f.present !== 'unknown',
      )
      return hasScale || asked.length === 2
    },
  },
  {
    id: 'risk.cognitiveScreen',
    label: 'Sàng lọc nhận thức',
    sectionId: 'risk',
    hint: 'Làm Mini-Cog, hoặc trả lời hai mục trí nhớ và nguy cơ sa sút trí tuệ trong nhóm 6.',
    appliesTo: (c) => domainFactors(c, 'cognitive').length > 0,
    isSatisfied: (c) => {
      const hasScale = c.riskAssessment.scales.some((s) => s.scaleId === 'minicog')
      const asked = c.riskAssessment.factors.filter(
        (f) => ['cg.memoryComplaint', 'cg.dementiaRisk'].includes(f.id) && f.present !== 'unknown',
      )
      return hasScale || asked.length === 2
    },
  },
  {
    id: 'risk.fallsGraded',
    label: 'Đánh giá mức độ nguy cơ té ngã',
    sectionId: 'risk',
    hint: 'Ba câu sàng lọc STEADI, hoặc trả lời mục té ngã trong nhóm 5.',
    appliesTo: (c) => domainFactors(c, 'geriatric').some((f) => f.id === 'ge.falls'),
    isSatisfied: (c) => {
      const f = c.riskAssessment.falls
      const screened =
        f.fellPastYear !== 'unknown' ||
        f.feelsUnsteady !== 'unknown' ||
        f.worriesAboutFalling !== 'unknown'
      const asked = c.riskAssessment.factors.find((x) => x.id === 'ge.falls')
      return screened || (!!asked && asked.present !== 'unknown')
    },
  },
  {
    id: 'risk.cvd',
    label: 'Nguy cơ tim mạch 10 năm',
    sectionId: 'risk',
    hint: 'Tra biểu đồ nguy cơ và ghi lại phần trăm hoặc phân nhóm.',
    appliesTo: (c) => c.patient.ageYears === null || c.patient.ageYears >= 40,
    isSatisfied: (c) => t(c.riskAssessment.cvd.percent) || t(c.riskAssessment.cvd.band),
  },
  {
    id: 'risk.environmental',
    label: 'Nguy cơ môi trường — nghề nghiệp',
    sectionId: 'risk',
    hint: 'Nhóm 9 — nơi bệnh nhân sống và làm việc.',
    isSatisfied: (c) => domainFactors(c, 'environmental').some((f) => f.present !== 'unknown'),
  },
  {
    id: 'risk.overall',
    label: 'Nhận định nguy cơ tổng thể',
    sectionId: 'risk',
    hint: 'Một đoạn ngắn tổng hợp nguy cơ nổi bật cần can thiệp.',
    isSatisfied: (c) => t(c.riskAssessment.overallNote),
  },

  // --- Chẩn đoán ----------------------------------------------------------
  {
    id: 'dx.primary',
    bedside: true,
    label: 'Chẩn đoán chính',
    sectionId: 'diagnosis',
    hint: 'Ghi chẩn đoán chính bằng thuật ngữ lâm sàng.',
    isSatisfied: (c) => !!c.diagnosis.primary && t(c.diagnosis.primary.label),
  },
  {
    id: 'dx.coding',
    label: 'Mã ICD-10 hoặc ICPC-2',
    sectionId: 'diagnosis',
    hint: 'Chọn mã tương ứng cho chẩn đoán chính.',
    isSatisfied: (c) => !!c.diagnosis.primary && anyText(c.diagnosis.primary.icd10, c.diagnosis.primary.icpc2),
  },
  {
    id: 'dx.comorbidities',
    label: 'Chẩn đoán kèm theo (bệnh đồng mắc)',
    sectionId: 'diagnosis',
    hint: 'Bệnh nhân có bệnh nền thì phải liệt kê kèm mức kiểm soát, hoặc chạm “Không có bệnh đồng mắc”.',
    isSatisfied: (c) =>
      c.diagnosis.comorbidities.length > 0 ||
      c.diagnosis.noComorbidities ||
      (c.personalHistory.pastMedical.length === 0 && c.personalHistory.noPastMedical),
  },
  {
    id: 'dx.comorbidityControl',
    label: 'Mức kiểm soát của từng bệnh đồng mắc',
    sectionId: 'diagnosis',
    hint: 'Mỗi bệnh đồng mắc cần nêu đang ổn định, chưa đạt đích hay chưa điều trị.',
    appliesTo: (c) => c.diagnosis.comorbidities.length > 0,
    isSatisfied: (c) => c.diagnosis.comorbidities.every((x) => t(x.status)),
  },
  {
    id: 'dx.differentials',
    label: 'Chẩn đoán phân biệt',
    sectionId: 'diagnosis',
    hint: 'Ít nhất 2 chẩn đoán phân biệt có lý do loại trừ.',
    isSatisfied: (c) => c.diagnosis.differentials.length >= 2,
  },
  {
    id: 'dx.reasoning',
    label: 'Lập luận chẩn đoán',
    sectionId: 'diagnosis',
    hint: 'Dữ kiện nào ủng hộ, dữ kiện nào phản đối chẩn đoán chính?',
    isSatisfied: (c) => c.diagnosis.reasoning.trim().length >= 20,
  },

  // --- Xử trí -------------------------------------------------------------
  {
    id: 'mx.nonPharm',
    label: 'Xử trí không dùng thuốc',
    sectionId: 'management',
    hint: 'Chế độ ăn, vận động, vật lý trị liệu, hỗ trợ tâm lý...',
    isSatisfied: (c) => t(c.managementPlan.nonPharmacological),
  },
  {
    id: 'mx.education',
    label: 'Giáo dục sức khỏe cho bệnh nhân',
    sectionId: 'management',
    hint: 'Bệnh nhân cần hiểu điều gì trước khi rời phòng khám?',
    isSatisfied: (c) => t(c.managementPlan.patientEducation),
  },
  {
    id: 'mx.followUpPlan',
    label: 'Kế hoạch tái khám',
    sectionId: 'management',
    hint: 'Hẹn khi nào, theo dõi chỉ số gì, dấu hiệu nào cần quay lại ngay.',
    isSatisfied: (c) => anyText(c.managementPlan.followUpInterval, c.managementPlan.followUpPlan),
  },
  {
    id: 'mx.referral',
    label: 'Quyết định chuyển tuyến',
    sectionId: 'management',
    hint: 'Ghi rõ có cần chuyển tuyến hay không và lý do.',
    isSatisfied: (c) => c.managementPlan.referral.needed !== 'unknown',
  },
  {
    id: 'mx.goals',
    label: 'Mục tiêu điều trị',
    sectionId: 'management',
    hint: 'Mục tiêu cụ thể, đo lường được, thống nhất với bệnh nhân.',
    isSatisfied: (c) => t(c.managementPlan.goalsOfCare),
  },
  {
    id: 'meds.list',
    label: 'Danh sách thuốc',
    sectionId: 'medications',
    hint: 'Tên thuốc, liều, đường dùng, số lần/ngày, chỉ định.',
    isSatisfied: (c) => c.medications.length > 0,
  },
  {
    id: 'meds.complete',
    label: 'Thuốc ghi đủ liều và chỉ định',
    sectionId: 'medications',
    hint: 'Mỗi thuốc cần có liều và lý do dùng.',
    isSatisfied: (c) => c.medications.length > 0 && c.medications.every((m) => t(m.dose) && t(m.indication)),
  },

  // --- Dự phòng -----------------------------------------------------------
  {
    id: 'prev.screenings',
    label: 'Tầm soát theo tuổi / giới',
    sectionId: 'prevention',
    hint: 'Ví dụ: huyết áp, đường huyết, lipid, Pap, mammography.',
    isSatisfied: (c) => c.prevention.screenings.some((s) => t(s.status)),
  },
  {
    id: 'prev.vaccinations',
    label: 'Tiêm chủng',
    sectionId: 'prevention',
    hint: 'Cúm, phế cầu, uốn ván, viêm gan B... theo độ tuổi.',
    isSatisfied: (c) => c.prevention.vaccinations.some((v) => t(v.status)),
  },
  {
    id: 'prev.counselling',
    label: 'Nội dung tư vấn dự phòng',
    sectionId: 'prevention',
    hint: 'Tư vấn cụ thể đã thực hiện trong lần khám này.',
    isSatisfied: (c) => t(c.prevention.counselling),
  },

  // --- Theo dõi -----------------------------------------------------------
  {
    id: 'followUp.entries',
    label: 'Ghi nhận lần theo dõi',
    sectionId: 'followUp',
    hint: 'Ít nhất một lần tái khám với đáp ứng điều trị.',
    isSatisfied: (c) => c.followUps.length > 0,
  },
  {
    id: 'reflection.learned',
    label: 'Sau ca này tôi học được gì',
    sectionId: 'reflection',
    hint: 'Viết ít nhất một điều cụ thể bạn rút ra từ ca này.',
    isSatisfied: (c) => c.reflection.learned.trim().length >= 15,
  },
  {
    id: 'reflection.nextTime',
    label: 'Lần sau sẽ làm khác thế nào',
    sectionId: 'reflection',
    hint: 'Một hành động cụ thể cho ca kế tiếp.',
    isSatisfied: (c) => t(c.reflection.nextTime) || t(c.reflection.difficulties),
  },
  {
    id: 'followUp.response',
    label: 'Đáp ứng điều trị',
    sectionId: 'followUp',
    hint: 'Triệu chứng và chỉ số thay đổi ra sao sau can thiệp?',
    isSatisfied: (c) => c.followUps.some((f) => t(f.treatmentResponse)),
  },
]

export const REQUIREMENT_BY_ID: Record<string, RequirementDef> = Object.fromEntries(
  REQUIREMENTS.map((r) => [r.id, r]),
)
