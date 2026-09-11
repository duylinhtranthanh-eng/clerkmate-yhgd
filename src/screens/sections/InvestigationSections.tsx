import { useEffect, useState } from 'react'
import type {
  Attachment,
  AttachmentCategory,
  FaceCheck,
  InvestigationResult,
  ResultFlag,
} from '../../types/case'
import { Badge, Card, Chip, Field, Notice, Select, TextArea, TextInput } from '../../components/Ui'
import { RepeatList } from '../../components/RepeatList'
import { Sheet } from '../../components/Sheet'
import {
  ATTACHMENT_CATEGORIES,
  CLINICAL_PHOTO_CHECKS,
  CLINICAL_PHOTO_WARNING,
  COMMON_INVESTIGATIONS,
} from '../../config/clinical'
import {
  attachmentObjectUrl,
  attachmentKeys,
  deleteAttachmentBlob,
  getAttachmentBlob,
  putAttachmentBlob,
} from '../../db/repository'
import { RedactEditor } from '../../components/RedactEditor'
import { makeThumbnail, neutralAttachmentName, sanitizeImage } from '../../utils/image'
import { buildSampleAttachment } from '../../config/demoCases/demoAttachments'
import { uid } from '../../utils/id'
import { todayIso } from '../../utils/format'
import { useToast } from '../../components/Toast'
import type { SectionProps } from './types'

const RESULT_FLAGS: { value: Exclude<ResultFlag, ''>; label: string; tone?: 'ok' | 'danger' }[] = [
  { value: 'normal', label: 'Bình thường', tone: 'ok' },
  { value: 'borderline', label: 'Ranh giới' },
  { value: 'abnormal', label: 'Bất thường', tone: 'danger' },
]

export function InvestigationsSection({ record, update }: SectionProps) {
  const inv = record.investigations
  const [customProposal, setCustomProposal] = useState('')
  const [redacting, setRedacting] = useState<{ attachment: Attachment; blob: Blob } | null>(null)
  const toast = useToast()

  /**
   * Image bytes are written straight to the blob store, which is not the path
   * `useCaseEditor` guards — so the submission lock has to be honoured here
   * too. Without this, redacting an image on a submitted case would overwrite
   * the stored pixels irreversibly while the record itself refused the change.
   */
  const locked = record.submission.locked
  const refuseIfLocked = () => {
    if (!locked) return false
    toast('Ca đã nộp nên đang khoá sửa. Mở lại ca ở tab Xem trước nếu cần bổ sung.')
    return true
  }

  /** Lets a photographed result be cleaned up without leaving this screen. */
  const openResultRedactor = async (attachment: Attachment) => {
    const blob = await getAttachmentBlob(attachment.blobKey)
    if (!blob) {
      toast('Không đọc được ảnh gốc.')
      return
    }
    setRedacting({ attachment, blob })
  }

  const applyResultRedaction = async (attachment: Attachment, redacted: Blob) => {
    if (refuseIfLocked()) return
    await putAttachmentBlob(attachment.blobKey, redacted)
    const thumbnail = await makeThumbnail(redacted)
    update((d) => {
      const t = d.attachments.find((x) => x.id === attachment.id)
      if (t) {
        t.thumbnail = thumbnail
        t.mimeType = redacted.type || 'image/jpeg'
        t.redacted = true
        t.privacyChecked = true
        t.sanitizedBlobKey = t.blobKey
      }
    })
    setRedacting(null)
    toast('Đã che và ghi đè lên ảnh gốc.')
  }
  const abnormal = inv.results.filter((r) => r.flag === 'abnormal' || r.flag === 'borderline')
  const unflagged = inv.results.filter((r) => !r.flag)

  const addProposed = (name: string) =>
    update((d) => void d.investigations.proposed.push({ id: uid('inv'), name }))

  const lockNotice = locked ? (
    <Notice tone="info">
      Ca đã nộp nên đang khoá sửa — không thêm, sửa hay che ảnh được. Mở lại ca ở tab{' '}
      <strong>Xem trước</strong> nếu cần bổ sung.
    </Notice>
  ) : null

  return (
    <>
      {lockNotice}
      <Card
        title="Đề nghị cận lâm sàng"
        action={
          inv.proposed.length > 0 ? <Badge tone="brand">{inv.proposed.length}</Badge> : null
        }
        hint="Chỉ cần tên xét nghiệm. Phần lập luận để dành cho lúc có kết quả."
      >
        <div className="chips" style={{ marginBottom: 14 }}>
          {COMMON_INVESTIGATIONS.map((c) => {
            const already = inv.proposed.some((p) => p.name === c)
            return (
              <Chip
                key={c}
                small
                on={already}
                onClick={() =>
                  already
                    ? update((d) => {
                        d.investigations.proposed = d.investigations.proposed.filter(
                          (p) => p.name !== c,
                        )
                      })
                    : addProposed(c)
                }
              >
                {already ? '✓ ' : '＋ '}
                {c}
              </Chip>
            )
          })}
        </div>

        <div style={{ display: 'flex', gap: 8 }}>
          <TextInput
            value={customProposal}
            placeholder="Xét nghiệm khác…"
            onChange={(e) => setCustomProposal(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                if (customProposal.trim()) {
                  addProposed(customProposal.trim())
                  setCustomProposal('')
                }
              }
            }}
          />
          <button
            type="button"
            className="btn btn--secondary btn--sm"
            onClick={() => {
              if (!customProposal.trim()) return
              addProposed(customProposal.trim())
              setCustomProposal('')
            }}
          >
            Thêm
          </button>
        </div>

        {inv.proposed.length > 0 && (
          <>
            <div className="section-title" style={{ margin: '16px 0 8px' }}>
              Đã chỉ định
            </div>
            <div className="chips">
              {inv.proposed.map((p) => (
                <Chip
                  key={p.id}
                  small
                  on
                  onClick={() =>
                    update((d) => {
                      d.investigations.proposed = d.investigations.proposed.filter((x) => x.id !== p.id)
                    })
                  }
                >
                  {p.name} ✕
                </Chip>
              ))}
            </div>
          </>
        )}
      </Card>

      <Card title="Kết quả đã có">
        <RepeatList
          items={inv.results}
          addLabel="Thêm kết quả"
          emptyLabel="Chưa nhập kết quả nào."
          onAdd={() =>
            update((d) =>
              void d.investigations.results.push({
                id: uid('res'),
                name: '',
                date: todayIso(),
                value: '',
                unit: '',
                flag: '',
                interpretation: '',
                attachmentId: null,
              }),
            )
          }
          onRemove={(id) =>
            update((d) => {
              d.investigations.results = d.investigations.results.filter((x) => x.id !== id)
            })
          }
          render={(item, i) => (
            <>
              <Field label="Tên xét nghiệm">
                <TextInput
                  value={item.name}
                  onChange={(e) => update((d) => void (d.investigations.results[i].name = e.target.value))}
                  placeholder="Công thức máu, X-quang ngực…"
                />
              </Field>
              <Field label="Ngày lấy mẫu / ngày chụp">
                <TextInput
                  type="date"
                  value={item.date}
                  onChange={(e) => update((d) => void (d.investigations.results[i].date = e.target.value))}
                />
              </Field>
              <div className="grid-2">
                <Field label="Kết quả">
                  <TextInput
                    value={item.value}
                    onChange={(e) => update((d) => void (d.investigations.results[i].value = e.target.value))}
                    placeholder="Bỏ trống nếu chỉ đính ảnh"
                  />
                </Field>
                <Field label="Đơn vị">
                  <TextInput
                    value={item.unit}
                    onChange={(e) => update((d) => void (d.investigations.results[i].unit = e.target.value))}
                  />
                </Field>
              </div>

              <ResultImage
                record={record}
                update={update}
                result={item}
                onRedact={(att: Attachment) => void openResultRedactor(att)}
              />
              <Field label="So với trị số bình thường">
                <div className="chips">
                  {RESULT_FLAGS.map((f) => (
                    <Chip
                      key={f.value}
                      small
                      tone={f.tone}
                      on={item.flag === f.value}
                      onClick={() =>
                        update((d) => {
                          const t = d.investigations.results[i]
                          t.flag = t.flag === f.value ? '' : f.value
                        })
                      }
                    >
                      {f.label}
                    </Chip>
                  ))}
                </div>
              </Field>
              <Field
                label="Lý giải kết quả này"
                help="Bắt buộc cả khi chỉ đính ảnh — ảnh không tự nói lên điều gì."
              >
                <TextArea
                  rows={2}
                  value={item.interpretation}
                  onChange={(e) =>
                    update((d) => void (d.investigations.results[i].interpretation = e.target.value))
                  }
                  placeholder="Tăng nhẹ, phù hợp với…"
                />
              </Field>
            </>
          )}
        />
      </Card>

      <Sheet open={!!redacting} onClose={() => setRedacting(null)} title="Che thông tin định danh">
        {redacting && (
          <RedactEditor
            blob={redacting.blob}
            onCancel={() => setRedacting(null)}
            onApply={(blob) => void applyResultRedaction(redacting.attachment, blob)}
          />
        )}
      </Sheet>

      <Card title="Tóm tắt kết quả" hint="Ghi lại những kết quả có ý nghĩa — phần “tìm thấy gì”.">
        <TextArea
          rows={3}
          value={inv.summary}
          onChange={(e) => update((d) => void (d.investigations.summary = e.target.value))}
          placeholder="X-quang gối phải: hẹp khe khớp trong, gai xương bờ khớp…"
        />
      </Card>

      <Card
        title="Lý giải kết quả"
        action={
          abnormal.length > 0 ? (
            <Badge tone="danger">{abnormal.length} bất thường</Badge>
          ) : inv.results.length > 0 ? (
            <Badge tone="ok">không bất thường</Badge>
          ) : null
        }
        hint="Phần “có nghĩa là gì” — khác với tóm tắt. Một kết quả bất thường chỉ có giá trị khi đặt vào bối cảnh bệnh nhân này."
      >
        {abnormal.length > 0 && (
          <div className="notice notice--warn" style={{ marginBottom: 14 }}>
            <span aria-hidden="true">⚠️</span>
            <div>
              Cần lý giải: <strong>{abnormal.map((r) => r.name || 'chưa đặt tên').join(', ')}</strong>
            </div>
          </div>
        )}
        {unflagged.length > 0 && (
          <p className="tiny muted" style={{ marginTop: -4 }}>
            Còn {unflagged.length} kết quả chưa đánh dấu bình thường hay bất thường.
          </p>
        )}

        <Field
          label="Kết quả nào bất thường, và bất thường theo hướng nào?"
          help="Nêu rõ tăng hay giảm, mức độ, và so với lần trước nếu có."
        >
          <TextArea
            rows={3}
            value={inv.interpretation.abnormal}
            onChange={(e) => update((d) => void (d.investigations.interpretation.abnormal = e.target.value))}
          />
        </Field>

        <Field
          label="Kết quả ủng hộ hay không ủng hộ chẩn đoán nào?"
          help="Đây là câu quan trọng nhất — nối cận lâm sàng với lập luận chẩn đoán."
        >
          <TextArea
            rows={4}
            value={inv.interpretation.supportsDiagnosis}
            onChange={(e) =>
              update((d) => void (d.investigations.interpretation.supportsDiagnosis = e.target.value))
            }
            placeholder="Hẹp khe khớp và gai xương ủng hộ thoái hóa khớp; CRP bình thường làm ít nghĩ viêm khớp dạng thấp…"
          />
        </Field>

        <Field
          label="Có kết quả nào không phù hợp với lâm sàng không?"
          help="Kết quả lệch với bệnh cảnh có thể là lỗi mẫu, cần lặp lại, hoặc là manh mối cho chẩn đoán khác."
        >
          <TextArea
            rows={3}
            value={inv.interpretation.inconsistencies}
            onChange={(e) =>
              update((d) => void (d.investigations.interpretation.inconsistencies = e.target.value))
            }
          />
        </Field>

        <Field
          label="Kết quả này làm thay đổi gì trong xử trí?"
          help="Nếu không đổi gì thì xét nghiệm đó có thực sự cần không?"
        >
          <TextArea
            rows={3}
            value={inv.interpretation.impactOnPlan}
            onChange={(e) =>
              update((d) => void (d.investigations.interpretation.impactOnPlan = e.target.value))
            }
          />
        </Field>

        <Notice tone="info">
          Một xét nghiệm không làm thay đổi xử trí thì cần cân nhắc lại chỉ định. Đây là câu hỏi nên tự đặt
          trước khi kê thêm cận lâm sàng.
        </Notice>
      </Card>
    </>
  )
}

/**
 * A photographed result, attached to the result row it belongs to.
 *
 * Kept next to the value and the interpretation rather than in the separate
 * attachments list: a photo of a lab slip *is* the result, and it needs the
 * same date and the same reading as a typed one.
 */
/**
 * The questions a clinical photo has to answer before it can leave the phone.
 *
 * The face question is deliberately not one checkbox among several: a declared
 * face has no remedy inside the app. Blurring or painting over it still leaves
 * a photograph of a person, so the only two answers offered are "no face" and
 * "there is a face" — and the second one withdraws the image from everything
 * that leaves the device rather than pretending a filter fixed it.
 */
function ClinicalPhotoChecklist({
  attachment,
  locked,
  onFace,
}: {
  attachment: Attachment
  locked: boolean
  onFace: (next: FaceCheck) => void
}) {
  return (
    <div style={{ marginBottom: 14 }}>
      <strong style={{ fontSize: 14, display: 'block', marginBottom: 8 }}>
        Kiểm tra ảnh lâm sàng
      </strong>
      <Notice tone="warn">{CLINICAL_PHOTO_WARNING}</Notice>
      <ul className="small" style={{ margin: '10px 0', paddingLeft: 20 }}>
        {CLINICAL_PHOTO_CHECKS.filter((c) => c.key !== 'noFace').map((c) => (
          <li key={c.key}>{c.label}</li>
        ))}
      </ul>
      <div className="chips">
        <Chip
          small
          tone="ok"
          on={attachment.faceCheck === 'none'}
          onClick={() => !locked && onFace(attachment.faceCheck === 'none' ? '' : 'none')}
        >
          Không có khuôn mặt
        </Chip>
        <Chip
          small
          tone="danger"
          on={attachment.faceCheck === 'present'}
          onClick={() => !locked && onFace(attachment.faceCheck === 'present' ? '' : 'present')}
        >
          Có khuôn mặt
        </Chip>
      </div>
      {attachment.faceCheck === 'present' && (
        <Notice tone="warn">
          <strong>Ảnh này không dùng được.</strong> Làm mờ mắt là chưa đủ — hãy{' '}
          <strong>cắt bỏ</strong> phần khuôn mặt rồi thêm lại, hoặc xoá ảnh và chụp lại chỉ vùng tổn
          thương.
        </Notice>
      )}
      {attachment.faceCheck === '' && (
        <p className="small muted" style={{ margin: '8px 0 0' }}>
          Chưa trả lời. Ảnh lâm sàng chưa trả lời câu này thì không nộp bài được.
        </p>
      )}
    </div>
  )
}

function ResultImage({
  record,
  update,
  result,
  onRedact,
}: {
  record: SectionProps['record']
  update: SectionProps['update']
  result: InvestigationResult
  onRedact: (attachment: Attachment) => void
}) {
  const attachment = record.attachments.find((a) => a.id === result.attachmentId) ?? null
  const [busy, setBusy] = useState(false)
  const toast = useToast()
  const locked = record.submission.locked

  const attach = async (file: File | null) => {
    if (!file || locked) return
    setBusy(true)
    try {
      const blobKey = uid('blob')
      await putAttachmentBlob(blobKey, file)
      const thumbnail = file.type.startsWith('image/') ? await makeThumbnail(file) : ''
      const attachmentId = uid('att')
      update((d) => {
        d.attachments.push({
          id: attachmentId,
          category: 'lab',
          // Never the picked file's name: a phone gallery is full of files
          // called things like "NguyenVanA_ECG_2026.jpg", and that name would
          // travel into the record and the printed catalogue.
          title: result.name || 'Kết quả cận lâm sàng',
          date: result.date,
          note: '',
          mimeType: file.type,
          thumbnail,
          blobKey,
          sanitizedBlobKey: '',
          redacted: false,
          privacyChecked: false,
          faceCheck: '',
          createdAt: new Date().toISOString(),
        })
        const target = d.investigations.results.find((r) => r.id === result.id)
        if (target) target.attachmentId = attachmentId
      })
      toast('Đã đính ảnh — nhớ che tên bệnh nhân và viết lý giải.')
    } finally {
      setBusy(false)
    }
  }

  const detach = async () => {
    if (locked) {
      toast('Ca đã nộp nên đang khoá sửa. Mở lại ca ở tab Xem trước nếu cần bổ sung.')
      return
    }
    if (attachment) await deleteAttachmentBlob(attachment.blobKey)
    update((d) => {
      d.attachments = d.attachments.filter((a) => a.id !== result.attachmentId)
      const target = d.investigations.results.find((r) => r.id === result.id)
      if (target) target.attachmentId = null
    })
  }

  if (!attachment) {
    return (
      <div className="field">
        <label>Ảnh chụp kết quả</label>
        <label
          className="btn btn--secondary btn--sm"
          style={{ cursor: locked ? 'not-allowed' : 'pointer', alignSelf: 'flex-start', opacity: locked ? 0.55 : 1 }}
        >
          {locked ? '🔒 Ca đã khoá sửa' : busy ? 'Đang xử lý…' : '📷 Đính ảnh phiếu kết quả'}
          <input
            type="file"
            accept="image/*"
            capture="environment"
            disabled={locked}
            style={{ display: 'none' }}
            onChange={(e) => {
              void attach(e.target.files?.[0] ?? null)
              e.target.value = ''
            }}
          />
        </label>
      </div>
    )
  }

  return (
    <div className="field">
      <label>Ảnh chụp kết quả</label>
      <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
        {attachment.thumbnail && (
          <img
            src={attachment.thumbnail}
            alt={attachment.title}
            style={{
              width: 92,
              borderRadius: 'var(--r-sm)',
              border: '1px solid var(--line)',
              flex: 'none',
            }}
          />
        )}
        <div style={{ flex: 1, minWidth: 0 }}>
          {attachment.redacted ? (
            <Badge tone="ok">đã che thông tin</Badge>
          ) : (
            <Badge tone="danger">chưa che thông tin</Badge>
          )}
          <div className="btn-row" style={{ marginTop: 8 }}>
            {!attachment.redacted && (
              <button
                type="button"
                className="btn btn--primary btn--sm"
                disabled={locked}
                onClick={() => onRedact(attachment)}
              >
                Che tên bệnh nhân
              </button>
            )}
            <button
              type="button"
              className="btn btn--secondary btn--sm"
              disabled={locked}
              onClick={() => void detach()}
            >
              Gỡ ảnh
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

const CATEGORY_LABEL: Record<AttachmentCategory, string> =
  Object.fromEntries(ATTACHMENT_CATEGORIES.map((c) => [c.id, c.label])) as Record<AttachmentCategory, string>

export function AttachmentsSection({ record, update }: SectionProps) {
  const [viewing, setViewing] = useState<Attachment | null>(null)
  /**
   * Chosen before the camera opens, not after.
   *
   * A clinical photo needs its warning shown *before* the shutter, and the
   * category is what decides which privacy questions the image has to answer.
   */
  const [pendingCategory, setPendingCategory] = useState<AttachmentCategory>('lab')
  const [viewUrl, setViewUrl] = useState<string | null>(null)
  const [redactBlob, setRedactBlob] = useState<Blob | null>(null)
  const [busy, setBusy] = useState(false)
  const toast = useToast()

  /** Same reason as in InvestigationsSection: blob writes bypass the editor. */
  const locked = record.submission.locked
  const refuseIfLocked = () => {
    if (!locked) return false
    toast('Ca đã nộp nên đang khoá sửa. Mở lại ca ở tab Xem trước nếu cần bổ sung.')
    return true
  }

  const unchecked = record.attachments.filter((a) => !a.privacyChecked)

  /** Replaces the stored image with the redacted one; the original is gone. */
  const applyRedaction = async (attachment: Attachment, redacted: Blob) => {
    if (refuseIfLocked()) return
    // The redacted image is already a canvas re-encode, so it carries no EXIF
    // and the original it replaces is gone. One artifact remains, and it is the
    // one allowed to leave the device.
    await putAttachmentBlob(attachment.blobKey, redacted)
    const thumbnail = await makeThumbnail(redacted)
    update((d) => {
      const t = d.attachments.find((x) => x.id === attachment.id)
      if (t) {
        t.thumbnail = thumbnail
        t.mimeType = redacted.type || 'image/jpeg'
        t.redacted = true
        t.privacyChecked = true
        t.sanitizedBlobKey = t.blobKey
      }
    })
    setRedactBlob(null)
    setViewing((prev) => (prev ? { ...prev, thumbnail, redacted: true, privacyChecked: true } : prev))
    toast('Đã che và ghi đè lên ảnh gốc.')
  }

  /**
   * "This image carries no identifiers" — which is a statement about the
   * picture, not about the file.
   *
   * It used to set a flag and leave the original bytes untouched, so an image
   * that had never been through any processing became eligible for the printed
   * record with its EXIF and GPS intact. It now produces the same kind of
   * derivative a redaction produces; the flag alone is no longer enough to let
   * an image leave the device.
   */
  const declareClean = async (attachment: Attachment) => {
    if (refuseIfLocked()) return
    setBusy(true)
    try {
      const raw = await getAttachmentBlob(attachment.blobKey)
      if (!raw) {
        toast('Không đọc được ảnh gốc.')
        return
      }
      const clean = await sanitizeImage(raw)
      const sanitizedKey = uid('blob')
      await putAttachmentBlob(sanitizedKey, clean)
      // Declaring twice would otherwise strand the earlier derivative in the
      // blob store with nothing pointing at it.
      if (attachment.sanitizedBlobKey && attachment.sanitizedBlobKey !== attachment.blobKey) {
        await deleteAttachmentBlob(attachment.sanitizedBlobKey)
      }
      const thumbnail = await makeThumbnail(clean)
      update((d) => {
        const t = d.attachments.find((x) => x.id === attachment.id)
        if (t) {
          t.sanitizedBlobKey = sanitizedKey
          t.privacyChecked = true
          t.thumbnail = thumbnail
          t.mimeType = clean.type || 'image/jpeg'
        }
      })
      setViewing((prev) =>
        prev ? { ...prev, sanitizedBlobKey: sanitizedKey, privacyChecked: true, thumbnail } : prev,
      )
      toast('Đã tạo bản sao đã làm sạch dữ liệu ẩn (EXIF, GPS).')
    } catch {
      toast('Không tạo được bản sao đã làm sạch.')
    } finally {
      setBusy(false)
    }
  }

  const openRedactor = async (attachment: Attachment) => {
    if (refuseIfLocked()) return
    const blob = await getAttachmentBlob(attachment.blobKey)
    if (!blob) {
      toast('Không đọc được ảnh gốc.')
      return
    }
    setRedactBlob(blob)
  }

  useEffect(() => {
    let revoked: string | null = null
    if (viewing) {
      attachmentObjectUrl(viewing).then((u) => {
        revoked = u
        setViewUrl(u)
      })
    } else {
      setViewUrl(null)
    }
    return () => {
      if (revoked) URL.revokeObjectURL(revoked)
    }
  }, [viewing])

  const onFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return
    if (refuseIfLocked()) return
    setBusy(true)
    try {
      let index = record.attachments.length
      for (const file of Array.from(files)) {
        index += 1
        const blobKey = uid('blob')
        await putAttachmentBlob(blobKey, file)
        const thumbnail = file.type.startsWith('image/') ? await makeThumbnail(file) : ''
        update((d) =>
          void d.attachments.push({
            id: uid('att'),
            category: pendingCategory,
            // The picked file's name is dropped on purpose. Phone galleries are
            // full of names like "NguyenVanA_ECG_2026.jpg", and that name would
            // travel straight into the record and the printed catalogue.
            title: neutralAttachmentName(index, CATEGORY_LABEL[pendingCategory]),
            date: todayIso(),
            note: '',
            mimeType: file.type,
            thumbnail,
            blobKey,
            sanitizedBlobKey: '',
            redacted: false,
            privacyChecked: false,
            faceCheck: '',
            createdAt: new Date().toISOString(),
          }),
        )
      }
      toast('Đã thêm ảnh — nhớ che tên và mã số bệnh nhân.')
    } catch {
      toast('Không lưu được hình ảnh.')
    } finally {
      setBusy(false)
    }
  }

  /** Gives someone with no lab photo something to practise redaction on. */
  const addSample = async () => {
    if (refuseIfLocked()) return
    setBusy(true)
    try {
      const sample = await buildSampleAttachment(record)
      await putAttachmentBlob(sample.attachment.blobKey, sample.blob)
      update((d) => void d.attachments.push(sample.attachment))
      toast('Đã chèn ảnh mẫu — thử nút che thông tin định danh.')
    } catch {
      toast('Không tạo được ảnh mẫu trên trình duyệt này.')
    } finally {
      setBusy(false)
    }
  }

  const removeAttachment = async (a: Attachment) => {
    if (refuseIfLocked()) return
    for (const key of attachmentKeys(a)) await deleteAttachmentBlob(key)
    update((d) => {
      d.attachments = d.attachments.filter((x) => x.id !== a.id)
    })
    setViewing(null)
  }

  return (
    <>
      <Card
        title="Hình ảnh đính kèm"
        hint="Ảnh kết quả xét nghiệm, ECG, X-quang, toa thuốc cũ. Lưu ngay trên thiết bị."
      >
        {locked && (
          <Notice tone="info">
            Ca đã nộp nên đang khoá sửa — không thêm, xoá hay che ảnh được. Mở lại ca ở tab{' '}
            <strong>Xem trước</strong> nếu cần bổ sung.
          </Notice>
        )}
        <Field label="Loại ảnh sắp thêm" help="Chọn trước khi chụp — loại ảnh quyết định phải kiểm tra những gì.">
          <div className="chips">
            {ATTACHMENT_CATEGORIES.map((c) => (
              <Chip
                key={c.id}
                small
                on={pendingCategory === c.id}
                onClick={() => setPendingCategory(c.id)}
              >
                {c.icon} {c.label}
              </Chip>
            ))}
          </div>
        </Field>

        {pendingCategory === 'clinical_photo' && (
          <Notice tone="warn">
            <strong>{CLINICAL_PHOTO_WARNING}</strong>
          </Notice>
        )}

        <label
          className="btn btn--primary btn--block"
          style={{ cursor: locked ? 'not-allowed' : 'pointer', opacity: locked ? 0.55 : 1 }}
        >
          {locked ? '🔒 Ca đã khoá sửa' : busy ? 'Đang xử lý…' : '📷 Chụp hoặc chọn ảnh'}
          <input
            type="file"
            accept="image/*"
            multiple
            capture="environment"
            disabled={locked}
            style={{ display: 'none' }}
            onChange={(e) => {
              void onFiles(e.target.files)
              e.target.value = ''
            }}
          />
        </label>

        {unchecked.length > 0 && (
          <div style={{ marginTop: 14 }}>
            <Notice tone="warn">
              Có <strong>{unchecked.length} ảnh</strong> chưa xác nhận đã che thông tin định danh. Phiếu xét
              nghiệm, ECG và toa thuốc gần như luôn in tên, mã số và ngày sinh bệnh nhân ở dải trên.
            </Notice>
          </div>
        )}

        <button
          type="button"
          className="btn btn--secondary btn--block"
          style={{ marginTop: 10 }}
          disabled={busy || locked}
          onClick={() => void addSample()}
        >
          🧪 Chèn ảnh xét nghiệm mẫu để thử
        </button>
        <p className="tiny muted" style={{ margin: '8px 0 0' }}>
          Ảnh mô phỏng có sẵn dải tên và mã số bệnh nhân, dùng để thử công cụ che khi bạn chưa có ảnh thật.
        </p>

        {record.attachments.length === 0 ? (
          <p className="small muted" style={{ marginTop: 14, marginBottom: 0 }}>
            Chưa có hình ảnh nào. ClerkMate không đọc chữ trong ảnh — bạn tự nhập số liệu vào phần kết quả.
          </p>
        ) : (
          <div className="thumbgrid" style={{ marginTop: 14 }}>
            {record.attachments.map((a) => (
              <button key={a.id} type="button" className="thumb" onClick={() => setViewing(a)}>
                {a.thumbnail ? (
                  <img src={a.thumbnail} alt={a.title} />
                ) : (
                  <div style={{ display: 'grid', placeItems: 'center', height: '100%', fontSize: 26 }}>📄</div>
                )}
                <span className="thumb__tag">
                  {ATTACHMENT_CATEGORIES.find((c) => c.id === a.category)?.label ?? 'Khác'}
                </span>
                {!a.privacyChecked && (
                  <span
                    className="thumb__tag"
                    style={{ left: 'auto', right: 6, bottom: 'auto', top: 6, background: 'var(--danger)' }}
                  >
                    chưa che
                  </span>
                )}
              </button>
            ))}
          </div>
        )}
      </Card>

      <Sheet open={!!viewing} onClose={() => setViewing(null)} title="Chi tiết hình ảnh">
        {viewing && (
          <>
            {viewUrl && (
              <img
                src={viewUrl}
                alt={viewing.title}
                style={{ width: '100%', borderRadius: 'var(--r-md)', marginBottom: 16 }}
              />
            )}
            <Field label="Tiêu đề">
              <TextInput
                value={viewing.title}
                onChange={(e) => {
                  const value = e.target.value
                  setViewing({ ...viewing, title: value })
                  update((d) => {
                    const t = d.attachments.find((x) => x.id === viewing.id)
                    if (t) t.title = value
                  })
                }}
              />
            </Field>
            <div className="grid-2">
              <Field label="Phân loại">
                <Select
                  value={viewing.category}
                  onChange={(e) => {
                    const value = e.target.value as AttachmentCategory
                    setViewing({ ...viewing, category: value })
                    update((d) => {
                      const t = d.attachments.find((x) => x.id === viewing.id)
                      if (t) t.category = value
                    })
                  }}
                  options={ATTACHMENT_CATEGORIES.map((c) => ({ value: c.id, label: c.label }))}
                  placeholder="Chọn loại"
                />
              </Field>
              <Field label="Ngày">
                <TextInput
                  type="date"
                  value={viewing.date}
                  onChange={(e) => {
                    const value = e.target.value
                    setViewing({ ...viewing, date: value })
                    update((d) => {
                      const t = d.attachments.find((x) => x.id === viewing.id)
                      if (t) t.date = value
                    })
                  }}
                />
              </Field>
            </div>
            <Field label="Ghi chú">
              <TextArea
                rows={2}
                value={viewing.note}
                onChange={(e) => {
                  const value = e.target.value
                  setViewing({ ...viewing, note: value })
                  update((d) => {
                    const t = d.attachments.find((x) => x.id === viewing.id)
                    if (t) t.note = value
                  })
                }}
              />
            </Field>
            <div className="hr" />

            {viewing.category === 'clinical_photo' && (
              <ClinicalPhotoChecklist
                attachment={viewing}
                locked={locked}
                onFace={(faceCheck) => {
                  setViewing((prev) => (prev ? { ...prev, faceCheck } : prev))
                  update((d) => {
                    const t = d.attachments.find((x) => x.id === viewing.id)
                    if (t) {
                      t.faceCheck = faceCheck
                      // A face makes the image unusable, whatever was ticked
                      // before: the derivative is withdrawn rather than kept.
                      if (faceCheck === 'present') {
                        t.sanitizedBlobKey = ''
                        t.privacyChecked = false
                      }
                    }
                  })
                }}
              />
            )}

            <div className="row-between" style={{ marginBottom: 8 }}>
              <strong style={{ fontSize: 14 }}>Thông tin định danh bệnh nhân</strong>
              {viewing.redacted ? (
                <Badge tone="ok">✓ đã che xong</Badge>
              ) : viewing.privacyChecked ? (
                <Badge tone="ok">✓ đã kiểm tra</Badge>
              ) : (
                <Badge tone="danger">chưa che</Badge>
              )}
            </div>

            {redactBlob ? (
              <RedactEditor
                blob={redactBlob}
                onCancel={() => setRedactBlob(null)}
                onApply={(redacted) => void applyRedaction(viewing, redacted)}
              />
            ) : (
              <>
                <p className="small muted" style={{ marginTop: 0 }}>
                  Che phần in tên, mã số và ngày sinh trước khi nộp bệnh án. Ô che được ghi thẳng vào ảnh
                  gốc, không phải lớp phủ.
                </p>
                <div className="btn-row">
                  <button
                    type="button"
                    className="btn btn--primary btn--sm"
                    disabled={locked || viewing.faceCheck === 'present'}
                    onClick={() => void openRedactor(viewing)}
                  >
                    ✏️ Che thông tin trên ảnh
                  </button>
                  {!viewing.privacyChecked && (
                    <button
                      type="button"
                      className="btn btn--secondary btn--sm"
                      disabled={locked || busy || viewing.faceCheck === 'present'}
                      onClick={() => void declareClean(viewing)}
                    >
                      {busy ? 'Đang xử lý…' : 'Ảnh này không có thông tin định danh'}
                    </button>
                  )}
                </div>
              </>
            )}

            <div className="hr" />

            <div className="row-between" style={{ marginTop: 8 }}>
              <Badge tone="muted">{viewing.mimeType || 'tệp'}</Badge>
              <button
                type="button"
                className="btn btn--danger btn--sm"
                disabled={locked}
                onClick={() => void removeAttachment(viewing)}
              >
                Xóa hình này
              </button>
            </div>
          </>
        )}
      </Sheet>
    </>
  )
}
