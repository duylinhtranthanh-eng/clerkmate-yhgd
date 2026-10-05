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
 *   AI_ALLOWED_ORIGINS  extra origins allowed to POST, comma separated
 *   AI_RATE_LIMIT       requests per address per 10 minutes (default 30)
 */

const PROVIDER = (process.env.AI_PROVIDER || 'anthropic').toLowerCase()
const API_KEY = process.env.AI_API_KEY || ''
const MODEL = process.env.AI_MODEL || 'claude-sonnet-5'
const API_URL =
  process.env.AI_API_URL ||
  (PROVIDER === 'openai'
    ? 'https://api.openai.com/v1/chat/completions'
    : 'https://api.anthropic.com/v1/messages')

/**
 * Who may call this function.
 *
 * The key never reaches the browser, but that alone does not protect it: an
 * endpoint anyone can POST to is a key anyone can spend. A request must come
 * from this deployment's own page, or from an origin named in
 * AI_ALLOWED_ORIGINS. Browsers attach `Origin` to every POST, including
 * same-origin ones, so a request without it is not a page — it is a script.
 *
 * This stops casual abuse, not a determined attacker forging headers. The
 * honest ceiling is the rate limit below.
 */
const ALLOWED_ORIGINS = (process.env.AI_ALLOWED_ORIGINS || '')
  .split(',')
  .map((o) => o.trim().replace(/\/$/, ''))
  .filter(Boolean)

function originAllowed(req) {
  const origin = (req.headers.get('origin') || '').replace(/\/$/, '')
  if (!origin) return false
  if (ALLOWED_ORIGINS.includes(origin)) return true
  const host = req.headers.get('host')
  return Boolean(host) && (origin === `https://${host}` || origin === `http://${host}`)
}

/**
 * A crude per-address cap.
 *
 * Netlify runs many instances and this counter is per instance, so the real
 * ceiling is higher than the number here. It is still the difference between a
 * stray script costing a few requests and costing a month of credit. Anything
 * stronger needs shared state, which this project does not have.
 */
const RATE_WINDOW_MS = 10 * 60 * 1000
const RATE_MAX = Number(process.env.AI_RATE_LIMIT || 30)
const hits = new Map()

function rateLimited(req) {
  const ip =
    (req.headers.get('x-nf-client-connection-ip') ||
      (req.headers.get('x-forwarded-for') || '').split(',')[0] ||
      'unknown').trim()
  const now = Date.now()
  const recent = (hits.get(ip) || []).filter((t) => now - t < RATE_WINDOW_MS)
  recent.push(now)
  hits.set(ip, recent)
  if (hits.size > 5000) hits.clear() // never let the map itself become the leak
  return recent.length > RATE_MAX
}

/**
 * The prompt for reading a photographed result slip.
 *
 * It asks for lines, not for judgement. The model transcribes; deciding which
 * line is a patient's name and which is an analyte happens in the app, in code
 * that can be read and tested, because "the model said it was safe" is not a
 * privacy control.
 */
const SLIP_PROMPT = `You are transcribing a photographed Vietnamese laboratory result slip.

Return every line of text you can read, in the order it appears on the page, exactly as printed. Keep Vietnamese diacritics. Keep the decimal separator as printed — Vietnamese slips often use a comma.

Do not summarise. Do not omit the header. Do not interpret the results. Do not decide what is sensitive: transcribe everything you can read and let the application decide what to keep.

Respond with a single JSON object and nothing else:
{"lines":["<line 1>","<line 2>", ...]}`

const MAX_IMAGE_BYTES = 4 * 1024 * 1024
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

/** Sends the photographed slip to the provider's vision endpoint. */
async function callProviderWithImage(imageB64, mimeType) {
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
          { role: 'system', content: SLIP_PROMPT },
          {
            role: 'user',
            content: [
              { type: 'image_url', image_url: { url: `data:${mimeType};base64,${imageB64}` } },
            ],
          },
        ],
      }),
      signal,
    })
    return {
      status: res.status,
      text: res.ok ? (await res.json())?.choices?.[0]?.message?.content : null,
    }
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
      max_tokens: 2000,
      temperature: 0,
      system: SLIP_PROMPT,
      messages: [
        {
          role: 'user',
          content: [
            { type: 'image', source: { type: 'base64', media_type: mimeType, data: imageB64 } },
          ],
        },
      ],
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

const ALLOWED_IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp'])

/**
 * The slip branch.
 *
 * Kept separate from the note branch rather than folded into it: the two send
 * very different things to the provider, and a reader checking what leaves the
 * device should not have to follow a flag through a shared code path to find
 * out which.
 */
async function handleSlip(body) {
  const mimeType = typeof body?.mimeType === 'string' ? body.mimeType.toLowerCase() : ''
  if (!ALLOWED_IMAGE_TYPES.has(mimeType)) return json({ error: 'bad-image-type' }, 400)

  const image = typeof body?.image === 'string' ? body.image : ''
  if (!image) return json({ error: 'bad-request' }, 400)
  // base64 carries three bytes in every four characters.
  if ((image.length * 3) / 4 > MAX_IMAGE_BYTES) return json({ error: 'too-large' }, 413)

  let result
  try {
    result = await callProviderWithImage(image, mimeType)
  } catch (e) {
    const timedOut = e?.name === 'TimeoutError' || e?.name === 'AbortError'
    return json({ error: timedOut ? 'timeout' : 'upstream-unreachable' }, timedOut ? 504 : 502)
  }

  if (result.status === 401 || result.status === 403) return json({ error: 'auth' }, 502)
  if (result.status === 429) return json({ error: 'rate-limit' }, 429)
  if (result.status >= 400) return json({ error: 'upstream-error' }, 502)

  const parsed = parseModelJson(result.text)
  if (!parsed || !Array.isArray(parsed.lines)) return json({ error: 'bad-model-output' }, 502)

  const lines = parsed.lines
    .filter((l) => typeof l === 'string')
    .map((l) => l.slice(0, 300))
    .slice(0, 200)

  return json({ lines, model: MODEL })
}

export default async function handler(req) {
  if (req.method === 'GET') {
    return json({ configured: Boolean(API_KEY), ...(API_KEY ? { model: MODEL } : {}) })
  }
  if (req.method !== 'POST') return json({ error: 'method-not-allowed' }, 405)
  if (!API_KEY) return json({ error: 'not-configured' }, 501)
  if (!originAllowed(req)) return json({ error: 'forbidden-origin' }, 403)
  if (rateLimited(req)) return json({ error: 'rate-limit' }, 429)

  let body
  try {
    body = await req.json()
  } catch {
    return json({ error: 'bad-request' }, 400)
  }

  if (body?.mode === 'slip') return handleSlip(body)

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
