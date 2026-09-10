import { useState } from 'react'
import { Card, Chip, Field, TextArea, TextInput } from '../../components/Ui'
import { RED_FLAG_LIBRARY } from '../../config/clinical'
import type { SectionProps } from './types'

const SOCRATES_FIELDS: { key: keyof CaseSocrates; label: string; placeholder: string }[] = [
  { key: 'site', label: 'S — Vị trí', placeholder: 'Đau ở đâu?' },
  { key: 'onset', label: 'O — Khởi phát', placeholder: 'Bắt đầu khi nào, đột ngột hay từ từ?' },
  { key: 'character', label: 'C — Tính chất', placeholder: 'Đau âm ỉ, nhói, bỏng rát?' },
  { key: 'radiation', label: 'R — Lan', placeholder: 'Có lan đi đâu không?' },
  { key: 'associations', label: 'A — Triệu chứng kèm', placeholder: 'Sốt, buồn nôn, tê…' },
  { key: 'timeCourse', label: 'T — Diễn tiến theo thời gian', placeholder: 'Liên tục hay từng cơn?' },
  { key: 'exacerbatingRelieving', label: 'E — Tăng / giảm', placeholder: 'Yếu tố làm nặng hoặc giảm đau' },
  { key: 'severity', label: 'S — Mức độ', placeholder: 'Thang điểm 0–10' },
]

type CaseSocrates = {
  site: string
  onset: string
  character: string
  radiation: string
  associations: string
  timeCourse: string
  exacerbatingRelieving: string
  severity: string
}

export function HistorySection({ record, update }: SectionProps) {
  const h = record.history
  const [flagGroup, setFlagGroup] = useState(RED_FLAG_LIBRARY[0].group)

  const toggleFlag = (flag: string, list: 'present' | 'absent') => {
    update((d) => {
      const other = list === 'present' ? 'absent' : 'present'
      const target = d.history.redFlags[list]
      const idx = target.indexOf(flag)
      if (idx >= 0) target.splice(idx, 1)
      else {
        target.push(flag)
        const oi = d.history.redFlags[other].indexOf(flag)
        if (oi >= 0) d.history.redFlags[other].splice(oi, 1)
      }
    })
  }

  const activeGroup = RED_FLAG_LIBRARY.find((g) => g.group === flagGroup) ?? RED_FLAG_LIBRARY[0]

  return (
    <>
      <Card title="Lý do chính">
        <Field label="Than phiền chính" help="Ghi bằng ngôn ngữ của bệnh nhân.">
          <TextInput
            value={h.chiefComplaint}
            onChange={(e) => update((d) => void (d.history.chiefComplaint = e.target.value))}
            placeholder="Đau khớp gối phải"
          />
        </Field>
        <Field label="Thời gian diễn tiến">
          <TextInput
            value={h.duration}
            onChange={(e) => update((d) => void (d.history.duration = e.target.value))}
            placeholder="3 tháng"
          />
        </Field>
      </Card>

      <Card title="Diễn tiến bệnh sử" hint="Kể theo trình tự thời gian, từ lúc khởi phát đến hiện tại.">
        <TextArea
          rows={7}
          value={h.hpi}
          onChange={(e) => update((d) => void (d.history.hpi = e.target.value))}
          placeholder="Cách nhập viện 3 tháng, bệnh nhân bắt đầu…"
        />
      </Card>

      <Card title="SOCRATES" hint="Bộ khung mô tả triệu chứng đau hoặc triệu chứng chính.">
        {SOCRATES_FIELDS.map((f) => (
          <Field key={f.key} label={f.label}>
            <TextInput
              value={h.socrates[f.key]}
              onChange={(e) => update((d) => void (d.history.socrates[f.key] = e.target.value))}
              placeholder={f.placeholder}
            />
          </Field>
        ))}
      </Card>

      <Card
        title="Cờ đỏ (red flags)"
        hint="Chạm 1 lần: đã ghi nhận có. Chạm ở hàng dưới: đã hỏi và loại trừ."
      >
        <div className="chips" style={{ marginBottom: 14 }}>
          {RED_FLAG_LIBRARY.map((g) => (
            <Chip key={g.group} small on={flagGroup === g.group} onClick={() => setFlagGroup(g.group)}>
              {g.group}
            </Chip>
          ))}
        </div>

        <div className="section-title">Ghi nhận có</div>
        <div className="chips" style={{ margin: '8px 0 14px' }}>
          {activeGroup.items.map((f) => (
            <Chip
              key={f}
              small
              tone="danger"
              on={h.redFlags.present.includes(f)}
              onClick={() => toggleFlag(f, 'present')}
            >
              {f}
            </Chip>
          ))}
        </div>

        <div className="section-title">Đã hỏi và loại trừ</div>
        <div className="chips" style={{ margin: '8px 0 14px' }}>
          {activeGroup.items.map((f) => (
            <Chip
              key={f}
              small
              tone="ok"
              on={h.redFlags.absent.includes(f)}
              onClick={() => toggleFlag(f, 'absent')}
            >
              {f}
            </Chip>
          ))}
        </div>

        <Field label="Ghi chú thêm về cờ đỏ">
          <TextArea
            rows={2}
            value={h.redFlags.note}
            onChange={(e) => update((d) => void (d.history.redFlags.note = e.target.value))}
          />
        </Field>
      </Card>

      <Card title="ICE" hint="Ideas — Concerns — Expectations: góc nhìn của bệnh nhân.">
        <Field label="Ideas — Bệnh nhân nghĩ mình bị gì?">
          <TextArea
            rows={2}
            value={h.ice.ideas}
            onChange={(e) => update((d) => void (d.history.ice.ideas = e.target.value))}
          />
        </Field>
        <Field label="Concerns — Bệnh nhân lo lắng điều gì?">
          <TextArea
            rows={2}
            value={h.ice.concerns}
            onChange={(e) => update((d) => void (d.history.ice.concerns = e.target.value))}
          />
        </Field>
        <Field label="Expectations — Bệnh nhân mong đợi gì ở lần khám này?">
          <TextArea
            rows={2}
            value={h.ice.expectations}
            onChange={(e) => update((d) => void (d.history.ice.expectations = e.target.value))}
          />
        </Field>
      </Card>

      <Card title="Rà soát cơ quan" hint="Các triệu chứng theo hệ cơ quan, ngoài than phiền chính.">
        <TextArea
          rows={4}
          value={h.systemsReview}
          onChange={(e) => update((d) => void (d.history.systemsReview = e.target.value))}
          placeholder="Tim mạch: không đau ngực, không khó thở. Tiêu hóa: …"
        />
      </Card>
    </>
  )
}
