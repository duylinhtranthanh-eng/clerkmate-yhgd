/**
 * Reading a result slip, driven in a real browser.
 *
 * The question is not "does Tesseract run" — it is whether this app can take a
 * photograph of a Vietnamese laboratory slip, put the numbers in the record, and
 * leave the patient's name out of it. So the suite draws a slip of the kind the
 * department's patients bring in, hands it to the app through the file input a
 * phone camera would use, and then reads the database: the analytes must be
 * there, the name must not, and no image may have been stored at all.
 *
 * It also asserts the thing that makes the feature worth having. Every request
 * the page makes is recorded, and a request to any host other than the one
 * serving the app fails the run — a photographed slip that quietly travelled to
 * a recognition service would defeat the point of recognising it.
 *
 * Recognition happens once. An earlier version of this suite ran it twice, once
 * directly and once through the app, and the renderer ran out of memory and took
 * the debugging session down with it.
 */
import { spawn, execSync } from 'node:child_process'
import { writeFileSync, mkdtempSync, mkdirSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
const PORT = 9407
const BASE = process.env.VERIFY_BASE || 'http://localhost:4191/clerkmate-yhgd/'
const PROFILE = `/tmp/clerkmate-ocr-${process.pid}`
const WORK = mkdtempSync(join(tmpdir(), 'clerkmate-ocr-'))
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const results = []
const check = (n, pass, d) => {
  results.push({ n, pass })
  console.log(`  ${pass ? '✓' : '✗'} ${n}${d ? ' — ' + d : ''}`)
}

// A Chrome left behind by an interrupted run keeps the debugging port, and the
// next run attaches to it instead of starting clean — complete with that run's
// service-worker cache, which is how this suite spent an afternoon testing an
// old bundle and reporting a bug that had already been fixed.
try {
  execSync('pkill -f "clerkmate-ocr-" || true')
} catch {}
execSync(`rm -rf ${PROFILE}`)
process.on('exit', () => {
  try {
    execSync(`rm -rf ${PROFILE}`)
    rmSync(WORK, { recursive: true, force: true })
  } catch {}
})

const chrome = spawn(
  CHROME,
  [
    '--window-position=-3000,0',
    '--window-size=430,940',
    `--remote-debugging-port=${PORT}`,
    `--user-data-dir=${PROFILE}`,
    '--hide-scrollbars',
    '--no-first-run',
    '--no-default-browser-check',
    'about:blank',
  ],
  { stdio: 'ignore' },
)

let wsUrl = null
for (let i = 0; i < 60 && !wsUrl; i++) {
  await sleep(300)
  try {
    wsUrl = (await (await fetch(`http://127.0.0.1:${PORT}/json/version`)).json()).webSocketDebuggerUrl
  } catch {}
}
const ws = new WebSocket(wsUrl)
let id = 0
let crashed = false
const pending = new Map()
const requestHosts = []
ws.addEventListener('message', (e) => {
  const m = JSON.parse(e.data)
  if (m.method === 'Network.requestWillBeSent') {
    try {
      requestHosts.push(new URL(m.params.request.url).host)
    } catch {}
  }
  if (m.method === 'Inspector.targetCrashed') crashed = true
  if (m.id && pending.has(m.id)) {
    const p = pending.get(m.id)
    pending.delete(m.id)
    m.error ? p.rej(new Error(m.error.message)) : p.res(m.result)
  }
})
await new Promise((r) => ws.addEventListener('open', r))
const send = (mm, p = {}, sid) =>
  new Promise((res, rej) => {
    const mid = ++id
    pending.set(mid, { res, rej })
    ws.send(JSON.stringify({ id: mid, method: mm, params: p, ...(sid ? { sessionId: sid } : {}) }))
  })
const { targetId } = await send('Target.createTarget', { url: 'about:blank' })
const { sessionId } = await send('Target.attachToTarget', { targetId, flatten: true })
const S = (m, p) => send(m, p, sessionId)
await S('Page.enable')
await S('Runtime.enable')
await S('DOM.enable')
await S('Network.enable')
await S('Emulation.setDeviceMetricsOverride', {
  width: 390,
  height: 844,
  deviceScaleFactor: 2,
  mobile: true,
})

const ev = async (x) => {
  if (crashed) throw new Error('the browser tab crashed')
  const r = await S('Runtime.evaluate', {
    expression: `(async () => { ${x} })()`,
    awaitPromise: true,
    returnByValue: true,
  })
  if (r.exceptionDetails) {
    throw new Error(r.exceptionDetails.exception?.description || r.exceptionDetails.text)
  }
  return r.result.value
}

const H = `
  window.__btn = (re) => [...document.querySelectorAll('button, label')].find((b) => new RegExp(re).test(b.textContent));
  window.__set = (el, v) => { const P = el instanceof HTMLTextAreaElement ? HTMLTextAreaElement : HTMLInputElement;
    Object.getOwnPropertyDescriptor(P.prototype, 'value').set.call(el, v); el.dispatchEvent(new Event('input', { bubbles: true })) };
  window.__txt = () => document.body.innerText;
  true;`

/** Waits for a condition in the page rather than guessing a delay. */
const until = async (expr, tries = 40, gap = 500) => {
  for (let i = 0; i < tries; i += 1) {
    await sleep(gap)
    await ev(H + ' return true')
    if (await ev(`return Boolean(${expr})`)) return true
  }
  return false
}

/**
 * A slip in the shape the clinic sees: identity across the header, then the
 * analytes with the reference intervals the laboratory printed beside them.
 */
const SLIP_LINES = [
  ['PHÒNG KHÁM ĐA KHOA — KHOA XÉT NGHIỆM', 'head'],
  ['Họ và tên: NGUYỄN VĂN AN', 'id'],
  ['Ngày sinh: 12/03/1958    Giới tính: Nam', 'id'],
  ['Địa chỉ: 25 Lê Lợi, Quận 1', 'id'],
  ['Mã BN: 20260105-112', 'id'],
  ['', 'gap'],
  ['KET QUA SINH HOA MAU', 'head'],
  ['Glucose          11,2   mmol/L    3,9 - 6,4', 'row'],
  ['Ure              4,2    mmol/L    2,5 - 7,5', 'row'],
  ['Creatinin        78     umol/L    62 - 106', 'row'],
  ['Cholesterol      6,8    mmol/L    3,9 - 5,2', 'row'],
  ['HbA1c            7,8    %         4,0 - 6,0', 'row'],
]

console.log('\ndrawing a slip to photograph')
await S('Page.navigate', { url: BASE })
await sleep(3000)
await ev(H + ' return true')

// Drawn rather than photographed so the suite is deterministic: a committed
// photograph would make this a test of one camera on one day.
const drew = await ev(`
  const W = 1240, H = 760;
  const c = document.createElement('canvas');
  c.width = W; c.height = H;
  const x = c.getContext('2d');
  x.fillStyle = '#ffffff'; x.fillRect(0, 0, W, H);
  x.fillStyle = '#000000';
  const lines = ${JSON.stringify(SLIP_LINES)};
  let y = 70;
  for (const [text, kind] of lines) {
    if (kind === 'gap') { y += 26; continue; }
    x.font = (kind === 'head' ? 'bold ' : '') + '30px "Courier New", monospace';
    x.fillText(text, 60, y);
    y += 52;
  }
  const blob = await new Promise((r) => c.toBlob(r, 'image/png'));
  const buf = new Uint8Array(await blob.arrayBuffer());
  let s = '';
  for (let i = 0; i < buf.length; i += 1) s += String.fromCharCode(buf[i]);
  window.__slip = btoa(s);
  return { bytes: buf.length };
`)
check('a slip is drawn to photograph', drew.bytes > 2000, `${Math.round(drew.bytes / 1024)} KB`)

const slipPath = join(WORK, 'phieu-xet-nghiem.png')
writeFileSync(slipPath, Buffer.from(await ev(`return window.__slip`), 'base64'))
await ev(`window.__slip = ''; return true`)

// ------------------------------------------------------------ a case to fill
console.log('\nopening a case')
await ev(`
  const i = [...document.querySelectorAll('input')].filter((x) => x.type === 'text' || !x.type);
  if (i.length >= 2) {
    window.__set(i[0], 'Thu'); window.__set(i[1], 'Y5002');
    await new Promise((r) => setTimeout(r, 300));
    const level = window.__btn('^Y5$');
    if (level) level.click();
    await new Promise((r) => setTimeout(r, 300));
    const go = window.__btn('^Bắt đầu$');
    if (go) go.click();
  }
  await new Promise((r) => setTimeout(r, 2200));
  return true;
`)
await ev(H + ' return true')
await ev(`
  // Two steps: the home button opens a sheet, the sheet creates the case.
  const b = window.__btn('Ca lâm sàng mới');
  if (b) b.click();
  await new Promise((r) => setTimeout(r, 900));
  const create = window.__btn('Tạo và bắt đầu ghi chú');
  if (create) create.click();
  return true;
`)
await sleep(2500)
await ev(H + ' return true')

const caseId = await ev(`
  const m = window.location.hash.match(/#\\/case\\/([^/]+)/);
  return m ? m[1] : '';
`)
check('a case is open to import into', Boolean(caseId), caseId || 'none')

await ev(`window.location.hash = '#/case/${caseId}/s/investigations'; return true`)
const controlReady = await until(`/đọc thành số liệu/i.test(window.__txt())`)
check('the import control is on the investigations screen', controlReady)

// ----------------------------------------------------------- the camera path
console.log('\nphotographing and reading')

const { root } = await S('DOM.getDocument', { depth: -1 })
const { nodeId } = await S('DOM.querySelector', {
  nodeId: root.nodeId,
  selector: 'input[type=file][accept="image/*"]',
})
check('the camera input is reachable', nodeId > 0, `nodeId ${nodeId}`)

// The route an evaluator takes, who has no photograph of a laboratory result
// and should not go and make one. If this is broken the feature is, for them,
// not there at all.
const sampleOffered = await ev(`
  const b = window.__btn('Thử với phiếu mẫu');
  return Boolean(b && !b.disabled);
`)
check('a sample slip is offered to anyone without one', sampleOffered)

if (nodeId > 0) await S('DOM.setFileInputFiles', { nodeId, files: [slipPath] })

check('the review sheet opens on the photograph', await until(`document.querySelector('.sheet')`, 20))

// Recognition is slow on a cold core: the worker, the WebAssembly and the
// language data all download on this first run.
const recognised = await until(
  `/kết quả vào bệnh án|Chọn ít nhất một dòng|Không nhận ra dòng/.test(window.__txt())`,
  80,
  3000,
)
check('the slip is recognised and offered for review', recognised,
  recognised ? '' : await ev(`
    const sheet = document.querySelector('.sheet');
    return sheet ? sheet.innerText.replace(/\\s+/g, ' ').slice(0, 220) : 'no sheet';
  `))

const sheetState = await ev(`
  const sheet = document.querySelector('.sheet');
  const txt = sheet ? sheet.innerText : '';
  return {
    inSheet: Boolean(sheet),
    idWarning: /dòng chứa thông tin định danh/.test(txt),
    hasGlucose: /Glucose/.test(txt),
    // Scoped to the sheet on purpose: the ordinary result editor has its own
    // "Bất thường" option, so a page-wide match would go green either way.
    abnormalBadge: /bất thường/.test(txt),
  };
`)
check('the review sheet is what is being read', sheetState.inSheet)

// The sheet is also the screenshot used in the deck. Taken here rather than by
// hand so the picture can never show a version of the screen that no longer
// exists — which has happened before with the demo screenshots.
if (process.env.OCR_SHOT) {
  const shot = await S('Page.captureScreenshot', { format: 'png' })
  mkdirSync(process.env.OCR_SHOT.replace(/\/[^/]+$/, ''), { recursive: true })
  writeFileSync(process.env.OCR_SHOT, Buffer.from(shot.data, 'base64'))
  console.log(`    ảnh màn hình: ${process.env.OCR_SHOT}`)
}
check('identity lines are called out, not quietly dropped', sheetState.idWarning)
check('the analytes are offered', sheetState.hasGlucose)
check('the sheet still shows what the printed interval implies', sheetState.abnormalBadge)

await ev(`
  const b = window.__btn('kết quả vào bệnh án');
  if (b) b.click();
  return true;
`)
await sleep(2500)

// ------------------------------------------------------ what ended up stored
console.log('\nwhat ended up stored')
const record = await ev(`
  const db = await new Promise((r) => { const q = indexedDB.open('clerkmate'); q.onsuccess = () => r(q.result) });
  const rows = await new Promise((r) => { const t = db.transaction('cases').objectStore('cases').getAll(); t.onsuccess = () => r(t.result) });
  const rec = rows.find((x) => x.id === '${caseId}');
  const list = rec ? rec.investigations.results : [];
  const blobs = await new Promise((r) => { const t = db.transaction('blobs').objectStore('blobs').getAll(); t.onsuccess = () => r(t.result) });
  return {
    names: list.map((r) => r.name).filter(Boolean),
    flags: list.map((r) => r.flag),
    attachments: rec ? rec.attachments.length : -1,
    blobs: blobs.length,
    json: JSON.stringify(rec),
  };
`)
check('the numbers are in the record', record.names.some((n) => /Glucose/i.test(n)),
  record.names.join(', '))
// Deliberately the opposite of what it used to assert.
//
// The flag is derived from the reference interval the recogniser read off the
// image, and reading digits off a photograph goes wrong: one lost comma turns
// "< 5,2" into "< 52", and an abnormal cholesterol arrives wearing a green
// label. A learner catches a wrong number; they do not catch a wrong label. So
// the numbers import and the flag does not.
check('no flag is written into the record from what the machine read',
  record.flags.every((f) => f === ''), record.flags.map((f) => f || '—').join('|'))

// The two checks this feature exists for.
check('the patient name never entered the record', !/NGUY[ỄE]N V[ĂA]N AN/i.test(record.json),
  'không có tên trong bệnh án')
check('no photograph was stored at all', record.attachments === 0 && record.blobs === 0,
  `${record.attachments} đính kèm, ${record.blobs} blob`)

// ------------------------------------------------- the path an evaluator takes
console.log('\ntrying it with no slip of your own')
await ev(`
  const b = window.__btn('Thử với phiếu mẫu');
  if (b) b.click();
  return true;
`)
const sampleRead = await until(
  `document.querySelector('.sheet') && /kết quả vào bệnh án|Không nhận ra dòng/.test(window.__txt())`,
  60,
  2000,
)
check('the sample slip is drawn and read', sampleRead)

const sampleSheet = await ev(`
  const sheet = document.querySelector('.sheet');
  const txt = sheet ? sheet.innerText : '';
  return {
    idWarning: /dòng chứa thông tin định danh/.test(txt),
    analytes: ['Glucose', 'Cholesterol', 'Creatinin'].filter((n) => txt.includes(n)),
  };
`)
check('the sample slip yields analytes', sampleSheet.analytes.length >= 2,
  sampleSheet.analytes.join(', '))
// The sample prints the identifier band real Vietnamese forms print, so the
// evaluator sees the app refuse it rather than being told it would.
check('the sample slip shows the identity band being refused', sampleSheet.idWarning)

const appHost = new URL(BASE).host
const foreign = [...new Set(requestHosts)].filter((h) => h && h !== appHost)
check('nothing was sent to anyone else, at any point', foreign.length === 0,
  foreign.length ? foreign.join(', ') : `chỉ ${appHost}`)

const failed = results.filter((r) => !r.pass)
console.log(`\n${results.length - failed.length}/${results.length} OCR checks passed`)
if (failed.length) console.log('FAILED:\n' + failed.map((f) => ' - ' + f.n).join('\n'))
ws.close()
try {
  chrome.kill()
} catch {}
process.exit(failed.length ? 1 : 0)
