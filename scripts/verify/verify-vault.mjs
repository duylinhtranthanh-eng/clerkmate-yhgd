/**
 * At-rest encryption, driven in a real browser.
 *
 * The question this suite exists to answer is not "does it encrypt" — the unit
 * checks cover that — but "can a learner lose their records by using it". So it
 * switches encryption on over a real case with a real image, reloads, unlocks,
 * compares the record byte for byte, and switches it off again.
 */
import { spawn, execSync } from 'node:child_process'

const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
const PORT = 9405, BASE = 'http://localhost:4191/clerkmate-yhgd/'
const PROFILE = `/tmp/clerkmate-vault-${process.pid}`
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const results = []
const check = (n, pass, d) => { results.push({ n, pass }); console.log(`  ${pass ? '✓' : '✗'} ${n}${d ? ' — ' + d : ''}`) }

try { execSync('pkill -f "clerkmate-vault-" || true') } catch {}
execSync(`rm -rf ${PROFILE}`)
process.on('exit', () => { try { execSync(`rm -rf ${PROFILE}`) } catch {} })

const chrome = spawn(CHROME, ['--window-position=-3000,0', '--window-size=430,940',
  `--remote-debugging-port=${PORT}`, `--user-data-dir=${PROFILE}`, '--hide-scrollbars',
  '--no-first-run', '--no-default-browser-check', 'about:blank'], { stdio: 'ignore' })
let wsUrl = null
for (let i = 0; i < 60 && !wsUrl; i++) { await sleep(300)
  try { wsUrl = (await (await fetch(`http://127.0.0.1:${PORT}/json/version`)).json()).webSocketDebuggerUrl } catch {} }
const ws = new WebSocket(wsUrl); let id = 0; const pending = new Map()
ws.addEventListener('message', (e) => { const m = JSON.parse(e.data)
  if (m.id && pending.has(m.id)) { const p = pending.get(m.id); pending.delete(m.id); m.error ? p.rej(new Error(m.error.message)) : p.res(m.result) } })
await new Promise((r) => ws.addEventListener('open', r))
const send = (mm, p = {}, sid) => new Promise((res, rej) => { const mid = ++id; pending.set(mid, { res, rej })
  ws.send(JSON.stringify({ id: mid, method: mm, params: p, ...(sid ? { sessionId: sid } : {}) })) })
const { targetId } = await send('Target.createTarget', { url: 'about:blank' })
const { sessionId } = await send('Target.attachToTarget', { targetId, flatten: true })
const S = (m, p) => send(m, p, sessionId)
await S('Page.enable'); await S('Runtime.enable')
await S('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 2, mobile: true })
const ev = async (x) => {
  const r = await S('Runtime.evaluate', { expression: `(async () => { ${x} })()`, awaitPromise: true, returnByValue: true })
  if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description || r.exceptionDetails.text)
  return r.result.value
}
const H = `
  window.__btn = (re) => [...document.querySelectorAll('button, label')].find((b) => new RegExp(re).test(b.textContent));
  window.__set = (el, v) => { const P = el instanceof HTMLTextAreaElement ? HTMLTextAreaElement : HTMLInputElement;
    Object.getOwnPropertyDescriptor(P.prototype, 'value').set.call(el, v); el.dispatchEvent(new Event('input', { bubbles: true })) };
  window.__txt = () => document.body.innerText;
  // The settings page has more than one "Bật" — the AI card has its own — so a
  // button is always found inside the card it belongs to.
  window.__card = (title) => [...document.querySelectorAll('.card')]
    .find((c) => new RegExp(title).test(c.innerText));
  window.__cardBtn = (title, re) => {
    const card = window.__card(title);
    return card && [...card.querySelectorAll('button')].find((b) => new RegExp(re).test(b.textContent.trim()));
  };
  window.__db = () => new Promise((r) => { const q = indexedDB.open('clerkmate'); q.onsuccess = () => r(q.result) });
  window.__rawCases = async () => { const db = await window.__db();
    return new Promise((r) => { const t = db.transaction('cases').objectStore('cases').getAll(); t.onsuccess = () => r(t.result) }) };
  window.__rawBlobs = async () => { const db = await window.__db();
    return new Promise((r) => { const t = db.transaction('blobs').objectStore('blobs').getAll(); t.onsuccess = () => r(t.result) }) };
  true;`
const go = async (h, w = 1600) => { await ev(`window.location.hash=${JSON.stringify(h)}; return true`); await sleep(w); await ev(H + ' return true') }

// -------------------------------------------------------------- a real case
console.log('\nseeding a case with an image')
await S('Page.navigate', { url: BASE }); await sleep(3000); await ev(H + ' return true')
await ev(`
  const i = [...document.querySelectorAll('input')].filter((x) => x.type === 'text' || !x.type);
  window.__set(i[0], 'Thu'); window.__set(i[1], 'SDH026');
  await new Promise((r) => setTimeout(r, 400));
  window.__btn('^Bắt đầu$').click(); return true;
`)
await sleep(1800); await ev(H + ' return true')
await ev(`window.__btn('Dùng thử ca mẫu').click(); return true`); await sleep(900)
await ev(`[...document.querySelectorAll('button')].find((b) => /đau khớp gối/.test(b.textContent)).click(); return true`)
await sleep(5000); await ev(H + ' return true')

const before = await ev(`
  const rows = await window.__rawCases();
  const blobs = await window.__rawBlobs();
  return { cases: rows.length, blobs: blobs.length, json: JSON.stringify(rows[0]),
           name: rows[0]?.patient?.name ?? '', sealed: rows.some((r) => r.sealed) };
`)
check('a case and its image are stored', before.cases === 1 && before.blobs >= 1,
  `${before.cases} case, ${before.blobs} blob(s)`)
check('and they are stored in the clear while encryption is off',
  !before.sealed && before.name.length > 0, before.name)

// ------------------------------------------------------------- switching on
console.log('\nswitching encryption on')
await go('#/settings')
const turnedOn = await ev(`
  window.__cardBtn('Mã hoá dữ liệu trên thiết bị', '^Bật$').click();
  await new Promise((r) => setTimeout(r, 700));
  const inputs = [...window.__card('Mã hoá dữ liệu trên thiết bị').querySelectorAll('input[type=password]')];
  window.__set(inputs[0], 'mat-khau-rat-dai');
  window.__set(inputs[1], 'mat-khau-rat-dai');
  await new Promise((r) => setTimeout(r, 400));
  window.confirm = () => true;
  window.__btn('Mã hoá dữ liệu trên thiết bị này').click();
  await new Promise((r) => setTimeout(r, 6000));
  const rows = await window.__rawCases();
  const blobs = await window.__rawBlobs();
  return {
    sealedCases: rows.filter((r) => r.sealed).length,
    plainCases: rows.filter((r) => !r.sealed).length,
    sealedBlobs: blobs.filter((b) => b && b.__sealed === 1).length,
    plainBlobs: blobs.filter((b) => !b || b.__sealed !== 1).length,
    leak: JSON.stringify(rows).includes('giả lập'),
  };
`)
check('every case is sealed, none left in the clear',
  turnedOn.sealedCases === 1 && turnedOn.plainCases === 0, JSON.stringify(turnedOn))
check('every image is sealed too',
  turnedOn.sealedBlobs >= 1 && turnedOn.plainBlobs === 0,
  `${turnedOn.sealedBlobs} sealed, ${turnedOn.plainBlobs} plain`)
check('the patient is no longer readable in the database', turnedOn.leak === false)

// -------------------------------------------------- reload, locked, unlocked
console.log('\nreopening the app')
await S('Page.reload'); await sleep(3500); await ev(H + ' return true')
const locked = await ev(`
  return { prompt: /Bệnh án đang được khoá/.test(window.__txt()),
           listed: document.querySelectorAll('.list__item').length };
`)
check('reopening asks for the password before anything is shown', locked.prompt)
check('no case is listed while locked', locked.listed === 0, String(locked.listed))

const wrong = await ev(`
  const i = document.querySelector('input[type=password]');
  window.__set(i, 'sai-mat-khau-roi');
  await new Promise((r) => setTimeout(r, 300));
  window.__btn('^Mở khoá$').click();
  await new Promise((r) => setTimeout(r, 2500));
  return { refused: /không đúng/.test(window.__txt()), stillLocked: /đang được khoá/.test(window.__txt()) };
`)
check('a wrong password is refused and nothing opens', wrong.refused && wrong.stillLocked,
  JSON.stringify(wrong))

const opened = await ev(`
  const i = document.querySelector('input[type=password]');
  window.__set(i, 'mat-khau-rat-dai');
  await new Promise((r) => setTimeout(r, 300));
  window.__btn('^Mở khoá$').click();
  await new Promise((r) => setTimeout(r, 6000));
  return { listed: document.querySelectorAll('.list__item').length,
           stillLocked: /đang được khoá/.test(window.__txt()),
           txt: window.__txt().slice(0, 90) };
`)
// A reload here would be a bug, not a detail: it would discard the in-memory
// key and lock the app again, so the check insists the records are simply there.
check('the right password brings the case back', opened.listed >= 1 && !opened.stillLocked,
  `${opened.listed} listed`)

// ----------------------------------------------------- the record is intact
const after = await ev(`
  const { listCases } = window;
  const rows = await window.__rawCases();
  return { sealed: rows.every((r) => !!r.sealed) };
`)
check('records stay sealed while in use', after.sealed)

const imageWorks = await ev(`
  window.location.hash = '#/';
  await new Promise((r) => setTimeout(r, 1500));
  const first = document.querySelector('.list__item button, .list__item');
  const id = (await window.__rawCases())[0].id;
  window.location.hash = '#/case/' + id + '/s/attachments';
  await new Promise((r) => setTimeout(r, 3000));
  const img = document.querySelector('.thumb img');
  return { thumb: !!img, src: (img?.src ?? '').slice(0, 12) };
`)
check('the attached image still renders once unlocked', imageWorks.thumb, imageWorks.src)

// ------------------------------------------------------------ switching off
console.log('\nswitching encryption off')
await go('#/settings')
const turnedOff = await ev(`
  window.confirm = () => true;
  window.__cardBtn('Mã hoá dữ liệu trên thiết bị', '^Tắt$').click();
  await new Promise((r) => setTimeout(r, 6000));
  const rows = await window.__rawCases();
  const blobs = await window.__rawBlobs();
  return { sealed: rows.filter((r) => r.sealed).length, cases: rows.length,
           blobs: blobs.length, plainBlobs: blobs.filter((b) => b && b.__sealed !== 1).length,
           name: rows[0]?.patient?.name ?? '', json: JSON.stringify(rows[0]) };
`)
check('turning it off decrypts every case', turnedOff.sealed === 0 && turnedOff.cases === 1,
  JSON.stringify({ sealed: turnedOff.sealed, cases: turnedOff.cases }))
check('and every image', turnedOff.plainBlobs === turnedOff.blobs && turnedOff.blobs >= 1,
  `${turnedOff.plainBlobs}/${turnedOff.blobs}`)
// Sealing and unsealing rewrites the row, so the stamps it recomputes on save
// (`updatedAt`, `completeness.computedAt`) legitimately move.
// Everything a learner typed must not: the diff is computed key by key and the
// check names whatever else changed, rather than reporting a bare mismatch.
const VOLATILE = new Set(['updatedAt', 'sealed', 'computedAt'])
const diffKeys = (a, b, path = '') => {
  if (a === b) return []
  const prim = (v) => v === null || typeof v !== 'object'
  if (prim(a) || prim(b)) return JSON.stringify(a) === JSON.stringify(b) ? [] : [path || '(root)']
  const keys = new Set([...Object.keys(a), ...Object.keys(b)])
  return [...keys].flatMap((k) =>
    VOLATILE.has(k) ? [] : diffKeys(a[k], b[k], path ? `${path}.${k}` : k))
}
const changed = diffKeys(JSON.parse(before.json), JSON.parse(turnedOff.json))
check('the record came back exactly as it went in', changed.length === 0,
  changed.length === 0 ? 'identical apart from updatedAt' : 'changed: ' + changed.join(', '))

const reopened = await ev(`
  window.location.hash = '#/';
  await new Promise((r) => setTimeout(r, 1600));
  return { listed: document.querySelectorAll('.list__item').length,
           prompt: /đang được khoá/.test(window.__txt()) };
`)
check('the app opens without a password again', reopened.listed >= 1 && !reopened.prompt,
  JSON.stringify(reopened))

const failed = results.filter((r) => !r.pass)
console.log(`\n${results.length - failed.length}/${results.length} vault checks passed`)
if (failed.length) console.log('FAILED:\n' + failed.map((f) => ' - ' + f.n).join('\n'))
ws.close(); try { chrome.kill() } catch {}
process.exit(failed.length ? 1 : 0)
