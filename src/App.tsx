import { useEffect } from 'react'
import { ToastProvider, useToast } from './components/Toast'
import { ProfileProvider, useProfile } from './hooks/useProfile'
import { OnboardingScreen } from './screens/OnboardingScreen'
import { isProfileComplete } from './types/profile'
import { TopBar } from './components/TopBar'
import { TabBar } from './components/TabBar'
import { HomeScreen } from './screens/HomeScreen'
import { SettingsScreen } from './screens/SettingsScreen'
import { QuickNoteScreen } from './screens/QuickNoteScreen'
import { RecordIndexScreen } from './screens/RecordIndexScreen'
import { CompletenessScreen } from './screens/CompletenessScreen'
import { GenogramScreen } from './screens/GenogramScreen'
import { ReviewScreen } from './screens/ReviewScreen'
import { SectionScreen } from './screens/SectionScreen'
import { SECTION_BY_ID } from './config/sections'
import { useAppUpdate } from './hooks/useAppUpdate'
import { useCaseEditor } from './hooks/useCaseEditor'
import { useRoute } from './hooks/useRoute'
import type { CaseTab, Route } from './hooks/useRoute'
import type { CaseRecord, CaseStatus } from './types/case'
import { SEX_LABEL, formatDateTime } from './utils/format'
import { Badge, EmptyState, Notice } from './components/Ui'
import { STATUS, caseStatus } from './workflow/status'
import { acknowledgeReviews, reopen, unreadReviews } from './workflow/submission'

export default function App() {
  const { updateReady, applyUpdate } = useAppUpdate()

  return (
    <ToastProvider>
      <ProfileProvider>
        <div className="app">
          <div className="shell">
            <Routes />
            {updateReady && (
              <div className="update-bar no-print" role="status">
                <span>Đã có bản cập nhật ClerkMate.</span>
                <button type="button" className="btn btn--sm" onClick={applyUpdate}>
                  Tải lại
                </button>
              </div>
            )}
          </div>
        </div>
      </ProfileProvider>
    </ToastProvider>
  )
}

function Routes() {
  const { route, navigate, back } = useRoute()
  const { profile, loading } = useProfile()

  useEffect(() => {
    if (!window.location.hash) window.location.hash = '#/'
  }, [])

  if (loading) {
    return (
      <div className="content">
        <p className="muted small">Đang mở ClerkMate…</p>
      </div>
    )
  }

  // First run: the learner profile has to exist before anything is recorded.
  if (!isProfileComplete(profile)) return <OnboardingScreen />

  return (
    <>
      {route.name === 'home' && <HomeScreen navigate={navigate} />}
      {route.name === 'settings' && <SettingsScreen back={back} />}
      {(route.name === 'case' || route.name === 'section') && (
        <CaseShell route={route} navigate={navigate} />
      )}
    </>
  )
}

function CaseShell({
  route,
  navigate,
}: {
  route: Extract<Route, { name: 'case' } | { name: 'section' }>
  navigate: (r: Route) => void
}) {
  const {
    record,
    loading,
    notFound,
    saveState,
    update,
    replace,
    replaceWorkflow,
    completeness,
    lockedAttempt,
  } = useCaseEditor(route.caseId)
  const toast = useToast()

  // Editing a locked record is refused inside the editor, so the explanation
  // has to be raised here rather than by each field.
  useEffect(() => {
    if (lockedAttempt) toast('Ca đã nộp nên đang khoá sửa. Bấm “Mở lại để sửa” trong tab Xem trước.')
  }, [lockedAttempt, toast])

  if (loading) {
    return (
      <>
        <TopBar title="Đang mở ca…" onBack={() => navigate({ name: 'home' })} />
        <div className="content">
          <p className="muted small">Đang đọc dữ liệu cục bộ…</p>
        </div>
      </>
    )
  }

  if (notFound || !record || !completeness) {
    return (
      <>
        <TopBar title="Không tìm thấy ca" onBack={() => navigate({ name: 'home' })} />
        <div className="content">
          <EmptyState
            icon="🔍"
            title="Ca lâm sàng không tồn tại"
            body="Có thể ca này đã bị xóa hoặc dữ liệu trình duyệt đã được dọn."
            action={
              <button type="button" className="btn btn--primary" onClick={() => navigate({ name: 'home' })}>
                Về danh sách ca
              </button>
            }
          />
        </div>
      </>
    )
  }

  const saveLabel =
    saveState === 'saving' ? 'Đang lưu…' : saveState === 'error' ? 'Lỗi lưu' : 'Đã lưu cục bộ'

  const subject =
    record.patient.name ||
    record.patient.caseLabel ||
    'Ca chưa đặt tên'

  const subtitle = [
    record.patient.ageYears !== null ? `${record.patient.ageYears} tuổi` : null,
    record.patient.sex !== 'unknown' ? SEX_LABEL[record.patient.sex] : null,
    record.learnerLevel,
    saveLabel,
  ]
    .filter(Boolean)
    .join(' · ')

  if (route.name === 'section') {
    const def = SECTION_BY_ID[route.sectionId]
    return (
      <>
        <TopBar
          title={def?.label ?? 'Phần bệnh án'}
          subtitle={subject}
          onBack={() => navigate({ name: 'case', caseId: record.id, tab: 'record' })}
        />
        <CaseBanners record={record} replaceWorkflow={replaceWorkflow} navigate={navigate} />
        <SectionScreen sectionId={route.sectionId} record={record} update={update} />
      </>
    )
  }

  const tab: CaseTab = route.tab

  return (
    <>
      <TopBar
        title={subject}
        subtitle={subtitle}
        backLabel="Danh sách ca"
        // Explicit navigation, not history.back(): a learner who reloaded or
        // deep-linked into a case still gets out in one tap.
        onBack={() => navigate({ name: 'home' })}
        right={
          <button
            type="button"
            className="iconbtn"
            onClick={() => navigate({ name: 'case', caseId: record.id, tab: 'review' })}
            aria-label="Xem trước và xuất"
          >
            ⤴
          </button>
        }
      />

      <CaseBanners
        record={record}
        replaceWorkflow={replaceWorkflow}
        navigate={navigate}
        status={caseStatus(record, completeness)}
      />

      {tab === 'note' && <QuickNoteScreen record={record} replace={replace} />}
      {tab === 'record' && (
        <RecordIndexScreen record={record} completeness={completeness} navigate={navigate} />
      )}
      {tab === 'check' && (
        <CompletenessScreen record={record} completeness={completeness} navigate={navigate} />
      )}
      {tab === 'genogram' && <GenogramScreen record={record} update={update} />}
      {tab === 'review' && (
        <ReviewScreen
          record={record}
          completeness={completeness}
          replace={replace}
          replaceWorkflow={replaceWorkflow}
        />
      )}

      <TabBar active={tab} onSelect={(t) => navigate({ name: 'case', caseId: record.id, tab: t })} />
    </>
  )
}

/**
 * Everything the submission flow has to say about this case, in one strip.
 *
 * A returned record has to announce itself wherever the learner happens to
 * open the case, not only on the export tab.
 */
function CaseBanners({
  record,
  replaceWorkflow,
  navigate,
  status,
}: {
  record: CaseRecord
  /** Both actions here act on a locked record on purpose. */
  replaceWorkflow: (next: CaseRecord) => void
  navigate: (r: Route) => void
  status?: CaseStatus
}) {
  const unread = unreadReviews(record)
  const locked = record.submission.locked

  if (unread.length === 0 && !locked) return null

  return (
    <div className="content content--tight no-print">
      {unread.map((r) => (
        <Notice key={r.id} tone={r.decision === 'returned' ? 'warn' : 'ok'}>
          <strong>
            {r.decision === 'returned' ? 'Giảng viên trả lại để bổ sung' : 'Giảng viên đã chấp nhận bài'}
          </strong>
          <br />
          {r.reviewer} · {formatDateTime(r.at)}
          {r.comment && (
            <>
              <br />
              <span>“{r.comment}”</span>
            </>
          )}
          <br />
          <button
            type="button"
            className="link-btn"
            onClick={() => replaceWorkflow(acknowledgeReviews(record))}
          >
            Đã đọc
          </button>
        </Notice>
      ))}

      {locked && (
        <Notice tone="info">
          {status && <Badge tone={STATUS[status].tone}>{STATUS[status].label}</Badge>}{' '}
          Ca đã nộp (mã <span className="mono">{record.submission.code}</span>) nên đang khoá sửa.{' '}
          <button type="button" className="link-btn" onClick={() => replaceWorkflow(reopen(record))}>
            Mở lại để sửa
          </button>
          {' · '}
          <button
            type="button"
            className="link-btn"
            onClick={() => navigate({ name: 'case', caseId: record.id, tab: 'review' })}
          >
            Xem thông tin bài nộp
          </button>
        </Notice>
      )}
    </div>
  )
}
