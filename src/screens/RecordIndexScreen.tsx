import { useMemo } from 'react'
import type { CaseRecord, CompletenessSnapshot } from '../types/case'
import { SECTIONS, SECTION_GROUPS } from '../config/sections'
import { sectionProgress } from '../completeness/engine'
import { Badge, Card, Progress } from '../components/Ui'
import type { Route } from '../hooks/useRoute'

export function RecordIndexScreen({
  record,
  completeness,
  navigate,
}: {
  record: CaseRecord
  completeness: CompletenessSnapshot
  navigate: (r: Route) => void
}) {
  const progress = useMemo(() => sectionProgress(completeness), [completeness])

  return (
    <div className="content">
      <Card className="card--flat">
        <div className="row-between">
          <div>
            <h2>Bệnh án có cấu trúc</h2>
            <p className="small muted" style={{ margin: '4px 0 0' }}>
              Mức {record.learnerLevel} · {completeness.mandatorySatisfied}/{completeness.mandatoryTotal} mục bắt buộc
            </p>
          </div>
          <Badge tone={completeness.percent >= 80 ? 'ok' : completeness.percent >= 50 ? 'warn' : 'danger'}>
            {completeness.percent}%
          </Badge>
        </div>
        <div style={{ marginTop: 12 }}>
          <Progress percent={completeness.percent} />
        </div>
      </Card>

      {SECTION_GROUPS.map((group) => {
        const items = SECTIONS.filter((s) => s.group === group)
        if (items.length === 0) return null
        return (
          <div key={group}>
            <div className="section-title" style={{ marginBottom: 10 }}>{group}</div>
            <Card className="card--pad0 card--flat">
              <div className="list">
                {items.map((s) => {
                  const p = progress.get(s.id)
                  const done = p && p.total > 0 && p.satisfied === p.total
                  return (
                    <button
                      key={s.id}
                      type="button"
                      className="list__item"
                      onClick={() =>
                        s.id === 'genogram'
                          ? navigate({ name: 'case', caseId: record.id, tab: 'genogram' })
                          : navigate({ name: 'section', caseId: record.id, sectionId: s.id })
                      }
                    >
                      <span className="list__icon">{s.icon}</span>
                      <span className="grow">
                        <span className="title">{s.label}</span>
                        <span className="meta">{s.blurb}</span>
                      </span>
                      {p ? (
                        p.mandatoryMissing > 0 ? (
                          <Badge tone="danger">thiếu {p.mandatoryMissing}</Badge>
                        ) : done ? (
                          <Badge tone="ok">đủ</Badge>
                        ) : (
                          <Badge tone="muted">
                            {p.satisfied}/{p.total}
                          </Badge>
                        )
                      ) : (
                        <Badge tone="muted">tùy chọn</Badge>
                      )}
                      <span className="muted" aria-hidden="true">›</span>
                    </button>
                  )
                })}
              </div>
            </Card>
          </div>
        )
      })}
    </div>
  )
}
