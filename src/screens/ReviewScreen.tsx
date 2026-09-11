import { useState } from 'react'
import type { CaseRecord, CompletenessSnapshot } from '../types/case'
import { CaseDocument } from '../export/CaseDocument'
import { DepartmentForm } from '../export/DepartmentForm'
import {
  canShare,
  downloadJson,
  openEmailDraft,
  printRecord,
  shareSummary,
  triggerDownload,
} from '../export/exportPdf'
import { missingByTier } from '../completeness/engine'
import { Badge, Card, Chip, Notice } from '../components/Ui'
import { useToast } from '../components/Toast'
import { useProfile } from '../hooks/useProfile'
import { STATUS, caseStatus, submitBlockers } from '../workflow/status'
import {
  bundleFileName,
  buildBundle,
  markExported,
  reopen,
  submit,
} from '../workflow/submission'
import { formatDateTime } from '../utils/format'
import { isSubmissionSafe } from '../workflow/privacy'

export function ReviewScreen({
  record,
  completeness,
  replace,
  replaceWorkflow,
}: {
  record: CaseRecord
  completeness: CompletenessSnapshot
  replace: (next: CaseRecord) => void
  /** Reopening writes to a record that is locked by definition. */
  replaceWorkflow: (next: CaseRecord) => void
}) {
  const toast = useToast()
  const { profile } = useProfile()
  const missing = missingByTier(completeness, 'mandatory')
  const unredacted = record.attachments.filter((a) => !isSubmissionSafe(a))
  const status = caseStatus(record, completeness)
  const blockers = submitBlockers(record, completeness)
  const sub = record.submission

  const student = {
    fullName: profile?.fullName ?? '',
    studentId: profile?.studentId ?? '',
    level: String(profile?.level ?? record.learnerLevel),
    classGroup: profile?.classGroup ?? '',
  }

  const downloadBundle = (next: CaseRecord) => {
    const bundle = buildBundle(next, student)
    triggerDownload(
      new Blob([JSON.stringify(bundle)], { type: 'application/json' }),
      bundleFileName(bundle),
    )
  }

  const onPrint = () => {
    // The PDF is the artefact the teacher actually receives, so the moment it
    // is produced is worth keeping even if the case is never submitted.
    if (!sub.locked) replace(markExported(record))
    printRecord(record, profile)
  }

  const onSubmit = () => {
    if (blockers.length > 0) return
    const next = submit(record, student.studentId)
    replace(next)
    // No file is pushed at the learner here. What goes to the lecturer is the
    // PDF; the .json is a portable copy, produced only when asked for.
    toast(`Đã khoá sửa. Mã bệnh án: ${next.submission.code}`)
  }

  /**
   * Which document the printer gets.
   *
   * The department's form is what a teacher receives, so it is the default.
   * The learning report is the same data laid out for teaching — kept, because
   * some of what it shows (self-assessment, the completeness picture) has no
   * cell on the official form.
   */
  const [docMode, setDocMode] = useState<'form' | 'report'>('form')

  const onReopen = () => {
    replaceWorkflow(reopen(record))
    toast('Đã mở lại ca. Nhớ nộp lại sau khi bổ sung.')
  }

  return (
    <div className="content">
      <Card className="card--flat no-print">
        <div className="row-between" style={{ marginBottom: 12 }}>
          <div>
            <h2>Xem trước &amp; xuất</h2>
            <p className="small muted" style={{ margin: '4px 0 0' }}>
              Bản hiện dưới đây chính là bản PDF bạn sẽ xuất ra
              {profile ? `, có tên và mã số của ${profile.fullName}` : ''}.
            </p>
          </div>
          <Badge tone={completeness.percent >= 80 ? 'ok' : 'warn'}>{completeness.percent}%</Badge>
        </div>

        {unredacted.length > 0 && (
          <div style={{ marginBottom: 12 }}>
            <Notice tone="warn">
              <strong>{unredacted.length} ảnh chưa che thông tin định danh bệnh nhân.</strong> Mở phần Hình
              ảnh đính kèm để che trước khi gửi bệnh án cho giảng viên — ảnh sẽ được in trong PDF.
            </Notice>
          </div>
        )}

        {missing.length > 0 && (
          <div style={{ marginBottom: 12 }}>
            <Notice tone="warn">
              Còn {missing.length} mục bắt buộc chưa hoàn thành: {missing.slice(0, 3).map((m) => m.label).join(', ')}
              {missing.length > 3 && '…'}. Bạn vẫn có thể xuất bản nháp.
            </Notice>
          </div>
        )}

        <div className="chips" style={{ marginBottom: 12 }}>
          <Chip small on={docMode === 'form'} onClick={() => setDocMode('form')}>
            Bệnh án theo mẫu Bộ môn
          </Chip>
          <Chip small on={docMode === 'report'} onClick={() => setDocMode('report')}>
            Bản học tập ClerkMate
          </Chip>
        </div>

        <button type="button" className="btn btn--primary btn--block" onClick={onPrint}>
          🖨 Xuất PDF{docMode === 'form' ? ' theo mẫu Bộ môn' : ' bản học tập'}
        </button>

        <p className="small" style={{ margin: '12px 0 0' }}>
          Trong hộp thoại in, chọn <strong>Lưu thành PDF</strong> (Save as PDF). Trên iPhone: nút Chia sẻ →
          Lưu vào Tệp. Sau đó <strong>gửi tệp PDF cho giảng viên</strong> qua kênh lớp bạn đang dùng —
          email, Zalo, LMS hay Drive. ClerkMate không cần giảng viên cài gì cả.
        </p>

        {/*
          Deliberately not called "gửi PDF qua email". A mailto: link cannot
          attach a local file in any browser, so the button writes the message
          and says plainly that the learner has to attach the PDF themselves.
        */}
        <button
          type="button"
          className="btn btn--secondary btn--block"
          style={{ marginTop: 10 }}
          onClick={() => openEmailDraft(record, profile)}
        >
          ✉️ Mở email đã soạn sẵn lời nhắn
        </button>
        <p className="tiny muted" style={{ margin: '6px 0 0' }}>
          Email mở ra đã có sẵn tiêu đề và lời nhắn. <strong>Tệp PDF bạn phải tự đính kèm</strong> — trình
          duyệt không đính kèm tệp vào email được.
        </p>

        {canShare() && (
          <button
            type="button"
            className="link-btn"
            style={{ marginTop: 10 }}
            onClick={async () => {
              const ok = await shareSummary(record, profile)
              if (!ok) toast('Thiết bị không hỗ trợ chia sẻ.')
            }}
          >
            Chia sẻ tóm tắt dạng chữ (không kèm PDF)
          </button>
        )}
        <button
          type="button"
          className="link-btn"
          style={{ marginTop: 6 }}
          onClick={() => {
            downloadJson(record)
            toast('Đã tải bản sao dữ liệu ca này.')
          }}
        >
          Lưu bản sao dữ liệu (.json) — để sao lưu, không phải bản nộp
        </button>
      </Card>

      {/*
        Kept, and kept working, but deliberately no longer the destination of
        the flow: what the lecturer receives is the PDF above. Locking a case
        is bookkeeping the learner may want — a record of "this is the version
        I handed in" — so it stays available and clearly labelled as optional.
      */}
      <Card title="Khoá bản đã nộp (tuỳ chọn)" className="no-print">
        <p className="small muted" style={{ marginTop: -4 }}>
          Không bắt buộc. Bạn gửi bài bằng <strong>tệp PDF</strong> ở trên. Khoá sửa chỉ để đánh dấu
          đây là bản đã gửi, và ghi lại mã bệnh án cùng thời điểm.
        </p>
        <div className="row-between" style={{ marginBottom: 10 }}>
          <span className="small muted">Trạng thái hiện tại</span>
          <Badge tone={STATUS[status].tone}>{STATUS[status].label}</Badge>
        </div>
        <p className="small muted" style={{ marginTop: 0 }}>
          {STATUS[status].next}
        </p>

        {sub.submittedAt ? (
          <>
            <dl className="doc" style={{ border: 0, padding: 0, marginTop: 4 }}>
              <dt>Mã bài nộp</dt>
              <dd className="mono">{sub.code}</dd>
              <dt>Thời điểm nộp</dt>
              <dd>{formatDateTime(sub.submittedAt)}</dd>
              {sub.exportedAt && (
                <>
                  <dt>Đã xuất PDF</dt>
                  <dd>{formatDateTime(sub.exportedAt)}</dd>
                </>
              )}
            </dl>
            <Notice tone="info">
              Ca đã khoá sửa. Thứ gửi cho giảng viên là <strong>tệp PDF</strong> bạn xuất ở trên.
              Giảng viên đọc PDF bằng công cụ sẵn có, không cần cài ClerkMate.
            </Notice>
            <div className="btn-row" style={{ marginTop: 12 }}>
              <button
                type="button"
                className="btn btn--secondary"
                style={{ flex: 1 }}
                onClick={() => downloadBundle(record)}
              >
                ⤓ Tải lại tệp dữ liệu (.json)
              </button>
              <button type="button" className="btn btn--secondary" onClick={onReopen}>
                🔓 Mở lại để sửa
              </button>
            </div>
            <p className="tiny muted" style={{ margin: '10px 0 0' }}>
              Mở lại được ghi nhận trong bệnh án và in ra trong PDF, nên lần nộp sau vẫn thấy rõ là nộp lại.
            </p>
          </>
        ) : (
          <>
            {blockers.length > 0 ? (
              <Notice tone="warn">
                Chưa nộp được: {blockers.join('; ')}.
              </Notice>
            ) : (
              <Notice tone="ok">Đủ điều kiện khoá. Hãy xuất PDF trước, rồi mới khoá sửa.</Notice>
            )}
            <button
              type="button"
              className="btn btn--primary btn--block"
              style={{ marginTop: 12 }}
              disabled={blockers.length > 0}
              onClick={onSubmit}
            >
              {blockers.length > 0 ? 'Chưa đủ điều kiện khoá' : '📮 Nộp bài và khoá sửa'}
            </button>
            {sub.reopenedAt.length > 0 && (
              <p className="tiny muted" style={{ margin: '10px 0 0' }}>
                Ca này đã được mở lại {sub.reopenedAt.length} lần sau khi nộp.
              </p>
            )}
          </>
        )}
      </Card>

      {docMode === 'form' ? (
        <DepartmentForm record={record} profile={profile} />
      ) : (
        <CaseDocument record={record} profile={profile} />
      )}
    </div>
  )
}
