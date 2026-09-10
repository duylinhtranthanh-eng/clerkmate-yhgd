import type { CaseRecord, ScaleInstance } from '../types/case'
import type { ScaleDef } from '../config/scales'
import { Badge, Chip, Field, Notice, TextArea, TextInput } from './Ui'
import { Sheet } from './Sheet'
import { bandFor, emptyInstance, scaleTotal, summarise } from '../scales/scoring'
import type { ScaleId } from '../config/scales'

/**
 * Administers one rating scale.
 *
 * Licensed instruments (HADS) show score-entry fields instead of items, with
 * the reason stated — ClerkMate will not reprint a copyrighted questionnaire.
 */
export function ScaleSheet({
  open,
  onClose,
  def,
  record,
  update,
  onFollowUp,
}: {
  open: boolean
  onClose: () => void
  def: ScaleDef | null
  record: CaseRecord
  update: (m: (d: CaseRecord) => void) => void
  onFollowUp?: (id: ScaleId) => void
}) {
  if (!def) return null

  const summary = summarise(record, def.id)
  const inst = summary.inst

  const mutate = (fn: (i: ScaleInstance) => void) =>
    update((d) => {
      let target = d.riskAssessment.scales.find((s) => s.scaleId === def.id)
      if (!target) {
        target = emptyInstance(def)
        d.riskAssessment.scales.push(target)
      }
      // Keep the answer array long enough for every item.
      while (target.answers.length < def.items.length) target.answers.push(null)
      fn(target)
      target.updatedAt = new Date().toISOString()
    })

  const total = summary.total
  const band = summary.band

  return (
    <Sheet open={open} onClose={onClose} title={`${def.name} — ${def.fullName}`}>
      <p className="small muted" style={{ marginTop: -6 }}>{def.purpose}</p>

      {def.availability === 'licensed' ? (
        <>
          <Notice tone="warn">{def.licenseNote}</Notice>
          {(!def.subscales || def.subscales.length === 0) && (
            <div style={{ marginTop: 14 }}>
              <Field label={`Tổng điểm (0–${def.maxScore ?? 100})`}>
                <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                  <TextInput
                    inputMode="numeric"
                    value={inst?.subscaleTotals.total ?? ''}
                    onChange={(e) => {
                      const raw = e.target.value.replace(/\D/g, '')
                      const n = raw === '' ? null : Math.min(def.maxScore ?? 100, Number(raw))
                      mutate((i) => {
                        i.subscaleTotals.total = n
                      })
                    }}
                  />
                  {(() => {
                    const b = bandFor(def.bands, inst?.subscaleTotals.total ?? null)
                    return b ? <Badge tone={b.tone}>{b.label}</Badge> : null
                  })()}
                </div>
              </Field>
            </div>
          )}
          <div style={{ marginTop: 14 }}>
            {(def.subscales ?? []).map((sub) => {
              const value = inst?.subscaleTotals[sub.id] ?? null
              const subBand = bandFor(sub.bands, value)
              return (
                <Field key={sub.id} label={`${sub.label} — điểm (0–${sub.maxScore})`}>
                  <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                    <TextInput
                      inputMode="numeric"
                      value={value ?? ''}
                      onChange={(e) => {
                        const raw = e.target.value.replace(/\D/g, '')
                        const n = raw === '' ? null : Math.min(sub.maxScore, Number(raw))
                        mutate((i) => {
                          i.subscaleTotals[sub.id] = n
                        })
                      }}
                    />
                    {subBand && <Badge tone={subBand.tone}>{subBand.label}</Badge>}
                  </div>
                </Field>
              )
            })}
          </div>
        </>
      ) : (
        <>
          <div className="notice notice--info" style={{ margin: '12px 0 16px' }}>
            <span aria-hidden="true">🗣️</span>
            <div>{def.timeframe}</div>
          </div>

          <div className="stack">
            {def.items.map((item, i) => {
              // An instrument may score its parts differently — Mini-Cog's word
              // recall is 0–3 while its clock drawing is 0 or 2.
              const options = item.options ?? def.options
              return (
                <div key={i}>
                  <span style={{ display: 'block', fontSize: 14, fontWeight: 550, marginBottom: 4 }}>
                    {i + 1}. {item.text}
                  </span>
                  {item.hint && (
                    <span className="tiny muted" style={{ display: 'block', marginBottom: 7 }}>
                      {item.hint}
                    </span>
                  )}
                  <div className="chips">
                    {options.map((o) => (
                      <Chip
                        key={o.value}
                        small
                        on={inst?.answers[i] === o.value}
                        onClick={() =>
                          mutate((inst2) => {
                            inst2.answers[i] = inst2.answers[i] === o.value ? null : o.value
                          })
                        }
                      >
                        {o.label}
                      </Chip>
                    ))}
                  </div>
                </div>
              )
            })}
          </div>

          <div
            className="row-between"
            style={{
              marginTop: 18,
              padding: 'var(--sp-3)',
              borderRadius: 'var(--r-md)',
              background: 'var(--surface-alt)',
              border: '1px solid var(--line)',
            }}
          >
            <span className="small">
              Đã trả lời {summary.answered}/{def.items.length}
            </span>
            {total === null ? (
              <Badge tone="muted">chưa đủ để tính điểm</Badge>
            ) : (
              <span style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <strong className="mono">{total}</strong>
                {band && <Badge tone={band.tone}>{band.label}</Badge>}
              </span>
            )}
          </div>

          {summary.safety && (
            <div style={{ marginTop: 14 }}>
              <Notice tone="warn">
                Câu {(def.safetyItemIndex ?? 0) + 1} có điểm trên 0 — bệnh nhân có ý nghĩ tự làm hại mình.
                Hãy hỏi trực tiếp về ý định và kế hoạch, đánh giá an toàn ngay, và đánh dấu mục{' '}
                <strong>“Ý tưởng hoặc kế hoạch tự sát”</strong> trong nhóm Nguy cơ cấp cứu.
                <div style={{ marginTop: 8 }}>
                  <button
                    type="button"
                    className="btn btn--danger btn--sm"
                    onClick={() =>
                      update((d) => {
                        const f = d.riskAssessment.factors.find((x) => x.id === 'em.suicidal')
                        if (f) {
                          f.present = 'yes'
                          if (!f.note.trim()) f.note = `Phát hiện qua ${def.name} câu ${(def.safetyItemIndex ?? 0) + 1}`
                        }
                      })
                    }
                  >
                    Đánh dấu nguy cơ cấp cứu
                  </button>
                </div>
              </Notice>
            </div>
          )}

          {summary.positive && def.followUp && onFollowUp && (
            <div style={{ marginTop: 14 }}>
              <Notice tone="warn">
                Sàng lọc dương tính ({total} ≥ {def.positiveAt}). Nên làm tiếp{' '}
                <strong>{def.followUp.toUpperCase()}</strong> để đánh giá mức độ.
                <div style={{ marginTop: 8 }}>
                  <button
                    type="button"
                    className="btn btn--primary btn--sm"
                    onClick={() => onFollowUp(def.followUp!)}
                  >
                    Làm {def.followUp.toUpperCase()} ngay
                  </button>
                </div>
              </Notice>
            </div>
          )}
        </>
      )}

      <div style={{ marginTop: 16 }}>
        <Field label="Ghi chú">
          <TextArea
            rows={2}
            value={inst?.note ?? ''}
            onChange={(e) => {
              const value = e.target.value
              mutate((i) => {
                i.note = value
              })
            }}
          />
        </Field>
      </div>

      <p className="tiny muted" style={{ marginBottom: 0 }}>{def.licenseNote}</p>

      <button type="button" className="btn btn--secondary btn--block" style={{ marginTop: 12 }} onClick={onClose}>
        Xong
      </button>
    </Sheet>
  )
}

export { scaleTotal }
