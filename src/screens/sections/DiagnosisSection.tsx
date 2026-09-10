import { useMemo, useState } from 'react'
import type { CaseRecord, DiagnosisEntry } from '../../types/case'
import { Badge, Card, Chip, Field, Notice, TextArea, TextInput } from '../../components/Ui'
import { RepeatList } from '../../components/RepeatList'
import { DIAGNOSIS_CODES } from '../../config/clinical'
import { uid } from '../../utils/id'
import { norm } from '../../parsing/text'
import type { SectionProps } from './types'

const COMORBIDITY_STATUS = ['Đang điều trị, ổn định', 'Đang điều trị, chưa đạt đích', 'Mới phát hiện', 'Chưa điều trị']

function blankEntry(prefix: string): DiagnosisEntry {
  return { id: uid(prefix), label: '', icd10: '', icpc2: '', status: '', note: '' }
}

function DiagnosisPicker({
  label = 'Tìm mã bệnh',
  onPick,
}: {
  label?: string
  onPick: (entry: { label: string; icd10: string; icpc2: string }) => void
}) {
  const [q, setQ] = useState('')
  const results = useMemo(() => {
    const nq = norm(q).trim()
    if (!nq) return DIAGNOSIS_CODES.slice(0, 6)
    return DIAGNOSIS_CODES.filter(
      (c) =>
        norm(c.label).includes(nq) ||
        c.icd10.toLowerCase().includes(nq) ||
        c.icpc2.toLowerCase().includes(nq),
    ).slice(0, 8)
  }, [q])

  return (
    <>
      <Field label={label} help="Danh sách rút gọn cho demo — bạn vẫn có thể tự nhập mã bất kỳ.">
        <TextInput value={q} onChange={(e) => setQ(e.target.value)} placeholder="tăng huyết áp, I10, K86…" />
      </Field>
      <div className="chips">
        {results.map((c) => (
          <Chip key={c.icd10 + c.icpc2} small onClick={() => onPick(c)}>
            {c.label} · {c.icd10}
          </Chip>
        ))}
        {results.length === 0 && <span className="small muted">Không có kết quả — nhập thủ công bên dưới.</span>}
      </div>
    </>
  )
}

/**
 * Diagnosis for a multimorbid patient.
 *
 * Order matters: the main problem for *this visit*, then the conditions the
 * patient carries alongside it, then the differentials. Family Medicine
 * patients usually have several active problems, so comorbidities are a
 * first-class list with their own control status, not a footnote.
 */
export function DiagnosisSection({ record, update }: SectionProps) {
  const dx = record.diagnosis
  const primary: DiagnosisEntry = dx.primary ?? { ...blankEntry('primary'), id: 'primary' }

  const setPrimary = (patch: Partial<DiagnosisEntry>) =>
    update((d) => {
      const cur = d.diagnosis.primary ?? blankEntry('dx')
      d.diagnosis.primary = { ...cur, ...patch }
    })

  /** Past medical problems not yet carried into the comorbidity list. */
  const importable = useMemo(() => {
    const have = new Set(dx.comorbidities.map((c) => norm(c.label)))
    const primaryLabel = norm(primary.label)
    return record.personalHistory.pastMedical.filter(
      (p) => p.label.trim() && !have.has(norm(p.label)) && norm(p.label) !== primaryLabel,
    )
  }, [dx.comorbidities, record.personalHistory.pastMedical, primary.label])

  const importFromHistory = (label: string, since: string) => {
    const match = DIAGNOSIS_CODES.find((c) => norm(c.label) === norm(label))
    update((d) => {
      d.diagnosis.noComorbidities = false
      d.diagnosis.comorbidities.push({
        id: uid('cm'),
        label,
        icd10: match?.icd10 ?? '',
        icpc2: match?.icpc2 ?? '',
        status: '',
        note: since ? `Từ ${since}` : '',
      })
    })
  }

  return (
    <>
      <Card
        title="Chẩn đoán chính"
        hint="Vấn đề chính của lần khám này — vấn đề bạn sẽ xử trí trước."
      >
        <DiagnosisPicker onPick={(c) => setPrimary({ label: c.label, icd10: c.icd10, icpc2: c.icpc2 })} />
        <div className="hr" />
        <Field label="Chẩn đoán">
          <TextInput
            value={primary.label}
            onChange={(e) => setPrimary({ label: e.target.value })}
            placeholder="Thoái hóa khớp gối phải"
          />
        </Field>
        <div className="grid-2">
          <Field label="ICD-10">
            <TextInput value={primary.icd10} onChange={(e) => setPrimary({ icd10: e.target.value })} placeholder="M17" />
          </Field>
          <Field label="ICPC-2">
            <TextInput value={primary.icpc2} onChange={(e) => setPrimary({ icpc2: e.target.value })} placeholder="L90" />
          </Field>
        </div>
        <Field label="Ghi chú">
          <TextInput value={primary.note} onChange={(e) => setPrimary({ note: e.target.value })} />
        </Field>
      </Card>

      <Card
        title="Chẩn đoán kèm theo — bệnh đồng mắc"
        action={<Badge tone={dx.comorbidities.length > 0 ? 'brand' : 'muted'}>{dx.comorbidities.length}</Badge>}
        hint="Bệnh nhân Y học gia đình thường đa bệnh. Liệt kê từng bệnh kèm mức kiểm soát hiện tại."
      >
        {dx.comorbidities.length === 0 && (
          <div className="chips" style={{ marginBottom: 14 }}>
            <Chip
              on={dx.noComorbidities}
              tone="ok"
              onClick={() =>
                update((d) => {
                  d.diagnosis.noComorbidities = !d.diagnosis.noComorbidities
                })
              }
            >
              Không có bệnh đồng mắc
            </Chip>
          </div>
        )}

        {importable.length > 0 && !dx.noComorbidities && (
          <div className="notice notice--info" style={{ marginBottom: 14 }}>
            <span aria-hidden="true">↩</span>
            <div>
              Có {importable.length} bệnh trong phần Tiền căn chưa đưa vào đây. Chạm để thêm:
              <div className="chips" style={{ marginTop: 8 }}>
                {importable.map((p) => (
                  <Chip key={p.id} small onClick={() => importFromHistory(p.label, p.since)}>
                    ＋ {p.label}
                  </Chip>
                ))}
              </div>
            </div>
          </div>
        )}

        {!dx.noComorbidities && (
          <RepeatList
            items={dx.comorbidities}
            addLabel="Thêm bệnh đồng mắc"
            emptyLabel="Chưa ghi nhận bệnh đồng mắc nào."
            onAdd={() =>
              update((d) => {
                d.diagnosis.noComorbidities = false
                d.diagnosis.comorbidities.push(blankEntry('cm'))
              })
            }
            onRemove={(id) =>
              update((d) => {
                d.diagnosis.comorbidities = d.diagnosis.comorbidities.filter((x) => x.id !== id)
              })
            }
            render={(item, i) => (
              <>
                <Field label="Bệnh">
                  <TextInput
                    value={item.label}
                    onChange={(e) => update((d) => void (d.diagnosis.comorbidities[i].label = e.target.value))}
                    placeholder="Tăng huyết áp"
                  />
                </Field>
                <div className="grid-2">
                  <Field label="ICD-10">
                    <TextInput
                      value={item.icd10}
                      onChange={(e) => update((d) => void (d.diagnosis.comorbidities[i].icd10 = e.target.value))}
                    />
                  </Field>
                  <Field label="ICPC-2">
                    <TextInput
                      value={item.icpc2}
                      onChange={(e) => update((d) => void (d.diagnosis.comorbidities[i].icpc2 = e.target.value))}
                    />
                  </Field>
                </div>
                <Field label="Mức kiểm soát">
                  <div className="chips">
                    {COMORBIDITY_STATUS.map((st) => (
                      <Chip
                        key={st}
                        small
                        tone={st === 'Đang điều trị, ổn định' ? 'ok' : undefined}
                        on={item.status === st}
                        onClick={() =>
                          update((d) => {
                            const t = d.diagnosis.comorbidities[i]
                            t.status = t.status === st ? '' : st
                          })
                        }
                      >
                        {st}
                      </Chip>
                    ))}
                  </div>
                </Field>
                <Field label="Ghi chú">
                  <TextInput
                    value={item.note}
                    onChange={(e) => update((d) => void (d.diagnosis.comorbidities[i].note = e.target.value))}
                    placeholder="Từ 10 năm, HA hiện 140/85 chưa đạt đích"
                  />
                </Field>
              </>
            )}
          />
        )}

        {dx.comorbidities.length > 1 && (
          <Notice tone="info">
            Bệnh nhân đa bệnh: hãy nêu rõ trong Kế hoạch xử trí thứ tự ưu tiên và các tương tác giữa các bệnh
            (ví dụ NSAID cho khớp nhưng bệnh nhân có tăng huyết áp và bệnh thận).
          </Notice>
        )}
      </Card>

      <Card title="Chẩn đoán phân biệt" hint="Nêu lý do ủng hộ và lý do loại trừ cho từng chẩn đoán.">
        <RepeatList
          items={dx.differentials}
          addLabel="Thêm chẩn đoán phân biệt"
          emptyLabel="Chưa có chẩn đoán phân biệt."
          onAdd={() => update((d) => void d.diagnosis.differentials.push(blankEntry('dd')))}
          onRemove={(id) =>
            update((d) => {
              d.diagnosis.differentials = d.diagnosis.differentials.filter((x) => x.id !== id)
            })
          }
          render={(item, i) => (
            <>
              <Field label="Chẩn đoán">
                <TextInput
                  value={item.label}
                  onChange={(e) => update((d) => void (d.diagnosis.differentials[i].label = e.target.value))}
                />
              </Field>
              <Field label="Lý do ủng hộ / loại trừ">
                <TextArea
                  rows={2}
                  value={item.note}
                  onChange={(e) => update((d) => void (d.diagnosis.differentials[i].note = e.target.value))}
                />
              </Field>
            </>
          )}
        />
      </Card>

      <Card title="Lập luận chẩn đoán" hint="Dữ kiện nào ủng hộ, dữ kiện nào chưa phù hợp?">
        <TextArea
          rows={5}
          value={dx.reasoning}
          onChange={(e) => update((d) => void (d.diagnosis.reasoning = e.target.value))}
        />
      </Card>
    </>
  )
}

export type { CaseRecord }
