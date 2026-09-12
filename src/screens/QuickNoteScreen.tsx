import { useEffect, useMemo, useState } from 'react'
import type { CaptureSource, CaseRecord } from '../types/case'
import type { StructuringSuggestion } from '../parsing/types'
import { heuristicStructurer } from '../parsing/heuristicStructurer'
import { remoteNoteStructurer } from '../parsing/aiStructurer'
import { StructuringUnavailable } from '../parsing/types'
import { applyMany } from '../parsing/apply'
import { createFragment } from '../types/factory'
import { useVoiceCapture, voiceSupported } from '../hooks/useVoiceCapture'
import { useAiStructuring } from '../hooks/useAiStructuring'
import { SECTION_BY_ID } from '../config/sections'
import { evaluateCompleteness } from '../completeness/engine'
import { Badge, Card, Checkbox, Chip, Notice } from '../components/Ui'
import { Sheet } from '../components/Sheet'
import { useToast } from '../components/Toast'
import { relativeTime } from '../utils/format'

const EXAMPLE =
  'Nữ 58 tuổi, nội trợ. Đau khớp gối phải 3 tháng, tăng khi lên cầu thang.\n' +
  'THA 10 năm, đang uống amlodipine 5mg 1v/ngày. Mẹ đái tháo đường.\n' +
  'Không hút thuốc, không uống rượu. HA 140/85, mạch 78. 62kg, 155cm.\n' +
  'Lo lắng sợ phải thay khớp.'

/**
 * A fictional note written the way a sentence-style note actually arrives —
 * fuller prose, fewer telegraphic abbreviations — so the two backends can be
 * compared on the same input.
 */
const EXAMPLE_AI =
  'Nữ 58 tuổi, nội trợ. Đau gối phải 3 tháng, tăng khi lên xuống cầu thang. ' +
  'THA 10 năm, đang uống amlodipine 5 mg mỗi sáng. Không dị ứng thuốc. ' +
  'Không hút thuốc, thỉnh thoảng uống bia. Mẹ bị đái tháo đường. ' +
  'HA hôm nay 148/86 mmHg, mạch 78 lần/phút.'

const AI_FALLBACK_MESSAGE = 'Không thể dùng chế độ AI. Đã chuyển sang bộ sắp xếp cục bộ.'

export function QuickNoteScreen({
  record,
  replace,
}: {
  record: CaseRecord
  replace: (next: CaseRecord) => void
}) {
  const [draft, setDraft] = useState('')
  const [tab, setTab] = useState<'text' | 'voice'>('text')
  const [suggestions, setSuggestions] = useState<StructuringSuggestion[] | null>(null)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [sourceNoteId, setSourceNoteId] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [mode, setMode] = useState<'local' | 'ai'>('local')
  const [usedBackend, setUsedBackend] = useState<'local' | 'ai'>('local')
  const [privacyOpen, setPrivacyOpen] = useState(false)
  const ai = useAiStructuring()
  const toast = useToast()

  // A submitted case is read-only. The editor refuses the write anyway, but a
  // button that silently does nothing is worse than one that is visibly off.
  const locked = record.submission.locked

  // If AI stops being selectable mid-session — the learner goes offline, or
  // turns the option off in Settings — fall the control back to local rather
  // than leaving a mode selected that cannot run.
  useEffect(() => {
    if (mode === 'ai' && !ai.aiSelectable) setMode('local')
  }, [mode, ai.aiSelectable])

  const notes = useMemo(
    () => [...record.quickNotes].sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    [record.quickNotes],
  )

  const showSuggestions = (
    found: StructuringSuggestion[],
    noteId: string | null,
    backend: 'local' | 'ai',
  ) => {
    setUsedBackend(backend)
    setSuggestions(found)
    setSourceNoteId(noteId)
    // Low confidence and conflicts start unticked. A conflict is a question
    // about two facts that may both be true; preselecting one of them answers
    // it on the learner's behalf, which is the one thing this screen must not do.
    setSelected(
      new Set(
        found
          .filter((s) => !s.alreadyPresent && s.confidence !== 'low' && !s.conflictsWith)
          .map((s) => s.id),
      ),
    )
  }

  /**
   * Runs the chosen backend, and never leaves the learner without an answer:
   * anything that stops the AI backend — offline, timeout, bad output, a rate
   * limit — falls straight through to the on-device parser, with the note
   * untouched.
   */
  const runStructurer = async (text: string, noteId: string | null, useAi = mode === 'ai') => {
    if (!text.trim()) return
    setBusy(true)
    try {
      if (useAi) {
        try {
          showSuggestions(await remoteNoteStructurer.structure(text, record), noteId, 'ai')
          return
        } catch (e) {
          const offline = e instanceof StructuringUnavailable && e.code === 'offline'
          toast(offline ? 'Đang ngoại tuyến. Đã dùng bộ sắp xếp cục bộ.' : AI_FALLBACK_MESSAGE)
        }
      }
      showSuggestions(await heuristicStructurer.structure(text, record), noteId, 'local')
    } finally {
      setBusy(false)
    }
  }

  const saveFragment = (source: CaptureSource, text: string): string | null => {
    const trimmed = text.trim()
    if (!trimmed) return null
    const fragment = createFragment(source, trimmed)
    const next = structuredClone(record)
    next.quickNotes.push(fragment)
    replace(next)
    return fragment.id
  }

  const saveDraftNote = (): string | null => {
    const id = saveFragment('text', draft)
    if (id) setDraft('')
    return id
  }

  const onOrganise = async () => {
    const text = draft.trim()
    if (!text) return
    // The first AI request in this browser profile needs the learner to have
    // read what leaving the device means.
    if (mode === 'ai' && !ai.privacyAccepted) {
      setPrivacyOpen(true)
      return
    }
    const id = saveDraftNote()
    await runStructurer(text, id)
  }

  const onAcceptPrivacy = async () => {
    ai.acceptPrivacy()
    setPrivacyOpen(false)
    const text = draft.trim()
    if (!text) return
    const id = saveDraftNote()
    await runStructurer(text, id, true)
  }

  const applySelected = () => {
    if (!suggestions) return
    const chosen = suggestions.filter((s) => selected.has(s.id))
    if (chosen.length === 0) {
      setSuggestions(null)
      return
    }
    let next = applyMany(record, chosen)
    if (sourceNoteId) {
      const note = next.quickNotes.find((n) => n.id === sourceNoteId)
      if (note) {
        const sections = Array.from(new Set(chosen.map((s) => s.sectionId)))
        note.filedInto = Array.from(new Set([...note.filedInto, ...sections]))
      }
    }
    if (sourceNoteId) {
      const note = next.quickNotes.find((n) => n.id === sourceNoteId)
      if (note) {
        note.processingStatus = chosen.length === suggestions.length ? 'fully_applied' : 'partially_applied'
        note.updatedAt = new Date().toISOString()
      }
    }
    next = { ...next }
    replace(next)
    setSuggestions(null)
    setSourceNoteId(null)
    // What the learner wants to know next is what is still missing, so the
    // completeness engine answers immediately rather than making them go and
    // look. It counts requirements; it does not advise.
    const after = evaluateCompleteness(next)
    const missing = after.mandatoryTotal - after.mandatorySatisfied
    toast(
      missing > 0
        ? `Đã bổ sung ${chosen.length} mục. Còn thiếu ${missing} mục bắt buộc ở mức ${after.level}.`
        : `Đã bổ sung ${chosen.length} mục. Đã đủ mục bắt buộc ở mức ${after.level}.`,
    )
  }

  const deleteNote = (id: string) => {
    const next = structuredClone(record)
    next.quickNotes = next.quickNotes.filter((n) => n.id !== id)
    replace(next)
  }

  const grouped = useMemo(() => {
    if (!suggestions) return []
    const map = new Map<string, StructuringSuggestion[]>()
    for (const s of suggestions) {
      const arr = map.get(s.sectionId) ?? []
      arr.push(s)
      map.set(s.sectionId, arr)
    }
    return Array.from(map.entries())
  }, [suggestions])

  return (
    <div className="content">
      <Card
        title="Ghi chú nhanh"
        hint="Ghi theo cách tự nhiên trong lúc khám. ClerkMate sẽ giúp đặt thông tin vào đúng mục của bệnh án."
      >
        <div className="chips" style={{ marginBottom: 12 }}>
          <Chip small on={tab === 'text'} onClick={() => setTab('text')}>
            ⌨️ Gõ
          </Chip>
          <Chip small on={tab === 'voice'} onClick={() => setTab('voice')}>
            🎙️ Nói
          </Chip>
        </div>

        {tab === 'voice' && (
          <VoicePanel
            locked={locked}
            onKeep={(text) => {
              const id = saveFragment('voice', text)
              if (id) {
                toast('Đã lưu đoạn ghi âm.')
                return id
              }
              return null
            }}
            onOrganise={(text, id) => void runStructurer(text, id)}
          />
        )}

        {tab === 'text' && (
        <>
        <textarea
          className="notepad"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder={EXAMPLE}
          aria-label="Nội dung ghi chú nhanh"
          disabled={locked}
        />
        {locked && (
          <p className="tiny muted" style={{ margin: '10px 0 0' }}>
            Ca đã nộp nên đang khoá sửa — không thêm được ghi chú. Mở lại ca ở tab Xem trước nếu cần
            bổ sung.
          </p>
        )}
        {ai.allowAi && !locked && (
          <div style={{ marginTop: 14 }}>
            <div className="section-title" style={{ marginBottom: 8 }}>
              Cách sắp xếp
            </div>
            <div className="stack stack--tight">
              <ModeOption
                on={mode === 'local'}
                title="Cục bộ"
                subtitle="Chạy trên thiết bị, không gửi dữ liệu ra ngoài."
                onClick={() => setMode('local')}
              />
              <ModeOption
                on={mode === 'ai'}
                title="Hỗ trợ bằng AI"
                subtitle={
                  !ai.online
                    ? 'Hỗ trợ bằng AI — cần kết nối mạng.'
                    : ai.checking
                      ? 'Đang kiểm tra dịch vụ AI…'
                      : !ai.configured
                        ? 'Chưa cấu hình dịch vụ AI trên máy chủ.'
                        : 'Gửi nội dung ghi chú tới dịch vụ AI để đề xuất cấu trúc.'
                }
                disabled={!ai.aiSelectable}
                onClick={() => setMode('ai')}
              />
            </div>
            {mode === 'ai' && (
              <p className="tiny muted" style={{ margin: '10px 0 0' }}>
                Chỉ sử dụng dữ liệu giả lập hoặc dữ liệu đã được ẩn danh khi dùng chế độ AI. Ứng dụng
                chỉ gửi nội dung ghi chú — không gửi bệnh án, hình ảnh hay danh tính người học.
              </p>
            )}
          </div>
        )}

        <div className="btn-row" style={{ marginTop: 12 }}>
          <button
            type="button"
            className="btn btn--primary"
            style={{ flex: 1 }}
            disabled={!draft.trim() || busy || locked}
            onClick={onOrganise}
          >
            {busy
              ? mode === 'ai'
                ? 'Đang gửi tới AI…'
                : 'Đang phân tích…'
              : 'Sắp xếp vào bệnh án'}
          </button>
          <button
            type="button"
            className="btn btn--secondary"
            disabled={!draft.trim() || locked}
            onClick={() => {
              saveDraftNote()
              toast('Đã lưu ghi chú.')
            }}
          >
            Lưu nháp
          </button>
        </div>
        {!draft.trim() && !locked && (
          <div className="chips" style={{ marginTop: 10 }}>
            <button type="button" className="link-btn" onClick={() => setDraft(EXAMPLE)}>
              Chèn ví dụ mẫu
            </button>
            <button type="button" className="link-btn" onClick={() => setDraft(EXAMPLE_AI)}>
              Ví dụ viết thành câu
            </button>
          </div>
        )}
        </>
        )}
      </Card>

      <Card title="Viết tắt được hiểu" className="card--flat">
        <p className="small muted" style={{ marginTop: -4 }}>
          Cứ gõ viết tắt như trên giấy nháp — bộ phân tích tự bung ra thuật ngữ đầy đủ.
        </p>
        <div className="stack stack--tight small">
          <div>
            <strong>Bệnh:</strong> THA, ĐTĐ, RLLPM, BPTNMT, HPQ, TBMMN, NMCT, BTM, VKDT, THK, LX, VGB,
            GERD, XHTH, UTV, UTCTC, SXH, SGTT…
          </div>
          <div>
            <strong>Sinh hiệu:</strong> HA 140/85 · M 78 · NT 18 · T 38.5 · SpO2 96 · CN 62kg · CC 155cm ·
            VE 88
          </div>
          <div>
            <strong>Khác:</strong> tên thuốc kèm liều (amlodipine 5mg 1v/ngày), quan hệ gia đình (mẹ ĐTĐ),
            phủ định (không hút thuốc, chưa ghi nhận dị ứng)
          </div>
        </div>
      </Card>

      <Notice tone="info">
        ClerkMate <strong>đề xuất</strong> cách sắp xếp — bạn là người quyết định. Ứng dụng không tự điền
        thông tin lâm sàng mà bạn chưa khai thác.
      </Notice>

      {notes.length > 0 && (
        <Card title={`Ghi chú trong buổi khám (${notes.length})`} className="card--flat">
          <div className="stack">
            {notes.map((n) => (
              <div key={n.id} className="suggestion" style={{ flexDirection: 'column', gap: 8 }}>
                <div className="chips" style={{ width: '100%', alignItems: 'center' }}>
                  <span className="tiny muted">
                    {relativeTime(n.createdAt)} · {n.source === 'voice' ? '🎙️ Nói' : '⌨️ Gõ'}
                  </span>
                  <Badge tone={FRAGMENT_BADGE[n.processingStatus ?? 'unprocessed'].tone}>
                    {FRAGMENT_BADGE[n.processingStatus ?? 'unprocessed'].label}
                  </Badge>
                </div>
                <div style={{ whiteSpace: 'pre-wrap', fontSize: 14 }}>{n.text}</div>
                {n.source === 'voice' && n.originalText !== n.text && (
                  <p className="tiny muted" style={{ margin: 0 }}>
                    Máy nghe được: “{n.originalText}”
                  </p>
                )}
                <div className="chips" style={{ width: '100%', alignItems: 'center' }}>
                  {n.filedInto.map((sid) => (
                    <Badge key={sid} tone="ok">
                      {SECTION_BY_ID[sid as keyof typeof SECTION_BY_ID]?.label ?? sid}
                    </Badge>
                  ))}
                </div>
                <div className="btn-row" style={{ width: '100%' }}>
                  <button
                    type="button"
                    className="btn btn--soft btn--sm"
                    disabled={locked}
                    onClick={() => runStructurer(n.text, n.id)}
                  >
                    Sắp xếp lại
                  </button>
                  <button
                    type="button"
                    className="btn btn--secondary btn--sm"
                    disabled={locked}
                    onClick={() => deleteNote(n.id)}
                  >
                    Xóa
                  </button>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      <Sheet
        open={!!suggestions}
        onClose={() => {
          setSuggestions(null)
          setSourceNoteId(null)
        }}
        title="Đề xuất sắp xếp"
      >
        <div className="row-between" style={{ marginTop: -6, marginBottom: 12 }}>
          <Badge tone={usedBackend === 'ai' ? 'brand' : 'muted'}>
            {usedBackend === 'ai' ? 'Đề xuất bởi AI' : 'Đề xuất cục bộ'}
          </Badge>
          {usedBackend === 'ai' && ai.model && <span className="tiny muted">{ai.model}</span>}
        </div>
        <p className="tiny muted" style={{ marginTop: 0 }}>
          ClerkMate chỉ đề xuất cách sắp xếp. Bạn là người quyết định nội dung nào được đưa vào bệnh án.
        </p>

        {suggestions && suggestions.length === 0 && (
          <p className="muted small">
            Chưa nhận diện được mục nào. Bạn vẫn có thể nhập trực tiếp trong tab Bệnh án.
          </p>
        )}

        {grouped.map(([sectionId, items]) => (
          <div key={sectionId} style={{ marginBottom: 18 }}>
            <div className="section-title" style={{ marginBottom: 8 }}>
              {SECTION_BY_ID[sectionId as keyof typeof SECTION_BY_ID]?.label ?? sectionId}
            </div>
            <div className="stack stack--tight">
              {items.map((s) => {
                const on = selected.has(s.id)
                return (
                  <div key={s.id} className="suggestion" data-on={on} data-dim={s.alreadyPresent}>
                    <Checkbox
                      on={on}
                      label={s.fieldLabel}
                      onToggle={() =>
                        setSelected((prev) => {
                          const next = new Set(prev)
                          if (next.has(s.id)) next.delete(s.id)
                          else next.add(s.id)
                          return next
                        })
                      }
                    />
                    <div className="grow">
                      <div className="tiny muted">{s.fieldLabel}</div>
                      <div style={{ fontWeight: 550 }}>{s.value}</div>
                      <div className="snippet">“{s.snippet}”</div>
                      {/*
                        Both values, side by side. The record already says
                        something else here, and the two may both be true of the
                        same patient — so this shows the choice instead of
                        making it.
                      */}
                      {s.conflictsWith && (
                        <div className="conflict">
                          <div className="tiny">
                            <strong>Có thông tin mới cho mục này.</strong>
                          </div>
                          <div className="tiny">
                            Đang có: <strong>{s.conflictsWith}</strong>
                          </div>
                          <div className="tiny">
                            Đề xuất mới: <strong>{s.value}</strong>
                          </div>
                          <div className="tiny muted">
                            Tích để cập nhật, bỏ trống để giữ giá trị hiện tại.
                          </div>
                        </div>
                      )}
                      {s.reason && <div className="tiny muted">{s.reason}</div>}
                    </div>
                    {s.alreadyPresent ? (
                      <Badge tone="muted">đã có</Badge>
                    ) : s.conflictsWith ? (
                      <Badge tone="warn">khác giá trị cũ</Badge>
                    ) : s.confidence === 'low' ? (
                      <Badge tone="warn">cần xem lại</Badge>
                    ) : null}
                  </div>
                )
              })}
            </div>
          </div>
        ))}

        {suggestions && suggestions.length > 0 && (
          <div className="btn-row" style={{ marginTop: 4 }}>
            <button type="button" className="btn btn--primary" style={{ flex: 1 }} onClick={applySelected}>
              Đưa {selected.size} mục vào bệnh án
            </button>
            <button
              type="button"
              className="btn btn--secondary"
              onClick={() =>
                setSelected(new Set(suggestions.filter((s) => !s.alreadyPresent).map((s) => s.id)))
              }
            >
              Chọn hết
            </button>
          </div>
        )}
      </Sheet>

      <Sheet open={privacyOpen} onClose={() => setPrivacyOpen(false)} title="Trước khi dùng chế độ AI">
        <Notice tone="warn">
          <strong>Chỉ sử dụng dữ liệu giả lập hoặc dữ liệu đã được ẩn danh khi dùng chế độ AI.</strong>
        </Notice>
        <p className="small" style={{ marginBottom: 0 }}>
          Ở chế độ này, <strong>nội dung ghi chú</strong> được gửi tới một dịch vụ AI bên ngoài để đề
          xuất cách sắp xếp. Ứng dụng <strong>không gửi</strong> bệnh án đã nhập, hình ảnh đính kèm,
          tên hay mã số của bạn.
        </p>
        <ul className="small" style={{ margin: '10px 0 0', paddingLeft: 20 }}>
          <li>AI chỉ <strong>đề xuất</strong> — bạn vẫn phải chọn từng mục trước khi ghi vào bệnh án.</li>
          <li>AI không chẩn đoán, không đề nghị điều trị, không tự điền dữ kiện bạn chưa khai thác.</li>
          <li>Mọi đề xuất đều phải kèm đoạn trích nguyên văn trong ghi chú; không có trích dẫn thì bị loại bỏ.</li>
          <li>Chế độ <strong>Cục bộ</strong> vẫn chạy hoàn toàn trên máy, kể cả khi mất mạng.</li>
        </ul>
        <div className="btn-row" style={{ marginTop: 16 }}>
          <button type="button" className="btn btn--primary" style={{ flex: 1 }} onClick={onAcceptPrivacy}>
            Tôi hiểu và đồng ý
          </button>
          <button type="button" className="btn btn--secondary" onClick={() => setPrivacyOpen(false)}>
            Huỷ
          </button>
        </div>
        <p className="tiny muted" style={{ margin: '10px 0 0' }}>
          Xác nhận này lưu trong trình duyệt này và không hỏi lại, trừ khi bạn xoá nó trong Cài đặt.
        </p>
      </Sheet>
    </div>
  )
}

function ModeOption({
  on,
  title,
  subtitle,
  disabled,
  onClick,
}: {
  on: boolean
  title: string
  subtitle: string
  disabled?: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      className="list__item"
      disabled={disabled}
      onClick={onClick}
      style={{
        borderRadius: 'var(--r-md)',
        border: `1px solid ${on ? 'var(--brand-600)' : 'var(--line)'}`,
        background: on ? 'var(--brand-50)' : undefined,
        opacity: disabled ? 0.55 : 1,
        textAlign: 'left',
      }}
    >
      <span className="list__icon" aria-hidden="true">{on ? '◉' : '○'}</span>
      <span className="grow">
        <span className="title">{title}</span>
        <span className="meta">{subtitle}</span>
      </span>
    </button>
  )
}

/** How a fragment's state reads in the inbox. */
const FRAGMENT_BADGE: Record<string, { label: string; tone: 'ok' | 'warn' | 'brand' | 'muted' }> = {
  unprocessed: { label: 'Chưa sắp xếp', tone: 'muted' },
  suggestions_ready: { label: 'Có đề xuất', tone: 'brand' },
  partially_applied: { label: 'Đã đưa một phần', tone: 'warn' },
  fully_applied: { label: 'Đã sắp xếp', tone: 'ok' },
  needs_review: { label: 'Cần xem lại', tone: 'warn' },
}

/**
 * Push-to-talk capture.
 *
 * The transcript is editable before anything is structured, because a
 * recogniser mishears — and a learner correcting "gối phải" from "gối phát"
 * should not have to retype the sentence. The microphone opens only while
 * recording, and the notice about where the audio goes appears before the
 * first recording rather than in a settings page nobody reads.
 */
function VoicePanel({
  locked,
  onKeep,
  onOrganise,
}: {
  locked: boolean
  onKeep: (text: string) => string | null
  onOrganise: (text: string, fragmentId: string) => void
}) {
  const voice = useVoiceCapture()
  const [edited, setEdited] = useState('')
  const [acknowledged, setAcknowledged] = useState(false)

  useEffect(() => {
    if (voice.state === 'recording' || voice.state === 'transcribing') setEdited(voice.transcript)
  }, [voice.transcript, voice.state])

  if (!voiceSupported()) {
    return (
      <Notice tone="warn">
        Trình duyệt này không hỗ trợ đọc thành văn bản. Bạn vẫn ghi chú bình thường ở tab{' '}
        <strong>Gõ</strong> — mọi tính năng khác không đổi.
      </Notice>
    )
  }

  if (locked) {
    return <Notice tone="info">Ca đã nộp nên đang khoá sửa — không ghi âm thêm được.</Notice>
  }

  if (!acknowledged) {
    return (
      <div className="stack">
        <Notice tone="warn">
          <strong>Không đọc tên, số hồ sơ, số điện thoại</strong> hoặc thông tin có thể nhận diện
          người bệnh.
        </Notice>
        <Notice tone="info">
          Âm thanh sẽ được <strong>gửi tới dịch vụ chuyển giọng nói thành văn bản của trình duyệt</strong>{' '}
          (Google với Chrome, Apple với Safari). Đây không phải nhận dạng trên máy. Chỉ sử dụng dữ liệu
          giả lập hoặc đã loại bỏ thông tin định danh.
        </Notice>
        <button type="button" className="btn btn--primary btn--block" onClick={() => setAcknowledged(true)}>
          Tôi đã hiểu, bật micro
        </button>
      </div>
    )
  }

  const recording = voice.state === 'recording'
  const working = voice.state === 'transcribing'

  return (
    <div className="stack">
      {voice.error && <Notice tone="warn">{voice.error}</Notice>}

      {recording ? (
        <button type="button" className="btn btn--primary btn--block" onClick={voice.stop}>
          ⏹ Dừng · đang nghe {voice.elapsed}s
        </button>
      ) : (
        <button
          type="button"
          className="btn btn--primary btn--block"
          disabled={working}
          onClick={() => {
            setEdited('')
            voice.start()
          }}
        >
          {working ? 'Đang chuyển thành văn bản…' : edited ? '🎙️ Ghi âm lại' : '🎙️ Bắt đầu nói'}
        </button>
      )}

      {(edited || recording || working) && (
        <>
          <textarea
            className="notepad"
            value={edited}
            onChange={(e) => setEdited(e.target.value)}
            placeholder="Nội dung nghe được sẽ hiện ở đây — sửa lại trước khi sắp xếp."
            aria-label="Nội dung nghe được"
          />
          <p className="tiny muted" style={{ margin: 0 }}>
            Sửa lại cho đúng trước khi sắp xếp. Bản máy nghe được vẫn được giữ nguyên trong ghi chú.
          </p>
          <div className="btn-row">
            <button
              type="button"
              className="btn btn--primary"
              style={{ flex: 1 }}
              disabled={!edited.trim() || recording}
              onClick={() => {
                const id = onKeep(edited)
                if (id) {
                  onOrganise(edited.trim(), id)
                  setEdited('')
                  voice.reset()
                }
              }}
            >
              Sắp xếp vào bệnh án
            </button>
            <button
              type="button"
              className="btn btn--secondary"
              disabled={!edited.trim() || recording}
              onClick={() => {
                if (onKeep(edited)) {
                  setEdited('')
                  voice.reset()
                }
              }}
            >
              Lưu đoạn này
            </button>
          </div>
        </>
      )}
    </div>
  )
}
