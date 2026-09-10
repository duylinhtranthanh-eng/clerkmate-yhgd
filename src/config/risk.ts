/**
 * Health-risk catalogue, ordered as a teaching sequence.
 *
 * The order is the lesson: emergency risks first (what could kill this patient
 * today), then behaviour and cardiometabolic risk, then the risks that depend
 * on who the patient is — cancer screening, geriatric syndromes, cognition —
 * and finally the psychosocial layer that Family Medicine is built on.
 *
 * Every factor carries a `why` so the checklist teaches while it is being used,
 * and `appliesWhen` keeps the list short: a 25-year-old is not asked about
 * falls, and prostate risk never shows for a female patient.
 */

import type { CaseRecord, LearnerLevel, Sex } from '../types/case'
import { norm } from '../parsing/text'
import type { SectionId } from './sections'

export type RiskDomainId =
  | 'emergency'
  | 'behavioural'
  | 'cardiometabolic'
  | 'cancer'
  | 'geriatric'
  | 'cognitive'
  | 'psychological'
  | 'social'
  | 'environmental'

export interface RiskDomainDef {
  id: RiskDomainId
  /** 1-based position in the teaching sequence. */
  step: number
  label: string
  icon: string
  /** Why this domain comes here — shown when the learner opens it. */
  teachingNote: string
  /**
   * When set, the domain is read from an instrument the learner already filled
   * instead of asking the same questions again.
   */
  derivedFrom?: { instrument: 'screem'; sectionId: SectionId }
  /**
   * Structural prompts shown instead of the item list once the scaffolding has
   * faded. They give the *shape* of the thinking without giving the answers.
   */
  prompts?: string[]
  /**
   * Safety-critical domains keep their full checklist at every level.
   *
   * Checklists are the right tool for do-not-forget items and the wrong tool
   * for generative reasoning — which is why surgical and aviation checklists
   * are used by experts, not withdrawn from them. A senior learner forgetting
   * to ask about suicidal ideation is a miss, not a teachable moment.
   */
  alwaysChecklist?: boolean
}

/**
 * How much scaffolding a learner gets for a domain.
 *
 * `checklist` — the full item list, ticked off (appropriate for a novice who
 *   has no schema to recall from yet).
 * `recallThenChecklist` — write from memory first, then the list appears with
 *   what you mentioned badged.
 * `generate` — no item list. Only the structural prompts; the learner types
 *   their own list and commits it. The catalogue then becomes an after-action
 *   review rather than a crutch.
 */
export type RiskDomainMode = 'checklist' | 'recallThenChecklist' | 'generate'

export interface RiskApplicabilityContext {
  sex: Sex
  ageYears: number | null
  /**
   * Derived hints, so a factor can apply for a clinical reason and not only
   * because of age: a 58-year-old with knee osteoarthritis and quadriceps
   * wasting needs a falls assessment as much as a 70-year-old does.
   */
  mobilityConcern: boolean
  smokingHistory: boolean
}

const MOBILITY_TERMS = [
  'thoai hoa khop', 'khop goi', 'khop hang', 'parkinson', 'dot quy', 'tai bien',
  'yeu chi', 'liet', 'te nga', 'di lai kho', 'khap khieng', 'chong mat', 'loang xuong',
  'gay xuong', 'benh ly than kinh ngoai bien',
]

/** Builds the gating context from whatever the learner has documented so far. */
export function riskContext(record: CaseRecord): RiskApplicabilityContext {
  const haystack = norm(
    [
      record.history.chiefComplaint,
      record.history.hpi,
      record.diagnosis.primary?.label ?? '',
      ...record.personalHistory.pastMedical.map((p) => p.label),
      ...record.examination.systems
        .filter((sys) => sys.status === 'abnormal')
        .map((sys) => `${sys.label} ${sys.findings}`),
      record.examination.generalAppearance,
    ].join(' | '),
  )

  const smoking = norm(`${record.lifestyle.smoking.status} ${record.lifestyle.smoking.detail}`)

  return {
    sex: record.patient.sex,
    ageYears: record.patient.ageYears,
    mobilityConcern: MOBILITY_TERMS.some((t) => haystack.includes(t)),
    smokingHistory: /hut thuoc|thuoc la|goi-nam|goi nam/.test(smoking) && !/khong hut/.test(smoking),
  }
}

export interface RiskFactorDef {
  id: string
  label: string
  domain: RiskDomainId
  /** One line the learner can actually learn from. */
  why: string
  appliesWhen?: (ctx: RiskApplicabilityContext) => boolean
}

export const RISK_DOMAINS: RiskDomainDef[] = [
  {
    id: 'emergency',
    step: 1,
    label: 'Nguy cơ cấp cứu',
    icon: '🚨',
    teachingNote:
      'Luôn rà soát đầu tiên: điều gì có thể gây nguy hiểm cho bệnh nhân ngay hôm nay? Nếu có, xử trí hoặc chuyển tuyến trước khi bàn đến bệnh mạn tính.',
    alwaysChecklist: true,
  },
  {
    id: 'behavioural',
    step: 2,
    label: 'Hành vi — lối sống',
    icon: '🚶',
    teachingNote:
      'Bốn hành vi cốt lõi (thuốc lá, rượu, vận động, dinh dưỡng) chi phối phần lớn bệnh không lây nhiễm và là nơi can thiệp hiệu quả nhất ở tuyến đầu.',
    prompts: ['Chất gây nghiện', 'Vận động thể lực', 'Dinh dưỡng', 'Giấc ngủ'],
  },
  {
    id: 'cardiometabolic',
    step: 3,
    label: 'Tim mạch — chuyển hóa',
    icon: '❤️',
    teachingNote:
      'Nhóm nguy cơ cộng dồn: mỗi yếu tố tăng thêm nguy cơ biến cố tim mạch. Rà soát đủ để tính được nguy cơ tổng thể, không chỉ từng bệnh riêng lẻ.',
    prompts: [
      'Chỉ số chuyển hóa đo được',
      'Hành vi góp phần',
      'Tiền căn gia đình',
      'Tổn thương cơ quan đích đã có',
    ],
  },
  {
    id: 'cancer',
    step: 4,
    label: 'Ung thư — theo tuổi và giới',
    icon: '🎗️',
    teachingNote:
      'Chỉ hỏi những gì phù hợp với đối tượng. Danh sách dưới đây đã tự lọc theo tuổi và giới của bệnh nhân trong phần hành chính.',
    prompts: [
      'Tầm soát theo tuổi',
      'Tầm soát theo giới',
      'Nhiễm trùng và phơi nhiễm mạn tính',
      'Tiền căn gia đình',
    ],
  },
  {
    id: 'geriatric',
    step: 5,
    label: 'Lão khoa',
    icon: '🦯',
    teachingNote:
      'Hội chứng lão khoa thường bị bỏ sót vì không nằm trong một chuyên khoa nào. Té ngã, đa thuốc và suy yếu tiên đoán kết cục tốt hơn cả danh sách bệnh.',
    prompts: [
      'Vận động, thăng bằng và té ngã',
      'Thuốc đang dùng',
      'Dinh dưỡng và cân nặng',
      'Giác quan',
      'Chức năng và tự chủ',
    ],
  },
  {
    id: 'cognitive',
    step: 6,
    label: 'Nhận thức',
    icon: '🧠',
    teachingNote:
      'Suy giảm nhận thức ảnh hưởng trực tiếp đến khả năng tuân thủ điều trị và sự an toàn tại nhà.',
    prompts: ['Trí nhớ và định hướng', 'Yếu tố nguy cơ điều chỉnh được', 'Ảnh hưởng lên tuân thủ điều trị'],
  },
  {
    id: 'psychological',
    step: 7,
    label: 'Tâm lý',
    icon: '💭',
    teachingNote:
      'Trầm cảm, lo âu và mất ngủ vừa là bệnh đồng mắc vừa là rào cản điều trị. Hỏi trực tiếp — bệnh nhân ít khi tự nêu.',
    prompts: ['Khí sắc', 'Lo âu', 'Mất mát và sang chấn', 'Niềm tin về bệnh'],
  },
  {
    id: 'social',
    step: 8,
    label: 'Xã hội — đọc từ SCREEM',
    icon: '🤝',
    teachingNote:
      'Nhóm này không hỏi lại: SCREEM và Family APGAR trong phần Đánh giá YHGĐ đã bao trùm mạng lưới hỗ trợ, kinh tế, học vấn và khả năng tiếp cận y tế. Ở đây chỉ đọc lại kết quả và bổ sung câu cần hỏi riêng.',
    derivedFrom: { instrument: 'screem', sectionId: 'fmAssessment' },
  },
  {
    id: 'environmental',
    step: 9,
    label: 'Môi trường — nghề nghiệp',
    icon: '🏭',
    teachingNote:
      'Nơi bệnh nhân sống và làm việc có thể là nguyên nhân trực tiếp của bệnh, và là nơi can thiệp bền vững nhất.',
    prompts: ['Nghề nghiệp', 'Nhà ở', 'Nước và vệ sinh'],
  },
]

export const RISK_DOMAIN_BY_ID: Record<RiskDomainId, RiskDomainDef> = Object.fromEntries(
  RISK_DOMAINS.map((d) => [d.id, d]),
) as Record<RiskDomainId, RiskDomainDef>

const atLeast = (age: number) => (ctx: RiskApplicabilityContext) =>
  ctx.ageYears === null || ctx.ageYears >= age
const between = (lo: number, hi: number) => (ctx: RiskApplicabilityContext) =>
  ctx.ageYears === null || (ctx.ageYears >= lo && ctx.ageYears <= hi)
const isFemale = (ctx: RiskApplicabilityContext) => ctx.sex === 'female' || ctx.sex === 'unknown'
const isMale = (ctx: RiskApplicabilityContext) => ctx.sex === 'male' || ctx.sex === 'unknown'

export const RISK_FACTOR_DEFS: RiskFactorDef[] = [
  // --- 1. emergency --------------------------------------------------------
  {
    id: 'em.chestPain',
    label: 'Đau ngực nghi do mạch vành',
    domain: 'emergency',
    why: 'Cần loại trừ hội chứng vành cấp trước mọi chẩn đoán khác.',
  },
  {
    id: 'em.dyspnoea',
    label: 'Khó thở cấp / SpO₂ giảm',
    domain: 'emergency',
    why: 'Suy hô hấp tiến triển nhanh; đo SpO₂ ngay tại phòng khám.',
  },
  {
    id: 'em.neuroDeficit',
    label: 'Dấu thần kinh khu trú mới xuất hiện',
    domain: 'emergency',
    why: 'Đột quỵ có cửa sổ điều trị tính bằng giờ.',
  },
  {
    id: 'em.severeHypertension',
    label: 'Huyết áp ≥ 180/110 mmHg',
    domain: 'emergency',
    why: 'Phân biệt tăng huyết áp cấp cứu (có tổn thương cơ quan đích) với tăng huyết áp khẩn trương.',
  },
  {
    id: 'em.sepsis',
    label: 'Sốt kèm rối loạn tri giác hoặc tụt huyết áp',
    domain: 'emergency',
    why: 'Gợi ý nhiễm khuẩn huyết — mỗi giờ chậm trễ làm tăng tử vong.',
  },
  {
    id: 'em.bleeding',
    label: 'Xuất huyết đang diễn tiến',
    domain: 'emergency',
    why: 'Nôn máu, tiêu phân đen, ho ra máu, rong huyết nhiều.',
  },
  {
    id: 'em.suicidal',
    label: 'Ý tưởng hoặc kế hoạch tự sát',
    domain: 'emergency',
    why: 'Phải hỏi trực tiếp khi có dấu hiệu trầm cảm; đánh giá mức độ an toàn ngay.',
  },
  {
    id: 'em.violence',
    label: 'Bạo lực đang xảy ra với bệnh nhân',
    domain: 'emergency',
    why: 'An toàn của bệnh nhân được ưu tiên trước kế hoạch điều trị.',
  },
  {
    id: 'em.hypoglycaemia',
    label: 'Cơn hạ đường huyết',
    domain: 'emergency',
    why: 'Ở bệnh nhân dùng sulfonylurea hoặc insulin, hạ đường huyết là cấp cứu và là nguyên nhân té ngã hay gặp nhất bị bỏ sót.',
  },
  {
    id: 'em.headTrauma',
    label: 'Té ngã có va đầu',
    domain: 'emergency',
    why: 'Nguy cơ xuất huyết nội sọ, đặc biệt khi đang dùng thuốc chống đông hoặc kháng kết tập tiểu cầu.',
  },
  {
    id: 'em.dehydration',
    label: 'Mất nước nặng / không ăn uống được',
    domain: 'emergency',
    why: 'Thường gặp ở người cao tuổi và trẻ nhỏ, dễ bị đánh giá thấp.',
  },

  // --- 2. behavioural ------------------------------------------------------
  {
    id: 'bh.smoking',
    label: 'Hút thuốc lá',
    domain: 'behavioural',
    why: 'Yếu tố nguy cơ đơn lẻ có thể phòng ngừa quan trọng nhất; ghi rõ số gói-năm.',
  },
  {
    id: 'bh.secondhandSmoke',
    label: 'Hút thuốc thụ động trong nhà',
    domain: 'behavioural',
    why: 'Ảnh hưởng trẻ em và người có bệnh hô hấp sống cùng nhà.',
  },
  {
    id: 'bh.alcohol',
    label: 'Uống rượu bia mức nguy hại',
    domain: 'behavioural',
    why: 'Sàng lọc bằng AUDIT-C; liên quan gan, tim mạch, chấn thương và tâm thần.',
  },
  {
    id: 'bh.inactivity',
    label: 'Ít vận động thể lực',
    domain: 'behavioural',
    why: 'Dưới 150 phút hoạt động cường độ trung bình mỗi tuần.',
  },
  {
    id: 'bh.diet',
    label: 'Ăn mặn, nhiều đường, ít rau quả',
    domain: 'behavioural',
    why: 'Đích can thiệp cụ thể và đo lường được trong tư vấn.',
  },
  {
    id: 'bh.substance',
    label: 'Sử dụng chất gây nghiện khác',
    domain: 'behavioural',
    why: 'Hỏi không phán xét; ảnh hưởng tuân thủ và tương tác thuốc.',
  },
  {
    id: 'bh.sleep',
    label: 'Ngủ không đủ hoặc mất ngủ kéo dài',
    domain: 'behavioural',
    why: 'Liên quan tăng huyết áp, chuyển hóa và sức khỏe tâm thần.',
  },

  // --- 3. cardiometabolic --------------------------------------------------
  {
    id: 'cm.hypertension',
    label: 'Tăng huyết áp',
    domain: 'cardiometabolic',
    why: 'Nguyên nhân hàng đầu của đột quỵ và bệnh thận mạn tại Việt Nam.',
  },
  {
    id: 'cm.diabetes',
    label: 'Đái tháo đường hoặc tiền đái tháo đường',
    domain: 'cardiometabolic',
    why: 'Tiền đái tháo đường vẫn can thiệp đảo ngược được bằng lối sống.',
  },
  {
    id: 'cm.dyslipidemia',
    label: 'Rối loạn lipid máu',
    domain: 'cardiometabolic',
    why: 'Quyết định chỉ định statin cùng với nguy cơ tim mạch tổng thể.',
  },
  {
    id: 'cm.obesity',
    label: 'Thừa cân — béo phì (ngưỡng châu Á)',
    domain: 'cardiometabolic',
    why: 'BMI ≥ 23 là thừa cân, ≥ 25 là béo phì theo ngưỡng châu Á.',
  },
  {
    id: 'cm.centralObesity',
    label: 'Béo trung tâm (vòng eo nam ≥ 90, nữ ≥ 80 cm)',
    domain: 'cardiometabolic',
    why: 'Dự báo nguy cơ chuyển hóa tốt hơn BMI ở người châu Á.',
  },
  {
    id: 'cm.familyCvd',
    label: 'Gia đình có bệnh tim mạch khởi phát sớm',
    domain: 'cardiometabolic',
    why: 'Nam < 55 tuổi, nữ < 65 tuổi ở người thân bậc một.',
  },
  {
    id: 'cm.ckd',
    label: 'Bệnh thận mạn / albumin niệu',
    domain: 'cardiometabolic',
    why: 'Vừa là hậu quả vừa là yếu tố khuếch đại nguy cơ tim mạch.',
  },
  {
    id: 'cm.atrialFibrillation',
    label: 'Rung nhĩ hoặc mạch không đều',
    domain: 'cardiometabolic',
    why: 'Bắt mạch mỗi lần khám ở người ≥ 65 tuổi để phát hiện sớm.',
    appliesWhen: atLeast(40),
  },

  // --- 4. cancer (tuỳ đối tượng) ------------------------------------------
  {
    id: 'ca.cervix',
    label: 'Chưa tầm soát ung thư cổ tử cung',
    domain: 'cancer',
    why: 'Nữ 21–65 tuổi: Pap hoặc HPV theo định kỳ.',
    appliesWhen: (ctx) => isFemale(ctx) && between(21, 65)(ctx),
  },
  {
    id: 'ca.breast',
    label: 'Chưa tầm soát ung thư vú',
    domain: 'cancer',
    why: 'Nữ ≥ 40 tuổi: nhũ ảnh định kỳ, kèm hướng dẫn tự khám vú.',
    appliesWhen: (ctx) => isFemale(ctx) && atLeast(40)(ctx),
  },
  {
    id: 'ca.colorectal',
    label: 'Chưa tầm soát ung thư đại trực tràng',
    domain: 'cancer',
    why: 'Từ 45 tuổi: xét nghiệm máu ẩn trong phân hoặc nội soi.',
    appliesWhen: atLeast(45),
  },
  {
    id: 'ca.prostate',
    label: 'Chưa bàn về tầm soát ung thư tuyến tiền liệt',
    domain: 'cancer',
    why: 'Nam ≥ 50 tuổi: quyết định chung sau khi giải thích lợi ích và tác hại.',
    appliesWhen: (ctx) => isMale(ctx) && atLeast(50)(ctx),
  },
  {
    id: 'ca.lung',
    label: 'Nguy cơ ung thư phổi do thuốc lá',
    domain: 'cancer',
    why: 'Tiền căn hút thuốc nhiều ở người ≥ 50 tuổi cần bàn về tầm soát.',
    appliesWhen: (ctx) => atLeast(50)(ctx) && (ctx.smokingHistory || ctx.ageYears === null),
  },
  {
    id: 'ca.liver',
    label: 'Nguy cơ ung thư gan (viêm gan B/C, xơ gan)',
    domain: 'cancer',
    why: 'Việt Nam có tỷ lệ viêm gan B cao — người mang virus cần theo dõi định kỳ.',
  },
  {
    id: 'ca.stomach',
    label: 'Nguy cơ ung thư dạ dày',
    domain: 'cancer',
    why: 'H. pylori, viêm teo dạ dày hoặc gia đình có ung thư dạ dày.',
    appliesWhen: atLeast(40),
  },
  {
    id: 'ca.familyEarly',
    label: 'Gia đình có ung thư khởi phát sớm',
    domain: 'cancer',
    why: 'Gợi ý hội chứng di truyền, cần tầm soát sớm hơn tuổi thường quy.',
  },

  // --- 5. geriatric --------------------------------------------------------
  {
    id: 'ge.falls',
    label: 'Nguy cơ té ngã',
    domain: 'geriatric',
    why: 'Hỏi về té ngã trong 12 tháng qua; té ngã dự báo mất chức năng và tử vong. Có thang đánh giá mức độ ở cuối nhóm này.',
    appliesWhen: (ctx) => atLeast(60)(ctx) || ctx.mobilityConcern,
  },
  {
    id: 'ge.homeHazard',
    label: 'Nhà ở có yếu tố gây té ngã',
    domain: 'geriatric',
    why: 'Cầu thang dốc, nền trơn, thiếu tay vịn, thiếu ánh sáng ban đêm.',
    appliesWhen: (ctx) => atLeast(60)(ctx) || ctx.mobilityConcern,
  },
  {
    id: 'ge.polypharmacy',
    label: 'Dùng nhiều thuốc (≥ 5 loại)',
    domain: 'geriatric',
    why: 'Tăng tương tác, tác dụng phụ và nguy cơ té ngã; cân nhắc giảm thuốc.',
    appliesWhen: atLeast(60),
  },
  {
    id: 'ge.frailty',
    label: 'Suy yếu — giảm hoạt động chức năng',
    domain: 'geriatric',
    why: 'Đi chậm, yếu sức, sụt cân, kiệt sức, ít hoạt động.',
    appliesWhen: (ctx) => atLeast(65)(ctx) || ctx.mobilityConcern,
  },
  {
    id: 'ge.sensory',
    label: 'Giảm thị lực hoặc thính lực',
    domain: 'geriatric',
    why: 'Gây cô lập xã hội, sai sót dùng thuốc và té ngã.',
    appliesWhen: atLeast(60),
  },
  {
    id: 'ge.malnutrition',
    label: 'Suy dinh dưỡng hoặc sụt cân không chủ ý',
    domain: 'geriatric',
    why: 'Vừa là dấu hiệu bệnh nặng, vừa là yếu tố nguy cơ độc lập.',
    appliesWhen: atLeast(60),
  },
  {
    id: 'ge.incontinence',
    label: 'Tiểu không tự chủ',
    domain: 'geriatric',
    why: 'Hiếm khi được bệnh nhân tự nêu nhưng ảnh hưởng lớn chất lượng sống.',
    appliesWhen: atLeast(60),
  },
  {
    id: 'ge.osteoporosis',
    label: 'Loãng xương hoặc tiền căn gãy xương do loãng xương',
    domain: 'geriatric',
    why: 'Gãy cổ xương đùi ở người cao tuổi có tỷ lệ tử vong một năm rất cao.',
    appliesWhen: atLeast(50),
  },

  // --- 6. cognitive --------------------------------------------------------
  {
    id: 'cg.memoryComplaint',
    label: 'Bệnh nhân hoặc gia đình lo về giảm trí nhớ',
    domain: 'cognitive',
    why: 'Người nhà thường phát hiện trước bệnh nhân — nên hỏi cả hai.',
    appliesWhen: atLeast(60),
  },
  {
    id: 'cg.dementiaRisk',
    label: 'Nguy cơ sa sút trí tuệ',
    domain: 'cognitive',
    why: 'Tuổi cao, tăng huyết áp, đái tháo đường, giảm thính lực, ít vận động, cô lập xã hội.',
    appliesWhen: atLeast(60),
  },
  {
    id: 'cg.delirium',
    label: 'Từng có lú lẫn cấp (mê sảng)',
    domain: 'cognitive',
    why: 'Báo hiệu não dễ tổn thương; thường do nhiễm trùng hoặc thuốc.',
    appliesWhen: atLeast(65),
  },
  {
    id: 'cg.adherence',
    label: 'Khó ghi nhớ và tuân thủ dùng thuốc',
    domain: 'cognitive',
    why: 'Quyết định việc cần hộp chia thuốc, đơn giản hóa toa hay người hỗ trợ.',
  },

  // --- 7. psychological ----------------------------------------------------
  {
    id: 'ps.depression',
    label: 'Dấu hiệu trầm cảm',
    domain: 'psychological',
    why: 'Sàng lọc PHQ-2: khí sắc trầm và mất hứng thú trong 2 tuần qua.',
  },
  {
    id: 'ps.anxiety',
    label: 'Dấu hiệu lo âu',
    domain: 'psychological',
    why: 'Sàng lọc GAD-2; thường biểu hiện bằng triệu chứng cơ thể.',
  },
  {
    id: 'ps.chronicStress',
    label: 'Căng thẳng tâm lý kéo dài',
    domain: 'psychological',
    why: 'Ảnh hưởng huyết áp, giấc ngủ, hành vi sức khỏe và tuân thủ.',
  },
  {
    id: 'ps.grief',
    label: 'Mất người thân gần đây',
    domain: 'psychological',
    why: 'Giai đoạn nguy cơ cao về sức khỏe thể chất và tâm thần.',
  },
  {
    id: 'ps.caregiverBurden',
    label: 'Gánh nặng người chăm sóc',
    domain: 'psychological',
    why: 'Người chăm sóc kiệt sức là nguy cơ cho cả hai — bệnh nhân và họ.',
  },
  {
    id: 'ps.illnessBelief',
    label: 'Niềm tin sai lệch về bệnh gây trở ngại điều trị',
    domain: 'psychological',
    why: 'Khai thác qua ICE; là điểm khởi đầu của tư vấn hiệu quả.',
  },

  // --- 8. social (SCREEM covers the rest — see RISK_DOMAINS.derivedFrom) ------
  {
    id: 'so.domesticViolence',
    label: 'Bạo lực gia đình (hiện tại hoặc tiền căn)',
    domain: 'social',
    why: 'SCREEM không hỏi điều này. Phải hỏi riêng, không hỏi trước mặt người đi cùng.',
  },
  // --- 9. environmental ----------------------------------------------------
  {
    id: 'en.occupational',
    label: 'Phơi nhiễm nghề nghiệp',
    domain: 'environmental',
    why: 'Bụi, hóa chất, tiếng ồn, thuốc trừ sâu, tư thế lao động.',
  },
  {
    id: 'en.indoorSmoke',
    label: 'Khói bếp than, củi trong nhà',
    domain: 'environmental',
    why: 'Nguyên nhân quan trọng của bệnh phổi tắc nghẽn mạn tính ở phụ nữ nông thôn.',
  },
  {
    id: 'en.housing',
    label: 'Nhà ở chật, ẩm, thông khí kém',
    domain: 'environmental',
    why: 'Liên quan lao, nhiễm khuẩn hô hấp và hen.',
  },
  {
    id: 'en.waterSanitation',
    label: 'Nước sạch và vệ sinh không bảo đảm',
    domain: 'environmental',
    why: 'Nguy cơ bệnh tiêu hóa và ký sinh trùng.',
  },
]

/**
 * Scaffolding fades as the learner advances: a Y2 student has no schema to
 * recall from and needs the list; an SDH learner who only recognises risks off
 * a list has not learnt anything ClerkMate was built to teach.
 *
 * Editable by the teaching team, like every other rule in `config/`.
 */
export const RISK_MODE_BY_LEVEL: Record<LearnerLevel, RiskDomainMode> = {
  Y2: 'checklist',
  Y5: 'recallThenChecklist',
  Y6: 'generate',
  SDH: 'generate',
}

export function riskModeFor(level: LearnerLevel, domain: RiskDomainDef): RiskDomainMode {
  if (domain.derivedFrom) return 'checklist'
  if (domain.alwaysChecklist) return 'checklist'
  // A domain with no prompts has nothing to scaffold generation with.
  const mode = RISK_MODE_BY_LEVEL[level]
  if (mode === 'generate' && (!domain.prompts || domain.prompts.length === 0)) {
    return 'recallThenChecklist'
  }
  return mode
}

export function applicableRiskFactors(ctx: RiskApplicabilityContext): RiskFactorDef[] {
  return RISK_FACTOR_DEFS.filter((f) => !f.appliesWhen || f.appliesWhen(ctx))
}

export const RISK_FACTOR_DEF_BY_ID: Record<string, RiskFactorDef> = Object.fromEntries(
  RISK_FACTOR_DEFS.map((f) => [f.id, f]),
)
