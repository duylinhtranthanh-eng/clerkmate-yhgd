import type { Sex } from '../../types/case'
import { Card, Chip, Field, Select, TextArea, TextInput } from '../../components/Ui'
import type { SectionProps } from './types'

const INSURANCE_OPTIONS = ['Có bảo hiểm y tế', 'Không có bảo hiểm y tế', 'Chưa rõ']

const SEX_OPTIONS: { value: Sex; label: string }[] = [
  { value: 'female', label: 'Nữ' },
  { value: 'male', label: 'Nam' },
  { value: 'other', label: 'Khác' },
]

export function PatientSection({ record, update }: SectionProps) {
  const p = record.patient
  return (
    <>
      <Card title="Thông tin hành chính" hint="Chỉ dùng bệnh nhân giả lập hoặc dữ liệu đã ẩn danh.">
        <Field label="Tên hoặc mã ca">
          <TextInput
            value={p.name}
            onChange={(e) => update((d) => void (d.patient.name = e.target.value))}
            placeholder="Ví dụ: Bà H. / Ca 01"
          />
        </Field>

        <Field label="Giới tính">
          <div className="chips">
            {SEX_OPTIONS.map((o) => (
              <Chip
                key={o.value}
                on={p.sex === o.value}
                onClick={() => update((d) => void (d.patient.sex = o.value))}
              >
                {o.label}
              </Chip>
            ))}
          </div>
        </Field>

        {/* Both numbers come from the department's paper form. */}
        <div className="grid-2">
          <Field label="Số hồ sơ">
            <TextInput
              value={p.fileNumber}
              onChange={(e) => update((d) => void (d.patient.fileNumber = e.target.value))}
              placeholder="Không bắt buộc"
            />
          </Field>
          <Field label="MSGĐ" help="Mã số gia đình trên bệnh án giấy.">
            <TextInput
              value={p.familyCode}
              onChange={(e) => update((d) => void (d.patient.familyCode = e.target.value))}
              placeholder="Không bắt buộc"
            />
          </Field>
        </div>

        <div className="grid-2">
          <Field label="Tuổi">
            <TextInput
              inputMode="numeric"
              value={p.ageYears ?? ''}
              onChange={(e) =>
                update((d) => {
                  const v = e.target.value.replace(/\D/g, '')
                  d.patient.ageYears = v === '' ? null : Number(v)
                })
              }
              placeholder="58"
            />
          </Field>
          <Field label="Năm sinh">
            <TextInput
              value={p.dateOfBirth}
              onChange={(e) => update((d) => void (d.patient.dateOfBirth = e.target.value))}
              placeholder="1967"
            />
          </Field>
        </div>

        <Field label="Nghề nghiệp">
          <TextInput
            value={p.occupation}
            onChange={(e) => update((d) => void (d.patient.occupation = e.target.value))}
            placeholder="Nội trợ, nông dân, giáo viên…"
          />
        </Field>

        <div className="grid-2">
          <Field label="Học vấn">
            <TextInput
              value={p.education}
              onChange={(e) => update((d) => void (d.patient.education = e.target.value))}
            />
          </Field>
          <Field label="Tình trạng hôn nhân">
            <TextInput
              value={p.maritalStatus}
              onChange={(e) => update((d) => void (d.patient.maritalStatus = e.target.value))}
              placeholder="Có gia đình"
            />
          </Field>
        </div>

        <div className="grid-2">
          <Field label="Dân tộc">
            <TextInput
              value={p.ethnicity}
              onChange={(e) => update((d) => void (d.patient.ethnicity = e.target.value))}
              placeholder="Kinh"
            />
          </Field>
          <Field label="Tôn giáo" help="Ghi khi ảnh hưởng đến quyết định chăm sóc.">
            <TextInput
              value={p.religion}
              onChange={(e) => update((d) => void (d.patient.religion = e.target.value))}
              placeholder="Không / Phật giáo…"
            />
          </Field>
        </div>

        <Field label="Nơi ở">
          <TextArea
            rows={2}
            value={p.address}
            onChange={(e) => update((d) => void (d.patient.address = e.target.value))}
            placeholder="Phường / xã, tỉnh — không ghi địa chỉ chi tiết của người thật"
          />
        </Field>

        <Field
          label="Bảo hiểm y tế"
          help="Chỉ ghi có hay không — không nhập số thẻ. Điều này ảnh hưởng đến lựa chọn thuốc và nơi chuyển tuyến."
        >
          <div className="chips">
            {INSURANCE_OPTIONS.map((o) => (
              <Chip
                key={o}
                on={p.insurance === o}
                onClick={() =>
                  update((d) => {
                    d.patient.insurance = d.patient.insurance === o ? '' : o
                  })
                }
              >
                {o}
              </Chip>
            ))}
          </div>
        </Field>
      </Card>
    </>
  )
}

export function VisitSection({ record, update }: SectionProps) {
  const v = record.visit
  return (
    <Card title="Lần khám này">
      <div className="grid-2">
        <Field label="Ngày khám">
          <TextInput
            type="date"
            value={v.date}
            onChange={(e) => update((d) => void (d.visit.date = e.target.value))}
          />
        </Field>
        <Field label="Hình thức">
          <Select
            value={v.encounterType}
            onChange={(e) => update((d) => void (d.visit.encounterType = e.target.value))}
            options={[
              { value: 'Khám lần đầu', label: 'Khám lần đầu' },
              { value: 'Tái khám', label: 'Tái khám' },
              { value: 'Thăm nhà', label: 'Thăm nhà' },
              { value: 'Khám cấp cứu', label: 'Khám cấp cứu' },
            ]}
          />
        </Field>
      </div>

      <Field label="Nơi khám">
        <TextInput
          value={v.setting}
          onChange={(e) => update((d) => void (d.visit.setting = e.target.value))}
          placeholder="Trạm y tế / Phòng khám YHGĐ / Khoa khám bệnh"
        />
      </Field>

      <Field label="Lý do đến khám" help="Một câu ngắn theo lời bệnh nhân.">
        <TextArea
          rows={2}
          value={v.reasonForEncounter}
          onChange={(e) => update((d) => void (d.visit.reasonForEncounter = e.target.value))}
        />
      </Field>

      <Field label="Người đi cùng">
        <TextInput
          value={v.accompaniedBy}
          onChange={(e) => update((d) => void (d.visit.accompaniedBy = e.target.value))}
          placeholder="Con gái, chồng…"
        />
      </Field>
    </Card>
  )
}
