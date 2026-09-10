import { useState } from 'react'
import type { CaseRecord } from '../types/case'
import { Badge, Card, Field, Notice, Progress, TextArea, TextInput } from '../components/Ui'
import { TopBar } from '../components/TopBar'
import { useToast } from '../components/Toast'
import { CaseDocument } from '../export/CaseDocument'
import { triggerDownload } from '../export/exportPdf'
import { evaluateCompleteness } from '../completeness/engine'
import { migrateCase } from '../types/factory'
import { STATUS, caseStatus } from '../workflow/status'
import { bundleFileName, parseBundle, recordReview } from '../workflow/submission'
import type { SubmissionBundle } from '../workflow/submission'

/**
 * The reviewer's side of the submission flow.
 *
 * Opened by the faculty member in the same app, from the file the learner
 * exported. Nothing is authenticated — the reviewer types their own name — and
 * nothing is stored on this device: the decision is written back into the file
 * and handed back. That keeps a genuine step transition and a
 * return-for-revision without introducing a server or accounts.
 */
export function FacultyReviewScreen({ back }: { back: () => void }) {
  const [bundle, setBundle] = useState<SubmissionBundle | null>(null)
  const [reviewer, setReviewer] = useState('')
  const [comment, setComment] = useState('')
  const [decided, setDecided] = useState<'returned' | 'accepted' | null>(null)
  const toast = useToast()

  const open = async (file: File) => {
    try {
      const parsed = parseBundle(await file.text())
      parsed.record = migrateCase(parsed.record)
      setBundle(parsed)
      setDecided(null)
      setComment('')
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Không đọc được tệp bài nộp.')
    }
  }

  const decide = (decision: 'returned' | 'accepted') => {
    if (!bundle) return
    if (decision === 'returned' && !comment.trim()) {
      toast('Cần nhận xét khi trả lại để bổ sung.')
      return
    }
    const reviewed: CaseRecord = recordReview(
      bundle.record,
      reviewer.trim() || 'Giảng viên',
      decision,
      comment.trim(),
    )
    const out: SubmissionBundle = { ...bundle, record: reviewed, exportedAt: new Date().toISOString() }
    triggerDownload(
      new Blob([JSON.stringify(out)], { type: 'application/json' }),
      bundleFileName(out, decision === 'returned' ? 'tra-lai' : 'da-cham'),
    )
    setBundle(out)
    setDecided(decision)
    toast(decision === 'returned' ? 'Đã tạo tệp trả lại.' : 'Đã tạo tệp đã chấm.')
  }

  const completeness = bundle ? evaluateCompleteness(bundle.record) : null
  const status = bundle && completeness ? caseStatus(bundle.record, completeness) : null

  return (
    <>
      <TopBar title="Chấm bài" subtitle="Dành cho giảng viên" onBack={back} backLabel="Quay lại" />

      <div className="content">
        {!bundle ? (
          <>
            <Card title="Mở bài nộp của người học" hint="Tệp .json mà người học gửi kèm bản PDF.">
              <label className="btn btn--primary btn--block" style={{ cursor: 'pointer' }}>
                📂 Chọn tệp bài nộp
                <input
                  type="file"
                  accept="application/json"
                  style={{ display: 'none' }}
                  onChange={(e) => {
                    const f = e.target.files?.[0]
                    if (f) void open(f)
                    e.target.value = ''
                  }}
                />
              </label>
            </Card>

            <Notice tone="info">
              Bài nộp <strong>không được lưu vào máy này</strong>. Giảng viên mở tệp, ghi nhận xét, và
              ứng dụng tạo một tệp mới để gửi lại người học. Không cần tài khoản, không cần máy chủ.
            </Notice>
          </>
        ) : (
          <>
            <Card className="card--flat">
              <div className="row-between" style={{ marginBottom: 10 }}>
                <div>
                  <h2>{bundle.student.fullName || 'Không rõ tên'}</h2>
                  <p className="small muted" style={{ margin: '4px 0 0' }}>
                    {bundle.student.studentId} · {bundle.record.learnerLevel}
                    {bundle.student.classGroup ? ` · ${bundle.student.classGroup}` : ''}
                  </p>
                  {bundle.student.level !== bundle.record.learnerLevel && (
                    // The chart is graded at the level it was written at; the profile
                    // level can have moved since. Showing only one of the two misleads.
                    <p className="tiny muted" style={{ margin: '2px 0 0' }}>
                      Bệnh án lập ở mức {bundle.record.learnerLevel}; hồ sơ người học hiện khai{' '}
                      {bundle.student.level}.
                    </p>
                  )}
                </div>
                {status && <Badge tone={STATUS[status].tone}>{STATUS[status].label}</Badge>}
              </div>
              <dl className="doc" style={{ border: 0, padding: 0 }}>
                <Row label="Mã bài nộp" value={bundle.code} />
                <Row label="Ca" value={bundle.record.patient.caseLabel || bundle.record.patient.name} />
                <Row
                  label="Mức hoàn chỉnh"
                  value={completeness ? `${completeness.percent}%` : ''}
                />
                <Row
                  label="Mục bắt buộc"
                  value={
                    completeness
                      ? `${completeness.mandatorySatisfied}/${completeness.mandatoryTotal}`
                      : ''
                  }
                />
              </dl>
              {completeness && (
                <div style={{ marginTop: 10 }}>
                  <Progress percent={completeness.percent} />
                </div>
              )}
            </Card>

            {completeness && completeness.mandatorySatisfied < completeness.mandatoryTotal && (
              <Notice tone="warn">
                Bài nộp còn {completeness.mandatoryTotal - completeness.mandatorySatisfied} mục bắt buộc
                chưa đạt:{' '}
                {completeness.items
                  .filter((i) => i.tier === 'mandatory' && !i.satisfied)
                  .map((i) => i.label)
                  .join(', ')}
                .
              </Notice>
            )}

            {bundle.record.submission.reopenedAt.length > 0 && (
              <Notice tone="info">
                Người học đã mở lại ca để sửa {bundle.record.submission.reopenedAt.length} lần sau khi nộp.
              </Notice>
            )}

            {decided ? (
              <Card title={decided === 'returned' ? 'Đã trả lại' : 'Đã chấm'}>
                <Notice tone={decided === 'returned' ? 'warn' : 'ok'}>
                  Tệp kết quả đã được tải về. Gửi tệp đó lại cho người học — khi họ mở trong ClerkMate,
                  ứng dụng sẽ hiện nhận xét
                  {decided === 'returned' ? ' và mở khoá ca để bổ sung' : ' và giữ ca ở trạng thái đã chấm'}.
                </Notice>
                <button
                  type="button"
                  className="btn btn--secondary btn--block"
                  style={{ marginTop: 12 }}
                  onClick={() => setBundle(null)}
                >
                  Chấm bài khác
                </button>
              </Card>
            ) : (
              <Card title="Nhận xét và quyết định">
                <Field label="Tên giảng viên" help="Ghi vào bệnh án. Không có xác thực.">
                  <TextInput
                    value={reviewer}
                    onChange={(e) => setReviewer(e.target.value)}
                    placeholder="BS. Nguyễn Văn B"
                  />
                </Field>
                <Field
                  label="Nhận xét"
                  help="Bắt buộc khi trả lại để bổ sung. Người học sẽ thấy nguyên văn."
                >
                  <TextArea
                    rows={5}
                    value={comment}
                    onChange={(e) => setComment(e.target.value)}
                    placeholder="Phần nào cần bổ sung, vì sao…"
                  />
                </Field>
                <div className="btn-row">
                  <button
                    type="button"
                    className="btn btn--primary"
                    style={{ flex: 1 }}
                    onClick={() => decide('returned')}
                  >
                    ↩ Trả lại để bổ sung
                  </button>
                  <button type="button" className="btn btn--secondary" onClick={() => decide('accepted')}>
                    ✓ Chấp nhận
                  </button>
                </div>
              </Card>
            )}

            <Card title="Bệnh án" hint="Bản đầy đủ, chỉ đọc." className="card--flat">
              <CaseDocument
                record={bundle.record}
                profile={{
                  fullName: bundle.student.fullName,
                  studentId: bundle.student.studentId,
                  level: bundle.record.learnerLevel,
                  classGroup: bundle.student.classGroup,
                  recallFirst: true,
                  levelHistory: [],
                  createdAt: bundle.exportedAt,
                  updatedAt: bundle.exportedAt,
                }}
              />
            </Card>
          </>
        )}
      </div>
    </>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  if (!value) return null
  return (
    <>
      <dt>{label}</dt>
      <dd>{value}</dd>
    </>
  )
}
