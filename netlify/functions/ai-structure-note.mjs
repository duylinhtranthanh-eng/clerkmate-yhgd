/**
 * AI note-structuring proxy.
 *
 * Exists for one reason: the provider key must never reach the browser. The app
 * calls this same-origin function, the function calls the provider, and the key
 * stays in Netlify's environment.
 *
 * Contract with the client (`src/parsing/aiStructurer.ts`):
 *   GET  → { configured: boolean, model?: string }   — no secrets, no note text
 *   POST { note, fields } → { suggestions: [...] }
 *
 * What this function will not do: log note text, echo provider responses to the
 * client, or return a target outside the whitelist the client sent. The client
 * validates everything again on arrival — neither side trusts the model.
 *
 * Environment:
 *   AI_API_KEY   (required to enable AI mode)
 *   AI_PROVIDER  'anthropic' (default) | 'openai'
 *   AI_MODEL     default 'claude-sonnet-5'
 *   AI_API_URL   override the provider endpoint
 */

const PROVIDER = (process.env.AI_PROVIDER || 'anthropic').toLowerCase()
const API_KEY = process.env.AI_API_KEY || ''
const MODEL = process.env.AI_MODEL || 'claude-sonnet-5'
const API_URL =
  process.env.AI_API_URL ||
  (PROVIDER === 'openai'
    ? 'https://api.openai.com/v1/chat/completions'
    : 'https://api.anthropic.com/v1/messages')

const MAX_NOTE_CHARS = 6000
const MAX_SUGGESTIONS = 40
/** Netlify's synchronous function budget is 10 s; leave room to answer. */
const PROVIDER_TIMEOUT_MS = 8500

const SYSTEM_PROMPT = `You are a clinical note structuring assistant, not a diagnostic assistant.

Extract only information explicitly present in the user's note.

Do not infer unstated diagnoses, symptoms, negative findings, treatment plans, examination findings, investigation results, or family relations.

Every extracted item must include a source snippet copied from the note.

If information is ambiguous, omit it or assign low confidence.

Return only valid JSON matching the requested schema.

Additional rules for this application:
- The note is written in Vietnamese by a medical student during a Family Medicine consultation. Keep Vietnamese diacritics exactly as they should be written in a medical record.
- You may expand common Vietnamese medical abbreviations (THA = tăng huyết áp, ĐTĐ = đái tháo đường, HA = huyết áp, M = mạch, NT = nhịp thở, CN = cân nặng, CC = chiều cao), but the "source" field must still quote the note verbatim, abbreviation included.
- "source" must be a span copied character-for-character from the note. Never paraphrase it. An item whose source is not in the note will be discarded.
- Only use the targets listed in the schema. Never invent a target.
- A negative statement ("không sốt", "không dị ứng") is not a positive finding. Use redFlags.absent only when the note explicitly says the sign was absent, and never create pastMedical or allergies entries from a negation.
- confidence is a number between 0 and 1. Use a low value rather than guessing.

Respond with a single JSON object and nothing else:
{"suggestions":[{"target":"<target>","value":"<string>","source":"<verbatim span from the note>","confidence":<0..1>,"fields":{"<key>":"<string>"},"reason":"<optional, one short line>"}]}`

const json = (body, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
  })

function buildUserMessage(note, fields) {
  return [
    'Trường được phép điền (chỉ dùng đúng các "target" này):',
    JSON.stringify(fields, null, 1),
    '',
    'Ghi chú của người học:',
    '"""',
    note,
    '"""',
  ].join('\n')
}

/** Pulls the JSON object out of a reply that may be fenced or padded. */
function parseModelJson(text) {
  if (typeof text !== 'string') return null
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i)
  const body = (fenced ? fenced[1] : text).trim()
  const start = body.indexOf('{')
  const end = body.lastIndexOf('}')
  if (start < 0 || end <= start) return null
  try {
    return JSON.parse(body.slice(start, end + 1))
  } catch {
    return null
  }
}

async function callProvider(note, fields) {
  const user = buildUserMessage(note, fields)
  const signal = AbortSignal.timeout(PROVIDER_TIMEOUT_MS)

  if (PROVIDER === 'openai') {
    const res = await fetch(API_URL, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${API_KEY}` },
      body: JSON.stringify({
        model: MODEL,
        temperature: 0,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: user },
        ],
      }),
      signal,
    })
    return { status: res.status, text: res.ok ? (await res.json())?.choices?.[0]?.message?.content : null }
  }

  const res = await fetch(API_URL, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': API_KEY,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 1500,
      temperature: 0,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: user }],
    }),
    signal,
  })
  if (!res.ok) return { status: res.status, text: null }
  const data = await res.json()
  const text = Array.isArray(data?.content)
    ? data.content.filter((c) => c?.type === 'text').map((c) => c.text).join('')
    : null
  return { status: res.status, text }
}

export default async function handler(req) {
  if (req.method === 'GET') {
    return json({ configured: Boolean(API_KEY), ...(API_KEY ? { model: MODEL } : {}) })
  }
  if (req.method !== 'POST') return json({ error: 'method-not-allowed' }, 405)
  if (!API_KEY) return json({ error: 'not-configured' }, 501)

  let body
  try {
    body = await req.json()
  } catch {
    return json({ error: 'bad-request' }, 400)
  }

  const note = typeof body?.note === 'string' ? body.note.trim().slice(0, MAX_NOTE_CHARS) : ''
  if (!note) return json({ error: 'empty-note' }, 400)

  // The client sends the field vocabulary; keep only well-formed entries so a
  // malformed request cannot reshape the prompt.
  const fields = Array.isArray(body?.fields)
    ? body.fields
        .filter((f) => f && typeof f.target === 'string' && typeof f.describe === 'string')
        .slice(0, 60)
        .map((f) => ({
          target: f.target,
          label: typeof f.label === 'string' ? f.label : '',
          describe: f.describe,
          ...(Array.isArray(f.fields) ? { fields: f.fields.filter((k) => typeof k === 'string') } : {}),
        }))
    : []
  if (fields.length === 0) return json({ error: 'bad-request' }, 400)

  const allowed = new Set(fields.map((f) => f.target))

  let result
  try {
    result = await callProvider(note, fields)
  } catch (e) {
    // Never surface the provider's own error text.
    const timedOut = e?.name === 'TimeoutError' || e?.name === 'AbortError'
    return json({ error: timedOut ? 'timeout' : 'upstream-unreachable' }, timedOut ? 504 : 502)
  }

  if (result.status === 401 || result.status === 403) return json({ error: 'auth' }, 502)
  if (result.status === 429) return json({ error: 'rate-limit' }, 429)
  if (result.status >= 400) return json({ error: 'upstream-error' }, 502)

  const parsed = parseModelJson(result.text)
  if (!parsed || !Array.isArray(parsed.suggestions)) return json({ error: 'bad-model-output' }, 502)

  const suggestions = parsed.suggestions
    .filter((s) => s && typeof s === 'object' && allowed.has(s.target))
    .slice(0, MAX_SUGGESTIONS)
    .map((s) => ({
      target: s.target,
      value: typeof s.value === 'number' ? String(s.value) : String(s.value ?? ''),
      source: String(s.source ?? ''),
      confidence: typeof s.confidence === 'number' ? s.confidence : 0.5,
      ...(s.fields && typeof s.fields === 'object' ? { fields: s.fields } : {}),
      ...(typeof s.reason === 'string' ? { reason: s.reason } : {}),
    }))

  return json({ suggestions, model: MODEL })
}
