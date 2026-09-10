import type { ExamStatus } from '../../types/case'
import { Badge, Card, Chip, Field, TextArea, TextInput } from '../../components/Ui'
import { EXAM_NORMAL_BY_ID } from '../../config/clinical'
import { bmiCategory, computeBmi } from '../../utils/format'
import type { SectionProps } from './types'

const STATUS_OPTIONS: { value: ExamStatus; label: string; tone?: 'ok' | 'danger' }[] = [
  { value: 'unchecked', label: 'Chưa khám' },
  { value: 'normal', label: 'Bình thường', tone: 'ok' },
  { value: 'abnormal', label: 'Bất thường', tone: 'danger' },
]

export function ExaminationSection({ record, update }: SectionProps) {
  const ex = record.examination
  const v = ex.vitals
  const bmi = computeBmi(v.heightCm, v.weightKg)

  const normalCount = ex.systems.filter((s) => s.status === 'normal').length
  const abnormalCount = ex.systems.filter((s) => s.status === 'abnormal').length

  /**
   * Choosing a status is the learner's confirmation, so writing the standard
   * normal phrase here is a one-tap entry rather than an auto-fill. Text the
   * learner has typed themselves is never overwritten.
   */
  const setStatus = (index: number, status: ExamStatus) =>
    update((d) => {
      const sys = d.examination.systems[index]
      const template = EXAM_NORMAL_BY_ID[sys.id] ?? ''
      const isTemplate = sys.findings.trim() === '' || sys.findings.trim() === template
      sys.status = status
      if (status === 'normal' && isTemplate) sys.findings = template
      if (status === 'unchecked' && isTemplate) sys.findings = ''
      if (status === 'abnormal' && sys.findings.trim() === template) sys.findings = ''
    })

  const markAllNormal = () =>
    update((d) => {
      for (const sys of d.examination.systems) {
        if (sys.status === 'abnormal') continue
        const template = EXAM_NORMAL_BY_ID[sys.id] ?? ''
        sys.status = 'normal'
        if (sys.findings.trim() === '') sys.findings = template
      }
    })

  const resetAll = () =>
    update((d) => {
      for (const sys of d.examination.systems) {
        const template = EXAM_NORMAL_BY_ID[sys.id] ?? ''
        if (sys.findings.trim() === template) sys.findings = ''
        sys.status = 'unchecked'
      }
    })

  const setVital = (key: keyof typeof v, value: string) =>
    update((d) => {
      d.examination.vitals[key] = value
      d.examination.vitals.bmi = computeBmi(
        d.examination.vitals.heightCm,
        d.examination.vitals.weightKg,
      )
    })

  return (
    <>
      <Card title="Sinh hiệu">
        <div className="grid-2">
          <Field label="Huyết áp tâm thu (mmHg)">
            <TextInput inputMode="numeric" value={v.systolic} onChange={(e) => setVital('systolic', e.target.value)} placeholder="140" />
          </Field>
          <Field label="Huyết áp tâm trương">
            <TextInput inputMode="numeric" value={v.diastolic} onChange={(e) => setVital('diastolic', e.target.value)} placeholder="85" />
          </Field>
        </div>
        <div className="grid-3">
          <Field label="Mạch">
            <TextInput inputMode="numeric" value={v.pulse} onChange={(e) => setVital('pulse', e.target.value)} placeholder="78" />
          </Field>
          <Field label="Nhịp thở">
            <TextInput inputMode="numeric" value={v.respiratoryRate} onChange={(e) => setVital('respiratoryRate', e.target.value)} placeholder="18" />
          </Field>
          <Field label="Nhiệt độ °C">
            <TextInput inputMode="decimal" value={v.temperatureC} onChange={(e) => setVital('temperatureC', e.target.value)} placeholder="37" />
          </Field>
        </div>
        <div className="grid-3">
          <Field label="SpO₂ %">
            <TextInput inputMode="numeric" value={v.spo2} onChange={(e) => setVital('spo2', e.target.value)} placeholder="97" />
          </Field>
          <Field label="Chiều cao (cm)">
            <TextInput inputMode="numeric" value={v.heightCm} onChange={(e) => setVital('heightCm', e.target.value)} placeholder="155" />
          </Field>
          <Field label="Cân nặng (kg)">
            <TextInput inputMode="decimal" value={v.weightKg} onChange={(e) => setVital('weightKg', e.target.value)} placeholder="62" />
          </Field>
        </div>
        <div className="grid-2">
          <Field label="Vòng eo (cm)">
            <TextInput inputMode="numeric" value={v.waistCm} onChange={(e) => setVital('waistCm', e.target.value)} placeholder="86" />
          </Field>
          <Field label="BMI" help="Ngưỡng châu Á (WHO Asia-Pacific)">
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, minHeight: 44 }}>
              {bmi ? (
                <>
                  <strong className="mono">{bmi}</strong>
                  <Badge tone={bmiCategory(bmi) === 'Bình thường' ? 'ok' : 'warn'}>{bmiCategory(bmi)}</Badge>
                </>
              ) : (
                <span className="small muted">Nhập chiều cao và cân nặng</span>
              )}
            </div>
          </Field>
        </div>
      </Card>

      <Card title="Tổng trạng">
        <TextArea
          rows={3}
          value={ex.generalAppearance}
          onChange={(e) => update((d) => void (d.examination.generalAppearance = e.target.value))}
          placeholder="Tỉnh, tiếp xúc tốt, da niêm hồng, không phù…"
        />
      </Card>

      <Card
        title="Khám theo cơ quan"
        action={
          <Badge tone={normalCount + abnormalCount > 0 ? 'brand' : 'muted'}>
            {normalCount + abnormalCount}/{ex.systems.length}
          </Badge>
        }
        hint="Bình thường thì một chạm là xong. Chỉ cần mô tả khi bất thường."
      >
        <div className="btn-row" style={{ marginBottom: 14 }}>
          <button type="button" className="btn btn--soft btn--sm" onClick={markAllNormal}>
            ✓ Tất cả bình thường
          </button>
          {normalCount + abnormalCount > 0 && (
            <button type="button" className="btn btn--secondary btn--sm" onClick={resetAll}>
              Xóa hết đánh dấu
            </button>
          )}
        </div>

        <div className="stack">
          {ex.systems.map((s, i) => (
            <div
              key={s.id}
              style={{
                borderTop: i === 0 ? 'none' : '1px solid var(--line)',
                paddingTop: i === 0 ? 0 : 'var(--sp-3)',
              }}
            >
              <strong style={{ display: 'block', fontSize: 14, marginBottom: 7 }}>{s.label}</strong>
              <div className="chips" style={{ marginBottom: 8 }}>
                {STATUS_OPTIONS.map((o) => (
                  <Chip
                    key={o.value}
                    small
                    tone={o.tone}
                    on={s.status === o.value}
                    onClick={() => setStatus(i, o.value)}
                  >
                    {o.label}
                  </Chip>
                ))}
              </div>
              {s.status !== 'unchecked' && (
                <TextArea
                  rows={s.status === 'normal' ? 2 : 3}
                  value={s.findings}
                  onChange={(e) => update((d) => void (d.examination.systems[i].findings = e.target.value))}
                  placeholder={
                    s.status === 'abnormal'
                      ? `Mô tả bất thường khi khám ${s.label.toLowerCase()}`
                      : 'Câu mô tả bình thường — có thể sửa lại'
                  }
                />
              )}
            </div>
          ))}
        </div>
      </Card>

      <Card title="Ghi chú khám thêm">
        <TextArea
          rows={3}
          value={ex.note}
          onChange={(e) => update((d) => void (d.examination.note = e.target.value))}
        />
      </Card>
    </>
  )
}
