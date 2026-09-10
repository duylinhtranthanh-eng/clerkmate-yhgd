import { useCallback, useEffect, useRef, useState } from 'react'
import { uid } from '../utils/id'

interface Rect {
  id: string
  /** Normalised to the image, so a box survives any preview size. */
  x: number
  y: number
  w: number
  h: number
}

type Corner = 'nw' | 'ne' | 'sw' | 'se'

type Drag =
  | { kind: 'draw'; origin: { x: number; y: number } }
  | { kind: 'move'; id: string; grab: { x: number; y: number }; start: Rect }
  | { kind: 'resize'; id: string; corner: Corner; start: Rect }

/** On-screen size of the drag handles, in canvas pixels. */
const HANDLE = 20
const MIN_SIZE = 0.02

const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v)

/** Corner positions of a rect, normalised. */
function corners(r: Rect): Record<Corner, { x: number; y: number }> {
  return {
    nw: { x: r.x, y: r.y },
    ne: { x: r.x + r.w, y: r.y },
    sw: { x: r.x, y: r.y + r.h },
    se: { x: r.x + r.w, y: r.y + r.h },
  }
}

/** Rebuilds a rect from one dragged corner and its opposite. */
function resizeRect(start: Rect, corner: Corner, p: { x: number; y: number }): Rect {
  const c = corners(start)
  const fixed =
    corner === 'nw' ? c.se : corner === 'ne' ? c.sw : corner === 'sw' ? c.ne : c.nw
  const x = Math.min(fixed.x, p.x)
  const y = Math.min(fixed.y, p.y)
  return { ...start, x, y, w: Math.abs(p.x - fixed.x), h: Math.abs(p.y - fixed.y) }
}

/**
 * Paints identifiers out of an attachment.
 *
 * Boxes can be drawn, moved and resized, because "cover the top 18%" only fits
 * the mock slip this app draws — a real photograph of a real form puts the
 * name wherever that hospital's template puts it, at whatever angle the phone
 * was held.
 *
 * The redaction itself is destructive: boxes are drawn onto the
 * full-resolution image, it is re-encoded, and the result replaces the stored
 * blob. An overlay would leave the patient's name in the file.
 */
export function RedactEditor({
  blob,
  onApply,
  onCancel,
}: {
  blob: Blob
  onApply: (redacted: Blob) => void
  onCancel: () => void
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const imageRef = useRef<HTMLImageElement | null>(null)
  const dragRef = useRef<Drag | null>(null)

  const [rects, setRects] = useState<Rect[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [ready, setReady] = useState(false)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    const url = URL.createObjectURL(blob)
    const img = new Image()
    img.onload = () => {
      imageRef.current = img
      setReady(true)
      URL.revokeObjectURL(url)
    }
    img.onerror = () => URL.revokeObjectURL(url)
    img.src = url
    return () => URL.revokeObjectURL(url)
  }, [blob])

  const draw = useCallback(() => {
    const canvas = canvasRef.current
    const img = imageRef.current
    if (!canvas || !img) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    // Canvas pixels track the on-screen width, so handles stay a usable size.
    const width = Math.max(200, canvas.parentElement?.clientWidth ?? 320)
    const height = Math.round((width * img.naturalHeight) / img.naturalWidth)
    if (canvas.width !== width || canvas.height !== height) {
      canvas.width = width
      canvas.height = height
    }

    ctx.clearRect(0, 0, width, height)
    ctx.drawImage(img, 0, 0, width, height)

    for (const r of rects) {
      ctx.fillStyle = '#000'
      ctx.fillRect(r.x * width, r.y * height, r.w * width, r.h * height)

      if (r.id !== selectedId) continue

      // Selection outline, drawn light so it reads against the black fill.
      ctx.strokeStyle = '#FFFFFF'
      ctx.lineWidth = 2
      ctx.setLineDash([6, 4])
      ctx.strokeRect(r.x * width, r.y * height, r.w * width, r.h * height)
      ctx.setLineDash([])

      for (const p of Object.values(corners(r))) {
        const cx = p.x * width
        const cy = p.y * height
        ctx.fillStyle = '#FFFFFF'
        ctx.strokeStyle = '#0F9B8E'
        ctx.lineWidth = 2.5
        ctx.beginPath()
        ctx.arc(cx, cy, HANDLE / 2, 0, Math.PI * 2)
        ctx.fill()
        ctx.stroke()
      }
    }
  }, [rects, selectedId])

  useEffect(() => {
    if (ready) draw()
  }, [ready, draw])

  useEffect(() => {
    const onResize = () => draw()
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [draw])

  const pointFrom = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const box = e.currentTarget.getBoundingClientRect()
    return {
      x: clamp01((e.clientX - box.left) / box.width),
      y: clamp01((e.clientY - box.top) / box.height),
    }
  }

  const onPointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    // Capture keeps a drag alive when the finger leaves the canvas. Not every
    // pointer can be captured, and failing to capture must not abort the drag.
    try {
      e.currentTarget.setPointerCapture(e.pointerId)
    } catch {
      /* proceed without capture */
    }
    const box = e.currentTarget.getBoundingClientRect()
    const p = pointFrom(e)
    const tolX = HANDLE / box.width
    const tolY = HANDLE / box.height

    // A handle on the selected box wins over everything else.
    const selected = rects.find((r) => r.id === selectedId)
    if (selected) {
      for (const [corner, c] of Object.entries(corners(selected)) as [Corner, { x: number; y: number }][]) {
        if (Math.abs(p.x - c.x) <= tolX && Math.abs(p.y - c.y) <= tolY) {
          dragRef.current = { kind: 'resize', id: selected.id, corner, start: selected }
          return
        }
      }
    }

    // Then an existing box under the finger — topmost first.
    for (let i = rects.length - 1; i >= 0; i--) {
      const r = rects[i]
      if (p.x >= r.x && p.x <= r.x + r.w && p.y >= r.y && p.y <= r.y + r.h) {
        setSelectedId(r.id)
        dragRef.current = { kind: 'move', id: r.id, grab: { x: p.x - r.x, y: p.y - r.y }, start: r }
        return
      }
    }

    // Otherwise start a new box.
    const fresh: Rect = { id: uid('rect'), x: p.x, y: p.y, w: 0, h: 0 }
    setRects((prev) => [...prev, fresh])
    setSelectedId(fresh.id)
    dragRef.current = { kind: 'draw', origin: p }
  }

  const onPointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const drag = dragRef.current
    if (!drag) return
    const p = pointFrom(e)

    setRects((prev) =>
      prev.map((r) => {
        if (drag.kind === 'draw') {
          if (r.id !== selectedId) return r
          return {
            ...r,
            x: Math.min(drag.origin.x, p.x),
            y: Math.min(drag.origin.y, p.y),
            w: Math.abs(p.x - drag.origin.x),
            h: Math.abs(p.y - drag.origin.y),
          }
        }
        if (r.id !== drag.id) return r
        if (drag.kind === 'move') {
          return {
            ...r,
            x: clamp01(Math.min(p.x - drag.grab.x, 1 - drag.start.w)),
            y: clamp01(Math.min(p.y - drag.grab.y, 1 - drag.start.h)),
          }
        }
        return resizeRect(drag.start, drag.corner, p)
      }),
    )
  }

  const onPointerUp = () => {
    const drag = dragRef.current
    dragRef.current = null
    if (!drag) return
    // Discard an accidental tap that produced no area.
    setRects((prev) => prev.filter((r) => r.w >= MIN_SIZE && r.h >= MIN_SIZE))
  }

  /** A starting box over the usual identifier band, meant to be adjusted. */
  const coverTopBand = () => {
    const fresh: Rect = { id: uid('rect'), x: 0, y: 0, w: 1, h: 0.18 }
    setRects((prev) => [...prev, fresh])
    setSelectedId(fresh.id)
  }

  const removeSelected = () => {
    setRects((prev) => prev.filter((r) => r.id !== selectedId))
    setSelectedId(null)
  }

  const apply = async () => {
    const img = imageRef.current
    if (!img || rects.length === 0) return
    setBusy(true)
    try {
      const out = document.createElement('canvas')
      out.width = img.naturalWidth
      out.height = img.naturalHeight
      const ctx = out.getContext('2d')
      if (!ctx) return
      ctx.drawImage(img, 0, 0)
      ctx.fillStyle = '#000'
      for (const r of rects) {
        ctx.fillRect(r.x * out.width, r.y * out.height, r.w * out.width, r.h * out.height)
      }
      const redacted = await new Promise<Blob | null>((resolve) =>
        out.toBlob(resolve, 'image/jpeg', 0.9),
      )
      if (redacted) onApply(redacted)
    } finally {
      setBusy(false)
    }
  }

  const hasSelection = rects.length > 0
  const selected = rects.find((r) => r.id === selectedId) ?? null

  return (
    <div>
      <div
        style={{
          display: 'flex',
          gap: 10,
          alignItems: 'flex-start',
          padding: 'var(--sp-3)',
          borderRadius: 'var(--r-md)',
          background: hasSelection ? 'var(--warn-bg)' : 'var(--info-bg)',
          marginBottom: 12,
        }}
      >
        <span style={{ fontSize: 20 }} aria-hidden="true">{hasSelection ? '②' : '①'}</span>
        <div className="small">
          {hasSelection ? (
            <>
              Đã có <strong>{rects.length} ô che</strong>. Kéo giữa ô để{' '}
              <strong>di chuyển</strong>, kéo chấm tròn ở góc để{' '}
              <strong>thay đổi kích thước</strong>. Xong thì bấm Áp dụng bên dưới.
            </>
          ) : (
            <>
              <strong>Chưa che gì cả.</strong> Kéo ngón tay trên ảnh để vẽ ô che đúng chỗ có tên và mã số —
              mỗi mẫu phiếu in một kiểu. Hoặc bấm <strong>Che dải trên</strong> rồi kéo chỉnh lại.
            </>
          )}
        </div>
      </div>

      <div style={{ marginTop: 12 }}>
        <canvas
          ref={canvasRef}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
          style={{
            width: '100%',
            display: 'block',
            borderRadius: 'var(--r-md)',
            border: '1px solid var(--line-strong)',
            touchAction: 'none',
            cursor: 'crosshair',
            background: 'var(--surface-alt)',
          }}
        />
      </div>

      <div className="btn-row" style={{ marginTop: 12 }}>
        <button
          type="button"
          className={hasSelection ? 'btn btn--secondary btn--sm' : 'btn btn--primary btn--sm'}
          onClick={coverTopBand}
        >
          ⬛ Che dải trên
        </button>
        {selected && (
          <button type="button" className="btn btn--secondary btn--sm" onClick={removeSelected}>
            Xóa ô đang chọn
          </button>
        )}
        {hasSelection && (
          <button
            type="button"
            className="btn btn--secondary btn--sm"
            onClick={() => {
              setRects([])
              setSelectedId(null)
            }}
          >
            Xóa hết
          </button>
        )}
      </div>

      {hasSelection && !selected && (
        <p className="tiny muted" style={{ margin: '8px 0 0' }}>
          Chạm vào một ô che để chọn rồi chỉnh vị trí và kích thước.
        </p>
      )}

      <div className="btn-row" style={{ marginTop: 12 }}>
        <button
          type="button"
          className={hasSelection ? 'btn btn--primary' : 'btn btn--secondary'}
          style={{ flex: 1 }}
          disabled={!hasSelection || busy}
          onClick={apply}
        >
          {busy
            ? 'Đang xử lý…'
            : hasSelection
              ? `✓ Áp dụng — xóa ${rects.length} vùng khỏi ảnh`
              : 'Chưa chọn vùng nào để che'}
        </button>
        <button type="button" className="btn btn--secondary" onClick={onCancel}>
          Đóng
        </button>
      </div>

      {hasSelection && (
        <p className="tiny muted" style={{ margin: '8px 0 0' }}>
          Sau khi áp dụng, phần bị che <strong>bị xóa vĩnh viễn khỏi ảnh gốc</strong> — không khôi phục
          lại được.
        </p>
      )}
    </div>
  )
}
