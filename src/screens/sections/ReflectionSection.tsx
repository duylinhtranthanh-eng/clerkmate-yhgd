import { useState } from 'react'
import { Badge, Card, Chip, Field, Notice, TextArea, TextInput } from '../../components/Ui'
import type { SectionProps } from './types'

const RATING_LABEL: Record<number, string> = {
  1: 'Chưa tự tin',
  2: 'Cần hướng dẫn nhiều',
  3: 'Làm được với hỗ trợ',
  4: 'Tự làm được',
  5: 'Tự tin, hướng dẫn được bạn',
}

const PROMPTS = [
  'Điều gì trong ca này khác với những gì tôi đã học trên lý thuyết?',
  'Dữ kiện nào tôi đã bỏ sót và chỉ nhận ra khi xem lại?',
  'Bước nào trong lập luận chẩn đoán tôi còn thấy khó?',
  'Tôi đã tư vấn được điều gì thực sự hữu ích cho bệnh nhân?',
]

/**
 * The reflection is the learner's own voice in the record. Nothing here is
 * scored automatically — the completeness engine only checks that it was
 * written, never what it says.
 */
export function ReflectionSection({ record, update }: SectionProps) {
  const r = record.reflection
  const [newTag, setNewTag] = useState('')

  const addTag = () => {
    const t = newTag.trim()
    if (!t) return
    update((d) => {
      if (!d.reflection.tags.includes(t)) d.reflection.tags.push(t)
    })
    setNewTag('')
  }

  return (
    <>
      <Card
        title="Sau ca này tôi học được gì"
        action={r.selfRating ? <Badge tone="brand">{r.selfRating}/5</Badge> : null}
        hint="Viết cho chính mình, không phải cho điểm. Phần này in kèm bệnh án khi gửi giảng viên."
      >
        <Field label="Điều tôi học được">
          <TextArea
            rows={5}
            value={r.learned}
            onChange={(e) => update((d) => void (d.reflection.learned = e.target.value))}
            placeholder="Một hoặc hai điều cụ thể, không cần dài."
          />
        </Field>

        <Field label="Chỗ tôi còn thấy khó">
          <TextArea
            rows={4}
            value={r.difficulties}
            onChange={(e) => update((d) => void (d.reflection.difficulties = e.target.value))}
            placeholder="Kỹ năng hỏi bệnh, lập luận chẩn đoán, tư vấn, giao tiếp với gia đình…"
          />
        </Field>

        <Field label="Lần sau tôi sẽ làm khác thế nào">
          <TextArea
            rows={4}
            value={r.nextTime}
            onChange={(e) => update((d) => void (d.reflection.nextTime = e.target.value))}
            placeholder="Một hành động cụ thể cho ca kế tiếp."
          />
        </Field>

        <Field label="Câu hỏi muốn hỏi giảng viên">
          <TextArea
            rows={3}
            value={r.questionsForTeacher}
            onChange={(e) => update((d) => void (d.reflection.questionsForTeacher = e.target.value))}
            placeholder="Ghi lại ngay để không quên khi thảo luận ca với giảng viên."
          />
        </Field>
      </Card>

      <Card title="Mức tự tin với dạng ca này">
        <div className="chips">
          {[1, 2, 3, 4, 5].map((v) => (
            <Chip
              key={v}
              on={r.selfRating === v}
              onClick={() =>
                update((d) => {
                  d.reflection.selfRating = d.reflection.selfRating === v ? null : v
                })
              }
            >
              {v}
            </Chip>
          ))}
        </div>
        {r.selfRating && (
          <p className="small muted" style={{ margin: '10px 0 0' }}>
            {RATING_LABEL[r.selfRating]}
          </p>
        )}
      </Card>

      <Card title="Từ khóa" hint="Để sau này tìm lại các ca cùng chủ đề.">
        <div style={{ display: 'flex', gap: 8 }}>
          <TextInput
            value={newTag}
            placeholder="Ví dụ: thoái hóa khớp"
            onChange={(e) => setNewTag(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                addTag()
              }
            }}
          />
          <button type="button" className="btn btn--secondary btn--sm" onClick={addTag}>
            Thêm
          </button>
        </div>
        {r.tags.length > 0 && (
          <div className="chips" style={{ marginTop: 10 }}>
            {r.tags.map((t) => (
              <Chip
                key={t}
                small
                on
                onClick={() =>
                  update((d) => {
                    d.reflection.tags = d.reflection.tags.filter((x) => x !== t)
                  })
                }
              >
                {t} ✕
              </Chip>
            ))}
          </div>
        )}
      </Card>

      <Card title="Nếu chưa biết viết gì" className="card--flat">
        <div className="stack stack--tight">
          {PROMPTS.map((p) => (
            <div key={p} className="small" style={{ display: 'flex', gap: 8 }}>
              <span aria-hidden="true">•</span>
              <span>{p}</span>
            </div>
          ))}
        </div>
      </Card>

      <Notice tone="info">
        ClerkMate chỉ kiểm tra bạn <strong>đã viết</strong> phần này hay chưa — nội dung phản tư không bị máy
        chấm điểm.
      </Notice>
    </>
  )
}
