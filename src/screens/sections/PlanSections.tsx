import type { YesNoUnknown } from '../../types/case'
import { Card, Chip, Field, Select, TextArea, TextInput } from '../../components/Ui'
import { RepeatList } from '../../components/RepeatList'
import { MEDICATION_FREQUENCIES, MEDICATION_ROUTES } from '../../config/clinical'
import { uid } from '../../utils/id'
import type { SectionProps } from './types'

const YES_NO: { value: YesNoUnknown; label: string }[] = [
  { value: 'yes', label: 'Có' },
  { value: 'no', label: 'Không' },
  { value: 'unknown', label: 'Chưa quyết định' },
]

export function ManagementSection({ record, update }: SectionProps) {
  const mp = record.managementPlan
  return (
    <>
      <Card title="Xử trí không dùng thuốc">
        <TextArea
          rows={4}
          value={mp.nonPharmacological}
          onChange={(e) => update((d) => void (d.managementPlan.nonPharmacological = e.target.value))}
          placeholder="Giảm cân, tập cơ tứ đầu đùi, giảm muối, vật lý trị liệu…"
        />
      </Card>

      <Card title="Giáo dục sức khỏe" hint="Điều bệnh nhân cần hiểu trước khi rời phòng khám.">
        <TextArea
          rows={4}
          value={mp.patientEducation}
          onChange={(e) => update((d) => void (d.managementPlan.patientEducation = e.target.value))}
        />
      </Card>

      <Card title="Mục tiêu điều trị">
        <TextArea
          rows={3}
          value={mp.goalsOfCare}
          onChange={(e) => update((d) => void (d.managementPlan.goalsOfCare = e.target.value))}
          placeholder="HA mục tiêu < 140/90 trong 3 tháng; đi bộ được 15 phút không đau…"
        />
      </Card>

      <Card title="Kế hoạch tái khám">
        <Field label="Hẹn tái khám sau">
          <TextInput
            value={mp.followUpInterval}
            onChange={(e) => update((d) => void (d.managementPlan.followUpInterval = e.target.value))}
            placeholder="2 tuần"
          />
        </Field>
        <Field label="Nội dung theo dõi" help="Theo dõi chỉ số gì, dấu hiệu nào cần quay lại ngay.">
          <TextArea
            rows={3}
            value={mp.followUpPlan}
            onChange={(e) => update((d) => void (d.managementPlan.followUpPlan = e.target.value))}
          />
        </Field>
      </Card>

      <Card title="Chuyển tuyến">
        <Field label="Có cần chuyển tuyến?">
          <div className="chips">
            {YES_NO.map((o) => (
              <Chip
                key={o.value}
                on={mp.referral.needed === o.value}
                onClick={() => update((d) => void (d.managementPlan.referral.needed = o.value))}
              >
                {o.label}
              </Chip>
            ))}
          </div>
        </Field>
        {mp.referral.needed === 'yes' && (
          <>
            <Field label="Chuyển đến">
              <TextInput
                value={mp.referral.destination}
                onChange={(e) => update((d) => void (d.managementPlan.referral.destination = e.target.value))}
                placeholder="Chuyên khoa Cơ xương khớp"
              />
            </Field>
            <div className="grid-2">
              <Field label="Lý do">
                <TextInput
                  value={mp.referral.reason}
                  onChange={(e) => update((d) => void (d.managementPlan.referral.reason = e.target.value))}
                />
              </Field>
              <Field label="Mức độ khẩn">
                <TextInput
                  value={mp.referral.urgency}
                  onChange={(e) => update((d) => void (d.managementPlan.referral.urgency = e.target.value))}
                  placeholder="Thường quy / Sớm"
                />
              </Field>
            </div>
          </>
        )}
        <div className="hr" />
        <Field label="Có cần nhập viện?">
          <div className="chips">
            {YES_NO.map((o) => (
              <Chip
                key={o.value}
                on={mp.hospitalization.needed === o.value}
                onClick={() => update((d) => void (d.managementPlan.hospitalization.needed = o.value))}
              >
                {o.label}
              </Chip>
            ))}
          </div>
        </Field>
        {mp.hospitalization.needed === 'yes' && (
          <Field label="Lý do nhập viện">
            <TextInput
              value={mp.hospitalization.reason}
              onChange={(e) => update((d) => void (d.managementPlan.hospitalization.reason = e.target.value))}
            />
          </Field>
        )}
      </Card>
    </>
  )
}

export function MedicationsSection({ record, update }: SectionProps) {
  return (
    <Card title="Thuốc" hint="Ghi đủ liều, đường dùng, số lần/ngày và chỉ định.">
      <RepeatList
        items={record.medications}
        addLabel="Thêm thuốc"
        emptyLabel="Chưa kê thuốc nào."
        onAdd={() =>
          update((d) =>
            void d.medications.push({
              id: uid('med'),
              name: '',
              dose: '',
              route: 'Uống',
              frequency: '',
              duration: '',
              indication: '',
              adherence: '',
              note: '',
            }),
          )
        }
        onRemove={(id) =>
          update((d) => {
            d.medications = d.medications.filter((x) => x.id !== id)
          })
        }
        render={(item, i) => (
          <>
            <Field label="Tên thuốc">
              <TextInput
                value={item.name}
                onChange={(e) => update((d) => void (d.medications[i].name = e.target.value))}
                placeholder="Amlodipine"
              />
            </Field>
            <div className="grid-2">
              <Field label="Liều">
                <TextInput
                  value={item.dose}
                  onChange={(e) => update((d) => void (d.medications[i].dose = e.target.value))}
                  placeholder="5 mg"
                />
              </Field>
              <Field label="Đường dùng">
                <Select
                  value={item.route}
                  onChange={(e) => update((d) => void (d.medications[i].route = e.target.value))}
                  options={MEDICATION_ROUTES.map((r) => ({ value: r, label: r }))}
                />
              </Field>
            </div>
            <div className="grid-2">
              <Field label="Số lần dùng">
                <Select
                  value={item.frequency}
                  onChange={(e) => update((d) => void (d.medications[i].frequency = e.target.value))}
                  options={MEDICATION_FREQUENCIES.map((f) => ({ value: f, label: f }))}
                />
              </Field>
              <Field label="Thời gian">
                <TextInput
                  value={item.duration}
                  onChange={(e) => update((d) => void (d.medications[i].duration = e.target.value))}
                  placeholder="30 ngày"
                />
              </Field>
            </div>
            <Field label="Chỉ định">
              <TextInput
                value={item.indication}
                onChange={(e) => update((d) => void (d.medications[i].indication = e.target.value))}
                placeholder="Kiểm soát huyết áp"
              />
            </Field>
            <Field label="Tuân thủ / ghi chú">
              <TextInput
                value={item.adherence}
                onChange={(e) => update((d) => void (d.medications[i].adherence = e.target.value))}
                placeholder="Quên thuốc 2 lần/tuần"
              />
            </Field>
          </>
        )}
      />
    </Card>
  )
}

export function PreventionSection({ record, update }: SectionProps) {
  const pv = record.prevention
  return (
    <>
      <Card title="Tầm soát" hint="Chọn tình trạng cho từng nội dung tầm soát phù hợp tuổi và giới.">
        <div className="stack stack--tight">
          {pv.screenings.map((s, i) => (
            <div key={s.id}>
              <div className="row-between" style={{ gap: 10 }}>
                <span style={{ fontSize: 14, flex: 1 }}>{s.name}</span>
                <div className="chips">
                  {['Đã làm', 'Cần làm', 'Không phù hợp'].map((st) => (
                    <Chip
                      key={st}
                      small
                      tone={st === 'Đã làm' ? 'ok' : undefined}
                      on={s.status === st}
                      onClick={() =>
                        update((d) => {
                          d.prevention.screenings[i].status = d.prevention.screenings[i].status === st ? '' : st
                        })
                      }
                    >
                      {st}
                    </Chip>
                  ))}
                </div>
              </div>
              {s.status === 'Đã làm' && (
                <div className="grid-2" style={{ marginTop: 8 }}>
                  <TextInput
                    type="date"
                    value={s.date}
                    onChange={(e) => update((d) => void (d.prevention.screenings[i].date = e.target.value))}
                  />
                  <TextInput
                    value={s.result}
                    placeholder="Kết quả"
                    onChange={(e) => update((d) => void (d.prevention.screenings[i].result = e.target.value))}
                  />
                </div>
              )}
            </div>
          ))}
        </div>
      </Card>

      <Card title="Tiêm chủng">
        <div className="stack stack--tight">
          {pv.vaccinations.map((v, i) => (
            <div key={v.id} className="row-between" style={{ gap: 10 }}>
              <span style={{ fontSize: 14, flex: 1 }}>{v.name}</span>
              <div className="chips">
                {['Đã tiêm', 'Cần tiêm', 'Không phù hợp'].map((st) => (
                  <Chip
                    key={st}
                    small
                    tone={st === 'Đã tiêm' ? 'ok' : undefined}
                    on={v.status === st}
                    onClick={() =>
                      update((d) => {
                        d.prevention.vaccinations[i].status = d.prevention.vaccinations[i].status === st ? '' : st
                      })
                    }
                  >
                    {st}
                  </Chip>
                ))}
              </div>
            </div>
          ))}
        </div>
      </Card>

      <Card title="Tư vấn dự phòng">
        <Field label="Nội dung đã tư vấn trong lần khám này">
          <TextArea
            rows={4}
            value={pv.counselling}
            onChange={(e) => update((d) => void (d.prevention.counselling = e.target.value))}
            placeholder="Tư vấn giảm muối, tăng vận động, nhận biết dấu hiệu nguy hiểm…"
          />
        </Field>
        <Field label="Kế hoạch nâng cao sức khỏe">
          <TextArea
            rows={3}
            value={pv.healthMaintenanceNote}
            onChange={(e) => update((d) => void (d.prevention.healthMaintenanceNote = e.target.value))}
          />
        </Field>
      </Card>
    </>
  )
}

export function FollowUpSection({ record, update }: SectionProps) {
  return (
    <Card title="Theo dõi dọc" hint="Mỗi lần tái khám ghi theo cấu trúc SOAP kèm đáp ứng điều trị.">
      <RepeatList
        items={record.followUps}
        addLabel="Thêm lần theo dõi"
        emptyLabel="Chưa có lần theo dõi nào."
        onAdd={() =>
          update((d) =>
            void d.followUps.push({
              id: uid('fu'),
              date: '',
              subjective: '',
              objective: '',
              assessment: '',
              plan: '',
              treatmentResponse: '',
              adherence: '',
              adverseEffects: '',
            }),
          )
        }
        onRemove={(id) =>
          update((d) => {
            d.followUps = d.followUps.filter((x) => x.id !== id)
          })
        }
        render={(item, i) => (
          <>
            <Field label="Ngày tái khám">
              <TextInput
                type="date"
                value={item.date}
                onChange={(e) => update((d) => void (d.followUps[i].date = e.target.value))}
              />
            </Field>
            <Field label="S — Bệnh nhân kể">
              <TextArea rows={2} value={item.subjective} onChange={(e) => update((d) => void (d.followUps[i].subjective = e.target.value))} />
            </Field>
            <Field label="O — Khám và cận lâm sàng">
              <TextArea rows={2} value={item.objective} onChange={(e) => update((d) => void (d.followUps[i].objective = e.target.value))} />
            </Field>
            <Field label="A — Đánh giá">
              <TextArea rows={2} value={item.assessment} onChange={(e) => update((d) => void (d.followUps[i].assessment = e.target.value))} />
            </Field>
            <Field label="P — Kế hoạch">
              <TextArea rows={2} value={item.plan} onChange={(e) => update((d) => void (d.followUps[i].plan = e.target.value))} />
            </Field>
            <Field label="Đáp ứng điều trị">
              <TextInput value={item.treatmentResponse} onChange={(e) => update((d) => void (d.followUps[i].treatmentResponse = e.target.value))} placeholder="Đau giảm từ 7/10 còn 3/10" />
            </Field>
            <div className="grid-2">
              <Field label="Tuân thủ">
                <TextInput value={item.adherence} onChange={(e) => update((d) => void (d.followUps[i].adherence = e.target.value))} />
              </Field>
              <Field label="Tác dụng phụ">
                <TextInput value={item.adverseEffects} onChange={(e) => update((d) => void (d.followUps[i].adverseEffects = e.target.value))} />
              </Field>
            </div>
          </>
        )}
      />
    </Card>
  )
}
