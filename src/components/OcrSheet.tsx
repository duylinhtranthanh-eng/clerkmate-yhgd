/**
 * The sheet a learner sees between a photographed slip and their record.
 *
 * Nothing here writes to the record on its own. The recogniser produces a list,
 * the learner says which rows are right, and only then does anything move. That
 * ordering is the whole point: optical character recognition on a phone
 * photograph of a printed form gets digits wrong often enough that a silent
 * import would put wrong numbers into a teaching record, and a wrong potassium
 * is worse than a missing one.
 *
 * The identity lines are handled the other way round. They are shown — a learner
 * should see exactly what was printed on the slip they photographed — but they
 * have no checkbox at all. There is no path through this sheet that puts a
 * patient's name into the record by accident, only by typing it in somewhere
 * else on purpose.
 */

import { useCallback, useEffect, useState } from 'react'
import { Badge, Checkbox, Notice } from './Ui'
import { Sheet } from './Sheet'
import { ocrAvailable, recognizeImage, retainOcr } from '../ocr/engine'
import { readSlipWithAi } from '../ocr/aiSlip'
import { fetchAiStatus } from '../parsing/aiStructurer'
import { identifierCount, parseOcrLines } from '../ocr/labLines'
import type { ParsedLine, ParsedResult } from '../ocr/labLines'

/** How sure the recogniser has to be before a row is ticked for the learner. */
const TRUST_THRESHOLD = 70

const STAGE_LABEL: Record<string, string> = {
  'loading tesseract core': 'Đang tải bộ nhận dạng…',
  'initializing tesseract': 'Đang khởi động…',
  'loading language traineddata': 'Đang tải dữ liệu tiếng Việt…',
  'initializing api': 'Đang chuẩn bị…',
  'recognizing text': 'Đang đọc chữ trong ảnh…',
}

export function OcrSheet({
  open,
  image,
  onClose,
  onImport,
}: {
  open: boolean
  /** The untouched local image. It never leaves this device. */
  image: Blob | null
  onClose: () => void
  onImport: (rows: ParsedResult[]) => void
}) {
  const [lines, setLines] = useState<ParsedLine[] | null>(null)
  const [chosen, setChosen] = useState<Set<number>>(new Set())
  const [stage, setStage] = useState('')
  const [error, setError] = useState('')
  const [showOther, setShowOther] = useState(false)
  const [elapsed, setElapsed] = useState(0)
  /** Whether the deployment has AI configured at all. Null while unknown. */
  const [aiOffered, setAiOffered] = useState<boolean | null>(null)
  const [usedAi, setUsedAi] = useState(false)

  const show = useCallback((parsed: ParsedLine[]) => {
    setLines(parsed)
    // Rows the recogniser was sure about start ticked; the doubtful ones start
    // clear, so a learner in a hurry imports the safe subset rather than the
    // whole page.
    setChosen(
      new Set(
        parsed
          .filter((l) => l.kind === 'result' && l.confidence >= TRUST_THRESHOLD)
          .map((l) => l.index),
      ),
    )
  }, [])

  const run = useCallback(async () => {
    if (!image) return
    setError('')
    setLines(null)
    setStage(STAGE_LABEL['loading tesseract core'])
    try {
      const outcome = await recognizeImage(image, (s) => setStage(STAGE_LABEL[s] ?? 'Đang xử lý…'))
      setElapsed(outcome.elapsedMs)
      setUsedAi(false)
      show(parseOcrLines(outcome.lines))
    } catch (e) {
      setError(
        e instanceof Error && e.message
          ? e.message
          : 'Không đọc được ảnh. Thử chụp lại gần hơn, đủ sáng và để phiếu thẳng.',
      )
    } finally {
      setStage('')
    }
  }, [image])

  /**
   * The route that sends the photograph away.
   *
   * Guarded by a confirmation that names what is about to happen, every time.
   * A learner who taps this is choosing accuracy over keeping the image on the
   * device, and that is a choice they should make knowingly rather than one the
   * app makes quietly on their behalf when the on-device read comes back thin.
   */
  const runAi = useCallback(async () => {
    if (!image) return
    const ok = window.confirm(
      'Ảnh phiếu này — bao gồm cả phần tên bệnh nhân in trên đầu phiếu — sẽ được gửi tới dịch vụ AI ' +
        'mà bộ môn đã cấu hình. ClerkMate không kiểm soát được bên đó giữ ảnh bao lâu.\n\n' +
        'Chỉ dùng với bệnh nhân giả lập hoặc phiếu đã che thông tin. Gửi đi?',
    )
    if (!ok) return
    setError('')
    setLines(null)
    setStage('Đang gửi ảnh cho AI đọc…')
    const started = performance.now()
    try {
      const got = await readSlipWithAi(image)
      setElapsed(Math.round(performance.now() - started))
      setUsedAi(true)
      show(parseOcrLines(got))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Không gửi được ảnh cho AI.')
    } finally {
      setStage('')
    }
  }, [image, show])

  // Holds the recogniser for as long as this sheet exists, so moving between
  // several slips on one screen pays the start-up cost once, and leaving the
  // screen gives the memory back.
  useEffect(() => retainOcr(), [])

  useEffect(() => {
    if (!open) return
    let alive = true
    void fetchAiStatus().then((s) => {
      if (alive) setAiOffered(s.configured)
    })
    return () => {
      alive = false
    }
  }, [open])

  useEffect(() => {
    if (open && image) void run()
    if (!open) {
      setLines(null)
      setChosen(new Set())
      setError('')
      setShowOther(false)
      setUsedAi(false)
    }
  }, [open, image, run])

  const toggle = (index: number) => {
    setChosen((prev) => {
      const next = new Set(prev)
      if (next.has(index)) next.delete(index)
      else next.add(index)
      return next
    })
  }

  const resultLines = (lines ?? []).filter((l) => l.kind === 'result')
  const otherLines = (lines ?? []).filter((l) => l.kind !== 'result')
  const idCount = lines ? identifierCount(lines) : 0
  const picked = resultLines.filter((l) => chosen.has(l.index))

  return (
    <Sheet open={open} onClose={onClose} title="Đọc kết quả từ ảnh">
      {!ocrAvailable() && (
        <Notice tone="warn">
          Trình duyệt này không chạy được bộ nhận dạng chữ. Bạn vẫn nhập tay được như bình thường.
        </Notice>
      )}

      {stage && (
        <div className="muted small" style={{ padding: '18px 0' }}>
          {stage}
          <div className="small" style={{ marginTop: 6 }}>
            Lần đầu phải tải bộ nhận dạng (khoảng 4 MB). Những lần sau chạy ngay, kể cả khi không có
            mạng.
          </div>
        </div>
      )}

      {error && (
        <>
          <Notice tone="warn">{error}</Notice>
          <button type="button" className="btn btn--secondary btn--block" onClick={() => void run()}>
            Thử đọc lại
          </button>
        </>
      )}

      {lines && !error && (
        <>
          {idCount > 0 && (
            <Notice tone="warn">
              Phiếu này có <strong>{idCount} dòng chứa thông tin định danh</strong>. ClerkMate không
              cho đưa những dòng đó vào bệnh án — bạn xem bên dưới để biết trên phiếu in những gì.
            </Notice>
          )}

          {usedAi && (
            <Notice tone="warn">
              Những dòng dưới đây do AI đọc, nên <strong>ảnh đã rời khỏi máy này</strong>.
            </Notice>
          )}

          {resultLines.length === 0 ? (
            <Notice tone="info">
              Không nhận ra dòng kết quả nào. Thử chụp lại gần hơn và đủ sáng, hoặc nhập tay.
            </Notice>
          ) : (
            <>
              <p className="small muted" style={{ margin: '4px 0 10px' }}>
                Đọc xong trong {(elapsed / 1000).toFixed(1)} giây. Kiểm lại số trước khi thêm — máy
                đọc sai chữ số là chuyện thường.
              </p>
              {/*
                Nói thẳng giới hạn của cái cờ, ngay cạnh chỗ nó hiện ra.

                Cờ suy từ khoảng tham chiếu mà máy đọc được trên ảnh. Một dấu
                phẩy mất đi là "< 5,2" thành "< 52", và một kết quả bất thường
                đeo nhãn xanh. Số sai thì người học nhìn ra; nhãn sai thì không.
              */}
              <Notice tone="info">
                Cờ bên dưới chỉ suy từ khoảng tham chiếu <strong>máy đọc được</strong> trên ảnh —
                đọc sai khoảng thì cờ sai theo. App <strong>không ghi cờ vào bệnh án</strong>; bạn
                tự đặt sau khi đối chiếu tờ phiếu.
              </Notice>
              <div className="list">
                {resultLines.map((l) => (
                  <div
                    key={l.index}
                    className="list__item"
                    style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}
                  >
                    <Checkbox
                      on={chosen.has(l.index)}
                      onToggle={() => toggle(l.index)}
                      label={l.result?.name ?? ''}
                    />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 600 }}>
                        {l.result?.name}{' '}
                        <span style={{ fontWeight: 400 }}>
                          {l.result?.value} {l.result?.unit}
                        </span>
                      </div>
                      <div className="small muted">
                        {l.result?.reference
                          ? `Khoảng tham chiếu in trên phiếu: ${l.result.reference}`
                          : 'Phiếu không in khoảng tham chiếu'}
                      </div>
                      <div style={{ marginTop: 4, display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                        {l.result?.flag === 'abnormal' && <Badge tone="danger">bất thường</Badge>}
                        {l.result?.flag === 'normal' && <Badge tone="ok">trong khoảng</Badge>}
                        {l.confidence > 0 && l.confidence < TRUST_THRESHOLD && (
                          <Badge tone="warn">máy đọc không chắc — kiểm kỹ</Badge>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}

          {otherLines.length > 0 && (
            <>
              <button
                type="button"
                className="btn btn--ghost btn--sm"
                style={{ marginTop: 10 }}
                onClick={() => setShowOther((v) => !v)}
              >
                {showOther ? 'Ẩn' : `Xem ${otherLines.length} dòng còn lại trên phiếu`}
              </button>
              {showOther && (
                <div className="list" style={{ marginTop: 8 }}>
                  {otherLines.map((l) => (
                    <div key={l.index} className="list__item">
                      <div className="small" style={{ opacity: 0.75 }}>
                        {l.text}
                      </div>
                      {l.kind === 'identifier' && (
                        <Badge tone="danger">thông tin định danh — không đưa vào bệnh án</Badge>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </>
          )}

          {aiOffered && !usedAi && (
            <>
              <button
                type="button"
                className="btn btn--ghost btn--sm"
                style={{ marginTop: 10 }}
                onClick={() => void runAi()}
              >
                Đọc chưa tốt? Nhờ AI đọc lại
              </button>
              <p className="small muted" style={{ margin: '4px 0 0' }}>
                Cách này chính xác hơn nhưng <strong>gửi ảnh ra khỏi máy</strong>. Sẽ hỏi lại trước
                khi gửi.
              </p>
            </>
          )}

          <div className="btn-row" style={{ marginTop: 'var(--sp-4)' }}>
            <button
              type="button"
              className="btn btn--primary btn--block"
              disabled={picked.length === 0}
              onClick={() => {
                onImport(picked.map((l) => l.result as ParsedResult))
              }}
            >
              {picked.length === 0
                ? 'Chọn ít nhất một dòng'
                : `Thêm ${picked.length} kết quả vào bệnh án`}
            </button>
          </div>
        </>
      )}
    </Sheet>
  )
}
