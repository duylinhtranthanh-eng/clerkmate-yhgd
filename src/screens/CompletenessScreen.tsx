import { useState } from 'react'
import type { CaseRecord, CompletenessSnapshot, LearnerLevel, RequirementTier } from '../types/case'
import { bedsideMinimum, evaluateCompleteness, missingByTier } from '../completeness/engine'
import { LEVELS, LEVEL_ORDER } from '../config/levels'
import { SECTION_BY_ID } from '../config/sections'
import type { SectionId } from '../config/sections'
import { Badge, Card, Chip, Notice, Ring } from '../components/Ui'
import type { Route } from '../hooks/useRoute'

const TIER_META: Record<RequirementTier, { label: string; tone: 'danger' | 'warn' | 'muted'; blurb: string }> = {
  mandatory: {
    label: 'Bắt buộc còn thiếu',
    tone: 'danger',
    blurb: 'Chưa đạt yêu cầu tối thiểu của bệnh án ở mức này.',
  },
  recommended: {
    label: 'Nên có',
    tone: 'warn',
    blurb: 'Không bắt buộc nhưng làm bệnh án chặt chẽ hơn.',
  },
  optional: {
    label: 'Nâng cao',
    tone: 'muted',
    blurb: 'Dành cho người học muốn đi sâu hơn.',
  },
}

export function CompletenessScreen({
  record,
  completeness,
  navigate,
}: {
  record: CaseRecord
  completeness: CompletenessSnapshot
  navigate: (r: Route) => void
}) {
  const [preview, setPreview] = useState<LearnerLevel | null>(null)
  const shown: CompletenessSnapshot = preview
    ? evaluateCompleteness(record, preview)
    : completeness

  const bedside = bedsideMinimum(shown)


  const go = (sectionId: SectionId) =>
    sectionId === 'genogram'
      ? navigate({ name: 'case', caseId: record.id, tab: 'genogram' })
      : navigate({ name: 'section', caseId: record.id, sectionId })

  return (
    <div className="content">
      <Card className="card--flat">
        <div style={{ display: 'flex', gap: 18, alignItems: 'center' }}>
          <Ring percent={shown.percent} />
          <div style={{ flex: 1 }}>
            <h2>{shown.percent}% hoàn chỉnh</h2>
            <p className="small muted" style={{ margin: '6px 0 0' }}>
              {LEVELS[shown.level].label}
            </p>
            <div className="chips" style={{ marginTop: 10 }}>
              <Badge tone="danger">
                Bắt buộc {shown.mandatorySatisfied}/{shown.mandatoryTotal}
              </Badge>
              <Badge tone="warn">
                Nên có {shown.recommendedSatisfied}/{shown.recommendedTotal}
              </Badge>
              <Badge tone="muted">
                Nâng cao {shown.optionalSatisfied}/{shown.optionalTotal}
              </Badge>
            </div>
          </div>
        </div>
      </Card>

      {/*
        Placed above everything else because it is the only part with a deadline
        attached: the rest of the record can be finished from notes tonight, and
        this part cannot be finished at all once the patient has gone home.
      */}
      {bedside.total > 0 && (
        <Card
          title={`Tối thiểu tại phòng khám (${bedside.satisfied}/${bedside.total})`}
          hint="Những mục chỉ lấy được khi bệnh nhân còn ngồi trước mặt. Phần còn lại hoàn thiện sau."
          className="card--flat"
        >
          {bedside.missing.length === 0 ? (
            <Notice tone="ok">Đã ghi đủ phần phải lấy tại chỗ.</Notice>
          ) : (
            <div className="stack stack--tight">
              {bedside.missing.map((i) => (
                <button
                  key={i.id}
                  type="button"
                  className="list__item"
                  onClick={() => go(i.sectionId as SectionId)}
                >
                  <div>
                    <div className="list__title">{i.label}</div>
                    <div className="list__sub">{SECTION_BY_ID[i.sectionId as SectionId]?.label}</div>
                  </div>
                  <span aria-hidden="true">›</span>
                </button>
              ))}
            </div>
          )}
        </Card>
      )}

      <Card
        title="Xem thử mức khác"
        hint={`Ca này được chấm theo mức ${record.learnerLevel} trong hồ sơ người học. Chạm để xem mức khác yêu cầu những gì.`}
      >
        <div className="chips">
          {LEVEL_ORDER.map((l) => (
            <Chip
              key={l}
              on={(preview ?? record.learnerLevel) === l}
              onClick={() => setPreview(l === record.learnerLevel ? null : l)}
            >
              {l}
              {l === record.learnerLevel ? ' ·' : ''}
            </Chip>
          ))}
        </div>
        <p className="small muted" style={{ margin: '10px 0 0' }}>
          {LEVELS[preview ?? record.learnerLevel].description}
        </p>
        {preview && preview !== record.learnerLevel && (
          <p className="tiny muted" style={{ margin: '8px 0 0' }}>
            Đang xem thử mức {preview}. Mức chính thức của ca vẫn là {record.learnerLevel} — đổi trong Cài đặt
            › Hồ sơ người học.
          </p>
        )}
      </Card>

      {(['mandatory', 'recommended', 'optional'] as RequirementTier[]).map((tier) => {
        const items = missingByTier(shown, tier)
        const meta = TIER_META[tier]
        const definedForLevel = shown.items.some((i) => i.tier === tier)
        if (!definedForLevel) return null
        return (
          <Card key={tier} title={`${meta.label} (${items.length})`} hint={meta.blurb} className="card--flat">
            {items.length === 0 ? (
              <Notice tone="ok">Không còn mục nào trong nhóm này.</Notice>
            ) : (
              <div className="stack stack--tight">
                {items.map((i) => (
                  <button
                    key={i.id}
                    type="button"
                    className="list__item"
                    style={{ borderRadius: 'var(--r-md)', border: '1px solid var(--line)' }}
                    onClick={() => go(i.sectionId as SectionId)}
                  >
                    <span className="list__icon">
                      {SECTION_BY_ID[i.sectionId as SectionId]?.icon ?? '•'}
                    </span>
                    <span className="grow">
                      <span className="title">{i.label}</span>
                      <span className="meta">{i.hint}</span>
                    </span>
                    <Badge tone={meta.tone}>{SECTION_BY_ID[i.sectionId as SectionId]?.label}</Badge>
                  </button>
                ))}
              </div>
            )}
          </Card>
        )
      })}

      <Notice tone="info">
        ClerkMate chỉ nêu những gì <strong>chưa được ghi nhận</strong>. Ứng dụng không tự điền và không suy đoán
        thông tin lâm sàng thay bạn.
      </Notice>
    </div>
  )
}
