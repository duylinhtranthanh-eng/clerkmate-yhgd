import { Badge, Card, Chip, Field, Notice, TextArea, TextInput } from '../../components/Ui'
import {
  APGAR_ITEMS,
  APGAR_OPTIONS,
  FAMILY_LIFE_CYCLE_STAGES,
  FAMILY_TYPES,
  SCREEM_DOMAINS,
  interpretApgar,
} from '../../config/clinical'
import type { SectionProps } from './types'

export function FmAssessmentSection({ record, update }: SectionProps) {
  const fm = record.familyMedicineAssessment
  const scores = APGAR_ITEMS.map((i) => fm.apgar[i.key])
  const answered = scores.filter((s) => s !== null).length
  const total = scores.reduce<number>((a, s) => a + (s ?? 0), 0)

  return (
    <>
      <Card title="Kiểu gia đình">
        <div className="chips">
          {FAMILY_TYPES.map((t) => (
            <Chip
              key={t}
              small
              on={fm.familyType === t}
              onClick={() =>
                update((d) => {
                  d.familyMedicineAssessment.familyType =
                    d.familyMedicineAssessment.familyType === t ? '' : t
                })
              }
            >
              {t}
            </Chip>
          ))}
        </div>
      </Card>

      <Card
        title="Chu kỳ sống gia đình"
        hint="Theo Duvall. Cùng một dữ liệu với tab Phả hệ — sửa ở đâu cũng được."
      >
        <div className="stack stack--tight">
          {FAMILY_LIFE_CYCLE_STAGES.map((s) => (
            <button
              key={s}
              type="button"
              className="chip"
              data-on={fm.familyLifeCycleStage === s ? 'true' : 'false'}
              style={{ textAlign: 'left', borderRadius: 'var(--r-md)' }}
              onClick={() =>
                update((d) => {
                  d.familyMedicineAssessment.familyLifeCycleStage =
                    d.familyMedicineAssessment.familyLifeCycleStage === s ? '' : s
                })
              }
            >
              {s}
            </button>
          ))}
        </div>
        <div style={{ marginTop: 14 }}>
          <Field label="Nhận định về giai đoạn này">
            <TextArea
              rows={3}
              value={fm.familyLifeCycleNote}
              onChange={(e) =>
                update((d) => void (d.familyMedicineAssessment.familyLifeCycleNote = e.target.value))
              }
              placeholder="Nhiệm vụ phát triển, khủng hoảng đang gặp, ảnh hưởng lên sức khỏe…"
            />
          </Field>
        </div>
      </Card>

      <Card
        title="Family APGAR"
        action={
          answered === 5 ? (
            <Badge tone={total >= 7 ? 'ok' : total >= 4 ? 'warn' : 'danger'}>
              {total}/10 — {interpretApgar(total)}
            </Badge>
          ) : (
            <Badge tone="muted">{answered}/5 mục</Badge>
          )
        }
        hint="Bệnh nhân tự đánh giá mức hài lòng với chức năng gia đình."
      >
        <div className="stack">
          {APGAR_ITEMS.map((item) => (
            <div key={item.key}>
              <div style={{ fontWeight: 600, fontSize: 13.5 }}>{item.label}</div>
              <div className="small muted" style={{ margin: '2px 0 8px' }}>
                {item.question}
              </div>
              <div className="chips">
                {APGAR_OPTIONS.map((o) => (
                  <Chip
                    key={o.value}
                    small
                    on={fm.apgar[item.key] === o.value}
                    onClick={() =>
                      update((d) => {
                        const cur = d.familyMedicineAssessment.apgar[item.key]
                        d.familyMedicineAssessment.apgar[item.key] = cur === o.value ? null : o.value
                      })
                    }
                  >
                    {o.label} ({o.value})
                  </Chip>
                ))}
              </div>
            </div>
          ))}
        </div>
        <div style={{ marginTop: 16 }}>
          <Field label="Nhận xét">
            <TextArea
              rows={2}
              value={fm.apgar.note}
              onChange={(e) => update((d) => void (d.familyMedicineAssessment.apgar.note = e.target.value))}
            />
          </Field>
        </div>
        {answered > 0 && answered < 5 && (
          <Notice tone="warn">Cần chấm đủ 5 mục thì tổng điểm APGAR mới có ý nghĩa diễn giải.</Notice>
        )}
      </Card>

      <Card title="SCREEM" hint="Nguồn lực và điểm yếu của gia đình trong sáu lĩnh vực.">
        <div className="stack">
          {SCREEM_DOMAINS.map((d0) => (
            <div key={d0.key}>
              <div style={{ fontWeight: 600, fontSize: 13.5 }}>{d0.label}</div>
              <div className="small muted" style={{ margin: '2px 0 8px' }}>
                {d0.prompt}
              </div>
              <Field label="Nguồn lực">
                <TextInput
                  value={fm.screem[d0.key].resources}
                  onChange={(e) =>
                    update((d) => void (d.familyMedicineAssessment.screem[d0.key].resources = e.target.value))
                  }
                />
              </Field>
              <Field label="Điểm yếu / trở ngại">
                <TextInput
                  value={fm.screem[d0.key].pathology}
                  onChange={(e) =>
                    update((d) => void (d.familyMedicineAssessment.screem[d0.key].pathology = e.target.value))
                  }
                />
              </Field>
            </div>
          ))}
        </div>
      </Card>

      <Card title="Môi trường sống và chăm sóc liên tục">
        <Field label="Môi trường sống / thăm nhà">
          <TextArea
            rows={3}
            value={fm.homeEnvironment}
            onChange={(e) => update((d) => void (d.familyMedicineAssessment.homeEnvironment = e.target.value))}
            placeholder="Nhà cấp 4, cầu thang dốc, nhà vệ sinh trơn, cách trạm y tế 2 km…"
          />
        </Field>
        <Field label="Tính liên tục trong chăm sóc">
          <TextArea
            rows={3}
            value={fm.continuityNote}
            onChange={(e) => update((d) => void (d.familyMedicineAssessment.continuityNote = e.target.value))}
            placeholder="Ai theo dõi lâu dài, tần suất tái khám, phối hợp tuyến trên…"
          />
        </Field>
      </Card>
    </>
  )
}
