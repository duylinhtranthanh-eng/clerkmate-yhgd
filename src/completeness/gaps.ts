/**
 * What is still unasked, and a neutral way to ask it.
 *
 * This reads the record's own empty boxes and the level's requirement set —
 * nothing else. It does not know what the patient has, does not rank
 * possibilities, and does not suggest what to do: a gap here means "this field
 * is empty and your level asks for it", which is a fact about the form rather
 * than an opinion about the patient.
 *
 * It is deliberately limited to what a learner can fill by *asking*. There is
 * no point prompting someone mid-consultation for an investigation result, and
 * prompting them towards a diagnosis would be exactly the thing this product
 * refuses to do.
 */

import type { CaseRecord, RequirementTier } from '../types/case'
import { resolveLevelRequirements } from '../config/levels'
import { REQUIREMENT_BY_ID } from '../config/requirements'

export interface GapItem {
  /** The field or element, in the learner's words. */
  label: string
  filled: boolean
  /** A neutral question that would fill it. Never a recommendation. */
  prompt?: string
}

export interface GapGroup {
  title: string
  items: GapItem[]
}

const has = (s: string | null | undefined): boolean => !!s && s.trim().length > 0

/**
 * The eight SOCRATES boxes, with a plain question for each.
 *
 * The questions are elicitation prompts tied to a field, the kind printed on a
 * history-taking card — not clinical advice. Each one asks the patient to
 * describe something; none of them proposes an answer.
 */
const SOCRATES_PROMPTS: { key: keyof CaseRecord['history']['socrates']; label: string; prompt: string }[] = [
  { key: 'site', label: 'Vị trí', prompt: 'Đau ở chỗ nào, chỉ giúp tôi vị trí đau nhất?' },
  { key: 'onset', label: 'Khởi phát', prompt: 'Bắt đầu từ khi nào, và lúc đó đang làm gì?' },
  { key: 'character', label: 'Tính chất', prompt: 'Cảm giác đau như thế nào — âm ỉ, nhói, hay buốt?' },
  { key: 'radiation', label: 'Hướng lan', prompt: 'Cơn đau có lan đi đâu không?' },
  { key: 'associations', label: 'Triệu chứng kèm', prompt: 'Ngoài đau, còn triệu chứng nào đi kèm không?' },
  { key: 'timeCourse', label: 'Diễn tiến', prompt: 'Từ lúc bắt đầu tới nay nặng hơn, nhẹ hơn, hay từng cơn?' },
  {
    key: 'exacerbatingRelieving',
    label: 'Tăng / giảm',
    prompt: 'Làm gì thì đau hơn, và làm gì thì đỡ?',
  },
  { key: 'severity', label: 'Mức độ', prompt: 'Nếu 10 là đau nhất, hiện giờ khoảng mấy điểm?' },
]

const ICE_PROMPTS: { key: keyof CaseRecord['history']['ice']; label: string; prompt: string }[] = [
  { key: 'ideas', label: 'Idea — người bệnh nghĩ là gì', prompt: 'Anh/chị nghĩ mình bị gì?' },
  { key: 'concerns', label: 'Concern — điều lo nhất', prompt: 'Điều anh/chị lo nhất là gì?' },
  {
    key: 'expectations',
    label: 'Expectation — mong đợi ở lần khám này',
    prompt: 'Hôm nay anh/chị mong được giúp điều gì nhất?',
  },
]

/**
 * Requirements a learner can close by asking, with a question for each.
 *
 * Anything not listed here is left out on purpose — an examination finding or a
 * test result is not something to prompt for in the middle of a conversation.
 */
const REQUIREMENT_PROMPTS: Record<string, string> = {
  'history.chiefComplaint': 'Lý do chính hôm nay anh/chị đến khám là gì?',
  'history.hpi': 'Anh/chị kể lại giúp tôi từ lúc bắt đầu tới nay?',
  'history.redFlags': 'Có sụt cân, sốt kéo dài, đau về đêm hay yếu liệt gì không?',
  'past.medical': 'Trước giờ anh/chị có bệnh gì đang theo dõi hoặc uống thuốc lâu dài không?',
  'past.allergies': 'Anh/chị có dị ứng thuốc hay thức ăn gì không?',
  'past.reproductive': 'Kinh nguyệt, số lần sinh, và ngừa thai hiện tại thế nào?',
  'family.history': 'Trong nhà có ai bị tăng huyết áp, đái tháo đường, lao hay ung thư không?',
  'lifestyle.core': 'Anh/chị có hút thuốc, uống rượu bia không? Vận động thế nào?',
  'lifestyle.full': 'Ăn uống, giấc ngủ và công việc hằng ngày của anh/chị thế nào?',
  'history.systemsReview': 'Các cơ quan khác có gì bất thường không — tim, phổi, tiêu hoá, tiết niệu?',
  'patient.social': 'Anh/chị làm nghề gì, hiện sống ở đâu và sống với ai?',
  'fm.apgar': 'Khi có chuyện, gia đình có giúp được anh/chị không?',
  'fm.screem': 'Gia đình anh/chị có nguồn hỗ trợ nào — họ hàng, đoàn thể, bảo hiểm?',
  'fm.lifeCycle': 'Hiện nhà anh/chị có mấy người, con cái bao nhiêu tuổi?',
  'genogram.members': 'Anh/chị kể giúp tôi những người thân trong nhà và tuổi của họ?',
}

/**
 * The gaps worth showing, given the record and the level it is measured at.
 *
 * Requirements the level treats as optional are left out: a second-year being
 * nagged about SCREEM has been given a worse tool, not a better one.
 */
export function historyGaps(record: CaseRecord): GapGroup[] {
  const resolved = resolveLevelRequirements(record.learnerLevel)
  const asked = (id: string): RequirementTier | null => {
    const tier = resolved.get(id)
    return tier === 'mandatory' || tier === 'recommended' ? tier : null
  }

  const groups: GapGroup[] = []

  // SOCRATES and ICE are shown element by element, because the form has a box
  // for each and "SOCRATES chưa đủ" does not tell a learner what to ask next.
  if (asked('history.socrates')) {
    const items = SOCRATES_PROMPTS.map((s) => ({
      label: s.label,
      filled: has(record.history.socrates[s.key]),
      prompt: s.prompt,
    }))
    if (items.some((i) => !i.filled)) groups.push({ title: 'SOCRATES', items })
  }

  if (asked('history.ice')) {
    const items = ICE_PROMPTS.map((s) => ({
      label: s.label,
      filled: has(record.history.ice[s.key]),
      prompt: s.prompt,
    }))
    if (items.some((i) => !i.filled)) groups.push({ title: 'ICE', items })
  }

  // Everything else is one line per unmet requirement.
  const others: GapItem[] = []
  for (const [id, prompt] of Object.entries(REQUIREMENT_PROMPTS)) {
    if (!asked(id)) continue
    const def = REQUIREMENT_BY_ID[id]
    if (!def) continue
    if (def.appliesTo && !def.appliesTo(record)) continue
    let satisfied = false
    try {
      satisfied = def.isSatisfied(record)
    } catch {
      satisfied = false
    }
    if (!satisfied) others.push({ label: def.label, filled: false, prompt })
  }
  if (others.length > 0) groups.push({ title: 'Chưa thấy thông tin', items: others })

  return groups
}
