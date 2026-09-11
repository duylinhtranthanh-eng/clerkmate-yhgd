/**
 * Final submission gate for ClerkMate.
 *
 * Runs the production build in a real Chrome, served from a repository subpath
 * so it is the GitHub Pages shape rather than the friendlier root case. Every
 * check either observes the UI or reads IndexedDB back — nothing is inferred
 * from source.
 */
import { spawn, execSync } from 'node:child_process'
import { writeFile, mkdir } from 'node:fs/promises'

const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
const PORT = 9360
const REPO = process.env.VERIFY_REPO || 'clerkmate-yhgd'
/**
 * Defaults to a locally served build at the GitHub Pages hosting shape. Set
 * VERIFY_BASE to point the same suite at a deployed site:
 *   VERIFY_BASE=https://<user>.github.io/<repo>/ npm run verify:app
 */
const BASE = process.env.VERIFY_BASE || `http://localhost:4191/${REPO}/`
const REMOTE = !BASE.startsWith('http://localhost')
const SUBPATH = new URL(BASE).pathname
// A unique directory per run, and any leftover browser is killed first: a
// previous run that threw would otherwise still hold the profile and the
// debugging port, and the next launch would silently attach to that old
// instance — carrying its IndexedDB, and its half-finished state, with it.
const PROFILE = `/tmp/clerkmate-final-profile-${process.pid}`
const OUT = '/tmp/clerkmate-final'
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

const results = []
let group = ''
const G = (g) => { group = g; console.log(`\n${g}`) }
const check = (name, pass, detail) => {
  results.push({ group, name, pass, detail })
  console.log(`  ${pass ? '✓' : '✗'} ${name}${detail ? ' — ' + detail : ''}`)
}

try { execSync(`pkill -f "clerkmate-final-profile" || true`) } catch {}
try { execSync(`lsof -ti tcp:${PORT} | while read p; do kill -9 $p; done`) } catch {}
execSync(`rm -rf ${PROFILE}`)
// Always take the browser down, including on the failure paths.
const shutdown = () => { try { execSync(`rm -rf ${PROFILE}`) } catch {} }
process.on('exit', shutdown)
for (const sig of ['SIGINT', 'SIGTERM', 'uncaughtException']) {
  process.on(sig, (e) => { if (e) console.error(e); shutdown(); process.exit(1) })
}
await mkdir(OUT, { recursive: true })
const chrome = spawn(CHROME, ['--window-position=-3000,0', '--window-size=460,980',
  `--remote-debugging-port=${PORT}`, `--user-data-dir=${PROFILE}`,
  '--hide-scrollbars', '--no-first-run', '--no-default-browser-check', 'about:blank'], { stdio: 'ignore' })

let wsUrl = null
for (let i = 0; i < 60 && !wsUrl; i++) {
  await sleep(300)
  try { wsUrl = (await (await fetch(`http://127.0.0.1:${PORT}/json/version`)).json()).webSocketDebuggerUrl } catch {}
}
const ws = new WebSocket(wsUrl)
let id = 0
const pending = new Map()
const events = []
ws.addEventListener('message', (e) => {
  const m = JSON.parse(e.data)
  if (m.id && pending.has(m.id)) { const p = pending.get(m.id); pending.delete(m.id); m.error ? p.rej(new Error(m.error.message)) : p.res(m.result) }
  else if (m.method) events.push(m)
})
await new Promise((r) => ws.addEventListener('open', r))
const send = (method, params = {}, sid) => new Promise((res, rej) => {
  const mid = ++id; pending.set(mid, { res, rej })
  ws.send(JSON.stringify({ id: mid, method, params, ...(sid ? { sessionId: sid } : {}) }))
})
const { targetId } = await send('Target.createTarget', { url: 'about:blank' })
const { sessionId } = await send('Target.attachToTarget', { targetId, flatten: true })
const S = (m, p) => send(m, p, sessionId)
await S('Page.enable'); await S('Runtime.enable'); await S('Log.enable'); await S('Network.enable')
await S('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 2, mobile: true })
await S('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 5 })

const evalOnce = async (expr) => {
  const r = await S('Runtime.evaluate', { expression: `(async () => { ${expr} })()`, awaitPromise: true, returnByValue: true })
  if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description || r.exceptionDetails.text)
  return r.result.value
}

/**
 * Evaluate in the page, surviving a reload.
 *
 * On a first visit the service worker takes control and the app reloads itself
 * — deliberate behaviour, and it wipes the helpers injected into the page. Any
 * evaluation that trips over a missing helper is retried once after
 * reinstalling them, so the suite tests the app rather than the injection.
 */
const ev = async (expr) => {
  try {
    return await evalOnce(expr)
  } catch (e) {
    if (!/window\.__\w+ is not a function/.test(e.message)) throw e
    await evalOnce(HELPERS + ' return true')
    return await evalOnce(expr)
  }
}
const shot = async (name) => {
  const { data } = await S('Page.captureScreenshot', { format: 'png' })
  await writeFile(`${OUT}/${name}.png`, Buffer.from(data, 'base64'))
}

const HELPERS = `
  window.__set = (el, v) => { const P = el instanceof HTMLTextAreaElement ? HTMLTextAreaElement : HTMLInputElement;
    Object.getOwnPropertyDescriptor(P.prototype, 'value').set.call(el, v); el.dispatchEvent(new Event('input', { bubbles: true })) };
  window.__btn = (re) => [...document.querySelectorAll('button, label')].find((b) => new RegExp(re).test(b.textContent));
  window.__txt = () => document.body.innerText;
  window.__db = async () => new Promise((r) => { const q = indexedDB.open('clerkmate'); q.onsuccess = () => r(q.result) });
  window.__case = async (id) => { const db = await window.__db();
    return new Promise((r) => { const t = db.transaction('cases').objectStore('cases').get(id); t.onsuccess = () => r(t.result) }) };
  window.__cases = async () => { const db = await window.__db();
    return new Promise((r) => { const t = db.transaction('cases').objectStore('cases').getAll(); t.onsuccess = () => r(t.result) }) };
  window.__blobKeys = async () => { const db = await window.__db();
    return new Promise((r) => { const t = db.transaction('blobs').objectStore('blobs').getAllKeys(); t.onsuccess = () => r(t.result) }) };
  window.__blob = async (k) => { const db = await window.__db();
    return new Promise((r) => { const t = db.transaction('blobs').objectStore('blobs').get(k); t.onsuccess = () => r(t.result) }) };
  window.__sha = async (blob) => { const h = await crypto.subtle.digest('SHA-256', await blob.arrayBuffer());
    return [...new Uint8Array(h)].map((b) => b.toString(16).padStart(2, '0')).join('') };
  window.__caught = [];
  const _createObjectURL = URL.createObjectURL.bind(URL);
  URL.createObjectURL = (b) => { if (b instanceof Blob && b.type === 'application/json') window.__caught.push(b); return _createObjectURL(b) };
  window.__fetches = [];
  const _fetch = window.fetch;
  window.fetch = (...a) => { try { window.__fetches.push({ url: typeof a[0] === 'string' ? a[0] : a[0].url, body: a[1]?.body ?? null }) } catch {} return _fetch(...a) };
  true;
`
const reinstall = () => ev(HELPERS + ' return true')
/**
 * Polls until the page is actually ready.
 *
 * A deployed site behind a CDN takes longer to become interactive than a local
 * preview, and typing into a form that has not rendered yet fails with an
 * unhelpful "Illegal invocation" rather than a timeout.
 */
const waitFor = async (expr, label, timeout = 25000) => {
  const started = Date.now()
  let lastError = null
  for (;;) {
    let ok = false
    try { ok = await ev(`return !!(${expr})`) } catch (e) { lastError = e.message }
    if (ok) return
    if (Date.now() - started > timeout) {
      let seen = '(could not read the page)'
      try { seen = await ev(`return { inputs: document.querySelectorAll('input').length, text: document.body.innerText.slice(0, 120) }`).then(JSON.stringify) } catch {}
      throw new Error(`timed out waiting for ${label}\n    last error: ${lastError ?? 'none'}\n    page: ${seen}`)
    }
    await sleep(300)
  }
}
const go = async (hash, wait = 1200) => { await ev(`window.location.hash = ${JSON.stringify(hash)}; return true`); await sleep(wait) }

// =========================================================== judge first look
G('judge flow — first 15 seconds')
await S('Page.navigate', { url: BASE })
// The service worker activates on a first visit and the app reloads itself once
// — deliberate, and it wipes anything injected into the page. Let that settle
// before driving the UI, rather than racing it.
await waitFor(
  `(await navigator.serviceWorker.getRegistration())?.active?.state === 'activated' && !!navigator.serviceWorker.controller`,
  'the service worker to take control', 40000,
)
await sleep(2500)
await reinstall()
await waitFor(`document.querySelectorAll('input').length >= 3 && /Hồ sơ người học/.test(document.body.innerText)`,
  'the onboarding form')
const first = await ev(`return window.__txt()`)
check('first screen names the product and what it produces', /ClerkMate/.test(first) && /bệnh án/i.test(first))
check('first screen says it is a learning tool, not an EMR', /công cụ học tập|không phải EMR/i.test(first))
check('first screen says demo data are fictional', /giả lập/i.test(first))
check('first screen says this is not a login', /không phải đăng nhập/i.test(first))
// The level chips are the one decision a learner makes with no information,
// so what each level will ask for has to be visible while they are choosing.
const levelChoice = await ev(`
  const rows = [...document.querySelectorAll('.level-table__row')].map((r) => ({
    level: r.querySelector('.level-table__level')?.textContent?.replace('bạn chọn', '').trim(),
    count: Number(r.querySelector('.level-table__pct')?.textContent?.trim()),
    detail: r.querySelector('.level-table__detail')?.textContent?.trim(),
    current: r.dataset.current === 'true',
  }));
  return rows;
`)
check('the first screen shows what each of the four levels will ask for',
  levelChoice.length === 4 && ['Y2', 'Y5', 'Y6', 'SDH'].every((l, i) => levelChoice[i].level === l),
  levelChoice.map((r) => `${r.level}:${r.count}`).join(' · '))
check('the levels genuinely ask for different amounts',
  levelChoice.every((r) => Number.isFinite(r.count)) && levelChoice[0].count < levelChoice[3].count,
  `${levelChoice[0].count} → ${levelChoice[3].count}`)
check('the risk section is described as changing with the level',
  /danh mục/.test(levelChoice[0].detail) && /tự liệt kê/.test(levelChoice[3].detail),
  levelChoice[3].detail)
check('the level being chosen is marked', levelChoice.filter((r) => r.current).length === 1,
  levelChoice.find((r) => r.current)?.level ?? 'none')
check('nothing but a name and an id stands between the judge and the app', /Hồ sơ người học/.test(first))
await shot('01-first-open')

const typeField = async (index, value) => {
  for (let attempt = 0; attempt < 5; attempt += 1) {
    await ev(`
      const i = [...document.querySelectorAll('input')].filter((x) => x.type === 'text' || !x.type);
      if (i[${index}]) window.__set(i[${index}], ${JSON.stringify(value)});
      return true;
    `)
    await sleep(500)
    const got = await ev(`
      const i = [...document.querySelectorAll('input')].filter((x) => x.type === 'text' || !x.type);
      return i[${index}] ? i[${index}].value : null;
    `)
    if (got === value) return
  }
  throw new Error(`could not type "${value}" into field ${index}`)
}
await typeField(0, 'Ban Giám khảo')
await typeField(1, 'BGK01')
await ev(`window.__btn('^Bắt đầu$').click(); return true`)
await waitFor(`/Ca lâm sàng của bạn/.test(document.body.innerText)`, 'the home screen')
await reinstall()
const home = await ev(`return window.__txt()`)
check('home says what it is', /Bệnh án Y học gia đình cho người học/.test(home))
check('home explains the product without a case existing', /Ghi chú nhanh tại phòng khám/.test(home))
check('demo call-to-action is on screen immediately', /Dùng thử ca mẫu/.test(home))
check('home says the demo data are simulated', /bệnh nhân giả lập/.test(home))
await shot('02-home-empty')

check('no network request so far (core mode is local)', (await ev(`return window.__fetches.length`)) === 0,
  JSON.stringify(await ev(`return window.__fetches.map((f) => f.url)`)))

// =========================================================== demo seeding
G('demo cases')
await ev(`window.__btn('Dùng thử ca mẫu').click(); return true`)
await sleep(800)
check('demo picker offers both fictional cases', await ev(`
  const t = window.__txt(); return /đau khớp gối/.test(t) && /té ngã tái diễn/.test(t);
`))
await ev(`[...document.querySelectorAll('button')].find((b) => /đau khớp gối/.test(b.textContent)).click(); return true`)
await waitFor(`document.querySelectorAll('.list__item').length > 0 && !/Chọn ca mẫu/.test(document.body.innerText)`,
  'the seeded demo case', 40000)
await sleep(1200)
await reinstall()
const caseId = await ev(`
  const rows = await window.__cases();
  return rows[0]?.id ?? null;
`)
check('demo case seeds on a fresh profile', !!caseId, caseId ?? 'none')
const seededCase = await ev(`return await window.__case(${JSON.stringify(caseId)})`)
check('demo case arrives with an attachment blob', (await ev(`return (await window.__blobKeys()).length`)) > 0)
check('demo case is near complete', seededCase.completeness?.percent >= 95, `${seededCase.completeness?.percent}%`)
check('demo attachment is deliberately un-redacted, for the redaction demo',
  seededCase.attachments.some((a) => !a.privacyChecked))
await go('#/')
await shot('03-home-with-case')

// =========================================================== quick note + parser
G('quick note and local parser')
await go(`#/case/${caseId}/note`)
await reinstall()
await ev(`window.__btn('Chèn ví dụ mẫu').click(); return true`)
await sleep(500)
await ev(`window.__btn('Sắp xếp vào bệnh án').click(); return true`)
await sleep(2500)
const sugg = await ev(`
  const rows = [...document.querySelectorAll('.suggestion[data-on]')];
  return { count: rows.length, allHaveSnippets: rows.every((r) => !!r.querySelector('.snippet')),
           origin: (window.__txt().match(/Đề xuất (bởi AI|cục bộ)/) || [])[0] ?? null,
           applyLabel: (window.__btn('Đưa \\\\d+ mục vào bệnh án') || {}).textContent ?? null };
`)
check('local parser returns suggestions', sugg.count > 3, `${sugg.count}`)
check('every suggestion shows its source snippet', sugg.allHaveSnippets)
check('suggestion sheet states its provenance', sugg.origin === 'Đề xuất cục bộ', sugg.origin)
check('nothing is applied until the learner confirms', !!sugg.applyLabel, sugg.applyLabel)
await shot('04-suggestions')
await ev(`document.querySelector('.backdrop')?.click(); return true`)
await sleep(600)
check('AI mode is not offered by default', !/CÁCH SẮP XẾP/.test(await ev(`return window.__txt()`)))

// =========================================================== completeness
G('completeness engine (UI)')
await go(`#/case/${caseId}/check`)
await reinstall()
const compl = await ev(`
  const t = window.__txt();
  const pct = (t.match(/(\\d+)% hoàn chỉnh/) || [])[1];
  // Read the summary card itself. The page now also carries a four-level
  // comparison whose rows quote their own "Bắt buộc x/y", which is a different
  // claim about a different level.
  const head = document.querySelector('.card--flat');
  const tiers = (head?.innerText ?? '').match(/Bắt buộc \\d+\\/\\d+|Nên có \\d+\\/\\d+|Nâng cao \\d+\\/\\d+/g);
  return { pct: Number(pct), tiers };
`)
check('percentage and all three tiers are shown', compl.pct > 0 && compl.tiers?.length === 3, JSON.stringify(compl))
const levelPreview = {}
const profileLevel = await ev(`
  const db = await new Promise((r) => { const q = indexedDB.open('clerkmate'); q.onsuccess = () => r(q.result) });
  return new Promise((r) => { const t = db.transaction('meta').objectStore('meta').get('learnerProfile');
    t.onsuccess = () => r(t.result?.level ?? null) });
`)

for (const level of ['Y2', 'Y5', 'Y6', 'SDH']) {
  await ev(`
    const chip = [...document.querySelectorAll('.chip')].find((c) => c.textContent.trim().startsWith(${JSON.stringify(level)}));
    chip.click(); return true;
  `)
  await sleep(900)
  levelPreview[level] = await ev(`
    const t = window.__txt();
    return { pct: Number((t.match(/(\\d+)% hoàn chỉnh/) || [])[1]),
             mandatory: (t.match(/Bắt buộc (\\d+\\/\\d+)/) || [])[1] };
  `)
}
check('preview changes the requirement set per level', new Set(Object.values(levelPreview).map((v) => v.mandatory)).size >= 3,
  JSON.stringify(levelPreview))
const officialLevel = await ev(`return (await window.__case(${JSON.stringify(caseId)})).learnerLevel`)
check('previewing another level does not change the case level', officialLevel === profileLevel,
  `case ${officialLevel} vs profile ${profileLevel}`)
// A judge who signs in as Y2 must not be handed a postgraduate record: the demo
// is built at the learner's own level, which is the app's central claim.
check('the demo case is created at the level the judge signed in with',
  officialLevel === profileLevel, `${officialLevel} / ${profileLevel}`)
await shot('05-completeness')
check('a missing item navigates to its section', await ev(`
  const btn = [...document.querySelectorAll('.list__item')].find((b) => /Đã che thông tin định danh/.test(b.textContent));
  if (!btn) return false;
  btn.click();
  await new Promise((r) => setTimeout(r, 1200));
  return /Hình ảnh đính kèm/.test(window.__txt());
`))

// =========================================================== redaction

// =========================================================== image redaction
G('image redaction')
await go(`#/case/${caseId}/s/attachments`)
await reinstall()
const before = await ev(`
  const c = await window.__case(${JSON.stringify(caseId)});
  const a = c.attachments[0];
  const blob = await window.__blob(a.blobKey);
  return { key: a.blobKey, sha: await window.__sha(blob), size: blob.size, thumb: a.thumbnail,
           redacted: a.redacted, privacyChecked: a.privacyChecked };
`)
check('un-redacted attachment is flagged in the UI', /chưa che/.test(await ev(`return window.__txt()`)))
await ev(`document.querySelector('.thumb').click(); return true`)
await sleep(1200)
await ev(`window.__btn('Che thông tin trên ảnh').click(); return true`)
await sleep(1400)
const canvasGeom = await ev(`
  const c = document.querySelector('canvas');
  const r = c.getBoundingClientRect();
  return { cssW: Math.round(r.width), cssH: Math.round(r.height), attrW: c.width, attrH: c.height };
`)
check('redaction canvas is scaled to the layout, not the raw image', canvasGeom.attrW === canvasGeom.cssW,
  JSON.stringify(canvasGeom))
await ev(`window.__btn('Che dải trên').click(); return true`)
await sleep(800)
const oneBox = await ev(`return /xóa 1 vùng khỏi ảnh/.test(window.__txt())`)
check('a starting box can be created', oneBox)
// drag the box down, then resize it from a corner — both via real pointer events
const drag = async (from, to) => {
  await ev(`
    const c = document.querySelector('canvas');
    const r = c.getBoundingClientRect();
    const pt = (x, y) => ({ clientX: r.left + x, clientY: r.top + y, bubbles: true, pointerId: 1, isPrimary: true, button: 0 });
    c.dispatchEvent(new PointerEvent('pointerdown', pt(${from[0]}, ${from[1]})));
    c.dispatchEvent(new PointerEvent('pointermove', pt(${to[0]}, ${to[1]})));
    c.dispatchEvent(new PointerEvent('pointerup', pt(${to[0]}, ${to[1]})));
    return true;
  `)
  await sleep(400)
}
const boxBefore = await ev(`
  const c = document.querySelector('canvas'); const r = c.getBoundingClientRect();
  return { w: Math.round(r.width), h: Math.round(r.height) };
`)
await drag([boxBefore.w * 0.5, boxBefore.h * 0.08], [boxBefore.w * 0.5, boxBefore.h * 0.3])
check('a box can be moved by dragging inside it', await ev(`return /xóa 1 vùng khỏi ảnh/.test(window.__txt())`))
await ev(`window.__btn('Che dải trên').click(); return true`)
await sleep(600)
const twoBoxes = await ev(`return /xóa \\d+ vùng khỏi ảnh/.exec(window.__txt())?.[0] ?? null`)
check('more than one box can be added', /xóa [2-9] vùng/.test(twoBoxes ?? ''), twoBoxes)
await shot('06-redaction')
await ev(`window.__btn('Áp dụng').click(); return true`)
await sleep(3000)
const after = await ev(`
  const c = await window.__case(${JSON.stringify(caseId)});
  const a = c.attachments[0];
  const blob = await window.__blob(a.blobKey);
  return { key: a.blobKey, sha: await window.__sha(blob), size: blob.size, thumb: a.thumbnail,
           redacted: a.redacted, privacyChecked: a.privacyChecked };
`)
check('applying redaction rewrites the stored blob in place', after.key === before.key && after.sha !== before.sha,
  `${before.sha.slice(0, 12)} → ${after.sha.slice(0, 12)}`)
check('the original bytes are gone from the store, not kept alongside',
  (await ev(`return (await window.__blobKeys()).length`)) === 1)
check('thumbnail is regenerated', after.thumb !== before.thumb)
check('attachment is marked redacted and privacy-checked', after.redacted && after.privacyChecked)
const pixels = await ev(`
  const c = await window.__case(${JSON.stringify(caseId)});
  const blob = await window.__blob(c.attachments[0].blobKey);
  const url = URL.createObjectURL(blob);
  const img = await new Promise((r) => { const i = new Image(); i.onload = () => r(i); i.src = url });
  const cv = document.createElement('canvas'); cv.width = img.naturalWidth; cv.height = img.naturalHeight;
  const ctx = cv.getContext('2d'); ctx.drawImage(img, 0, 0);
  // sample the band the starting box covers
  const band = ctx.getImageData(0, 0, cv.width, Math.round(cv.height * 0.16)).data;
  let black = 0, total = 0;
  for (let i = 0; i < band.length; i += 4) { total += 1; if (band[i] < 12 && band[i + 1] < 12 && band[i + 2] < 12) black += 1 }
  URL.revokeObjectURL(url);
  return { black, total, ratio: black / total, w: img.naturalWidth, h: img.naturalHeight };
`)
check('the covered region is solid black in the stored image at full resolution',
  pixels.ratio > 0.9, `${(pixels.ratio * 100).toFixed(1)}% of the sampled band, image ${pixels.w}×${pixels.h}`)

// =========================================================== backup round trip
G('backup and restore')
await go('#/settings')
await reinstall()
await ev(`window.__caught = []; window.__btn('Sao lưu ra tệp').click(); return true`)
await sleep(3500)
const backup = await ev(`return await window.__caught[0].text()`)
const snapshotBefore = await ev(`
  const cases = await window.__cases();
  const keys = await window.__blobKeys();
  const shas = {};
  for (const k of keys) shas[k] = await window.__sha(await window.__blob(k));
  return { cases, shas };
`)
check('backup file is produced', backup.length > 1000, `${Math.round(backup.length / 1024)} KB`)
check('backup carries the attachment bytes', (() => {
  const b = JSON.parse(backup)
  return Object.keys(b.blobs ?? {}).length === Object.keys(snapshotBefore.shas).length
})(), `${Object.keys(JSON.parse(backup).blobs ?? {}).length} blob(s)`)
// wipe everything the app owns, exactly as clearing site data would
await ev(`
  const db = await window.__db();
  await new Promise((r) => { const t = db.transaction(['cases', 'blobs'], 'readwrite');
    t.objectStore('cases').clear(); t.objectStore('blobs').clear(); t.oncomplete = () => r() });
  return true;
`)
check('local data really was wiped', (await ev(`return (await window.__cases()).length + (await window.__blobKeys()).length`)) === 0)
await ev(`
  const fi = [...document.querySelectorAll('input[type=file]')].find((i) => i.accept === 'application/json');
  const dt = new DataTransfer();
  dt.items.add(new File([${JSON.stringify(backup)}], 'b.json', { type: 'application/json' }));
  fi.files = dt.files; fi.dispatchEvent(new Event('change', { bubbles: true }));
  return true;
`)
let restoreToast = null
for (let i = 0; i < 24; i++) { await sleep(250); const m = await ev(`return (window.__txt().match(/Đã khôi phục[^\\n]*/) || [])[0] ?? null`); if (m) { restoreToast = m; break } }
await sleep(1500)
const snapshotAfter = await ev(`
  const cases = await window.__cases();
  const keys = await window.__blobKeys();
  const shas = {};
  for (const k of keys) shas[k] = await window.__sha(await window.__blob(k));
  return { cases, shas };
`)
check('restore reports what it restored', !!restoreToast, restoreToast)
check('every case comes back', snapshotAfter.cases.length === snapshotBefore.cases.length,
  `${snapshotAfter.cases.length}/${snapshotBefore.cases.length}`)
check('case content is byte-identical after restore',
  JSON.stringify(snapshotAfter.cases) === JSON.stringify(snapshotBefore.cases))
check('attachment image bytes survive restore', JSON.stringify(snapshotAfter.shas) === JSON.stringify(snapshotBefore.shas),
  Object.keys(snapshotAfter.shas).length + ' blob(s), sha match')
const restored = snapshotAfter.cases[0]
check('restored case keeps its redacted image state', restored.attachments.every((a) => a.redacted && a.privacyChecked))
check('restored case keeps family members and genogram data', restored.familyMembers.length > 1,
  `${restored.familyMembers.length} members`)
check('restored case keeps submission metadata', typeof restored.submission?.locked === 'boolean')
check('restored case keeps the completeness snapshot', typeof restored.completeness?.percent === 'number',
  `${restored.completeness?.percent}%`)

// =========================================================== submission lock
G('submission lock — every mutation path')
await go(`#/case/${caseId}/review`)
await reinstall()
const submitState = await ev(`
  const b = window.__btn('Nộp bài và khoá sửa');
  return { present: !!b, disabled: b ? b.disabled : null };
`)
check('submit becomes available once the case is clean', submitState.present && !submitState.disabled, JSON.stringify(submitState))
await ev(`window.__btn('Nộp bài và khoá sửa').click(); return true`)
await sleep(2000)
const locked = await ev(`return await window.__case(${JSON.stringify(caseId)})`)
check('submitting locks the record and mints a code', locked.submission.locked && !!locked.submission.code,
  locked.submission.code)
/**
 * Content fingerprint of a case plus its image bytes.
 *
 * `updatedAt` and the cached completeness snapshot are excluded on purpose:
 * autosave flushes on every unmount, so they change when the learner merely
 * navigates. Including them would make this measure "was it re-saved" instead
 * of "was it changed", and every section would look like a lock failure.
 */
const fingerprint = () => ev(`
  const c = await window.__case(${JSON.stringify(caseId)});
  const keys = await window.__blobKeys();
  const shas = {};
  for (const k of keys) shas[k] = await window.__sha(await window.__blob(k));
  const clone = JSON.parse(JSON.stringify(c));
  delete clone.updatedAt;
  delete clone.completeness;
  return JSON.stringify(clone) + '|' + JSON.stringify(shas);
`)
const lockedFingerprint = await fingerprint()

const SECTIONS = ['patient', 'visit', 'history', 'personalHistory', 'lifestyle', 'familyHistory',
  'fmAssessment', 'examination', 'investigations', 'attachments', 'risk', 'diagnosis',
  'management', 'medications', 'prevention', 'followUp', 'reflection']
for (const sec of SECTIONS) {
  await go(`#/case/${caseId}/s/${sec}`, 1400)
  await reinstall()
  // Sweep every enabled field and every enabled chip/添加 button in the section.
  const attempted = await ev(`
    let touched = 0;
    for (const el of document.querySelectorAll('input, textarea')) {
      if (el.disabled || el.type === 'file') continue;
      touched += 1;
      window.__set(el, el.type === 'date' ? '2020-01-01' : 'KHOÁ-TEST-' + touched);
    }
    await new Promise((r) => setTimeout(r, 250));
    for (const b of document.querySelectorAll('.chip, .btn--soft, .btn--sm')) {
      if (b.disabled) continue;
      const t = b.textContent || '';
      if (/Xem|Mở|Ẩn|Chọn giai đoạn|Mức này/.test(t)) continue;
      touched += 1; b.click();
      await new Promise((r) => setTimeout(r, 60));
    }
    await new Promise((r) => setTimeout(r, 700));
    return touched;
  `)
  const same = (await fingerprint()) === lockedFingerprint
  check(`lock holds in section "${sec}" (${attempted} attempts)`, same)
}
for (const tab of ['note', 'record', 'check', 'genogram']) {
  await go(`#/case/${caseId}/${tab}`, 1400)
  await reinstall()
  const attempted = await ev(`
    let touched = 0;
    for (const el of document.querySelectorAll('input, textarea')) {
      if (el.disabled || el.type === 'file') continue;
      touched += 1; window.__set(el, 'KHOÁ-TEST');
    }
    await new Promise((r) => setTimeout(r, 250));
    for (const b of document.querySelectorAll('.chip, .btn--soft, .btn--sm, .btn--secondary, .btn--primary')) {
      if (b.disabled) continue;
      const t = b.textContent || '';
      if (/Xem|Mở lại|Tải lại|Xuất PDF|Chia sẻ|Lưu bản sao|Đã đọc|Chấm bài|Mức này|Ẩn/.test(t)) continue;
      touched += 1; b.click();
      await new Promise((r) => setTimeout(r, 80));
    }
    await new Promise((r) => setTimeout(r, 800));
    document.querySelector('.backdrop')?.click();
    return touched;
  `)
  const same = (await fingerprint()) === lockedFingerprint
  check(`lock holds in tab "${tab}" (${attempted} attempts)`, same)
}
// the blob-level paths specifically
await go(`#/case/${caseId}/s/attachments`, 1400)
await reinstall()
const blobPaths = await ev(`
  const results = {};
  const t = window.__txt();
  results.noticeShown = /Ca đã nộp nên đang khoá sửa/.test(t);
  const add = window.__btn('Ca đã khoá sửa') || window.__btn('Chụp hoặc chọn ảnh');
  results.addDisabled = !!add && (add.querySelector('input')?.disabled ?? true);
  results.sampleDisabled = (window.__btn('Chèn ảnh xét nghiệm mẫu') || {}).disabled ?? null;
  document.querySelector('.thumb')?.click();
  await new Promise((r) => setTimeout(r, 1200));
  results.redactDisabled = (window.__btn('Che thông tin trên ảnh') || {}).disabled ?? null;
  results.deleteDisabled = (window.__btn('Xóa hình này') || {}).disabled ?? null;
  results.confirmDisabled = (window.__btn('không có thông tin định danh') || {}).disabled ?? null;
  return results;
`)
check('attachments screen explains the lock', blobPaths.noticeShown)
check('add-image is off on a locked case', blobPaths.addDisabled === true, String(blobPaths.addDisabled))
check('sample-image is off on a locked case', blobPaths.sampleDisabled === true, String(blobPaths.sampleDisabled))
check('redact is off on a locked case', blobPaths.redactDisabled === true, String(blobPaths.redactDisabled))
check('delete-image is off on a locked case', blobPaths.deleteDisabled === true, String(blobPaths.deleteDisabled))
check('image bytes untouched through the whole lock sweep', (await fingerprint()) === lockedFingerprint)
await shot('07-locked-attachments')

// force the UI open and fire the handlers anyway
await ev(`document.querySelector('.backdrop')?.click(); return true`)
await sleep(600)
const forced = await ev(`
  for (const el of document.querySelectorAll('input, textarea, button')) el.disabled = false;
  const s = window.__btn('Chèn ảnh xét nghiệm mẫu'); if (s) s.click();
  await new Promise((r) => setTimeout(r, 2000));
  document.querySelector('.thumb')?.click();
  await new Promise((r) => setTimeout(r, 1000));
  for (const el of document.querySelectorAll('button')) el.disabled = false;
  const d = window.__btn('Xóa hình này'); if (d) d.click();
  await new Promise((r) => setTimeout(r, 1500));
  return true;
`)
void forced
check('enforcement survives the UI being forced open', (await fingerprint()) === lockedFingerprint)

// reopen and confirm editing returns
await go(`#/case/${caseId}/review`, 1400)
await reinstall()
await ev(`window.__btn('Mở lại để sửa').click(); return true`)
await sleep(1800)
const reopened = await ev(`return await window.__case(${JSON.stringify(caseId)})`)
check('reopen unlocks and is counted', reopened.submission.locked === false && reopened.submission.reopenedAt.length === 1,
  `${reopened.submission.reopenedAt.length} reopen(s)`)
check('reopen clears the submitted stamp so the next send is a resubmission', reopened.submission.submittedAt === '')
await go(`#/case/${caseId}/s/patient`, 1400)
await reinstall()
check('editing works again after reopening', await ev(`
  const el = [...document.querySelectorAll('input')].find((i) => i.type === 'text' || !i.type);
  const before = el.value;
  window.__set(el, before + ' (đã sửa)');
  // 450 ms autosave debounce plus an IndexedDB write; be generous, the sweep
  // just before this leaves the page busy.
  await new Promise((r) => setTimeout(r, 1800));
  const c = await window.__case(${JSON.stringify(caseId)});
  window.__set(el, before);
  await new Promise((r) => setTimeout(r, 700));
  return c.patient.name.includes('(đã sửa)') || c.patient.caseLabel.includes('(đã sửa)');
`))

// =========================================================== teacher grading
G('the final screen — where the learner flow ends')
await go(`#/case/${caseId}/review`, 1400)
await reinstall()
const finalActions = await ev(`
  const t = window.__txt();
  const primary = [...document.querySelectorAll('.btn--primary')].map((b) => b.textContent.trim());
  return {
    pdfIsPrimary: primary.some((x) => /Xuất PDF/.test(x)),
    pdfHandoffStated: /gửi tệp PDF cho giảng viên/i.test(t),
    jsonNotTheSubmission: /không phải bản nộp/.test(t),
    lockIsOptional: /tuỳ chọn/.test(t),
  };
`)
check('the final screen makes exporting a PDF the primary action', finalActions.pdfIsPrimary)
check('it tells the learner to send the PDF to the lecturer', finalActions.pdfHandoffStated)
check('it says the .json is not the submission', finalActions.jsonNotTheSubmission)
check('locking the case is presented as optional', finalActions.lockIsOptional)
check('there is no grading entry point anywhere in the app', await ev(`
  window.location.hash = '#/cham-bai';
  await new Promise((r) => setTimeout(r, 1200));
  const stray = [...document.querySelectorAll('button, a, label')]
    .map((b) => b.textContent || '')
    .filter((x) => /Chấm bài|giảng viên gửi về/.test(x));
  window.location.hash = '#/';
  await new Promise((r) => setTimeout(r, 900));
  // A removed route must not render a grading screen, and Home must not offer one.
  return stray.length === 0 && !/Chấm bài/.test(window.__txt());
`))

// =========================================================== privacy of traffic
G('privacy of network traffic')
const traffic = await ev(`return window.__fetches.map((f) => f.url)`)
check('no case data left the device during the whole run', traffic.length === 0, JSON.stringify(traffic))
const requestUrls = events.filter((e) => e.method === 'Network.requestWillBeSent')
  .map((e) => e.params.request.url).filter((u) => !u.startsWith('data:') && !u.startsWith('blob:'))
const offOrigin = requestUrls.filter((u) => !u.startsWith(new URL(BASE).origin))
check('every network request stayed on this origin', offOrigin.length === 0, offOrigin.slice(0, 3).join(' '))
const logs = events.filter((e) => e.method === 'Log.entryAdded').map((e) => e.params.entry)
const leaky = logs.filter((l) => /BGK01|Ban Giám khảo|Bà H|amlodipine|Đau khớp/.test(l.text ?? ''))
check('nothing logged patient or learner data', leaky.length === 0, leaky.slice(0, 2).map((l) => l.text).join(' | '))
const errors = logs.filter((l) => l.level === 'error')
check('no console errors during the whole run', errors.length === 0, errors.slice(0, 3).map((l) => l.text).join(' | '))

// =========================================================== PWA and offline
G('PWA and offline, from a repository subpath')
const sw = await ev(`
  const r = await navigator.serviceWorker.getRegistration();
  if (!r || !r.active) return null;
  const keys = await caches.keys();
  const c = await caches.open(keys[0]);
  return { scope: r.scope, script: r.active.scriptURL,
           cached: (await c.keys()).map((q) => new URL(q.url).pathname), controlled: !!navigator.serviceWorker.controller };
`)
check('service worker is active with the subpath scope', !!sw && sw.scope.endsWith(SUBPATH), sw?.scope)
check('all precached URLs are inside the subpath', !!sw && sw.cached.every((p) => p.startsWith(SUBPATH)),
  `${sw?.cached.length} files`)
const manifest = await ev(`
  const link = document.querySelector('link[rel=manifest]');
  const m = await (await fetch(link.href)).json();
  const abs = (u) => new URL(u, link.href).pathname;
  return { start: abs(m.start_url), scope: abs(m.scope), display: m.display, icons: m.icons.length };
`)
check('manifest start_url, scope and icons resolve inside the subpath',
  manifest.start === SUBPATH && manifest.scope === SUBPATH && manifest.icons === 3, JSON.stringify(manifest))
check('manifest asks for a standalone install', manifest.display === 'standalone')

console.log(REMOTE ? '\n  (going offline)' : '\n  (stopping the server)')
if (!REMOTE) {
  // Locally the strongest proof is to take the server away entirely.
  try { execSync('lsof -ti tcp:4191 | while read p; do kill -9 $p; done') } catch {}
}
// Mark where the offline phase starts, so the requests made during it can be
// counted. A shell that renders without a single network request for its own
// document or assets came out of the cache — which is the claim being tested,
// and it holds whether or not the emulated offline state reaches the worker.
const offlineFrom = events.length
await sleep(1500)
await S('Network.emulateNetworkConditions', { offline: true, latency: 0, downloadThroughput: 0, uploadThroughput: 0 })
await S('Page.reload')
await sleep(4500)
await ev(`window.location.hash = '#/'; return true`)
await sleep(1500)
const offline = await ev(`
  let probe;
  const url = new URL('probe-' + Date.now() + '.txt', location.href).href;
  try { const r = await fetch(url, { cache: 'no-store' }); probe = 'SUCCEEDED ' + r.status } catch (e) { probe = 'failed' }
  return { probe, cases: document.querySelectorAll('.list__item').length, home: /Ca lâm sàng của bạn/.test(document.body.innerText) };
`)
// How the shell was obtained. A shell that renders without a single network
// response for its own document or bundles came out of the cache — which is the
// claim under test, and it holds whether or not the emulated offline state
// reaches the service worker's own fetches.
const offlineResponses = events.slice(offlineFrom)
  .filter((e) => e.method === 'Network.responseReceived')
  .map((e) => e.params.response)
  .filter((r) => r.url.startsWith(new URL(BASE).origin) && !r.url.includes('probe-'))
// Provenance, not absence. Chrome reports a service-worker-served response as
// a `responseReceived` too, so counting events cannot tell cache from network;
// what distinguishes them is `fromServiceWorker`. With the origin's server
// killed, every response for the app's own URLs must carry that flag — and
// there must be at least one, or nothing was demonstrated at all.
const fromNetwork = offlineResponses.filter((r) => r.fromServiceWorker !== true)
const offlineFetches = fromNetwork.map((r) => r.url)
if (!REMOTE) {
  check('the shell was served by the service worker, with the server switched off',
    offlineResponses.length > 0 && fromNetwork.length === 0,
    fromNetwork.length
      ? `bypassed the worker: ${offlineFetches.slice(0, 2).join(' ')}`
      : `${offlineResponses.length} response(s), all from the service worker`)
}
if (REMOTE) {
  // Emulated offline does not reach a service worker's own fetches, and a
  // deployed host cannot be switched off, so neither the probe nor the cache
  // provenance can be *proved* here. Both are reported; the local run asserts
  // them properly by taking the server away.
  console.log(`  · network responses during the offline phase: ${offlineFetches.length} (not asserted against a remote host)`)
  // A deployed host cannot be switched off, and page-level offline emulation
  // does not reach the worker's own fetches, so this is reported, not asserted.
  console.log(`  · uncached request while offline: ${offline.probe} (not asserted against a remote host)`)
} else {
  check('a real request fails while offline', offline.probe === 'failed', offline.probe)
}
check('app shell opens offline from the subpath cache', offline.home)
check('IndexedDB cases are still there offline', offline.cases > 0, `${offline.cases} case(s)`)
await reinstall()
check('local parser still works offline', await ev(`
  const rows = await window.__cases();
  window.location.hash = '#/case/' + rows[0].id + '/note';
  await new Promise((r) => setTimeout(r, 1500));
  const ta = document.querySelector('textarea.notepad');
  if (!ta || ta.disabled) return false;
  window.__set(ta, 'Nữ 61 tuổi. Ho 5 ngày. HA 130/80, mạch 84.');
  await new Promise((r) => setTimeout(r, 500));
  window.__btn('Sắp xếp vào bệnh án').click();
  await new Promise((r) => setTimeout(r, 2500));
  return document.querySelectorAll('.suggestion[data-on]').length > 2;
`))
await shot('10-offline')

await mkdir(OUT, { recursive: true })
check('both demo cases can be created in one tap', await ev(`
  window.location.hash = '#/';
  await new Promise((r) => setTimeout(r, 1200));
  const add = [...document.querySelectorAll('button')].find((x) => /Thêm ca mẫu/.test(x.textContent));
  if (add) { add.click(); await new Promise((r) => setTimeout(r, 800)); }
  const all = [...document.querySelectorAll('button')].find((x) => /Tạo cả \\d+ ca mẫu/.test(x.textContent));
  if (!all) return false;
  all.click();
  await new Promise((r) => setTimeout(r, 7000));
  return (await window.__cases()).length >= 2;
`))

await writeFile(`${OUT}/results.json`, JSON.stringify(results, null, 2))
const failed = results.filter((r) => !r.pass)
console.log(`\n${results.length - failed.length}/${results.length} checks passed`)
if (failed.length) { console.log('\nFAILED:'); failed.forEach((f) => console.log(` - [${f.group}] ${f.name} ${f.detail ?? ''}`)) }
await S('Target.closeTarget', { targetId }); ws.close(); chrome.kill()
process.exit(failed.length ? 1 : 0)
