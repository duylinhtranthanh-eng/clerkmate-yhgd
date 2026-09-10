import type { CaseRecord, CompletenessSnapshot } from '../types/case'
import { CaseDocument } from '../export/CaseDocument'
import { canShare, downloadJson, printRecord, shareSummary, triggerDownload } from '../export/exportPdf'
import { missingByTier } from '../completeness/engine'
import { Badge, Card, Notice } from '../components/Ui'
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
  const unredacted = record.attachments.filter((a) => !a.privacyChecked)
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
    downloadBundle(next)
    toast(`Đã nộp. Mã bài nộp: ${next.submission.code}`)
  }

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
              Bản in dưới đây chính là bản PDF bạn sẽ xuất ra
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

        <div className="btn-row">
          <button type="button" className="btn btn--primary" style={{ flex: 1 }} onClick={onPrint}>
            🖨 Xuất PDF
          </button>
          {canShare() && (
            <button
              type="button"
              className="btn btn--secondary"
              onClick={async () => {
                const ok = await shareSummary(record, profile)
                if (!ok) toast('Thiết bị không hỗ trợ chia sẻ.')
              }}
            >
              Chia sẻ
            </button>
          )}
          <button
            type="button"
            className="btn btn--secondary"
            onClick={() => {
              downloadJson(record)
              toast('Đã tải bản sao dữ liệu ca này.')
            }}
          >
            Lưu bản sao dữ liệu
          </button>
        </div>

        <p className="tiny muted" style={{ margin: '12px 0 0' }}>
          Trong hộp thoại in, chọn <strong>Lưu thành PDF</strong> (Save as PDF). Trên iPhone: nút Chia sẻ →
          Lưu vào Tệp. “Lưu bản sao dữ liệu” tạo tệp <code>.json</code> — bản sao lưu để mở lại trong
          ClerkMate, không dùng để gửi giảng viên.
        </p>
      </Card>

      <Card title="Nộp bài" className="no-print">
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
              Ca đã khoá sửa. Gửi cho giảng viên <strong>bản PDF</strong> kèm tệp{' '}
              <code>ClerkMate_{sub.code}.json</code> để giảng viên mở trong mục “Chấm bài”.
            </Notice>
            <div className="btn-row" style={{ marginTop: 12 }}>
              <button
                type="button"
                className="btn btn--secondary"
                style={{ flex: 1 }}
                onClick={() => downloadBundle(record)}
              >
                ⤓ Tải lại tệp bài nộp
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
              <Notice tone="ok">Đủ điều kiện nộp. Nên xuất PDF trước, rồi bấm nộp.</Notice>
            )}
            <button
              type="button"
              className="btn btn--primary btn--block"
              style={{ marginTop: 12 }}
              disabled={blockers.length > 0}
              onClick={onSubmit}
            >
              {blockers.length > 0 ? 'Chưa đủ điều kiện nộp' : '📮 Nộp bài và khoá sửa'}
            </button>
            {sub.reopenedAt.length > 0 && (
              <p className="tiny muted" style={{ margin: '10px 0 0' }}>
                Ca này đã được mở lại {sub.reopenedAt.length} lần sau khi nộp.
              </p>
            )}
          </>
        )}
      </Card>

      <CaseDocument record={record} profile={profile} />
    </div>
  )
}
