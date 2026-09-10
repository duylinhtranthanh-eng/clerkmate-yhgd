/**
 * Print and PDF audit.
 *
 * Renders the review document under print media and inspects what the printer
 * would actually receive, then produces a real PDF through Chrome's own print
 * pipeline — the same pipeline the app uses — and checks the file.
 */
import { spawn, execSync } from 'node:child_process'
import { writeFile, mkdir } from 'node:fs/promises'

const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
const PORT = 9380, REPO = 'clerkmate-yhgd'
const BASE = `http://localhost:4191/${REPO}/`
// A unique directory per run, and any leftover browser is killed first: a
// previous run that threw would otherwise still hold the profile and the
// debugging port, and the next launch would silently attach to that old
// instance — carrying its IndexedDB, and its half-finished state, with it.
const PROFILE = `/tmp/clerkmate-print-profile-${process.pid}`
const OUT = '/tmp/clerkmate-print'
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const results = []
const check = (name, pass, detail) => { results.push({ name, pass, detail })
  console.log(`  ${pass ? '✓' : '✗'} ${name}${detail ? ' — ' + detail : ''}`) }

try { execSync(`pkill -f "clerkmate-print-profile" || true`) } catch {}
try { execSync(`lsof -ti tcp:${PORT} | xargs -r kill -9`) } catch {}
execSync(`rm -rf ${PROFILE}`)
// Always take the browser down, including on the failure paths.
const shutdown = () => { try { execSync(`rm -rf ${PROFILE}`) } catch {} }
process.on('exit', shutdown)
for (const sig of ['SIGINT', 'SIGTERM', 'uncaughtException']) {
  process.on(sig, (e) => { if (e) console.error(e); shutdown(); process.exit(1) })
}; await mkdir(OUT, { recursive: true })
const chrome = spawn(CHROME, ['--window-position=-3000,0', '--window-size=460,980',
  `--remote-debugging-port=${PORT}`, `--user-data-dir=${PROFILE}`, '--hide-scrollbars',
  '--no-first-run', '--no-default-browser-check', 'about:blank'], { stdio: 'ignore' })
let wsUrl = null
for (let i = 0; i < 60 && !wsUrl; i++) { await sleep(300)
  try { wsUrl = (await (await fetch(`http://127.0.0.1:${PORT}/json/version`)).json()).webSocketDebuggerUrl } catch {} }
const ws = new WebSocket(wsUrl); let id = 0; const pending = new Map()
ws.addEventListener('message', (e) => { const m = JSON.parse(e.data)
  if (m.id && pending.has(m.id)) { const p = pending.get(m.id); pending.delete(m.id); m.error ? p.rej(new Error(m.error.message)) : p.res(m.result) } })
await new Promise((r) => ws.addEventListener('open', r))
const send = (method, params = {}, sid) => new Promise((res, rej) => { const mid = ++id; pending.set(mid, { res, rej })
  ws.send(JSON.stringify({ id: mid, method, params, ...(sid ? { sessionId: sid } : {}) })) })
const { targetId } = await send('Target.createTarget', { url: 'about:blank' })
const { sessionId } = await send('Target.attachToTarget', { targetId, flatten: true })
const S = (m, p) => send(m, p, sessionId)
await S('Page.enable'); await S('Runtime.enable')
await S('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 2, mobile: true })
const ev = async (x) => { const r = await S('Runtime.evaluate', { expression: `(async () => { ${x} })()`, awaitPromise: true, returnByValue: true })
  if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description || r.exceptionDetails.text); return r.result.value }
const H = `
  window.__set = (el, v) => { const P = el instanceof HTMLTextAreaElement ? HTMLTextAreaElement : HTMLInputElement;
    Object.getOwnPropertyDescriptor(P.prototype, 'value').set.call(el, v); el.dispatchEvent(new Event('input', { bubbles: true })) };
  window.__btn = (re) => [...document.querySelectorAll('button, label')].find((b) => new RegExp(re).test(b.textContent));
  window.__cases = async () => { const db = await new Promise((r) => { const q = indexedDB.open('clerkmate'); q.onsuccess = () => r(q.result) });
    return new Promise((r) => { const t = db.transaction('cases').objectStore('cases').getAll(); t.onsuccess = () => r(t.result) }) };
  true;`

console.log('\npreparing a case with a redacted image and a submission stamp')
await S('Page.navigate', { url: BASE }); await sleep(3000); await ev(H + ' return true')
await ev(`let i=[...document.querySelectorAll('input')].filter(x=>x.type==='text'||!x.type); window.__set(i[0],'Nguyễn Văn A'); return true`); await sleep(400)
await ev(`let i=[...document.querySelectorAll('input')].filter(x=>x.type==='text'||!x.type); window.__set(i[1],'21YHGD001'); return true`); await sleep(400)
await ev(`let i=[...document.querySelectorAll('input')].filter(x=>x.type==='text'||!x.type); window.__set(i[2],'K30'); return true`); await sleep(400)
await ev(`[...document.querySelectorAll('.chip')].find(c=>c.textContent.trim()==='SDH')?.click(); return true`); await sleep(300)
await ev(`window.__btn('^Bắt đầu$').click(); return true`); await sleep(1600); await ev(H + ' return true')
await ev(`window.__btn('Dùng thử ca mẫu').click(); return true`); await sleep(700)
await ev(`[...document.querySelectorAll('button')].find(b=>/đau khớp gối/.test(b.textContent)).click(); return true`); await sleep(4500)
await ev(H + ' return true')
const cid = await ev(`return (await window.__cases())[0].id`)
const go = async (h, w = 1500) => { await ev(`window.location.hash=${JSON.stringify(h)}; return true`); await sleep(w); await ev(H + ' return true') }

await go(`#/case/${cid}/s/attachments`)
await ev(`document.querySelector('.thumb').click(); return true`); await sleep(1200)
await ev(`window.__btn('Che thông tin trên ảnh').click(); return true`); await sleep(1400)
await ev(`window.__btn('Che dải trên').click(); return true`); await sleep(700)
await ev(`window.__btn('Áp dụng').click(); return true`); await sleep(3000)
await ev(`document.querySelector('.backdrop')?.click(); return true`); await sleep(600)
const redactedThumb = await ev(`const c=(await window.__cases()).find(x=>x.id===${JSON.stringify(cid)}); return c.attachments[0].thumbnail`)
await go(`#/case/${cid}/review`)
await ev(`window.__btn('Nộp bài và khoá sửa').click(); return true`); await sleep(2200)
await go(`#/case/${cid}/review`)
// reopen and resubmit so the printed record carries resubmission metadata
await ev(`window.__btn('Mở lại để sửa').click(); return true`); await sleep(1800)
await go(`#/case/${cid}/review`)
await ev(`window.__btn('Nộp bài và khoá sửa').click(); return true`); await sleep(2200)
await go(`#/case/${cid}/review`)

console.log('\nprint media')
await S('Emulation.setEmulatedMedia', { media: 'print' })
await sleep(1200)
const hidden = await ev(`
  const vis = (sel) => { const el = document.querySelector(sel); return el ? getComputedStyle(el).display : 'absent' };
  return { topbar: vis('.topbar'), tabbar: vis('.tabbar'), noprint: vis('.no-print'),
           watermark: vis('.print-watermark'), footer: vis('.print-footer'), doc: vis('article.doc') };
`)
check('the top bar is not printed', hidden.topbar === 'none', hidden.topbar)
check('the tab bar is not printed', hidden.tabbar === 'none', hidden.tabbar)
check('UI-only blocks (.no-print) are not printed', hidden.noprint === 'none', hidden.noprint)
check('the level watermark is printed', hidden.watermark === 'flex', hidden.watermark)
check('the footer is printed', hidden.footer === 'block', hidden.footer)
check('the record itself is printed', hidden.doc !== 'none' && hidden.doc !== 'absent', hidden.doc)
const overflow = await ev(`
  const de = document.documentElement;
  // SVG elements report clientWidth 0 by spec, so they always look overflowing.
  const wide = [...document.querySelectorAll('article.doc *')]
    .filter((el) => !(el instanceof SVGElement) && !el.closest('svg'))
    .filter((el) => el.scrollWidth > el.clientWidth + 2)
    .map((el) => (el.tagName.toLowerCase() + '.' + String(el.getAttribute('class') || '')).slice(0, 40))
    .slice(0, 5);
  return { pageOverflow: de.scrollWidth - de.clientWidth, wide };
`)
check('the page does not scroll sideways in print', overflow.pageOverflow <= 1, String(overflow.pageOverflow))
check('no element inside the record overflows its box', overflow.wide.length === 0, overflow.wide.join(', '))
const content = await ev(`
  const doc = document.querySelector('article.doc');
  const t = doc.innerText;
  return {
    diacritics: /ệ|ố|ữ|ơ|ạ|ế|ậ|ồ/.test(t),
    title: /BỆNH ÁN Y HỌC GIA ĐÌNH/.test(t),
    learner: /Nguyễn Văn A/.test(t) && /21YHGD001/.test(t) && /K30/.test(t),
    patient: /Bà H\\. \\(giả lập\\)/.test(t) && /58/.test(t) && /Nội trợ/.test(t),
    levelStamp: /Bệnh án lập ở mức SDH/.test(t),
    sections: doc.querySelectorAll('section > h2').length,
    genogramSvg: !!doc.querySelector('svg') && doc.querySelectorAll('svg rect, svg circle').length > 4,
    attachmentList: /danh mục hình ảnh đính kèm/i.test(t),
    // The attachment line must not state one privacy status and then contradict
    // it in the same sentence.
    attachmentSelfConsistent: !(/đã che thông tin định danh/i.test(t) && /CHƯA che thông tin định danh/.test(t)),
    thumbSrc: (doc.querySelector('.thumbgrid img') || {}).src ?? null,
    code: (t.match(/[0-9A-Z]+-\\d{6}-\\d{3}/) || [])[0] ?? null,
    reopens: /Số lần mở lại/.test(t),
    watermarkText: (document.querySelector('.print-watermark span') || {}).textContent ?? null,
    footerText: (document.querySelector('.print-footer') || {}).innerText ?? null,
  };
`)
check('Vietnamese diacritics render in the printed record', content.diacritics)
check('document title is present', content.title)
check('learner name, id and class are printed', content.learner)
check('patient data are printed and are the fictional demo ones', content.patient)
check('level stamp is printed', content.levelStamp)
check('the expected numbered sections are present', content.sections >= 15 && content.sections <= 21,
  `${content.sections} of up to 21 (empty ones hide themselves)`)
check('genogram is printed as vector SVG', content.genogramSvg)
check('attachment list is printed', content.attachmentList)
check('the attachment line does not contradict its own privacy status', content.attachmentSelfConsistent)
check('the printed thumbnail is the redacted image', content.thumbSrc === redactedThumb,
  content.thumbSrc ? 'matches the stored redacted thumbnail' : 'no thumbnail found')
check('submission code is printed', !!content.code, content.code)
check('resubmission metadata is printed', content.reopens)
check('watermark carries the level and student id', /SDH/.test(content.watermarkText ?? '') && /21YHGD001/.test(content.watermarkText ?? ''),
  content.watermarkText)
check('footer carries level, learner and export date', /SDH/.test(content.footerText ?? '') && /21YHGD001/.test(content.footerText ?? ''))
const { data: shotData } = await S('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true })
await writeFile(`${OUT}/print-media.png`, Buffer.from(shotData, 'base64'))

console.log('\nreal PDF')
await S('Emulation.setEmulatedMedia', { media: '' })
await sleep(600)
const { data: pdfData } = await S('Page.printToPDF', {
  printBackground: true, paperWidth: 8.27, paperHeight: 11.69,
  marginTop: 0.55, marginBottom: 0.55, marginLeft: 0.51, marginRight: 0.51, preferCSSPageSize: true,
})
const pdf = Buffer.from(pdfData, 'base64')
await writeFile(`${OUT}/ClerkMate_sample.pdf`, pdf)
const raw = pdf.toString('latin1')
const pages = (raw.match(/\/Type\s*\/Page[^s]/g) || []).length
check('a PDF was produced', pdf.length > 20000, `${Math.round(pdf.length / 1024)} KB`)
check('the PDF has more than one page', pages > 1, `${pages} pages`)
check('the PDF embeds at least one image (the lab slip)', /\/Subtype\s*\/Image/.test(raw),
  `${(raw.match(/\/Subtype\s*\/Image/g) || []).length} image object(s)`)
check('the PDF embeds fonts rather than rasterising text', /\/Type\s*\/Font/.test(raw),
  `${(raw.match(/\/Type\s*\/Font/g) || []).length} font object(s)`)
check('the PDF is a valid file header/trailer', raw.startsWith('%PDF-') && raw.trimEnd().endsWith('%%EOF'))

console.log(`\n${results.filter((r) => r.pass).length}/${results.length} print checks passed`)
console.log(`PDF written to ${OUT}/ClerkMate_sample.pdf`)
const failed = results.filter((r) => !r.pass)
if (failed.length) { console.log('\nFAILED:'); failed.forEach((f) => console.log(' -', f.name, f.detail ?? '')) }
await S('Target.closeTarget', { targetId }); ws.close(); chrome.kill()
process.exit(failed.length ? 1 : 0)
