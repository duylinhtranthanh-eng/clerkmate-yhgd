/**
 * Quick Capture, driven in a real browser.
 *
 * Covers what a unit test cannot: that the tabs exist, that a fragment survives
 * the round trip to IndexedDB, that a conflict is shown rather than applied,
 * that the microphone is never opened before the learner has read where the
 * audio goes, and that no transcript is written to the console.
 */
import { spawn, execSync } from 'node:child_process'
import { writeFile, mkdir } from 'node:fs/promises'

const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
const PORT = 9397, BASE = 'http://localhost:4191/clerkmate-yhgd/'
const PROFILE = `/tmp/clerkmate-capture-${process.pid}`
const OUT = '/tmp/clerkmate-capture'
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const results = []
const check = (n, pass, d) => { results.push({ n, pass }); console.log(`  ${pass ? '✓' : '✗'} ${n}${d ? ' — ' + d : ''}`) }

try { execSync('pkill -f "clerkmate-capture-" || true') } catch {}
execSync(`rm -rf ${PROFILE}`); await mkdir(OUT, { recursive: true })
process.on('exit', () => { try { execSync(`rm -rf ${PROFILE}`) } catch {} })

const chrome = spawn(CHROME, ['--window-position=-3000,0', '--window-size=430,940',
  `--remote-debugging-port=${PORT}`, `--user-data-dir=${PROFILE}`, '--hide-scrollbars',
  '--no-first-run', '--no-default-browser-check', 'about:blank'], { stdio: 'ignore' })
let wsUrl = null
for (let i = 0; i < 60 && !wsUrl; i++) { await sleep(300)
  try { wsUrl = (await (await fetch(`http://127.0.0.1:${PORT}/json/version`)).json()).webSocketDebuggerUrl } catch {} }
const ws = new WebSocket(wsUrl); let id = 0; const pending = new Map()
const logs = []
ws.addEventListener('message', (e) => {
  const m = JSON.parse(e.data)
  if (m.method === 'Runtime.consoleAPICalled') {
    logs.push((m.params.args ?? []).map((a) => String(a.value ?? a.description ?? '')).join(' '))
  }
  if (m.id && pending.has(m.id)) { const p = pending.get(m.id); pending.delete(m.id); m.error ? p.rej(new Error(m.error.message)) : p.res(m.result) }
})
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
const shot = async (name) => {
  const { data } = await S('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true })
  await writeFile(`${OUT}/${name}.png`, Buffer.from(data, 'base64'))
}
const H = `
  window.__btn = (re) => [...document.querySelectorAll('button, label')].find((b) => new RegExp(re).test(b.textContent));
  window.__set = (el, v) => { const P = el instanceof HTMLTextAreaElement ? HTMLTextAreaElement : HTMLInputElement;
    Object.getOwnPropertyDescriptor(P.prototype, 'value').set.call(el, v); el.dispatchEvent(new Event('input', { bubbles: true })) };
  window.__txt = () => document.body.innerText;
  window.__db = () => new Promise((r) => { const q = indexedDB.open('clerkmate'); q.onsuccess = () => r(q.result) });
  window.__cases = async () => { const db = await window.__db();
    return new Promise((r) => { const t = db.transaction('cases').objectStore('cases').getAll(); t.onsuccess = () => r(t.result) }) };
  true;`

// ------------------------------------------------------------------ setting up
console.log('\nsetting up a case')
await S('Page.navigate', { url: BASE }); await sleep(3000); await ev(H + ' return true')
await ev(`
  const i = [...document.querySelectorAll('input')].filter((x) => x.type === 'text' || !x.type);
  window.__set(i[0], 'Thu'); window.__set(i[1], 'Y5001');
  await new Promise((r) => setTimeout(r, 400));
  window.__btn('^Bắt đầu$').click(); return true;
`)
await sleep(1800); await ev(H + ' return true')
await ev(`window.__btn('Ca lâm sàng mới').click(); return true`); await sleep(900)
await ev(`
  const i = [...document.querySelectorAll('.sheet input')];
  if (i[0]) window.__set(i[0], 'Ca 01');
  await new Promise((r) => setTimeout(r, 300));
  [...document.querySelectorAll('.sheet button')].find((b) => /Tạo/.test(b.textContent)).click();
  return true;
`)
await sleep(2200); await ev(H + ' return true')
const caseId = await ev(`return (await window.__cases())[0].id`)
check('a case can be created and opens on the capture tab', !!caseId && (await ev('return location.hash')).includes('/note'))

// ---------------------------------------------------------------- A. text mode
console.log('\ntext capture')
const tabs = await ev(`return { text: !!window.__btn('Gõ'), voice: !!window.__btn('Nói') }`)
check('both capture modes are offered', tabs.text && tabs.voice)
await shot('01-capture-text')

await ev(`
  const ta = document.querySelector('textarea.notepad');
  window.__set(ta, 'đau gối P 3th, tăng khi cầu thang, nghỉ đỡ, đau 6/10');
  await new Promise((r) => setTimeout(r, 500));
  window.__btn('Sắp xếp vào bệnh án').click(); return true;
`)
await sleep(2200)
const review = await ev(`
  const rows = [...document.querySelectorAll('.sheet .suggestion')];
  return {
    count: rows.length,
    labels: rows.map((r) => r.querySelector('.tiny')?.textContent?.trim()),
    snippets: rows.map((r) => r.querySelector('.snippet')?.textContent?.trim()).filter(Boolean).length,
    groups: [...document.querySelectorAll('.sheet .section-title')].map((x) => x.textContent.trim()),
    checked: [...document.querySelectorAll('.sheet .suggestion[data-on="true"]')].length,
  };
`)
check('one fragment produces several suggestions', review.count >= 4, `${review.count} rows`)
check('every suggestion shows the text it came from', review.snippets === review.count,
  `${review.snippets}/${review.count}`)
check('suggestions are grouped by section', review.groups.length >= 1, review.groups.join(' · '))
check('the SOCRATES elements are proposed', (review.labels ?? []).some((l) => /Mức độ|Vị trí|Tăng/.test(l ?? '')),
  (review.labels ?? []).join(' | ').slice(0, 80))
await shot('02-suggestions')

const applied = await ev(`
  window.__btn('Đưa \\\\d+ mục vào bệnh án').click();
  await new Promise((r) => setTimeout(r, 1800));
  const c = (await window.__cases()).find((x) => x.id === ${JSON.stringify(caseId)});
  return { severity: c.history.socrates.severity, site: c.history.socrates.site,
           toast: window.__txt().match(/Đã bổ sung[^\\n]*/)?.[0] ?? '',
           status: c.quickNotes[0]?.processingStatus, source: c.quickNotes[0]?.source };
`)
check('accepted suggestions reach the record', applied.severity === '6/10', JSON.stringify(applied.severity))
check('the fragment records how far it got', ['partially_applied', 'fully_applied'].includes(applied.status), applied.status)
check('the fragment remembers it was typed', applied.source === 'text', applied.source)
check('completeness answers back straight away', /Còn thiếu \d+ mục bắt buộc|Đã đủ mục/.test(applied.toast), applied.toast)
await shot('03-inbox')

const inbox = await ev(`
  const t = window.__txt();
  return { title: /Ghi chú trong buổi khám/.test(t), source: /⌨️ Gõ/.test(t), badge: /Đã sắp xếp|Đã đưa một phần/.test(t) };
`)
check('the inbox keeps the fragment, with its source and status',
  inbox.title && inbox.source && inbox.badge, JSON.stringify(inbox))

// ---------------------------------------------------------------- B. conflict
console.log('\nconflict, not overwrite')
await ev(`
  const ta = document.querySelector('textarea.notepad');
  window.__set(ta, 'Lúc nặng nhất đau 8/10');
  await new Promise((r) => setTimeout(r, 400));
  window.__btn('Sắp xếp vào bệnh án').click(); return true;
`)
await sleep(2200)
const conflict = await ev(`
  const rows = [...document.querySelectorAll('.sheet .suggestion')].filter((r) => r.querySelector('.conflict'));
  // The severity row is the one under test: the note also contradicts the
  // chief complaint, which is a conflict too but not this scenario's.
  const row = rows.find((r) => /6\\/10/.test(r.innerText) && /8\\/10/.test(r.innerText)) ?? rows[0];
  return {
    shown: rows.length > 0,
    text: row?.querySelector('.conflict')?.innerText?.replace(/\\n/g, ' | ') ?? '',
    preselected: row?.dataset.on === 'true',
    rows: rows.length,
  };
`)
check('a different value in a one-answer box is shown as a conflict', conflict.shown, conflict.text.slice(0, 90))
check('both the old and the new value are shown', /6\/10/.test(conflict.text) && /8\/10/.test(conflict.text), conflict.text.slice(0, 90))
check('a conflict is not preselected', conflict.preselected === false)
await shot('04-conflict')

const kept = await ev(`
  document.querySelector('.backdrop')?.click();
  await new Promise((r) => setTimeout(r, 900));
  const c = (await window.__cases()).find((x) => x.id === ${JSON.stringify(caseId)});
  return { severity: c.history.socrates.severity, fragments: c.quickNotes.length };
`)
check('declining a conflict leaves the record alone', kept.severity === '6/10', kept.severity)
check('the fragment is kept either way', kept.fragments >= 2, `${kept.fragments} fragments`)

// ------------------------------------------------------------------- C. voice
console.log('\nvoice capture')
const voice = await ev(`
  window.__btn('Nói').click();
  await new Promise((r) => setTimeout(r, 800));
  const t = window.__txt();
  return {
    unsupported: /không hỗ trợ đọc thành văn bản/.test(t),
    identifiers: /Không đọc tên, số hồ sơ, số điện thoại/.test(t),
    remote: /gửi tới dịch vụ chuyển giọng nói/.test(t),
    gate: !!window.__btn('Tôi đã hiểu, bật micro'),
    recordingOffered: !!window.__btn('Bắt đầu nói'),
  };
`)
if (voice.unsupported) {
  check('an unsupported browser says so and keeps text capture working', true, 'no recogniser in this build')
} else {
  check('the identifier warning is shown before the microphone', voice.identifiers)
  check('it says the audio leaves the device, and to whom', voice.remote)
  check('recording is gated behind that notice', voice.gate && !voice.recordingOffered,
    `gate ${voice.gate}, record ${voice.recordingOffered}`)
}
await shot('05-voice')

if (!voice.unsupported) {
  const afterAck = await ev(`
    window.__btn('Tôi đã hiểu, bật micro').click();
    await new Promise((r) => setTimeout(r, 700));
    return { start: !!window.__btn('Bắt đầu nói'), editor: !!document.querySelector('textarea.notepad') };
  `)
  check('after acknowledging, push-to-talk is offered', afterAck.start)
}

// --------------------------------------------------------- D. lock and privacy
console.log('\nlock and privacy')
// Leave the case first: the editor holds the open record in memory and
// autosaves it, so a lock written underneath a screen that is still mounted can
// simply be flushed away again. Lock it from Home, then walk back in.
await ev(`window.location.hash = '#/'; return true`)
await sleep(1500)
const lockCheck = await ev(`
  const c = (await window.__cases()).find((x) => x.id === ${JSON.stringify(caseId)});
  const db = await window.__db();
  c.submission = { ...c.submission, locked: true, submittedAt: new Date().toISOString(), code: 'X-1' };
  await new Promise((r) => { const t = db.transaction('cases', 'readwrite'); t.objectStore('cases').put(c); t.oncomplete = r });
  window.location.hash = '#/case/' + ${JSON.stringify(caseId)} + '/note';
  await new Promise((r) => setTimeout(r, 2000));
  const ta = document.querySelector('textarea.notepad');
  const before = (await window.__cases()).find((x) => x.id === ${JSON.stringify(caseId)}).quickNotes.length;
  if (ta && !ta.disabled) { window.__set(ta, 'ghi khi đã khoá'); }
  const btn = window.__btn('Sắp xếp vào bệnh án');
  if (btn && !btn.disabled) btn.click();
  await new Promise((r) => setTimeout(r, 1400));
  const after = (await window.__cases()).find((x) => x.id === ${JSON.stringify(caseId)}).quickNotes.length;
  return { disabled: !ta || ta.disabled, before, after, voiceTab: !!window.__btn('Nói') };
`)
check('a locked case cannot take new fragments', lockCheck.before === lockCheck.after,
  `${lockCheck.before} → ${lockCheck.after}`)
check('the capture box is disabled when locked', lockCheck.disabled)

const voiceLocked = await ev(`
  const b = window.__btn('Nói');
  if (b) { b.click(); await new Promise((r) => setTimeout(r, 700)); }
  return { blocked: /khoá sửa/.test(window.__txt()), canRecord: !!window.__btn('Bắt đầu nói') };
`)
check('voice capture is closed on a locked case', voiceLocked.blocked && !voiceLocked.canRecord,
  JSON.stringify(voiceLocked))

const leaked = logs.filter((l) => /đau gối|6\/10|8\/10|nặng nhất/.test(l))
check('no captured text is written to the console', leaked.length === 0, leaked.slice(0, 1).join(' | '))

const failed = results.filter((r) => !r.pass)
console.log(`\n${results.length - failed.length}/${results.length} quick capture checks passed`)
console.log(`screenshots in ${OUT}`)
if (failed.length) console.log('FAILED:\n' + failed.map((f) => ' - ' + f.n).join('\n'))
ws.close(); try { chrome.kill() } catch {}
process.exit(failed.length ? 1 : 0)
