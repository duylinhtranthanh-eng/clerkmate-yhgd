/**
 * Cardiovascular risk.
 *
 * ClerkMate deliberately does NOT compute a risk percentage, and does not
 * pre-fill or cross-check the chart inputs either. A validated percentage
 * requires the official prediction chart for the right region (e.g. the
 * WHO/ISH chart for SEAR-B), and inventing those numbers would be worse than
 * useless in a teaching tool.
 *
 * Knowing which variables the chart needs — and transcribing them correctly —
 * is itself part of the lesson, so the learner assembles them unaided. The
 * values they used are printed in the exported record, so a teacher can check
 * the working rather than only the answer.
 *
 * Wiring an automatic lookup is a matter of adding the region's table here.
 */

export interface CvdInput {
  id: string
  label: string
  /** A line about the variable itself, not about where else to find it. */
  hint: string
  placeholder: string
}

export const CVD_INPUTS: CvdInput[] = [
  {
    id: 'age',
    label: 'Tuổi',
    hint: 'Biểu đồ nguy cơ áp dụng từ 40 tuổi.',
    placeholder: '58',
  },
  {
    id: 'sex',
    label: 'Giới tính',
    hint: 'Nam và nữ dùng hai bảng khác nhau.',
    placeholder: 'Nam / Nữ',
  },
  {
    id: 'smoking',
    label: 'Tình trạng hút thuốc',
    hint: 'Đang hút, đã bỏ, hay chưa bao giờ — biểu đồ phân biệt ba nhóm này.',
    placeholder: 'Có / Không / Đã bỏ',
  },
  {
    id: 'sbp',
    label: 'Huyết áp tâm thu',
    hint: 'Lấy trung bình của ít nhất hai lần đo, không lấy lần cao nhất.',
    placeholder: '140',
  },
  {
    id: 'diabetes',
    label: 'Đái tháo đường',
    hint: 'Có hoặc không — biểu đồ có hai bảng riêng cho hai trường hợp.',
    placeholder: 'Có / Không',
  },
  {
    id: 'cholesterol',
    label: 'Cholesterol toàn phần',
    hint: 'Chỉ cần khi dùng bảng có xét nghiệm; bảng không xét nghiệm bỏ trống ô này.',
    placeholder: '5,2 mmol/L',
  },
]

export const CVD_CHARTS = [
  'WHO/ISH — khu vực SEAR-B, bản không cần xét nghiệm',
  'WHO/ISH — khu vực SEAR-B, bản có xét nghiệm',
  'Bảng của bộ môn / hướng dẫn Bộ Y tế',
  'Khác',
]

export const CVD_BANDS = ['< 10%', '10 — < 20%', '20 — < 30%', '≥ 30%']
