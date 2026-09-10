/**
 * AI-assisted note structuring.
 *
 * Implements the same `NoteStructurer` interface as the offline parser, so the
 * Quick Note screen and every applier stay unchanged: this backend proposes,
 * the learner decides, and `apply.ts` remains the only code that writes.
 *
 * Two rules make the difference between structuring and inventing, and both are
 * enforced here rather than trusted to the model:
 *
 *   1. Every suggestion must quote a span that genuinely appears in the note.
 *      A quote the note does not contain means the model produced the value
 *      from somewhere else, and the suggestion is dropped.
 *   2. Every target must be in `AI_FIELDS`. Anything else — a diagnosis, a
 *      management plan, an examination finding — is dropped, whatever the model
 *      was asked or decided to return.
 *
 * The browser never holds a provider key: requests go to a same-origin proxy
 * (a Netlify Function) that keeps the secret server-side. `VITE_AI_API_URL` can
 * point that proxy somewhere else; there is deliberately no `VITE_AI_API_KEY`,
 * because anything in a Vite env var ships inside the bundle.
 */

import type { CaseRecord } from '../types/case'
import type { Confidence, NoteStructurer, StructuringSuggestion } from './types'
import { StructuringUnavailable } from './types'
import type { Draft } from './heuristicStructurer'
import { finalise } from './heuristicStructurer'
import { AI_FIELD_BY_TARGET, aiFieldSchema } from './fields'
import { norm } from './text'

/**
 * Where the proxy lives.
 *
 * Resolved against the app's own base path rather than the site root, so a
 * build hosted under a subdirectory — `https://user.github.io/repo/`, which is
 * how GitHub Pages serves a project site — asks its own deployment and not
 * whatever happens to sit at the domain root.
 *
 * On a host with no such function (GitHub Pages has none), the probe simply
 * 404s and `fetchAiStatus` reports `configured: false`, which switches the AI
 * option off. That is the intended behaviour, not an error path.
 */
export const AI_ENDPOINT: string =
  import.meta.env.VITE_AI_API_URL ||
  `${import.meta.env.BASE_URL || '/'}.netlify/functions/ai-structure-note`

/** Longer than the proxy's own provider timeout, so its error wins over ours. */
const REQUEST_TIMEOUT_MS = 12_000
const MAX_NOTE_CHARS = 6000

export interface AiStatus {
  configured: boolean
  model?: string
}

/** Asks the proxy whether a provider is wired up. Sends no note text. */
export async function fetchAiStatus(signal?: AbortSignal): Promise<AiStatus> {
  try {
    const res = await fetch(AI_ENDPOINT, { method: 'GET', signal })
    if (!res.ok) return { configured: false }
    const data = (await res.json()) as AiStatus
    return { configured: data?.configured === true, model: data?.model }
  } catch {
    return { configured: false }
  }
}

interface RawSuggestion {
  target?: unknown
  value?: unknown
  source?: unknown
  confidence?: unknown
  reason?: unknown
  fields?: unknown
}

function toConfidence(score: number): Confidence {
  if (score >= 0.85) return 'high'
  if (score >= 0.6) return 'medium'
  return 'low'
}

/**
 * True when the quoted span really is in the note.
 *
 * Compared without diacritics or repeated whitespace: a model that re-types a
 * quote can drop a tone mark, and that is not the failure we are guarding
 * against. A quote that shares no wording with the note is.
 */
function quoteIsInNote(quote: string, note: string): boolean {
  const q = norm(quote).replace(/\s+/g, ' ').trim()
  if (q.length < 2) return false
  return norm(note).replace(/\s+/g, ' ').includes(q)
}

function asStringMap(input: unknown): Record<string, string> {
  if (!input || typeof input !== 'object') return {}
  const out: Record<string, string> = {}
  for (const [k, v] of Object.entries(input as Record<string, unknown>)) {
    if (typeof v === 'string') out[k] = v
    else if (typeof v === 'number') out[k] = String(v)
  }
  return out
}

/** Turns the proxy's payload into drafts, dropping everything unverifiable. */
export function draftsFromResponse(raw: unknown, note: string): Draft[] {
  const list = (raw as { suggestions?: unknown })?.suggestions
  if (!Array.isArray(list)) {
    throw new StructuringUnavailable('bad-response', 'Phản hồi AI không đúng định dạng.')
  }

  const drafts: Draft[] = []
  for (const item of list as RawSuggestion[]) {
    if (!item || typeof item !== 'object') continue

    const target = typeof item.target === 'string' ? item.target : ''
    const def = AI_FIELD_BY_TARGET[target]
    if (!def) continue

    const value =
      typeof item.value === 'string'
        ? item.value.trim()
        : typeof item.value === 'number'
          ? String(item.value)
          : ''
    if (!value) continue

    const source = typeof item.source === 'string' ? item.source.trim() : ''
    if (!source || !quoteIsInNote(source, note)) continue

    const rawScore = typeof item.confidence === 'number' ? item.confidence : 0.5
    const score = Math.min(1, Math.max(0, rawScore))

    const fields = asStringMap(item.fields)
    const payload = def.toPayload ? def.toPayload(value, fields) : undefined
    if (def.toPayload && !payload) continue

    drafts.push({
      targetKey: def.target,
      sectionId: def.sectionId,
      fieldLabel: def.label,
      value,
      ...(payload ? { payload } : {}),
      snippet: source,
      confidence: toConfidence(score),
      score,
      ...(typeof item.reason === 'string' && item.reason.trim()
        ? { reason: item.reason.trim() }
        : {}),
    })
  }
  return drafts
}

async function callProxy(note: string): Promise<unknown> {
  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    throw new StructuringUnavailable('offline', 'Thiết bị đang ngoại tuyến.')
  }

  let res: Response
  try {
    res = await fetch(AI_ENDPOINT, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      // Only the note and the field vocabulary. No record, no attachments, no
      // learner identity — see the fact sheet for the exact payload.
      body: JSON.stringify({ note: note.slice(0, MAX_NOTE_CHARS), fields: aiFieldSchema() }),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    })
  } catch (e) {
    const timedOut = e instanceof DOMException && e.name === 'TimeoutError'
    throw new StructuringUnavailable(
      timedOut ? 'timeout' : 'network',
      timedOut ? 'Dịch vụ AI phản hồi quá lâu.' : 'Không kết nối được dịch vụ AI.',
    )
  }

  if (!res.ok) {
    const code =
      res.status === 401 || res.status === 403
        ? 'auth'
        : res.status === 429
          ? 'rate-limit'
          : res.status === 501
            ? 'not-configured'
            : 'server'
    throw new StructuringUnavailable(code, `Dịch vụ AI trả về lỗi ${res.status}.`)
  }

  try {
    return await res.json()
  } catch {
    throw new StructuringUnavailable('bad-response', 'Không đọc được phản hồi từ dịch vụ AI.')
  }
}

export function createRemoteNoteStructurer(): NoteStructurer {
  return {
    id: 'ai-proxy',
    label: 'Hỗ trợ bằng AI',
    local: false,
    async structure(text: string, record: CaseRecord): Promise<StructuringSuggestion[]> {
      const note = text.trim()
      if (!note) return []
      const payload = await callProxy(note)
      return finalise(record, draftsFromResponse(payload, note), 'ai')
    },
  }
}

export const remoteNoteStructurer = createRemoteNoteStructurer()
