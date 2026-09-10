import type { ReactNode } from 'react'
import { Card, Chip, Field, TextArea, TextInput } from '../../components/Ui'
import { RepeatList } from '../../components/RepeatList'
import { uid } from '../../utils/id'
import type { SectionProps } from './types'

/**
 * A history block that can be closed in one tap.
 *
 * An empty list on its own is ambiguous — it may mean "not asked". The
 * "Không có" chip records that the question *was* asked, which is what the
 * completeness engine needs in order to stop nagging.
 */
function NoneToggle({
  on,
  disabled,
  label,
  onToggle,
  children,
}: {
  on: boolean
  disabled: boolean
  label: string
  onToggle: () => void
  children: ReactNode
}) {
  return (
    <>
      <div className="chips" style={{ marginBottom: 14 }}>
        <Chip on={on} tone="ok" onClick={disabled ? undefined : onToggle}>
          {label}
        </Chip>
        {disabled && (
          <span className="tiny muted" style={{ alignSelf: 'center' }}>
            Xóa hết mục bên dưới trước khi chọn
          </span>
        )}
      </div>
      {!on && children}
    </>
  )
}

export function PersonalHistorySection({ record, update }: SectionProps) {
  const ph = record.personalHistory
  const isFemale = record.patient.sex === 'female'

  return (
    <>
      <Card title="Tiền căn bệnh lý">
        <NoneToggle
          on={ph.noPastMedical}
          disabled={ph.pastMedical.length > 0}
          label="Không ghi nhận bệnh nền"
          onToggle={() => update((d) => void (d.personalHistory.noPastMedical = !d.personalHistory.noPastMedical))}
        >
        <RepeatList
          items={ph.pastMedical}
          addLabel="Thêm bệnh nền"
          emptyLabel="Chưa ghi nhận bệnh nền nào."
          onAdd={() =>
            update((d) =>
              void d.personalHistory.pastMedical.push({
                id: uid('pm'),
                label: '',
                since: '',
                status: '',
                note: '',
              }),
            )
          }
          onRemove={(id) =>
            update((d) => {
              d.personalHistory.pastMedical = d.personalHistory.pastMedical.filter((x) => x.id !== id)
            })
          }
          render={(item, i) => (
            <>
              <Field label="Chẩn đoán">
                <TextInput
                  value={item.label}
                  onChange={(e) => update((d) => void (d.personalHistory.pastMedical[i].label = e.target.value))}
                  placeholder="Tăng huyết áp"
                />
              </Field>
              <div className="grid-2">
                <Field label="Từ khi nào">
                  <TextInput
                    value={item.since}
                    onChange={(e) => update((d) => void (d.personalHistory.pastMedical[i].since = e.target.value))}
                    placeholder="10 năm"
                  />
                </Field>
                <Field label="Tình trạng">
                  <TextInput
                    value={item.status}
                    onChange={(e) => update((d) => void (d.personalHistory.pastMedical[i].status = e.target.value))}
                    placeholder="Đang điều trị"
                  />
                </Field>
              </div>
            </>
          )}
        />
        </NoneToggle>
      </Card>

      <Card title="Tiền căn ngoại khoa">
        <NoneToggle
          on={ph.noPastSurgical}
          disabled={ph.pastSurgical.length > 0}
          label="Chưa phẫu thuật / thủ thuật"
          onToggle={() =>
            update((d) => void (d.personalHistory.noPastSurgical = !d.personalHistory.noPastSurgical))
          }
        >
        <RepeatList
          items={ph.pastSurgical}
          addLabel="Thêm phẫu thuật / thủ thuật"
          emptyLabel="Chưa ghi nhận."
          onAdd={() =>
            update((d) =>
              void d.personalHistory.pastSurgical.push({
                id: uid('ps'),
                label: '',
                since: '',
                status: '',
                note: '',
              }),
            )
          }
          onRemove={(id) =>
            update((d) => {
              d.personalHistory.pastSurgical = d.personalHistory.pastSurgical.filter((x) => x.id !== id)
            })
          }
          render={(item, i) => (
            <div className="grid-2">
              <Field label="Phẫu thuật">
                <TextInput
                  value={item.label}
                  onChange={(e) => update((d) => void (d.personalHistory.pastSurgical[i].label = e.target.value))}
                />
              </Field>
              <Field label="Năm">
                <TextInput
                  value={item.since}
                  onChange={(e) => update((d) => void (d.personalHistory.pastSurgical[i].since = e.target.value))}
                />
              </Field>
            </div>
          )}
        />
        </NoneToggle>
      </Card>

      <Card title="Dị ứng" hint="Luôn phải khai thác trước khi kê toa.">
        <NoneToggle
          on={ph.noAllergies}
          disabled={ph.allergies.length > 0}
          label="Không ghi nhận dị ứng"
          onToggle={() => update((d) => void (d.personalHistory.noAllergies = !d.personalHistory.noAllergies))}
        >
        <RepeatList
          items={ph.allergies}
          addLabel="Thêm dị ứng"
          emptyLabel="Chưa ghi nhận — hãy hỏi và ghi rõ kể cả khi không có."
          onAdd={() =>
            update((d) =>
              void d.personalHistory.allergies.push({ id: uid('al'), agent: '', reaction: '', severity: '' }),
            )
          }
          onRemove={(id) =>
            update((d) => {
              d.personalHistory.allergies = d.personalHistory.allergies.filter((x) => x.id !== id)
            })
          }
          render={(item, i) => (
            <>
              <Field label="Tác nhân">
                <TextInput
                  value={item.agent}
                  onChange={(e) => update((d) => void (d.personalHistory.allergies[i].agent = e.target.value))}
                  placeholder="Penicillin / Chưa ghi nhận"
                />
              </Field>
              <div className="grid-2">
                <Field label="Biểu hiện">
                  <TextInput
                    value={item.reaction}
                    onChange={(e) => update((d) => void (d.personalHistory.allergies[i].reaction = e.target.value))}
                  />
                </Field>
                <Field label="Mức độ">
                  <TextInput
                    value={item.severity}
                    onChange={(e) => update((d) => void (d.personalHistory.allergies[i].severity = e.target.value))}
                  />
                </Field>
              </div>
            </>
          )}
        />
        </NoneToggle>
      </Card>

      {isFemale && (
        <Card title="Tiền căn sản phụ khoa">
          <div className="grid-2">
            <Field label="Tuổi có kinh">
              <TextInput
                value={ph.reproductive.menarcheAge}
                onChange={(e) => update((d) => void (d.personalHistory.reproductive.menarcheAge = e.target.value))}
              />
            </Field>
            <Field label="Chu kỳ kinh">
              <TextInput
                value={ph.reproductive.cycle}
                onChange={(e) => update((d) => void (d.personalHistory.reproductive.cycle = e.target.value))}
                placeholder="28 ngày, đều"
              />
            </Field>
          </div>
          <div className="grid-2">
            <Field label="Kinh cuối (LMP)">
              <TextInput
                value={ph.reproductive.lmp}
                onChange={(e) => update((d) => void (d.personalHistory.reproductive.lmp = e.target.value))}
              />
            </Field>
            <Field label="PARA">
              <TextInput
                value={ph.reproductive.para}
                onChange={(e) => update((d) => void (d.personalHistory.reproductive.para = e.target.value))}
                placeholder="2002"
              />
            </Field>
          </div>
          <div className="grid-2">
            <Field label="Ngừa thai">
              <TextInput
                value={ph.reproductive.contraception}
                onChange={(e) => update((d) => void (d.personalHistory.reproductive.contraception = e.target.value))}
              />
            </Field>
            <Field label="Mãn kinh">
              <TextInput
                value={ph.reproductive.menopause}
                onChange={(e) => update((d) => void (d.personalHistory.reproductive.menopause = e.target.value))}
                placeholder="52 tuổi"
              />
            </Field>
          </div>
          <Field label="Ghi chú sản khoa">
            <TextArea
              rows={2}
              value={ph.reproductive.obstetricNote}
              onChange={(e) => update((d) => void (d.personalHistory.reproductive.obstetricNote = e.target.value))}
            />
          </Field>
        </Card>
      )}

      <Card title="Ghi chú tiền căn khác">
        <TextArea
          rows={3}
          value={ph.note}
          onChange={(e) => update((d) => void (d.personalHistory.note = e.target.value))}
          placeholder="Truyền máu, chấn thương, thuốc đã ngưng…"
        />
      </Card>
    </>
  )
}

export function LifestyleSection({ record, update }: SectionProps) {
  const l = record.lifestyle
  return (
    <Card title="Lối sống" hint="Nền tảng của mọi kế hoạch tư vấn thay đổi hành vi.">
      <Field label="Thuốc lá">
        <TextInput
          value={l.smoking.status}
          onChange={(e) => update((d) => void (d.lifestyle.smoking.status = e.target.value))}
          placeholder="Không hút / Đang hút 20 gói-năm / Đã bỏ 5 năm"
        />
      </Field>
      <Field label="Chi tiết thuốc lá">
        <TextInput
          value={l.smoking.detail}
          onChange={(e) => update((d) => void (d.lifestyle.smoking.detail = e.target.value))}
          placeholder="Số điếu/ngày, số năm hút"
        />
      </Field>
      <Field label="Rượu bia">
        <TextInput
          value={l.alcohol.status}
          onChange={(e) => update((d) => void (d.lifestyle.alcohol.status = e.target.value))}
          placeholder="Không / Thỉnh thoảng / 3 lon bia mỗi ngày"
        />
      </Field>
      <Field label="Vận động thể lực">
        <TextInput
          value={l.physicalActivity}
          onChange={(e) => update((d) => void (d.lifestyle.physicalActivity = e.target.value))}
          placeholder="Đi bộ 30 phút x 3 lần/tuần"
        />
      </Field>
      <Field label="Chế độ ăn">
        <TextInput
          value={l.diet}
          onChange={(e) => update((d) => void (d.lifestyle.diet = e.target.value))}
          placeholder="Ăn mặn, ít rau"
        />
      </Field>
      <Field label="Giấc ngủ">
        <TextInput
          value={l.sleep}
          onChange={(e) => update((d) => void (d.lifestyle.sleep = e.target.value))}
          placeholder="Ngủ 6 giờ, khó vào giấc"
        />
      </Field>
      <Field label="Chất gây nghiện khác">
        <TextInput
          value={l.substanceUse}
          onChange={(e) => update((d) => void (d.lifestyle.substanceUse = e.target.value))}
        />
      </Field>
      <Field label="Căng thẳng tâm lý">
        <TextArea
          rows={2}
          value={l.stress}
          onChange={(e) => update((d) => void (d.lifestyle.stress = e.target.value))}
        />
      </Field>
      <Field label="Phơi nhiễm nghề nghiệp">
        <TextInput
          value={l.occupationalExposure}
          onChange={(e) => update((d) => void (d.lifestyle.occupationalExposure = e.target.value))}
          placeholder="Bụi, hóa chất, tiếng ồn…"
        />
      </Field>
    </Card>
  )
}

export function FamilyHistorySection({ record, update }: SectionProps) {
  const fh = record.familyHistory
  return (
    <Card title="Tiền căn gia đình" hint="Thông tin ở đây và ở phả hệ bổ sung cho nhau.">
      <NoneToggle
        on={fh.none}
        disabled={fh.entries.length > 0}
        label="Không ghi nhận bệnh lý gia đình"
        onToggle={() => update((d) => void (d.familyHistory.none = !d.familyHistory.none))}
      >
      <RepeatList
        items={fh.entries}
        addLabel="Thêm bệnh lý gia đình"
        emptyLabel="Chưa ghi nhận."
        onAdd={() =>
          update((d) => void d.familyHistory.entries.push({ id: uid('fh'), condition: '', relatives: '', note: '' }))
        }
        onRemove={(id) =>
          update((d) => {
            d.familyHistory.entries = d.familyHistory.entries.filter((x) => x.id !== id)
          })
        }
        render={(item, i) => (
          <div className="grid-2">
            <Field label="Bệnh lý">
              <TextInput
                value={item.condition}
                onChange={(e) => update((d) => void (d.familyHistory.entries[i].condition = e.target.value))}
                placeholder="Đái tháo đường"
              />
            </Field>
            <Field label="Người thân">
              <TextInput
                value={item.relatives}
                onChange={(e) => update((d) => void (d.familyHistory.entries[i].relatives = e.target.value))}
                placeholder="Mẹ"
              />
            </Field>
          </div>
        )}
      />
      </NoneToggle>
      <div style={{ marginTop: 14 }}>
        <Field label="Ghi chú thêm">
          <TextArea
            rows={3}
            value={fh.note}
            onChange={(e) => update((d) => void (d.familyHistory.note = e.target.value))}
          />
        </Field>
      </div>
    </Card>
  )
}
