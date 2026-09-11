import { useCallback, useEffect, useState } from 'react'
import type { CaseSummary, LearnerLevel } from '../types/case'
import { deleteCase, listCases, saveCase } from '../db/repository'
import { createEmptyCase } from '../types/factory'
import { STATUS } from '../workflow/status'
import { LEVELS } from '../config/levels'
import { SEX_LABEL, relativeTime } from '../utils/format'
import { useProfile } from '../hooks/useProfile'
import { Badge, Card, EmptyState, Field, Notice, Progress, TextInput } from '../components/Ui'
import { Sheet } from '../components/Sheet'
import { TopBar } from '../components/TopBar'
import { useToast } from '../components/Toast'
import { DEMO_CASES, seedDemoCase } from '../config/demoCases'
import type { DemoCaseDef } from '../config/demoCases'
import type { Route } from '../hooks/useRoute'

export function HomeScreen({ navigate }: { navigate: (r: Route) => void }) {
  const [cases, setCases] = useState<CaseSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [menuFor, setMenuFor] = useState<CaseSummary | null>(null)
  const [pickingDemo, setPickingDemo] = useState(false)
  const { profile } = useProfile()
  const level: LearnerLevel = profile?.level ?? 'Y5'
  const toast = useToast()

  const refresh = useCallback(() => {
    setLoading(true)
    listCases()
      .then(setCases)
      .catch(() => toast('Không đọc được dữ liệu cục bộ.'))
      .finally(() => setLoading(false))
  }, [toast])

  useEffect(() => {
    refresh()
  }, [refresh])

  const onCreate = async (label: string) => {
    const next = createEmptyCase(level, label || `Ca ${String(cases.length + 1).padStart(2, '0')}`)
    const saved = await saveCase(next)
    if (!saved) return
    setCreating(false)
    navigate({ name: 'case', caseId: saved.id, tab: 'note' })
  }

  const [seeding, setSeeding] = useState(false)

  const onSeedDemo = async (demo: DemoCaseDef) => {
    setSeeding(true)
    try {
      await seedDemoCase(demo, profile?.level)
      setPickingDemo(false)
      toast(`Đã tạo ${demo.label}.`)
      refresh()
    } finally {
      setSeeding(false)
    }
  }

  /** One tap for someone who just wants to look around with real material. */
  const onSeedAllDemos = async () => {
    setSeeding(true)
    try {
      for (const demo of DEMO_CASES) await seedDemoCase(demo, profile?.level)
      setPickingDemo(false)
      toast(`Đã tạo ${DEMO_CASES.length} ca mẫu.`)
      refresh()
    } finally {
      setSeeding(false)
    }
  }

  const onDelete = async (id: string) => {
    await deleteCase(id)
    setMenuFor(null)
    toast('Đã xóa ca lâm sàng.')
    refresh()
  }

  return (
    <>
      <TopBar
        title="ClerkMate"
        subtitle={
          profile
            ? `${profile.fullName} · ${profile.studentId} · ${profile.level}`
            : 'Từ ghi chú nhanh đến bệnh án hoàn chỉnh'
        }
        right={
          <button
            type="button"
            className="iconbtn"
            onClick={() => navigate({ name: 'settings' })}
            aria-label="Cài đặt"
          >
            ⚙
          </button>
        }
      />

      <div className="content">
        {/*
          Orientation card. Someone opening ClerkMate for the first time — a
          reviewer, a teacher, a judge — has to be able to tell in one glance
          what this is, that it is for learning rather than for real patients,
          and that they can try it immediately without an account.
        */}
        <Card className="card--flat">
          <h2 style={{ marginBottom: 6 }}>Bệnh án Y học gia đình cho người học</h2>
          <p className="small muted" style={{ margin: 0 }}>
            Ghi chú nhanh tại phòng khám → bệnh án có cấu trúc → xuất PDF nộp giảng viên. Ca mẫu là
            bệnh nhân giả lập.
          </p>
          <div className="btn-row" style={{ marginTop: 14 }}>
            <button
              type="button"
              className="btn btn--primary"
              style={{ flex: 1 }}
              onClick={() => setPickingDemo(true)}
            >
              ▶ Dùng thử ca mẫu
            </button>
            <button type="button" className="btn btn--secondary" onClick={() => setCreating(true)}>
              ＋ Ca mới
            </button>
          </div>
        </Card>

        <Card className="card--flat">
          <div className="row-between" style={{ alignItems: 'flex-start' }}>
            <div>
              <h2>Ca lâm sàng của bạn</h2>
              <p className="small muted" style={{ margin: '4px 0 0' }}>
                Dữ liệu lưu ngay trên thiết bị này. Không tài khoản, không máy chủ.
              </p>
            </div>
            <Badge tone="brand">{cases.length} ca</Badge>
          </div>
        </Card>

        {loading ? (
          <p className="muted small">Đang tải…</p>
        ) : cases.length === 0 ? (
          <Card className="card--pad0">
            <EmptyState
              icon="🩺"
              title="Chưa có ca nào"
              body="Bấm “Dùng thử ca mẫu” ở trên để mở một ca giả lập đã điền đầy đủ, hoặc tạo ca mới và bắt đầu bằng một ghi chú nhanh."
              action={
                <button type="button" className="btn btn--secondary" onClick={() => setPickingDemo(true)}>
                  ▶ Dùng thử ca mẫu
                </button>
              }
            />
          </Card>
        ) : (
          <Card className="card--pad0 card--flat">
            <div className="list">
              {cases.map((c) => (
                <div key={c.id} className="list__item" style={{ cursor: 'default' }}>
                  <button
                    type="button"
                    className="list__icon"
                    style={{ border: 0, cursor: 'pointer' }}
                    onClick={() => navigate({ name: 'case', caseId: c.id, tab: 'record' })}
                    aria-label={`Mở ${c.caseLabel}`}
                  >
                    {c.sex === 'female' ? '👩' : c.sex === 'male' ? '👨' : '🧑'}
                  </button>
                  <button
                    type="button"
                    className="grow"
                    style={{ border: 0, background: 'none', textAlign: 'left', padding: 0, cursor: 'pointer' }}
                    onClick={() => navigate({ name: 'case', caseId: c.id, tab: 'record' })}
                  >
                    <div className="title">
                      {c.patientName || c.caseLabel || 'Chưa đặt tên'}
                      {c.ageYears !== null && (
                        <span className="muted" style={{ fontWeight: 400 }}>
                          {' '}
                          · {c.ageYears} tuổi · {SEX_LABEL[c.sex]}
                        </span>
                      )}
                    </div>
                    <div className="meta">
                      {c.chiefComplaint || 'Chưa có lý do khám'} · {relativeTime(c.updatedAt)}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 7 }}>
                      <Badge tone="muted">{c.learnerLevel}</Badge>
                      <Badge tone={STATUS[c.status].tone}>{STATUS[c.status].label}</Badge>
                      {c.hasUnreadReview && <Badge tone="danger">Nhận xét mới</Badge>}
                      <div style={{ flex: 1 }}>
                        <Progress percent={c.percent} />
                      </div>
                      <span className="tiny mono muted">{c.percent}%</span>
                    </div>
                  </button>
                  <button
                    type="button"
                    className="iconbtn iconbtn--ghost"
                    onClick={() => setMenuFor(c)}
                    aria-label="Tùy chọn"
                  >
                    ⋯
                  </button>
                </div>
              ))}
            </div>
          </Card>
        )}

        {cases.length > 0 && (
          <button
            type="button"
            className="link-btn"
            onClick={() => setPickingDemo(true)}
            style={{ alignSelf: 'flex-start' }}
          >
            + Thêm ca mẫu để trình diễn
          </button>
        )}


        <Notice tone="info">
          Dữ liệu chỉ nằm trên thiết bị này. Nên sao lưu trong phần Cài đặt trước khi trình diễn.
        </Notice>
      </div>

      <Sheet open={pickingDemo} onClose={() => setPickingDemo(false)} title="Chọn ca mẫu">
        <p className="small muted" style={{ marginTop: -6 }}>
          Hai ca giả lập đã điền đầy đủ, kèm ảnh phiếu xét nghiệm mô phỏng để thử ngay công cụ che thông tin
          định danh. Ca được lập ở <strong>mức {profile?.level ?? 'Y5'}</strong> theo hồ sơ của bạn — đổi mức
          trong Cài đặt thì mức độ đầy đủ yêu cầu cũng đổi theo.
        </p>
        <button
          type="button"
          className="btn btn--primary btn--block"
          style={{ marginBottom: 'var(--sp-3)' }}
          disabled={seeding}
          onClick={() => void onSeedAllDemos()}
        >
          ▶ Tạo cả {DEMO_CASES.length} ca mẫu
        </button>
        {seeding && <p className="small muted">Đang tạo ca và ảnh đính kèm…</p>}
        <div className="stack">
          {DEMO_CASES.map((demo) => (
            <button
              key={demo.id}
              type="button"
              className="list__item"
              style={{ borderRadius: 'var(--r-md)', border: '1px solid var(--line)', alignItems: 'flex-start' }}
              disabled={seeding}
              onClick={() => void onSeedDemo(demo)}
            >
              <span className="list__icon" aria-hidden="true">{demo.icon}</span>
              <span className="grow">
                <span className="title">{demo.label}</span>
                <span className="meta">{demo.summary}</span>
                <span className="chips" style={{ marginTop: 8 }}>
                  {demo.highlights.map((h) => (
                    <Badge key={h} tone="brand">{h}</Badge>
                  ))}
                </span>
              </span>
            </button>
          ))}
        </div>
      </Sheet>

      <NewCaseSheet
        open={creating}
        level={level}
        suggestedLabel={`Ca ${String(cases.length + 1).padStart(2, '0')}`}
        onClose={() => setCreating(false)}
        onCreate={onCreate}
        onEditProfile={() => {
          setCreating(false)
          navigate({ name: 'settings' })
        }}
      />

      <Sheet open={!!menuFor} onClose={() => setMenuFor(null)} title={menuFor?.patientName || menuFor?.caseLabel}>
        <div className="stack">
          <button
            type="button"
            className="btn btn--secondary btn--block"
            onClick={() => {
              if (menuFor) navigate({ name: 'case', caseId: menuFor.id, tab: 'review' })
              setMenuFor(null)
            }}
          >
            Xem trước &amp; xuất PDF
          </button>
          <button
            type="button"
            className="btn btn--danger btn--block"
            onClick={() => menuFor && onDelete(menuFor.id)}
          >
            Xóa ca này
          </button>
          <p className="tiny muted" style={{ textAlign: 'center', margin: 0 }}>
            Xóa là vĩnh viễn và không thể hoàn tác.
          </p>
        </div>
      </Sheet>
    </>
  )
}

function NewCaseSheet({
  open,
  onClose,
  onCreate,
  onEditProfile,
  level,
  suggestedLabel,
}: {
  open: boolean
  onClose: () => void
  onCreate: (label: string) => void
  onEditProfile: () => void
  level: LearnerLevel
  suggestedLabel: string
}) {
  const [label, setLabel] = useState(suggestedLabel)

  useEffect(() => {
    if (open) setLabel(suggestedLabel)
  }, [open, suggestedLabel])

  return (
    <Sheet open={open} onClose={onClose} title="Ca lâm sàng mới">
      <Field label="Tên ca / mã ca">
        <TextInput value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Ví dụ: Ca 01" />
      </Field>

      <div className="notice notice--info" style={{ marginBottom: 'var(--sp-3)' }}>
        <span aria-hidden="true">🎓</span>
        <div>
          Mức yêu cầu: <strong>{level}</strong> — {LEVELS[level].description}
          <br />
          <button type="button" className="link-btn" onClick={onEditProfile}>
            Đổi trình độ trong hồ sơ người học
          </button>
        </div>
      </div>

      <button type="button" className="btn btn--primary btn--block" onClick={() => onCreate(label)}>
        Tạo và bắt đầu ghi chú
      </button>
    </Sheet>
  )
}
