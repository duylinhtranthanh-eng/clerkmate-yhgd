/**
 * Rating scales.
 *
 * Licensing matters here. PHQ-2/PHQ-9 and GAD-2/GAD-7 are free to reproduce and
 * use without permission, so their items ship with the app. HADS is a licensed
 * instrument (Snaith & Zigmond, distributed by GL Assessment), so ClerkMate
 * does NOT reprint its items — it records the subscale scores the learner
 * obtained from the official form.
 *
 * The Vietnamese item wording below is a working translation for teaching, not
 * a formally validated Vietnamese version. If the department has a validated
 * translation, replace the `text` fields — nothing else needs to change.
 */

import type { RiskDomainId } from './risk'

export type ScaleId = 'phq2' | 'phq9' | 'gad2' | 'gad7' | 'hads' | 'isi' | 'minicog'

export interface ScaleOption {
  value: number
  label: string
}

export interface ScaleItemDef {
  text: string
  /** Overrides the scale's shared options — Mini-Cog scores its two parts differently. */
  options?: ScaleOption[]
  hint?: string
}

export interface ScaleBand {
  max: number
  label: string
  tone: 'ok' | 'warn' | 'danger'
}

export interface ScaleSubscale {
  id: string
  label: string
  maxScore: number
  bands: ScaleBand[]
}

export interface ScaleDef {
  id: ScaleId
  name: string
  fullName: string
  domain: RiskDomainId
  purpose: string
  timeframe: string
  /** 'open' — items included. 'licensed' — score entry only. */
  availability: 'open' | 'licensed'
  licenseNote: string
  items: ScaleItemDef[]
  options: ScaleOption[]
  bands: ScaleBand[]
  /** For licensed scales scored as a single total rather than subscales. */
  maxScore?: number
  /** Total at or above which the screen is considered positive. */
  positiveAt: number | null
  /** Scale to offer next when this one screens positive. */
  followUp?: ScaleId
  subscales?: ScaleSubscale[]
  /** 0-based index of an item that needs immediate attention when > 0. */
  safetyItemIndex?: number
}

const FREQUENCY_OPTIONS: ScaleOption[] = [
  { value: 0, label: 'Không hề' },
  { value: 1, label: 'Vài ngày' },
  { value: 2, label: 'Hơn nửa số ngày' },
  { value: 3, label: 'Gần như mỗi ngày' },
]

const PHQ9_ITEMS: ScaleItemDef[] = ([
  'Ít thấy thích thú hoặc ít thấy vui khi làm việc gì',
  'Cảm thấy buồn, chán nản hoặc mất hy vọng',
  'Khó vào giấc ngủ, khó ngủ tiếp, hoặc ngủ quá nhiều',
  'Cảm thấy mệt mỏi hoặc ít năng lượng',
  'Ăn kém hoặc ăn quá nhiều',
  'Cảm thấy tệ về bản thân — thấy mình thất bại hoặc làm gia đình thất vọng',
  'Khó tập trung, ví dụ khi đọc báo hoặc xem tivi',
  'Vận động hoặc nói chậm hẳn đến mức người khác nhận ra; hoặc ngược lại, bồn chồn không ngồi yên được',
  'Có ý nghĩ rằng thà chết đi thì tốt hơn, hoặc nghĩ đến việc tự làm hại mình',
] as string[]).map((text) => ({ text }))

const GAD7_ITEMS: ScaleItemDef[] = ([
  'Cảm thấy bồn chồn, lo lắng hoặc căng thẳng',
  'Không thể ngừng lo hoặc không kiểm soát được sự lo lắng',
  'Lo quá nhiều về những chuyện khác nhau',
  'Khó thư giãn',
  'Bứt rứt đến mức khó ngồi yên',
  'Dễ bực mình hoặc dễ nổi nóng',
  'Cảm thấy sợ như thể điều gì tồi tệ sắp xảy ra',
] as string[]).map((text) => ({ text }))

export const SCALES: Record<ScaleId, ScaleDef> = {
  phq2: {
    id: 'phq2',
    name: 'PHQ-2',
    fullName: 'Patient Health Questionnaire — 2 câu sàng lọc trầm cảm',
    domain: 'psychological',
    purpose: 'Sàng lọc nhanh trầm cảm bằng 2 câu. Dương tính thì làm tiếp PHQ-9.',
    timeframe: 'Trong 2 tuần qua, bạn có bị các vấn đề sau làm khó chịu không?',
    availability: 'open',
    licenseNote: 'PHQ là công cụ miễn phí, không cần xin phép để sử dụng.',
    items: PHQ9_ITEMS.slice(0, 2),
    options: FREQUENCY_OPTIONS,
    bands: [
      { max: 2, label: 'Âm tính', tone: 'ok' },
      { max: 6, label: 'Dương tính — cần làm PHQ-9', tone: 'warn' },
    ],
    positiveAt: 3,
    followUp: 'phq9',
  },

  phq9: {
    id: 'phq9',
    name: 'PHQ-9',
    fullName: 'Patient Health Questionnaire — 9 câu, đánh giá mức độ trầm cảm',
    domain: 'psychological',
    purpose: 'Đánh giá mức độ trầm cảm và theo dõi đáp ứng điều trị.',
    timeframe: 'Trong 2 tuần qua, bạn có bị các vấn đề sau làm khó chịu không?',
    availability: 'open',
    licenseNote: 'PHQ là công cụ miễn phí, không cần xin phép để sử dụng.',
    items: PHQ9_ITEMS,
    options: FREQUENCY_OPTIONS,
    bands: [
      { max: 4, label: 'Tối thiểu', tone: 'ok' },
      { max: 9, label: 'Nhẹ', tone: 'warn' },
      { max: 14, label: 'Trung bình', tone: 'warn' },
      { max: 19, label: 'Trung bình — nặng', tone: 'danger' },
      { max: 27, label: 'Nặng', tone: 'danger' },
    ],
    positiveAt: 10,
    safetyItemIndex: 8,
  },

  gad2: {
    id: 'gad2',
    name: 'GAD-2',
    fullName: 'Generalized Anxiety Disorder — 2 câu sàng lọc lo âu',
    domain: 'psychological',
    purpose: 'Sàng lọc nhanh lo âu bằng 2 câu. Dương tính thì làm tiếp GAD-7.',
    timeframe: 'Trong 2 tuần qua, bạn có bị các vấn đề sau làm khó chịu không?',
    availability: 'open',
    licenseNote: 'GAD-7 là công cụ miễn phí, không cần xin phép để sử dụng.',
    items: GAD7_ITEMS.slice(0, 2),
    options: FREQUENCY_OPTIONS,
    bands: [
      { max: 2, label: 'Âm tính', tone: 'ok' },
      { max: 6, label: 'Dương tính — cần làm GAD-7', tone: 'warn' },
    ],
    positiveAt: 3,
    followUp: 'gad7',
  },

  gad7: {
    id: 'gad7',
    name: 'GAD-7',
    fullName: 'Generalized Anxiety Disorder — 7 câu, đánh giá mức độ lo âu',
    domain: 'psychological',
    purpose: 'Đánh giá mức độ lo âu lan tỏa và theo dõi đáp ứng điều trị.',
    timeframe: 'Trong 2 tuần qua, bạn có bị các vấn đề sau làm khó chịu không?',
    availability: 'open',
    licenseNote: 'GAD-7 là công cụ miễn phí, không cần xin phép để sử dụng.',
    items: GAD7_ITEMS,
    options: FREQUENCY_OPTIONS,
    bands: [
      { max: 4, label: 'Tối thiểu', tone: 'ok' },
      { max: 9, label: 'Nhẹ', tone: 'warn' },
      { max: 14, label: 'Trung bình', tone: 'warn' },
      { max: 21, label: 'Nặng', tone: 'danger' },
    ],
    positiveAt: 10,
  },

  hads: {
    id: 'hads',
    name: 'HADS',
    fullName: 'Hospital Anxiety and Depression Scale',
    domain: 'psychological',
    purpose:
      'Đánh giá lo âu và trầm cảm ở bệnh nhân có bệnh thực thể. ClerkMate chỉ ghi lại điểm bạn đã chấm trên bản gốc.',
    timeframe: 'Theo hướng dẫn của bản HADS gốc',
    availability: 'licensed',
    licenseNote:
      'HADS là công cụ có bản quyền (Snaith & Zigmond, GL Assessment). ClerkMate không in lại 14 câu hỏi — bạn chấm trên bản chính thức của bộ môn rồi nhập điểm hai phân thang vào đây.',
    items: [],
    options: FREQUENCY_OPTIONS,
    bands: [],
    positiveAt: null,
    subscales: [
      {
        id: 'anxiety',
        label: 'HADS-A (lo âu)',
        maxScore: 21,
        bands: [
          { max: 7, label: 'Bình thường', tone: 'ok' },
          { max: 10, label: 'Ranh giới', tone: 'warn' },
          { max: 21, label: 'Bất thường', tone: 'danger' },
        ],
      },
      {
        id: 'depression',
        label: 'HADS-D (trầm cảm)',
        maxScore: 21,
        bands: [
          { max: 7, label: 'Bình thường', tone: 'ok' },
          { max: 10, label: 'Ranh giới', tone: 'warn' },
          { max: 21, label: 'Bất thường', tone: 'danger' },
        ],
      },
    ],
  },

  isi: {
    id: 'isi',
    name: 'ISI',
    fullName: 'Insomnia Severity Index — mức độ mất ngủ',
    domain: 'psychological',
    purpose:
      'Đánh giá mức độ mất ngủ và theo dõi đáp ứng can thiệp. ClerkMate chỉ ghi lại tổng điểm bạn đã chấm trên bản gốc.',
    timeframe: '2 tuần qua, theo hướng dẫn của bản ISI',
    availability: 'licensed',
    licenseNote:
      'ISI là công cụ có bản quyền (Morin). ClerkMate không in lại 7 câu hỏi — bạn chấm trên bản chính thức của bộ môn rồi nhập tổng điểm (0–28) vào đây.',
    items: [],
    options: FREQUENCY_OPTIONS,
    maxScore: 28,
    bands: [
      { max: 7, label: 'Không mất ngủ đáng kể', tone: 'ok' },
      { max: 14, label: 'Mất ngủ dưới ngưỡng', tone: 'warn' },
      { max: 21, label: 'Mất ngủ mức trung bình', tone: 'danger' },
      { max: 28, label: 'Mất ngủ mức nặng', tone: 'danger' },
    ],
    positiveAt: 15,
  },

  minicog: {
    id: 'minicog',
    name: 'Mini-Cog',
    fullName: 'Mini-Cog — sàng lọc suy giảm nhận thức trong 3 phút',
    domain: 'cognitive',
    purpose:
      'Sàng lọc nhanh suy giảm nhận thức tại tuyến đầu. Dương tính thì đánh giá sâu hơn, không phải là chẩn đoán sa sút trí tuệ.',
    timeframe:
      'Đọc 3 từ cho bệnh nhân nhắc lại, cho vẽ mặt đồng hồ chỉ 11 giờ 10, rồi hỏi lại 3 từ ban đầu.',
    availability: 'open',
    licenseNote: 'Mini-Cog là công cụ miễn phí, không cần xin phép để sử dụng trong lâm sàng và giảng dạy.',
    items: [
      {
        text: 'Nhắc lại 3 từ sau khi vẽ đồng hồ (mỗi từ đúng 1 điểm)',
        hint: 'Bộ từ thường dùng: Chuối — Bình minh — Cái ghế. Không gợi ý, không nhắc.',
        options: [
          { value: 0, label: '0 từ' },
          { value: 1, label: '1 từ' },
          { value: 2, label: '2 từ' },
          { value: 3, label: '3 từ' },
        ],
      },
      {
        text: 'Vẽ mặt đồng hồ chỉ 11 giờ 10',
        hint: 'Bình thường (2 điểm) khi có đủ các số ở đúng vị trí và hai kim chỉ đúng giờ được yêu cầu.',
        options: [
          { value: 0, label: 'Bất thường (0)' },
          { value: 2, label: 'Bình thường (2)' },
        ],
      },
    ],
    options: [],
    bands: [
      { max: 2, label: 'Dương tính — cần đánh giá nhận thức sâu hơn', tone: 'danger' },
      { max: 5, label: 'Âm tính', tone: 'ok' },
    ],
    positiveAt: null,
  },
}

/** Scales offered inside each risk domain, in the order they should be used. */
export const SCALES_BY_DOMAIN: Partial<Record<RiskDomainId, ScaleId[]>> = {
  psychological: ['phq2', 'phq9', 'gad2', 'gad7', 'hads', 'isi'],
  cognitive: ['minicog'],
}

/** Scales a learner starts with; follow-ups appear only when triggered. */
export const ENTRY_SCALES: ScaleId[] = ['phq2', 'gad2']
