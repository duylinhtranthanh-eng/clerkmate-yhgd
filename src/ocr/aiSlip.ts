/**
 * Reading a result slip with the AI provider instead of on the device.
 *
 * This is the second of two routes, and the worse one for privacy by a long
 * way. The on-device recogniser in `engine.ts` never lets the photograph leave;
 * this sends the whole image — the patient's name across the header included —
 * to a third party. It exists because the on-device recogniser struggles with a
 * crumpled slip photographed at an angle in a badly lit corridor, and a learner
 * who can read the numbers off the page themselves should not be forced to type
 * them in because the software could not.
 *
 * Three things keep it honest:
 *
 *   - it is unreachable unless someone has deliberately configured AI mode on
 *     the deployment, which the department controls, not the learner;
 *   - the caller has to confirm, in a dialogue that says the image is about to
 *     be sent and to whom, every single time;
 *   - the result is a suggestion like any other, reviewed in the same sheet,
 *     with identity lines switched off by the same rules.
 *
 * Nothing here is reachable in core mode. If the proxy is not configured the
 * endpoint answers `configured: false` and the button is never drawn.
 */

import { AI_ENDPOINT } from '../parsing/aiStructurer'
import type { OcrLine } from './engine'

/** Images above this are rejected before the request, not after. */
const MAX_IMAGE_BYTES = 4 * 1024 * 1024
const REQUEST_TIMEOUT_MS = 30_000

export class SlipReadFailed extends Error {
  constructor(
    readonly code: string,
    message: string,
  ) {
    super(message)
    this.name = 'SlipReadFailed'
  }
}

async function toBase64(blob: Blob): Promise<string> {
  const buf = new Uint8Array(await blob.arrayBuffer())
  let s = ''
  for (let i = 0; i < buf.length; i += 1) s += String.fromCharCode(buf[i])
  return btoa(s)
}

/**
 * Sends the photograph and returns the lines the model read.
 *
 * The lines come back as plain text and go through exactly the same classifier
 * the on-device route uses, so identity lines are marked and excluded by the
 * same code either way. The model is never asked to decide what is identifying
 * and what is not: that judgement stays in `labLines.ts`, where it can be read
 * and tested.
 */
export async function readSlipWithAi(image: Blob): Promise<OcrLine[]> {
  if (image.size > MAX_IMAGE_BYTES) {
    throw new SlipReadFailed('too-large', 'Ảnh lớn quá (trên 4 MB). Chụp lại với độ phân giải thấp hơn.')
  }
  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    throw new SlipReadFailed('offline', 'Thiết bị đang ngoại tuyến. Dùng cách đọc ngay trên máy.')
  }

  let res: Response
  try {
    res = await fetch(AI_ENDPOINT, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        mode: 'slip',
        mimeType: image.type || 'image/jpeg',
        image: await toBase64(image),
      }),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    })
  } catch (e) {
    const timedOut = e instanceof DOMException && e.name === 'TimeoutError'
    throw new SlipReadFailed(
      timedOut ? 'timeout' : 'network',
      timedOut ? 'Dịch vụ AI phản hồi quá lâu.' : 'Không kết nối được dịch vụ AI.',
    )
  }

  if (!res.ok) {
    throw new SlipReadFailed('server', `Dịch vụ AI trả về lỗi ${res.status}.`)
  }

  let data: unknown
  try {
    data = await res.json()
  } catch {
    throw new SlipReadFailed('bad-response', 'Không đọc được phản hồi từ dịch vụ AI.')
  }

  const lines = (data as { lines?: unknown })?.lines
  if (!Array.isArray(lines)) {
    throw new SlipReadFailed('bad-response', 'Dịch vụ AI không trả về nội dung đọc được.')
  }

  return lines
    .filter((l): l is string => typeof l === 'string')
    .map((text) => ({ text: text.replace(/\s+/g, ' ').trim(), confidence: 0 }))
    .filter((l) => /[0-9A-Za-zÀ-ỹ]/.test(l.text))
}
