/** Client-side thumbnailing so the case list never has to read a full blob. */
export async function makeThumbnail(file: Blob, max = 320, quality = 0.72): Promise<string> {
  const url = URL.createObjectURL(file)
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image()
      el.onload = () => resolve(el)
      el.onerror = () => reject(new Error('Không đọc được ảnh.'))
      el.src = url
    })
    const scale = Math.min(1, max / Math.max(img.naturalWidth, img.naturalHeight))
    const w = Math.max(1, Math.round(img.naturalWidth * scale))
    const h = Math.max(1, Math.round(img.naturalHeight * scale))
    const canvas = document.createElement('canvas')
    canvas.width = w
    canvas.height = h
    const ctx = canvas.getContext('2d')
    if (!ctx) return ''
    ctx.drawImage(img, 0, 0, w, h)
    return canvas.toDataURL('image/jpeg', quality)
  } catch {
    return ''
  } finally {
    URL.revokeObjectURL(url)
  }
}

/**
 * Re-encodes an image so the bytes that leave the device carry nothing but pixels.
 *
 * Drawing to a canvas and reading it back rebuilds the file from raster data,
 * so EXIF goes with it — camera model, timestamps, and the GPS fix that a photo
 * taken in a clinic room carries by default. There is no metadata-stripping
 * step to get wrong: the metadata simply has nowhere to survive.
 *
 * The full resolution is kept. This is the copy a teacher reads.
 */
export async function sanitizeImage(file: Blob, quality = 0.9): Promise<Blob> {
  const url = URL.createObjectURL(file)
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image()
      el.onload = () => resolve(el)
      el.onerror = () => reject(new Error('Không đọc được ảnh.'))
      el.src = url
    })
    const canvas = document.createElement('canvas')
    canvas.width = img.naturalWidth
    canvas.height = img.naturalHeight
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('Trình duyệt không dựng được ảnh.')
    ctx.drawImage(img, 0, 0)
    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, 'image/jpeg', quality),
    )
    if (!blob) throw new Error('Không tạo được bản sao đã làm sạch.')
    return blob
  } finally {
    URL.revokeObjectURL(url)
  }
}

/** A file name that cannot carry a patient's name out with the image. */
export function neutralAttachmentName(index: number, category: string): string {
  return `Ảnh đính kèm ${String(index).padStart(2, '0')} — ${category}`
}
