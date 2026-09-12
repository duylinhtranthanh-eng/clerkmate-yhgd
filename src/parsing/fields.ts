/**
 * The field vocabulary an AI backend is allowed to write into.
 *
 * This is the contract between three places that must never drift apart: the
 * prompt sent to the model, the validation applied to whatever comes back, and
 * the appliers in `apply.ts` that turn an accepted suggestion into record data.
 * Adding a field here is the only step needed to widen AI structuring — and
 * leaving one out is the only thing stopping the model writing there.
 *
 * Deliberately excluded in this first version: diagnosis, management,
 * investigations and examination systems. Those are the learner's reasoning,
 * not transcription.
 */

import type { SectionId } from '../config/sections'
import { norm } from './text'

export interface AiFieldDef {
  target: string
  sectionId: SectionId
  /** Shown on the suggestion card. */
  label: string
  /** One line telling the model what belongs here; sent to the proxy. */
  describe: string
  /** Extra keys the model may fill in `fields` for structured targets. */
  fields?: string[]
  /**
   * Turns a validated AI item into the payload the appliers expect.
   * Returning null rejects the suggestion — a value we cannot map is a value
   * we must not guess at.
   */
  toPayload?: (value: string, fields: Record<string, string>) => Record<string, string> | null
}

const digits = (s: string) => (s.match(/\d+(?:[.,]\d+)?/)?.[0] ?? '').replace(',', '.')

const SEX_WORDS: { re: RegExp; sex: string }[] = [
  { re: /^(nu|female|f|woman|ba|chi|co)$/, sex: 'female' },
  { re: /^(nam|male|m|man|ong|anh|chu)$/, sex: 'male' },
]

const RELATIONS = new Set(['father', 'mother', 'sibling', 'spouse', 'child'])
const RELATION_WORDS: Record<string, string> = {
  cha: 'father', bo: 'father', ba: 'father', father: 'father',
  me: 'mother', ma: 'mother', mother: 'mother',
  'anh trai': 'sibling', 'chi gai': 'sibling', 'em trai': 'sibling', 'em gai': 'sibling',
  anh: 'sibling', chi: 'sibling', em: 'sibling', sibling: 'sibling',
  vo: 'spouse', chong: 'spouse', spouse: 'spouse',
  con: 'child', 'con trai': 'child', 'con gai': 'child', child: 'child',
}

/** A vital that is just a number lands in one record field. */
function numberInto(key: string): AiFieldDef['toPayload'] {
  return (value, fields) => {
    const n = digits(fields[key] ?? value)
    return n ? { [key]: n } : null
  }
}

export const AI_FIELDS: AiFieldDef[] = [
  {
    target: 'patient.sex',
    sectionId: 'patient',
    label: 'Giới tính',
    describe: 'Giới tính bệnh nhân, chỉ khi ghi chú nói rõ. Giá trị: "Nữ" hoặc "Nam".',
    fields: ['sex'],
    toPayload: (value, fields) => {
      const raw = norm(fields.sex || value).trim()
      const hit = SEX_WORDS.find((s) => s.re.test(raw))
      return hit ? { sex: hit.sex } : null
    },
  },
  {
    target: 'patient.ageYears',
    sectionId: 'patient',
    label: 'Tuổi',
    describe: 'Tuổi tính bằng năm, chỉ số. Ví dụ: 58.',
    fields: ['age'],
    toPayload: (value, fields) => {
      const n = digits(fields.age ?? value)
      const age = Number(n)
      return Number.isFinite(age) && age > 0 && age < 130 ? { age: String(Math.round(age)) } : null
    },
  },
  {
    target: 'patient.occupation',
    sectionId: 'patient',
    label: 'Nghề nghiệp',
    describe: 'Nghề nghiệp bệnh nhân, giữ nguyên tiếng Việt có dấu.',
  },

  {
    target: 'history.chiefComplaint',
    sectionId: 'history',
    label: 'Than phiền chính',
    describe: 'Lý do đến khám, một cụm ngắn theo lời bệnh nhân.',
  },
  {
    target: 'history.duration',
    sectionId: 'history',
    label: 'Thời gian diễn tiến',
    describe: 'Triệu chứng chính đã kéo dài bao lâu. Ví dụ: "3 tháng".',
  },
  {
    target: 'history.socrates.site',
    sectionId: 'history',
    label: 'Vị trí',
    describe: 'Đau hoặc triệu chứng ở đâu. Ví dụ: "gối phải".',
  },
  {
    target: 'history.socrates.onset',
    sectionId: 'history',
    label: 'Khởi phát',
    describe: 'Bắt đầu thế nào và từ khi nào. Ví dụ: "từ từ 3 tháng".',
  },
  {
    target: 'history.socrates.character',
    sectionId: 'history',
    label: 'Tính chất',
    describe: 'Cảm giác ra sao. Ví dụ: "đau âm ỉ", "nhói".',
  },
  {
    target: 'history.socrates.radiation',
    sectionId: 'history',
    label: 'Hướng lan',
    describe: 'Có lan đi đâu không. Chỉ ghi khi người bệnh nói rõ.',
  },
  {
    target: 'history.socrates.associations',
    sectionId: 'history',
    label: 'Triệu chứng kèm',
    describe: 'Triệu chứng đi kèm được nêu rõ.',
  },
  {
    target: 'history.socrates.timeCourse',
    sectionId: 'history',
    label: 'Diễn tiến',
    describe: 'Thay đổi theo thời gian. Ví dụ: "nặng dần", "từng cơn".',
  },
  {
    target: 'history.socrates.exacerbatingRelieving',
    sectionId: 'history',
    label: 'Tăng / giảm',
    describe: 'Điều gì làm nặng hơn hoặc nhẹ hơn. Ví dụ: "tăng khi lên cầu thang, nghỉ thì đỡ".',
  },
  {
    target: 'history.socrates.severity',
    sectionId: 'history',
    label: 'Mức độ',
    describe: 'Mức độ theo lời người bệnh, thang 0–10 nếu có. Ví dụ: "6/10".',
  },
  {
    target: 'history.systemsReview.append',
    sectionId: 'history',
    label: 'Lược qua các cơ quan',
    describe: 'Chỉ những cơ quan người bệnh nói rõ là có hoặc không có triệu chứng.',
  },
  {
    target: 'history.hpi.append',
    sectionId: 'history',
    label: 'Thêm vào diễn tiến bệnh sử',
    describe: 'Câu kể diễn tiến bệnh, chép lại từ ghi chú. Không tóm tắt thêm ý mới.',
  },

  {
    target: 'redFlags.present',
    sectionId: 'history',
    label: 'Cờ đỏ — ghi nhận có',
    describe: 'Dấu hiệu nguy hiểm mà ghi chú nói rõ là CÓ. Tuyệt đối không suy đoán.',
  },
  {
    target: 'redFlags.absent',
    sectionId: 'history',
    label: 'Cờ đỏ — đã hỏi và loại trừ',
    describe: 'Dấu hiệu nguy hiểm mà ghi chú nói rõ là KHÔNG có (ví dụ "không sốt"). Chỉ khi có chữ phủ định.',
  },

  {
    target: 'ice.ideas',
    sectionId: 'history',
    label: 'ICE — bệnh nhân nghĩ mình bị gì',
    describe: 'Bệnh nhân tự nghĩ mình bị bệnh gì, chỉ khi ghi chú nói rõ.',
  },
  {
    target: 'ice.concerns',
    sectionId: 'history',
    label: 'ICE — điều bệnh nhân lo lắng',
    describe: 'Điều bệnh nhân lo sợ, chỉ khi ghi chú nói rõ.',
  },
  {
    target: 'ice.expectations',
    sectionId: 'history',
    label: 'ICE — bệnh nhân mong đợi gì',
    describe: 'Điều bệnh nhân mong muốn ở lần khám này, chỉ khi ghi chú nói rõ.',
  },

  {
    target: 'pastMedical.add',
    sectionId: 'personalHistory',
    label: 'Tiền căn bệnh',
    describe: 'Một bệnh nền đã có. Mỗi bệnh một mục.',
    fields: ['label', 'since'],
    toPayload: (value, fields) => {
      const label = (fields.label || value).trim()
      return label ? { label, since: (fields.since ?? '').trim() } : null
    },
  },
  {
    target: 'allergies.none',
    sectionId: 'personalHistory',
    label: 'Dị ứng — đã hỏi, không ghi nhận',
    describe:
      'Chỉ dùng khi người bệnh nói rõ là không dị ứng. Không suy ra từ việc ghi chú không nhắc tới dị ứng.',
  },
  {
    target: 'pastMedical.none',
    sectionId: 'personalHistory',
    label: 'Tiền căn — đã hỏi, không có bệnh nền',
    describe:
      'Chỉ dùng khi người bệnh nói rõ là không có bệnh nền. Không suy ra từ việc ghi chú không nhắc tới.',
  },
  {
    target: 'allergies.add',
    sectionId: 'personalHistory',
    label: 'Dị ứng',
    describe: 'Tác nhân gây dị ứng. Chỉ dùng khi ghi chú nói CÓ dị ứng, không dùng cho "không dị ứng".',
    fields: ['agent', 'reaction'],
    toPayload: (value, fields) => {
      const agent = (fields.agent || value).trim()
      return agent ? { agent, reaction: (fields.reaction ?? '').trim() } : null
    },
  },

  {
    target: 'lifestyle.smoking',
    sectionId: 'lifestyle',
    label: 'Hút thuốc',
    describe: 'Tình trạng hút thuốc đúng như ghi chú, ví dụ "Không hút thuốc" hoặc "Đang hút".',
    fields: ['status', 'detail'],
    toPayload: (value, fields) => {
      const status = (fields.status || value).trim()
      return status ? { status, detail: (fields.detail ?? '').trim() } : null
    },
  },
  {
    target: 'lifestyle.alcohol',
    sectionId: 'lifestyle',
    label: 'Rượu bia',
    describe: 'Tình trạng uống rượu bia đúng như ghi chú.',
    fields: ['status', 'detail'],
    toPayload: (value, fields) => {
      const status = (fields.status || value).trim()
      return status ? { status, detail: (fields.detail ?? '').trim() } : null
    },
  },
  {
    target: 'lifestyle.physicalActivity',
    sectionId: 'lifestyle',
    label: 'Vận động',
    describe: 'Mức vận động thể lực, chỉ khi ghi chú nói rõ.',
  },
  {
    target: 'lifestyle.diet',
    sectionId: 'lifestyle',
    label: 'Chế độ ăn',
    describe: 'Thói quen ăn uống, chỉ khi ghi chú nói rõ.',
  },
  {
    target: 'lifestyle.sleep',
    sectionId: 'lifestyle',
    label: 'Giấc ngủ',
    describe: 'Tình trạng giấc ngủ, chỉ khi ghi chú nói rõ.',
  },

  {
    target: 'familyHistory.add',
    sectionId: 'familyHistory',
    label: 'Tiền căn gia đình',
    describe: 'Bệnh của người thân. `condition` là tên bệnh, `relatives` là người thân (ví dụ "Mẹ").',
    fields: ['condition', 'relatives'],
    toPayload: (value, fields) => {
      const condition = (fields.condition || value).trim()
      return condition ? { condition, relatives: (fields.relatives ?? '').trim() } : null
    },
  },
  {
    target: 'familyMembers.add',
    sectionId: 'genogram',
    label: 'Thành viên gia đình (cho phả hệ)',
    describe:
      'Người thân để vẽ phả hệ. `relation` bắt buộc, một trong: father, mother, sibling, spouse, child. ' +
      '`condition` là bệnh của người đó nếu ghi chú có nói.',
    fields: ['relation', 'name', 'condition'],
    toPayload: (value, fields) => {
      let relation = norm(fields.relation ?? '').trim()
      if (!RELATIONS.has(relation)) relation = RELATION_WORDS[relation] ?? ''
      if (!RELATIONS.has(relation)) {
        // Fall back to reading the relation out of the displayed value.
        const guess = Object.entries(RELATION_WORDS).find(([word]) => norm(value).includes(word))
        relation = guess?.[1] ?? ''
      }
      if (!RELATIONS.has(relation)) return null
      const payload: Record<string, string> = { relation, name: (fields.name ?? '').trim() }
      if (relation === 'father') payload.sex = 'male'
      if (relation === 'mother') payload.sex = 'female'
      const condition = (fields.condition ?? '').trim()
      if (condition) payload.condition = condition
      return payload
    },
  },

  {
    target: 'medications.add',
    sectionId: 'medications',
    label: 'Thuốc đang dùng',
    describe: 'Một thuốc bệnh nhân đang dùng. `name` tên thuốc, `dose` liều, `frequency` số lần dùng.',
    fields: ['name', 'dose', 'frequency'],
    toPayload: (value, fields) => {
      const name = (fields.name || value).trim()
      return name
        ? { name, dose: (fields.dose ?? '').trim(), frequency: (fields.frequency ?? '').trim() }
        : null
    },
  },

  {
    target: 'vitals.bloodPressure',
    sectionId: 'examination',
    label: 'Huyết áp',
    describe: 'Huyết áp dạng "tâm thu/tâm trương", ví dụ "148/86".',
    fields: ['systolic', 'diastolic'],
    toPayload: (value, fields) => {
      const sys = digits(fields.systolic ?? '')
      const dia = digits(fields.diastolic ?? '')
      if (sys && dia) return { systolic: sys, diastolic: dia }
      const m = value.match(/(\d{2,3})\s*\/\s*(\d{2,3})/)
      return m ? { systolic: m[1], diastolic: m[2] } : null
    },
  },
  { target: 'vitals.pulse', sectionId: 'examination', label: 'Mạch', describe: 'Mạch, lần/phút, chỉ số.', fields: ['pulse'], toPayload: numberInto('pulse') },
  { target: 'vitals.temperature', sectionId: 'examination', label: 'Nhiệt độ', describe: 'Nhiệt độ °C, chỉ số.', fields: ['temperatureC'], toPayload: numberInto('temperatureC') },
  { target: 'vitals.respiratoryRate', sectionId: 'examination', label: 'Nhịp thở', describe: 'Nhịp thở, lần/phút, chỉ số.', fields: ['respiratoryRate'], toPayload: numberInto('respiratoryRate') },
  { target: 'vitals.spo2', sectionId: 'examination', label: 'SpO₂', describe: 'SpO₂ theo %, chỉ số.', fields: ['spo2'], toPayload: numberInto('spo2') },
  { target: 'vitals.weight', sectionId: 'examination', label: 'Cân nặng', describe: 'Cân nặng theo kg, chỉ số.', fields: ['weightKg'], toPayload: numberInto('weightKg') },
  { target: 'vitals.height', sectionId: 'examination', label: 'Chiều cao', describe: 'Chiều cao theo cm, chỉ số.', fields: ['heightCm'], toPayload: numberInto('heightCm') },
  { target: 'vitals.waist', sectionId: 'examination', label: 'Vòng eo', describe: 'Vòng eo theo cm, chỉ số.', fields: ['waistCm'], toPayload: numberInto('waistCm') },
]

export const AI_FIELD_BY_TARGET: Record<string, AiFieldDef> = Object.fromEntries(
  AI_FIELDS.map((f) => [f.target, f]),
)

/** The compact schema the proxy puts in the prompt. Carries no patient data. */
export function aiFieldSchema(): { target: string; label: string; describe: string; fields?: string[] }[] {
  return AI_FIELDS.map((f) => ({
    target: f.target,
    label: f.label,
    describe: f.describe,
    ...(f.fields ? { fields: f.fields } : {}),
  }))
}
