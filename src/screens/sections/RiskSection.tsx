import { useMemo, useState } from 'react'
import type { RiskFactor, YesNoUnknown } from '../../types/case'
import { Badge, Card, Chip, Field, Notice, Progress, TextArea, TextInput } from '../../components/Ui'
import { Select } from '../../components/Ui'
import { ScaleSheet } from '../../components/ScaleSheet'
import {
  RISK_DOMAINS,
  RISK_FACTOR_DEF_BY_ID,
  applicableRiskFactors,
  riskContext,
  riskModeFor,
} from '../../config/risk'
import type { RiskDomainDef, RiskDomainId, RiskDomainMode } from '../../config/risk'
import { SCALES, SCALES_BY_DOMAIN } from '../../config/scales'
import type { ScaleId } from '../../config/scales'
import { summarise } from '../../scales/scoring'
import { FALLS_ACTIONS, FALLS_QUESTIONS, FALLS_RULE_TEXT, TUG_CUTOFF_SECONDS, fallsBand } from '../../config/falls'
import { CVD_BANDS, CVD_CHARTS, CVD_INPUTS } from '../../config/cvd'
import { SCREEM_DOMAINS } from '../../config/clinical'
import { nonEmpty } from '../../utils/format'
import { countListedItems, mentionedFactors } from '../../risk/recall'
import { useProfile } from '../../hooks/useProfile'
import { uid } from '../../utils/id'
import type { SectionProps } from './types'

const PRESENCE: { value: YesNoUnknown; label: string; tone?: 'ok' | 'danger' }[] = [
  { value: 'yes', label: 'Có', tone: 'danger' },
  { value: 'no', label: 'Không', tone: 'ok' },
  { value: 'unknown', label: 'Chưa hỏi' },
]

/**
 * Risk review as a guided sequence rather than one long checklist.
 *
 * One domain open at a time, in the teaching order from `config/risk.ts`;
 * each domain explains why it comes where it does, each factor says why it is
 * asked, and "Tất cả không" lets the learner clear a domain in one tap and
 * then flip only what applies. Nothing is ever answered on their behalf.
 */
export function RiskSection({ record, update }: SectionProps) {
  const ctx = useMemo(() => riskContext(record), [record])

  /** Only factors relevant to this patient, keyed by domain, in catalogue order. */
  const byDomain = useMemo(() => {
    const applicable = new Set(applicableRiskFactors(ctx).map((f) => f.id))
    const map = new Map<RiskDomainId, RiskFactor[]>()
    for (const f of record.riskAssessment.factors) {
      if (!f.custom && !applicable.has(f.id) && f.present === 'unknown') continue
      const domain = (f.domain || 'behavioural') as RiskDomainId
      const arr = map.get(domain) ?? []
      arr.push(f)
      map.set(domain, arr)
    }
    return map
  }, [record.riskAssessment.factors, ctx])

  const visible = record.riskAssessment.factors.filter((f) =>
    (byDomain.get((f.domain || 'behavioural') as RiskDomainId) ?? []).some((x) => x.id === f.id),
  )
  const reviewed = visible.filter((f) => f.present !== 'unknown').length
  const flagged = visible.filter((f) => f.present === 'yes')
  const emergencyFlagged = flagged.filter((f) => f.domain === 'emergency')

  const [open, setOpen] = useState<RiskDomainId | null>('emergency')
  const [scaleOpen, setScaleOpen] = useState<ScaleId | null>(null)
  const { profile } = useProfile()
  const recallFirst = profile?.recallFirst ?? true

  const setPresence = (id: string, value: YesNoUnknown) =>
    update((d) => {
      const f = d.riskAssessment.factors.find((x) => x.id === id)
      if (f) f.present = f.present === value ? 'unknown' : value
    })

  const markDomain = (domain: RiskDomainId, value: YesNoUnknown) =>
    update((d) => {
      const ids = new Set((byDomain.get(domain) ?? []).map((f) => f.id))
      for (const f of d.riskAssessment.factors) {
        if (!ids.has(f.id)) continue
        // Never overwrite a positive finding with a bulk "no".
        if (value === 'no' && f.present === 'yes') continue
        f.present = value
      }
    })

  return (
    <>
      <Card className="card--flat">
        <div className="row-between" style={{ marginBottom: 10 }}>
          <div>
            <h2>Rà soát nguy cơ</h2>
            <p className="small muted" style={{ margin: '4px 0 0' }}>
              9 nhóm, theo thứ tự lâm sàng: cấp cứu trước, xã hội sau.
            </p>
          </div>
          <Badge tone={reviewed === visible.length && visible.length > 0 ? 'ok' : 'muted'}>
            {reviewed}/{visible.length}
          </Badge>
        </div>
        <Progress percent={visible.length === 0 ? 0 : Math.round((reviewed / visible.length) * 100)} />
        {record.patient.ageYears === null && (
          <p className="tiny muted" style={{ margin: '10px 0 0' }}>
            Nhập tuổi và giới trong phần Hành chính để danh sách tự lọc theo đối tượng.
          </p>
        )}
      </Card>

      {emergencyFlagged.length > 0 && (
        <Notice tone="warn">
          Có {emergencyFlagged.length} nguy cơ cấp cứu đang dương tính:{' '}
          <strong>{emergencyFlagged.map((f) => f.label).join(', ')}</strong>. Xử trí hoặc chuyển tuyến trước
          khi hoàn thiện kế hoạch mạn tính.
        </Notice>
      )}

      {RISK_DOMAINS.map((domain) => {
        const factors = byDomain.get(domain.id) ?? []
        if (factors.length === 0) return null
        const answered = factors.filter((f) => f.present !== 'unknown').length
        const positives = factors.filter((f) => f.present === 'yes').length
        const isOpen = open === domain.id
        const recallText = record.riskAssessment.recall[domain.id]?.text ?? ''
        const mentioned = mentionedFactors(
          recallText,
          factors.map((f) => RISK_FACTOR_DEF_BY_ID[f.id]).filter(Boolean),
        )
        const baseMode = riskModeFor(record.learnerLevel, domain)
        // The learner can switch the gate off entirely in Cài đặt.
        const mode: RiskDomainMode = recallFirst ? baseMode : 'checklist'
        const committed = !!record.riskAssessment.recall[domain.id]?.revealedAt
        const showChecklist = mode === 'checklist' || committed

        return (
          <Card key={domain.id} className="card--flat">
            <button
              type="button"
              onClick={() => setOpen(isOpen ? null : domain.id)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                width: '100%',
                background: 'none',
                border: 0,
                padding: 0,
                textAlign: 'left',
                cursor: 'pointer',
              }}
              aria-expanded={isOpen}
            >
              <span className="list__icon" aria-hidden="true">{domain.icon}</span>
              <span style={{ flex: 1, minWidth: 0 }}>
                <span style={{ display: 'block', fontWeight: 650, color: 'var(--ink-900)' }}>
                  {domain.step}. {domain.label}
                </span>
                <span className="meta small muted" style={{ display: 'block' }}>
                  {answered}/{factors.length} đã hỏi
                  {positives > 0 && ` · ${positives} dương tính`}
                </span>
              </span>
              {positives > 0 ? (
                <Badge tone="danger">{positives}</Badge>
              ) : answered === factors.length ? (
                <Badge tone="ok">đủ</Badge>
              ) : (
                <Badge tone="muted">{factors.length - answered} còn lại</Badge>
              )}
              <span className="muted" aria-hidden="true">{isOpen ? '⌃' : '⌄'}</span>
            </button>

            {isOpen && (
              <>
                <div className="notice notice--info" style={{ margin: '14px 0' }}>
                  <span aria-hidden="true">🎓</span>
                  <div>{domain.teachingNote}</div>
                </div>

                {domain.derivedFrom && <ScreemReadout record={record} />}

                {mode !== 'checklist' && (
                  <RecallGate record={record} update={update} domain={domain} mode={mode} />
                )}

                {!showChecklist ? null : (
                <>
                {mode === 'generate' && (
                  <div className="notice notice--ok" style={{ marginBottom: 14 }}>
                    <span aria-hidden="true">📖</span>
                    <div>
                      Danh mục dưới đây là <strong>bản đối chiếu sau khi bạn đã chốt</strong>. Mục nào bạn đã
                      nêu được đánh dấu; mục nào chưa, hãy tự hỏi vì sao mình không nghĩ tới.
                    </div>
                  </div>
                )}

                <div className="btn-row" style={{ marginBottom: 14 }}>
                  <button
                    type="button"
                    className="btn btn--soft btn--sm"
                    onClick={() => markDomain(domain.id, 'no')}
                  >
                    ✓ Tất cả không
                  </button>
                  {answered > 0 && (
                    <button
                      type="button"
                      className="btn btn--secondary btn--sm"
                      onClick={() => markDomain(domain.id, 'unknown')}
                    >
                      Xóa nhóm này
                    </button>
                  )}
                </div>

                <div className="stack">
                  {factors.map((f) => {
                    const def = RISK_FACTOR_DEF_BY_ID[f.id]
                    const thoughtOf = mentioned.has(f.id)
                    return (
                      <div key={f.id}>
                        <span style={{ display: 'block', fontSize: 14, fontWeight: 550 }}>
                          {f.label}
                          {thoughtOf && (
                            <span style={{ marginLeft: 6 }}>
                              <Badge tone="ok">bạn đã nghĩ tới</Badge>
                            </span>
                          )}
                          {f.custom && (
                            <span style={{ marginLeft: 6 }}>
                              <Badge tone="brand">bạn thêm</Badge>
                            </span>
                          )}
                        </span>
                        {def?.why && (
                          <span className="tiny muted" style={{ display: 'block', margin: '2px 0 7px' }}>
                            {def.why}
                          </span>
                        )}
                        <div className="chips">
                          {PRESENCE.map((p) => (
                            <Chip
                              key={p.value}
                              small
                              tone={p.tone}
                              on={f.present === p.value}
                              onClick={() => setPresence(f.id, p.value)}
                            >
                              {p.label}
                            </Chip>
                          ))}
                        </div>
                        {f.present === 'yes' && (
                          <TextArea
                            rows={2}
                            style={{ marginTop: 8 }}
                            value={f.note}
                            placeholder="Chi tiết: mức độ, thời gian, ảnh hưởng…"
                            onChange={(e) =>
                              update((d) => {
                                const t = d.riskAssessment.factors.find((x) => x.id === f.id)
                                if (t) t.note = e.target.value
                              })
                            }
                          />
                        )}
                      </div>
                    )
                  })}
                </div>

                <CustomFactorAdder record={record} update={update} domain={domain.id} />
                </>
                )}

                {showChecklist && domain.id === 'cardiometabolic' && <CvdRiskCard record={record} update={update} />}
                {showChecklist && domain.id === 'geriatric' && <FallsCard record={record} update={update} />}
                {showChecklist && SCALES_BY_DOMAIN[domain.id] && (
                  <ScaleLauncher record={record} domain={domain.id} onOpen={setScaleOpen} />
                )}
              </>
            )}
          </Card>
        )
      })}

      <ScaleSheet
        open={scaleOpen !== null}
        onClose={() => setScaleOpen(null)}
        def={scaleOpen ? SCALES[scaleOpen] : null}
        record={record}
        update={update}
        onFollowUp={(id) => setScaleOpen(id)}
      />

      <Card title="Nhận định nguy cơ tổng thể" hint="Nguy cơ nào cần can thiệp trước, và can thiệp bằng gì?">
        {flagged.length > 0 && (
          <div className="chips" style={{ marginBottom: 12 }}>
            {flagged.map((f) => (
              <Badge key={f.id} tone="danger">{f.label}</Badge>
            ))}
          </div>
        )}
        <TextArea
          rows={5}
          value={record.riskAssessment.overallNote}
          onChange={(e) => update((d) => void (d.riskAssessment.overallNote = e.target.value))}
          placeholder="Ví dụ: ưu tiên kiểm soát huyết áp và giảm cân; sàng lọc trầm cảm ở lần tái khám; can thiệp nguy cơ té ngã tại nhà."
        />
      </Card>
    </>
  )
}

/**
 * The social domain reads SCREEM rather than asking the same questions twice.
 */
function ScreemReadout({ record }: { record: SectionProps['record'] }) {
  const screem = record.familyMedicineAssessment.screem
  const filled = SCREEM_DOMAINS.filter(
    (d) => nonEmpty(screem[d.key].resources) || nonEmpty(screem[d.key].pathology),
  )
  const apgar = record.familyMedicineAssessment.apgar
  const apgarDone = [apgar.adaptation, apgar.partnership, apgar.growth, apgar.affection, apgar.resolve].every(
    (v) => v !== null,
  )

  return (
    <div style={{ marginBottom: 16 }}>
      {filled.length === 0 ? (
        <Notice tone="warn">
          Chưa điền SCREEM. Mở <strong>Đánh giá YHGĐ</strong> để đánh giá nguồn lực và trở ngại xã hội —
          không cần trả lời lại ở đây.
        </Notice>
      ) : (
        <>
          <div className="section-title" style={{ marginBottom: 8 }}>
            Đọc từ SCREEM ({filled.length}/6 lĩnh vực)
          </div>
          <div className="stack stack--tight">
            {filled.map((d) => (
              <div key={d.key}>
                <span style={{ display: 'block', fontSize: 13.5, fontWeight: 600 }}>{d.label}</span>
                {nonEmpty(screem[d.key].pathology) && (
                  <span className="small" style={{ display: 'block', color: 'var(--danger)' }}>
                    Trở ngại: {screem[d.key].pathology}
                  </span>
                )}
                {nonEmpty(screem[d.key].resources) && (
                  <span className="small muted" style={{ display: 'block' }}>
                    Nguồn lực: {screem[d.key].resources}
                  </span>
                )}
              </div>
            ))}
          </div>
          {apgarDone && (
            <p className="small muted" style={{ margin: '10px 0 0' }}>
              Family APGAR đã chấm đủ 5 mục — xem điểm trong phần Đánh giá YHGĐ.
            </p>
          )}
        </>
      )}
    </div>
  )
}

/** Launcher for the rating scales that belong to a domain. */
function ScaleLauncher({
  record,
  domain,
  onOpen,
}: {
  record: SectionProps['record']
  domain: RiskDomainId
  onOpen: (id: ScaleId) => void
}) {
  const ids = SCALES_BY_DOMAIN[domain] ?? []
  const summaries = ids.map((id) => summarise(record, id))
  /** Follow-ups stay hidden until the screening scale is positive. */
  const visible = summaries.filter((sm) => {
    const isFollowUp = summaries.some((other) => other.def.followUp === sm.def.id)
    if (!isFollowUp) return true
    const parent = summaries.find((other) => other.def.followUp === sm.def.id)
    return parent?.positive || sm.total !== null
  })

  return (
    <div style={{ marginTop: 18, paddingTop: 14, borderTop: '1px solid var(--line)' }}>
      <div className="section-title" style={{ marginBottom: 4 }}>
        Thang điểm
      </div>
      <p className="tiny muted" style={{ margin: '0 0 10px' }}>
        Không bắt buộc — chỉ làm khi ca này cần. Sàng lọc dương tính thì app tự mời làm thang đầy đủ.
      </p>
      <div className="stack stack--tight">
        {visible.map((sm) => {
          const licensed = sm.def.availability === 'licensed'
          const licensedScores = Object.entries(sm.inst?.subscaleTotals ?? {}).filter(([, v]) => v !== null)
          return (
            <button
              key={sm.def.id}
              type="button"
              className="list__item"
              style={{ borderRadius: 'var(--r-md)', border: '1px solid var(--line)' }}
              onClick={() => onOpen(sm.def.id)}
            >
              <span className="list__icon" aria-hidden="true">📋</span>
              <span className="grow">
                <span className="title">{sm.def.name}</span>
                <span className="meta">
                  {licensed
                    ? licensedScores.length > 0
                      ? licensedScores.map(([k, v]) => `${k === 'anxiety' ? 'A' : 'D'} ${v}`).join(' · ')
                      : 'Nhập điểm từ bản chính thức'
                    : sm.total !== null
                      ? `Điểm ${sm.total}`
                      : sm.answered > 0
                        ? `Đang làm ${sm.answered}/${sm.def.items.length}`
                        : `${sm.def.items.length} câu`}
                </span>
              </span>
              {sm.band ? (
                <Badge tone={sm.band.tone}>{sm.band.label}</Badge>
              ) : (
                <Badge tone="muted">chưa làm</Badge>
              )}
            </button>
          )
        })}
      </div>
    </div>
  )
}

/** Graded falls assessment: STEADI screen + Timed Up and Go. */
function FallsCard({ record, update }: SectionProps) {
  const f = record.riskAssessment.falls
  const band = fallsBand(f)
  const [showRule, setShowRule] = useState(false)

  type YnKey = 'fellPastYear' | 'injured' | 'feelsUnsteady' | 'worriesAboutFalling'
  const setYn = (key: YnKey, value: YesNoUnknown) =>
    update((d) => {
      const falls = d.riskAssessment.falls
      falls[key] = falls[key] === value ? 'unknown' : value
    })

  return (
    <div style={{ marginTop: 18, paddingTop: 14, borderTop: '1px solid var(--line)' }}>
      <div className="row-between" style={{ marginBottom: 4 }}>
        <div className="section-title" style={{ margin: 0 }}>
          Mức độ nguy cơ té ngã
        </div>
        {band.level && <Badge tone={band.tone}>{band.label}</Badge>}
      </div>
      <p className="tiny muted" style={{ margin: '0 0 12px' }}>
        Ba câu sàng lọc theo CDC STEADI, kèm nghiệm pháp Timed Up and Go.
      </p>

      <div className="stack">
        {FALLS_QUESTIONS.map((q) => (
          <div key={q.key}>
            <span style={{ display: 'block', fontSize: 14, fontWeight: 550 }}>{q.question}</span>
            <span className="tiny muted" style={{ display: 'block', margin: '2px 0 7px' }}>{q.why}</span>
            <div className="chips">
              <Chip small tone="danger" on={f[q.key] === 'yes'} onClick={() => setYn(q.key, 'yes')}>
                Có
              </Chip>
              <Chip small tone="ok" on={f[q.key] === 'no'} onClick={() => setYn(q.key, 'no')}>
                Không
              </Chip>
            </div>
          </div>
        ))}

        {f.fellPastYear === 'yes' && (
          <div className="grid-2">
            <Field label="Số lần té trong 12 tháng">
              <TextInput
                inputMode="numeric"
                value={f.fallCount}
                onChange={(e) =>
                  update((d) => void (d.riskAssessment.falls.fallCount = e.target.value.replace(/\D/g, '')))
                }
              />
            </Field>
            <Field label="Có chấn thương?">
              <div className="chips">
                <Chip small tone="danger" on={f.injured === 'yes'} onClick={() => setYn('injured', 'yes')}>
                  Có
                </Chip>
                <Chip small tone="ok" on={f.injured === 'no'} onClick={() => setYn('injured', 'no')}>
                  Không
                </Chip>
              </div>
            </Field>
          </div>
        )}

        <div className="grid-2">
          <Field label={`Timed Up and Go (giây)`} help={`≥ ${TUG_CUTOFF_SECONDS} giây là tăng nguy cơ`}>
            <TextInput
              inputMode="decimal"
              value={f.timedUpAndGoSeconds}
              placeholder="10.5"
              onChange={(e) =>
                update((d) => void (d.riskAssessment.falls.timedUpAndGoSeconds = e.target.value))
              }
            />
          </Field>
          <Field label="Đứng lên ngồi xuống 30 giây (lần)">
            <TextInput
              inputMode="numeric"
              value={f.chairStandCount}
              onChange={(e) =>
                update((d) => void (d.riskAssessment.falls.chairStandCount = e.target.value.replace(/\D/g, '')))
              }
            />
          </Field>
        </div>
      </div>

      {band.level && (
        <div className={`notice notice--${band.tone === 'ok' ? 'ok' : 'warn'}`} style={{ marginTop: 12 }}>
          <span aria-hidden="true">{band.tone === 'ok' ? '✅' : '⚠️'}</span>
          <div>
            <strong>{band.label}</strong>
            <ul style={{ margin: '4px 0 0', paddingLeft: 18 }}>
              {band.reasons.map((r) => (
                <li key={r}>{r}</li>
              ))}
            </ul>
            {band.level !== 'low' && (
              <>
                <div style={{ marginTop: 8, fontWeight: 600 }}>Cần cân nhắc:</div>
                <ul style={{ margin: '2px 0 0', paddingLeft: 18 }}>
                  {FALLS_ACTIONS[band.level].map((a) => (
                    <li key={a}>{a}</li>
                  ))}
                </ul>
              </>
            )}
          </div>
        </div>
      )}

      <button type="button" className="link-btn" style={{ marginTop: 10 }} onClick={() => setShowRule((v) => !v)}>
        {showRule ? 'Ẩn cách xếp mức' : 'Mức này được xếp thế nào?'}
      </button>
      {showRule && (
        <ul className="small muted" style={{ margin: '6px 0 0', paddingLeft: 18 }}>
          {FALLS_RULE_TEXT.map((r) => (
            <li key={r}>{r}</li>
          ))}
        </ul>
      )}

      <div style={{ marginTop: 12 }}>
        <Field label="Ghi chú">
          <TextArea
            rows={2}
            value={f.note}
            onChange={(e) => update((d) => void (d.riskAssessment.falls.note = e.target.value))}
          />
        </Field>
      </div>
    </div>
  )
}

/**
 * Cardiovascular risk — the learner assembles the inputs, reads the chart and
 * records the result. Nothing here is computed, pre-filled or cross-checked:
 * knowing which variables the chart needs, and transcribing them correctly, is
 * part of what is being learnt. The teacher sees the values used in the export.
 */
function CvdRiskCard({ record, update }: SectionProps) {
  const cvd = record.riskAssessment.cvd
  const applicable = record.patient.ageYears === null || record.patient.ageYears >= 40

  if (!applicable) return null

  const setInput = (id: string, value: string) =>
    update((d) => {
      d.riskAssessment.cvd.inputs = { ...d.riskAssessment.cvd.inputs, [id]: value }
    })

  return (
    <div style={{ marginTop: 18, paddingTop: 14, borderTop: '1px solid var(--line)' }}>
      <div className="row-between" style={{ marginBottom: 4 }}>
        <div className="section-title" style={{ margin: 0 }}>
          Nguy cơ tim mạch 10 năm
        </div>
        {nonEmpty(cvd.band) && <Badge tone="warn">{cvd.band}</Badge>}
      </div>
      <p className="tiny muted" style={{ margin: '0 0 12px' }}>
        Bạn tự xác định các biến số cần thiết, tra biểu đồ chính thức rồi ghi lại kết quả. ClerkMate không
        tính hộ và không điền sẵn — biết biểu đồ cần những biến nào là một phần của bài học.
      </p>

      <div className="grid-2">
        {CVD_INPUTS.map((input) => (
          <Field key={input.id} label={input.label} help={input.hint}>
            <TextInput
              value={cvd.inputs[input.id] ?? ''}
              placeholder={input.placeholder}
              onChange={(e) => setInput(input.id, e.target.value)}
            />
          </Field>
        ))}
      </div>

      <div className="hr" />

      <Field label="Biểu đồ đã dùng">
        <Select
          value={cvd.chart}
          onChange={(e) => update((d) => void (d.riskAssessment.cvd.chart = e.target.value))}
          options={CVD_CHARTS.map((c) => ({ value: c, label: c }))}
          placeholder="Chọn biểu đồ"
        />
      </Field>
      <div className="grid-2">
        <Field label="Nguy cơ 10 năm (%)">
          <TextInput
            inputMode="decimal"
            value={cvd.percent}
            placeholder="12"
            onChange={(e) => update((d) => void (d.riskAssessment.cvd.percent = e.target.value))}
          />
        </Field>
        <Field label="Phân nhóm">
          <Select
            value={cvd.band}
            onChange={(e) => update((d) => void (d.riskAssessment.cvd.band = e.target.value))}
            options={CVD_BANDS.map((b) => ({ value: b, label: b }))}
            placeholder="Chọn nhóm"
          />
        </Field>
      </div>

      <Field label="Ghi chú">
        <TextArea
          rows={2}
          value={cvd.note}
          onChange={(e) => update((d) => void (d.riskAssessment.cvd.note = e.target.value))}
          placeholder="Cách tra, giả định đã dùng, lý do chọn biểu đồ này…"
        />
      </Field>

    </div>
  )
}

/**
 * Recall before recognition, with the scaffolding faded by level.
 *
 * `recallThenChecklist` — write from memory, then the list appears.
 * `generate` — no list to reveal at all: only the domain's structural prompts.
 *   The learner writes their own list and commits it, and only then does the
 *   catalogue appear as an after-action review.
 *
 * There is deliberately no "skip": a single free tap past the exercise is how
 * the exercise stops happening. The way out is to commit a list — or to state
 * explicitly that the domain was reviewed and nothing was found, which is a
 * clinical statement rather than an escape hatch.
 */
function RecallGate({
  record,
  update,
  domain,
  mode,
}: {
  record: SectionProps['record']
  update: SectionProps['update']
  domain: RiskDomainDef
  mode: RiskDomainMode
}) {
  const entry = record.riskAssessment.recall[domain.id]
  const text = entry?.text ?? ''
  const committed = !!entry?.revealedAt
  const generate = mode === 'generate'

  const setText = (value: string) =>
    update((d) => {
      const cur = d.riskAssessment.recall[domain.id] ?? { text: '', revealedAt: '' }
      d.riskAssessment.recall[domain.id] = { ...cur, text: value }
    })

  const commit = () =>
    update((d) => {
      const cur = d.riskAssessment.recall[domain.id] ?? { text: '', revealedAt: '' }
      d.riskAssessment.recall[domain.id] = {
        ...cur,
        revealedAt: new Date().toISOString(),
        mode,
      }
    })

  const markNoneFound = () =>
    update((d) => {
      const cur = d.riskAssessment.recall[domain.id] ?? { text: '', revealedAt: '' }
      d.riskAssessment.recall[domain.id] = {
        text: cur.text.trim() || 'Đã rà soát nhóm này, không ghi nhận yếu tố nào.',
        revealedAt: new Date().toISOString(),
        mode,
      }
      // Reviewing a domain and finding nothing is an answer, so record it.
      const ids = new Set(
        d.riskAssessment.factors.filter((f) => f.domain === domain.id).map((f) => f.id),
      )
      for (const f of d.riskAssessment.factors) {
        if (ids.has(f.id) && f.present === 'unknown') f.present = 'no'
      }
    })

  if (!committed) {
    return (
      <div
        style={{
          border: '1px dashed var(--brand-500)',
          borderRadius: 'var(--r-md)',
          padding: 'var(--sp-3)',
          background: 'var(--brand-50)',
          marginBottom: 16,
        }}
      >
        <div style={{ fontWeight: 650, fontSize: 14, marginBottom: 4 }}>
          {generate ? 'Bạn tự liệt kê' : 'Bạn tự nghĩ trước đã'}
        </div>
        <p className="small" style={{ margin: '0 0 10px' }}>
          {generate ? (
            <>
              Ở mức <strong>{record.learnerLevel}</strong>, nhóm này <strong>không có danh sách sẵn</strong>.
              Bạn tự liệt kê những yếu tố cần rà soát cho bệnh nhân cụ thể này.
            </>
          ) : (
            <>
              Với bệnh nhân <strong>cụ thể này</strong>, nhóm nguy cơ trên có những yếu tố nào? Viết ra những
              gì bạn nhớ được — mỗi ý một dòng.
            </>
          )}
        </p>

        {generate && domain.prompts && domain.prompts.length > 0 && (
          <div style={{ marginBottom: 10 }}>
            <div className="tiny muted" style={{ marginBottom: 6 }}>
              Gợi ý cấu trúc để nghĩ theo — không phải đáp án:
            </div>
            <div className="chips">
              {domain.prompts.map((prompt) => (
                <span key={prompt} className="badge badge--muted">{prompt}</span>
              ))}
            </div>
          </div>
        )}

        <TextArea
          rows={5}
          value={text}
          placeholder={'Mỗi ý một dòng:\n- \n- \n- '}
          onChange={(e) => setText(e.target.value)}
        />
        <div className="btn-row" style={{ marginTop: 10 }}>
          <button
            type="button"
            className="btn btn--primary btn--sm"
            disabled={countListedItems(text) === 0}
            onClick={commit}
          >
            {generate
              ? `Chốt danh sách (${countListedItems(text)} ý)`
              : `Xong — mở danh mục (${countListedItems(text)} ý)`}
          </button>
          <button type="button" className="btn btn--secondary btn--sm" onClick={markNoneFound}>
            Nhóm này không có
          </button>
        </div>
        {countListedItems(text) === 0 && (
          <p className="tiny muted" style={{ margin: '8px 0 0' }}>
            Viết ít nhất một ý, hoặc chọn “Nhóm này không có” nếu bạn đã rà soát và không ghi nhận gì.
          </p>
        )}
      </div>
    )
  }

  if (!nonEmpty(text)) return null

  return (
    <div
      style={{
        border: '1px solid var(--line)',
        borderRadius: 'var(--r-md)',
        padding: 'var(--sp-3)',
        background: 'var(--surface-alt)',
        marginBottom: 16,
      }}
    >
      <div className="section-title" style={{ margin: '0 0 6px' }}>
        Bạn đã tự nêu ({countListedItems(text)} ý)
      </div>
      <TextArea
        rows={Math.min(6, Math.max(2, countListedItems(text) + 1))}
        value={text}
        placeholder="Bổ sung thêm nếu nghĩ ra"
        onChange={(e) => setText(e.target.value)}
      />
      <p className="tiny muted" style={{ margin: '6px 0 0' }}>
        Phần này in kèm bệnh án, nên giảng viên thấy được bạn tự nghĩ ra những gì trước khi xem danh mục.
      </p>
    </div>
  )
}

/**
 * The catalogue can never be complete, so the learner can always add a factor
 * of their own. Custom factors are never filtered out by age or sex.
 */
function CustomFactorAdder({
  record,
  update,
  domain,
}: {
  record: SectionProps['record']
  update: SectionProps['update']
  domain: RiskDomainId
}) {
  const [label, setLabel] = useState('')

  const add = () => {
    const value = label.trim()
    if (!value) return
    update((d) => {
      d.riskAssessment.factors.push({
        id: uid('rf'),
        label: value,
        domain,
        present: 'yes',
        note: '',
        custom: true,
      })
    })
    setLabel('')
  }

  const mine = record.riskAssessment.factors.filter((f) => f.custom && f.domain === domain)

  return (
    <div style={{ marginTop: 16, paddingTop: 12, borderTop: '1px dashed var(--line-strong)' }}>
      <div className="section-title" style={{ marginBottom: 4 }}>
        Yếu tố khác bạn nghĩ ra
      </div>
      <p className="tiny muted" style={{ margin: '0 0 8px' }}>
        Danh sách trên không bao giờ đủ. Yếu tố bạn thêm sẽ vào bệnh án như mọi yếu tố khác.
      </p>
      <div style={{ display: 'flex', gap: 8 }}>
        <TextInput
          value={label}
          placeholder="Ví dụ: nuôi gia cầm, nguy cơ cúm gia cầm"
          onChange={(e) => setLabel(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              add()
            }
          }}
        />
        <button type="button" className="btn btn--secondary btn--sm" onClick={add}>
          Thêm
        </button>
      </div>
      {mine.length > 0 && (
        <div className="chips" style={{ marginTop: 10 }}>
          {mine.map((f) => (
            <Chip
              key={f.id}
              small
              on
              onClick={() =>
                update((d) => {
                  d.riskAssessment.factors = d.riskAssessment.factors.filter((x) => x.id !== f.id)
                })
              }
            >
              {f.label} ✕
            </Chip>
          ))}
        </div>
      )}
    </div>
  )
}
