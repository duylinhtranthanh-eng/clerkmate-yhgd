import { useState } from 'react'
import type { CaseRecord, FamilyMember, FamilyRelation, Sex } from '../types/case'
import { GenogramSvg } from '../genogram/GenogramSvg'
import { resolveFamilyMembers } from '../genogram/resolve'
import { suggestLifeCycleStage } from '../genogram/lifeCycle'
import { FAMILY_LIFE_CYCLE_STAGES } from '../config/clinical'
import { Badge, Card, Chip, Field, Notice, Select, TextArea, TextInput } from '../components/Ui'
import { Sheet } from '../components/Sheet'
import { uid } from '../utils/id'
import { SEX_LABEL } from '../utils/format'

const RELATION_OPTIONS: { value: FamilyRelation; label: string; defaultSex: Sex }[] = [
  { value: 'father', label: 'Cha', defaultSex: 'male' },
  { value: 'mother', label: 'Mẹ', defaultSex: 'female' },
  { value: 'sibling', label: 'Anh / chị / em', defaultSex: 'unknown' },
  { value: 'spouse', label: 'Vợ / chồng', defaultSex: 'unknown' },
  { value: 'child', label: 'Con', defaultSex: 'unknown' },
]

const RELATION_LABEL: Record<FamilyRelation, string> = {
  self: 'Bệnh nhân',
  father: 'Cha',
  mother: 'Mẹ',
  sibling: 'Anh / chị / em',
  spouse: 'Vợ / chồng',
  child: 'Con',
}

export function GenogramScreen({
  record,
  update,
}: {
  record: CaseRecord
  update: (m: (d: CaseRecord) => void) => void
}) {
  const [editing, setEditing] = useState<FamilyMember | null>(null)
  /** Patient identity comes from Hành chính, never from a second copy here. */
  const members = resolveFamilyMembers(record)

  const patch = (id: string, mut: (m: FamilyMember) => void) =>
    update((d) => {
      const m = d.familyMembers.find((x) => x.id === id)
      if (m) mut(m)
    })

  const addMember = (relation: FamilyRelation) => {
    const def = RELATION_OPTIONS.find((r) => r.value === relation)
    const member: FamilyMember = {
      id: uid('fm'),
      name: '',
      relation,
      sex: def?.defaultSex ?? 'unknown',
      ageYears: null,
      alive: true,
      ageAtDeath: null,
      conditions: [],
      order: record.familyMembers.filter((m) => m.relation === relation).length,
      note: '',
    }
    update((d) => void d.familyMembers.push(member))
    setEditing(member)
  }

  const remove = (id: string) => {
    update((d) => {
      d.familyMembers = d.familyMembers.filter((x) => x.id !== id)
    })
    setEditing(null)
  }

  return (
    <div className="content">
      <Card title="Sơ đồ phả hệ" hint="Vẽ tự động từ dữ liệu bên dưới. Không dùng AI — bố cục luôn ổn định.">
        <GenogramSvg members={members} />
      </Card>

      <LifeCycleCard record={record} members={members} update={update} />

      <Card title="Thành viên gia đình" hint="Chạm vào một người để sửa tuổi, tình trạng và bệnh lý.">
        <div className="stack stack--tight" style={{ marginBottom: 14 }}>
          {members.map((m) => (
            <button
              key={m.id}
              type="button"
              className="list__item"
              style={{ borderRadius: 'var(--r-md)', border: '1px solid var(--line)' }}
              onClick={() => setEditing(m)}
            >
              <span className="list__icon">
                {m.sex === 'female' ? '⚪' : m.sex === 'male' ? '⬛' : '◆'}
              </span>
              <span className="grow">
                <span className="title">{m.name || RELATION_LABEL[m.relation]}</span>
                <span className="meta">
                  {RELATION_LABEL[m.relation]}
                  {m.ageYears !== null && ` · ${m.ageYears} tuổi`}
                  {!m.alive && ' · đã mất'}
                  {m.conditions.length > 0 && ` · ${m.conditions.join(', ')}`}
                </span>
              </span>
              {m.relation === 'self' && <Badge tone="brand">BN</Badge>}
            </button>
          ))}
        </div>

        <div className="section-title" style={{ marginBottom: 8 }}>Thêm thành viên</div>
        <div className="chips">
          {RELATION_OPTIONS.map((r) => (
            <Chip key={r.value} small onClick={() => addMember(r.value)}>
              ＋ {r.label}
            </Chip>
          ))}
        </div>
      </Card>

      <Notice tone="info">
        MVP hỗ trợ ba thế hệ: cha mẹ — bệnh nhân, anh chị em, vợ/chồng — con. Ông bà và cấu trúc phức tạp hơn
        nằm trong lộ trình phát triển.
      </Notice>

      <Sheet open={!!editing} onClose={() => setEditing(null)} title="Thông tin thành viên">
        {editing && (
          <MemberForm
            member={members.find((m) => m.id === editing.id) ?? editing}
            onChange={(mut) => patch(editing.id, mut)}
            onRemove={() => remove(editing.id)}
          />
        )}
      </Sheet>
    </div>
  )
}

function LifeCycleCard({
  record,
  members,
  update,
}: {
  record: CaseRecord
  members: FamilyMember[]
  update: (m: (d: CaseRecord) => void) => void
}) {
  const current = record.familyMedicineAssessment.familyLifeCycleStage
  const suggestion = suggestLifeCycleStage(members, record.patient.ageYears)
  const [expanded, setExpanded] = useState(false)

  const setStage = (stage: string) =>
    update((d) => {
      d.familyMedicineAssessment.familyLifeCycleStage =
        d.familyMedicineAssessment.familyLifeCycleStage === stage ? '' : stage
    })

  return (
    <Card
      title="Vòng đời gia đình"
      action={current ? <Badge tone="ok">đã xác định</Badge> : <Badge tone="muted">chưa chọn</Badge>}
      hint="Giai đoạn chu kỳ sống theo Duvall — dùng chung với phần Đánh giá YHGĐ."
    >
      {current ? (
        <div className="notice notice--ok" style={{ marginBottom: 'var(--sp-3)' }}>
          <span aria-hidden="true">🔄</span>
          <div>
            <strong>{current}</strong>
          </div>
        </div>
      ) : (
        suggestion && (
          <div className="notice notice--info" style={{ marginBottom: 'var(--sp-3)' }}>
            <span aria-hidden="true">💡</span>
            <div>
              Gợi ý từ phả hệ: <strong>{suggestion.stage}</strong>
              <br />
              <span className="tiny">{suggestion.rationale}</span>
              <br />
              <button type="button" className="link-btn" onClick={() => setStage(suggestion.stage)}>
                Dùng gợi ý này
              </button>
            </div>
          </div>
        )
      )}

      {!current && !suggestion && (
        <p className="small muted" style={{ marginTop: 0 }}>
          Thêm vợ/chồng và con kèm tuổi vào phả hệ để ClerkMate gợi ý giai đoạn chu kỳ.
        </p>
      )}

      <button
        type="button"
        className="btn btn--secondary btn--sm"
        onClick={() => setExpanded((v) => !v)}
      >
        {expanded ? 'Ẩn danh sách 8 giai đoạn' : current ? 'Chọn giai đoạn khác' : 'Chọn thủ công'}
      </button>

      {expanded && (
        <div className="stack stack--tight" style={{ marginTop: 'var(--sp-3)' }}>
          {FAMILY_LIFE_CYCLE_STAGES.map((stage) => (
            <button
              key={stage}
              type="button"
              className="chip"
              data-on={current === stage ? 'true' : 'false'}
              style={{ textAlign: 'left', borderRadius: 'var(--r-md)' }}
              onClick={() => setStage(stage)}
            >
              {stage}
            </button>
          ))}
        </div>
      )}

      <div style={{ marginTop: 'var(--sp-4)' }}>
        <Field label="Nhiệm vụ phát triển / khủng hoảng của giai đoạn">
          <TextArea
            rows={3}
            value={record.familyMedicineAssessment.familyLifeCycleNote}
            onChange={(e) =>
              update((d) => void (d.familyMedicineAssessment.familyLifeCycleNote = e.target.value))
            }
            placeholder="Giai đoạn này gia đình đang phải thích nghi với điều gì? Ảnh hưởng lên sức khỏe bệnh nhân?"
          />
        </Field>
      </div>
    </Card>
  )
}

const COMMON_CONDITIONS = [
  'Tăng huyết áp',
  'Đái tháo đường',
  'Tim mạch',
  'Đột quỵ',
  'Ung thư',
  'Hen',
  'Lao',
  'Trầm cảm',
]

function MemberForm({
  member,
  onChange,
  onRemove,
}: {
  member: FamilyMember
  onChange: (mut: (m: FamilyMember) => void) => void
  onRemove: () => void
}) {
  const [newCondition, setNewCondition] = useState('')
  const isSelf = member.relation === 'self'

  const toggleCondition = (c: string) =>
    onChange((m) => {
      const i = m.conditions.indexOf(c)
      if (i >= 0) m.conditions.splice(i, 1)
      else m.conditions.push(c)
    })

  return (
    <>
      {isSelf ? (
        <Notice tone="info">
          Tên, giới tính và tuổi của bệnh nhân lấy từ phần <strong>Hành chính</strong> nên không sửa ở đây —
          sửa một chỗ để hai nơi luôn khớp. Ở đây bạn chỉ thêm bệnh lý và ghi chú cho phả hệ.
        </Notice>
      ) : (
        <>
          <Field label="Quan hệ với bệnh nhân" help="Quyết định vị trí của người này trong phả hệ.">
            <Select
              value={member.relation}
              onChange={(e) => onChange((m) => void (m.relation = e.target.value as FamilyRelation))}
              options={RELATION_OPTIONS.map((r) => ({ value: r.value, label: r.label }))}
              placeholder="Chọn quan hệ"
            />
          </Field>

          <Field
            label="Tên gọi trong phả hệ"
            help={`Chỉ để phân biệt khi có nhiều người cùng quan hệ — ví dụ "Con trai lớn", "Con trai nhỏ". Bỏ trống sẽ hiển thị là "${RELATION_LABEL[member.relation]}".`}
          >
            <TextInput
              value={member.name}
              placeholder={RELATION_LABEL[member.relation]}
              onChange={(e) => onChange((m) => void (m.name = e.target.value))}
            />
          </Field>

          <Field label="Giới tính">
            <div className="chips">
              {(['male', 'female', 'other'] as Sex[]).map((s) => (
                <Chip key={s} on={member.sex === s} onClick={() => onChange((m) => void (m.sex = s))}>
                  {SEX_LABEL[s]}
                </Chip>
              ))}
            </div>
          </Field>

          <div className="grid-2">
            <Field label="Tuổi">
              <TextInput
                inputMode="numeric"
                value={member.ageYears ?? ''}
                onChange={(e) =>
                  onChange((m) => {
                    const v = e.target.value.replace(/\D/g, '')
                    m.ageYears = v === '' ? null : Number(v)
                  })
                }
              />
            </Field>
            <Field label="Thứ tự hiển thị" help="Nhỏ hơn nằm bên trái.">
              <TextInput
                inputMode="numeric"
                value={member.order}
                onChange={(e) =>
                  onChange((m) => void (m.order = Number(e.target.value.replace(/\D/g, '') || 0)))
                }
              />
            </Field>
          </div>
        </>
      )}

      {!isSelf && (
        <Field label="Tình trạng">
          <div className="chips">
            <Chip on={member.alive} tone="ok" onClick={() => onChange((m) => void (m.alive = true))}>
              Còn sống
            </Chip>
            <Chip on={!member.alive} onClick={() => onChange((m) => void (m.alive = false))}>
              Đã mất
            </Chip>
          </div>
        </Field>
      )}

      {!isSelf && !member.alive && (
        <Field label="Tuổi khi mất">
          <TextInput
            inputMode="numeric"
            value={member.ageAtDeath ?? ''}
            onChange={(e) =>
              onChange((m) => {
                const v = e.target.value.replace(/\D/g, '')
                m.ageAtDeath = v === '' ? null : Number(v)
              })
            }
          />
        </Field>
      )}

      <Field label="Bệnh lý">
        <div className="chips" style={{ marginBottom: 8 }}>
          {COMMON_CONDITIONS.map((c) => (
            <Chip key={c} small on={member.conditions.includes(c)} onClick={() => toggleCondition(c)}>
              {c}
            </Chip>
          ))}
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <TextInput
            value={newCondition}
            placeholder="Bệnh lý khác"
            onChange={(e) => setNewCondition(e.target.value)}
          />
          <button
            type="button"
            className="btn btn--secondary btn--sm"
            onClick={() => {
              const c = newCondition.trim()
              if (!c) return
              onChange((m) => {
                if (!m.conditions.includes(c)) m.conditions.push(c)
              })
              setNewCondition('')
            }}
          >
            Thêm
          </button>
        </div>
        {member.conditions.length > 0 && (
          <div className="chips" style={{ marginTop: 8 }}>
            {member.conditions.map((c) => (
              <Chip key={c} small on onClick={() => toggleCondition(c)}>
                {c} ✕
              </Chip>
            ))}
          </div>
        )}
      </Field>

      <Field label="Ghi chú">
        <TextArea rows={2} value={member.note} onChange={(e) => onChange((m) => void (m.note = e.target.value))} />
      </Field>

      {!isSelf && (
        <button type="button" className="btn btn--danger btn--block" onClick={onRemove} style={{ marginTop: 8 }}>
          Xóa thành viên
        </button>
      )}
    </>
  )
}
