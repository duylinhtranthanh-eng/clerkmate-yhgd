/**
 * Graded falls assessment.
 *
 * Screening questions follow the CDC STEADI "Stay Independent" three-question
 * screen, with Timed Up and Go as the performance measure. The banding rule is
 * ClerkMate's own and is printed on screen so the learner can see exactly how
 * the level was reached — no hidden scoring.
 */

import type { FallsAssessment } from '../types/case'

export interface FallsQuestionDef {
  key: 'fellPastYear' | 'feelsUnsteady' | 'worriesAboutFalling'
  question: string
  why: string
}

export const FALLS_QUESTIONS: FallsQuestionDef[] = [
  {
    key: 'fellPastYear',
    question: 'Trong 12 tháng qua ông/bà có bị té ngã lần nào không?',
    why: 'Té ngã trước đó là yếu tố tiên đoán mạnh nhất cho lần té tiếp theo.',
  },
  {
    key: 'feelsUnsteady',
    question: 'Ông/bà có cảm thấy mất vững khi đứng hoặc khi đi lại không?',
    why: 'Cảm giác mất vững gợi ý rối loạn dáng đi hoặc thăng bằng.',
  },
  {
    key: 'worriesAboutFalling',
    question: 'Ông/bà có lo sợ bị té ngã không?',
    why: 'Sợ té làm giảm vận động, dẫn tới yếu cơ và càng dễ té hơn.',
  },
]

/** Timed Up and Go: ≥ 12 giây gợi ý tăng nguy cơ té ngã. */
export const TUG_CUTOFF_SECONDS = 12

export interface FallsBand {
  level: 'low' | 'moderate' | 'high' | null
  label: string
  tone: 'ok' | 'warn' | 'danger'
  /** The specific findings that produced this level. */
  reasons: string[]
}

export const FALLS_RULE_TEXT = [
  'Cao: té ≥ 2 lần trong 12 tháng, HOẶC té có chấn thương, HOẶC TUG ≥ 12 giây.',
  'Trung bình: té 1 lần không chấn thương, HOẶC có cảm giác mất vững, HOẶC lo sợ té ngã.',
  'Thấp: trả lời “không” cho cả ba câu sàng lọc.',
]

export function fallsBand(f: FallsAssessment): FallsBand {
  const answered =
    f.fellPastYear !== 'unknown' ||
    f.feelsUnsteady !== 'unknown' ||
    f.worriesAboutFalling !== 'unknown' ||
    f.timedUpAndGoSeconds.trim() !== ''
  if (!answered) {
    return { level: null, label: 'Chưa đánh giá', tone: 'warn', reasons: [] }
  }

  const count = parseInt(f.fallCount.replace(/\D/g, ''), 10)
  const tug = parseFloat(f.timedUpAndGoSeconds.replace(',', '.'))
  const high: string[] = []
  const moderate: string[] = []

  if (Number.isFinite(count) && count >= 2) high.push(`Té ${count} lần trong 12 tháng`)
  if (f.injured === 'yes') high.push('Té có chấn thương')
  if (Number.isFinite(tug) && tug >= TUG_CUTOFF_SECONDS) high.push(`TUG ${tug} giây (≥ ${TUG_CUTOFF_SECONDS})`)

  if (f.fellPastYear === 'yes' && high.length === 0) moderate.push('Có té ngã trong 12 tháng qua')
  if (f.feelsUnsteady === 'yes') moderate.push('Cảm giác mất vững khi đi lại')
  if (f.worriesAboutFalling === 'yes') moderate.push('Lo sợ bị té ngã')

  if (high.length > 0) {
    return { level: 'high', label: 'Nguy cơ té ngã cao', tone: 'danger', reasons: [...high, ...moderate] }
  }
  if (moderate.length > 0) {
    return { level: 'moderate', label: 'Nguy cơ té ngã trung bình', tone: 'warn', reasons: moderate }
  }
  return {
    level: 'low',
    label: 'Nguy cơ té ngã thấp',
    tone: 'ok',
    reasons: ['Cả ba câu sàng lọc đều âm tính'],
  }
}

/** Interventions to consider, shown once a level is known. */
export const FALLS_ACTIONS: Record<'moderate' | 'high', string[]> = {
  moderate: [
    'Hướng dẫn bài tập thăng bằng và tăng sức cơ chi dưới',
    'Rà soát thuốc gây chóng mặt, hạ huyết áp thế đứng',
    'Kiểm tra thị lực',
  ],
  high: [
    'Đánh giá dáng đi, sức cơ và thăng bằng chi tiết',
    'Rà soát và giảm bớt thuốc nguy cơ cao',
    'Can thiệp an toàn nhà ở: tay vịn, thảm chống trơn, đủ sáng ban đêm',
    'Đánh giá vitamin D và mật độ xương',
    'Cân nhắc chuyển vật lý trị liệu',
  ],
}
