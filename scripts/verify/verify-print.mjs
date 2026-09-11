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
try { execSync(`lsof -ti tcp:${PORT} | while read p; do kill -9 $p; done`) } catch {}
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

console.log('\nwhat the printer sees before the image is sanitized')
// The demo case ships a deliberately un-redacted lab slip, so at this point the
// record holds a raw attachment with a thumbnail made from the untouched file.
// That thumbnail is exactly what must not reach paper.
await go(`#/case/${cid}/review`)
const beforeSanitising = await ev(`
  // Both exports share one privacy gate; these assertions read the learning
  // report, which is where the printed thumbnails live.
  const chip = [...document.querySelectorAll('.chip')].find((c) => /Bản học tập/.test(c.textContent));
  if (chip && chip.dataset.on !== 'true') { chip.click(); await new Promise((r) => setTimeout(r, 900)); }
  const c = (await window.__cases()).find(x => x.id === ${JSON.stringify(cid)});
  const a = c.attachments[0];
  const doc = document.querySelector('article.doc');
  return {
    hasRawThumb: (a.thumbnail || '').length > 100,
    derivative: a.sanitizedBlobKey || '',
    printedThumbs: doc.querySelectorAll('.thumbgrid img').length,
    listed: /Hình ảnh đính kèm/i.test(doc.innerText),
    line: (doc.innerText.match(/.*CHƯA kiểm tra.*/) || [''])[0].trim(),
  };
`)
check('the raw attachment does have a thumbnail on the device', beforeSanitising.hasRawThumb)
check('but it has no sanitized derivative yet', beforeSanitising.derivative === '', beforeSanitising.derivative || 'none')
check('so nothing is printed for it', beforeSanitising.printedThumbs === 0, `${beforeSanitising.printedThumbs} image(s) in the printed grid`)
check('and the printed list says the image was withheld', /không được in/.test(beforeSanitising.line), beforeSanitising.line || 'no line found')

await go(`#/case/${cid}/s/attachments`)
await ev(`document.querySelector('.thumb').click(); return true`); await sleep(1200)
await ev(`window.__btn('Che thông tin trên ảnh').click(); return true`); await sleep(1400)
await ev(`window.__btn('Che dải trên').click(); return true`); await sleep(700)
await ev(`window.__btn('Áp dụng').click(); return true`); await sleep(3000)
await ev(`document.querySelector('.backdrop')?.click(); return true`); await sleep(600)
await go(`#/case/${cid}/review`)
await ev(`window.__btn('Nộp bài và khoá sửa').click(); return true`); await sleep(2200)
await go(`#/case/${cid}/review`)
// reopen and resubmit so the printed record carries resubmission metadata
await ev(`window.__btn('Mở lại để sửa').click(); return true`); await sleep(1800)
await go(`#/case/${cid}/review`)
await ev(`window.__btn('Nộp bài và khoá sửa').click(); return true`); await sleep(2200)
await go(`#/case/${cid}/review`)

console.log('\nthe department form')
// The default export is the department's own paper record. These assertions are
// about its bones; the pages themselves are compared against the scanned form
// by eye, which a DOM test cannot do.
const form = await ev(`
  const chip = [...document.querySelectorAll('.chip')].find((c) => /mẫu Bộ môn/.test(c.textContent));
  if (chip && chip.dataset.on !== 'true') { chip.click(); await new Promise((r) => setTimeout(r, 900)); }
  const pages = [...document.querySelectorAll('.department-page')];
  const t = document.body.innerText;
  return {
    pages: pages.length,
    isDefault: chip ? chip.dataset.on === 'true' : false,
    masthead: /PHÒNG KHÁM THỰC HÀNH/.test(t) && /Y HỌC GIA ĐÌNH/.test(t),
    learnerStrip: t.includes('SV/HV:') && t.includes('MSSV:'),
    vitalsHeads: [...document.querySelectorAll('.page-1 .dept-table--vitals th')].map((x) => x.textContent.trim()),
    problemRows: [...document.querySelectorAll('.page-1 table')][1]
      ? [...document.querySelectorAll('.page-1 table')][1].querySelectorAll('tbody tr').length : 0,
    examRows: document.querySelectorAll('.dept-exam .dept-exam__row').length,
    labRows: document.querySelectorAll('.page-3 table tbody tr').length,
    screeningRows: document.querySelectorAll('.page-4 table tbody tr').length,
    ticked: document.querySelectorAll('.dept-tick').length,
    appendixLabelled: /không có trong bệnh án giấy/.test(t),
  };
`)
check('the department form is what the learner exports by default', form.isDefault)
check('it is the form, four pages of it', form.pages === 4 || form.pages === 5, `${form.pages} pages`)
check('it carries the department masthead', form.masthead)
check('the learner is named without disturbing the form', form.learnerStrip)
check('the vitals row is the seven columns of the form',
  form.vitalsHeads.join('|') === 'Mạch|Huyết áp|Chiều cao|Cân nặng|BMI|Nhiệt độ|Đường huyết',
  form.vitalsHeads.join('|'))
check('every problem row of the form is present, filled or not', form.problemRows === 17, String(form.problemRows))
check('every organ system of the form is present', form.examRows >= 10, String(form.examRows))
check('the follow-up investigation table keeps its rows', form.labRows >= 14, String(form.labRows))
check('the screening schedule keeps its rows', form.screeningRows === 12, String(form.screeningRows))
check('empty cells are drawn as empty boxes rather than dropped', form.ticked >= 20, String(form.ticked))
check('anything the paper form does not have is labelled as an addition', form.appendixLabelled)

// The learning report is the other export; the checks below are about it.
await ev(`
  const chip = [...document.querySelectorAll('.chip')].find((c) => /Bản học tập/.test(c.textContent));
  chip.click(); await new Promise((r) => setTimeout(r, 900)); return true;
`)

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
    sections: [...doc.querySelectorAll('section > h2')].map((h) => h.textContent.trim()),
    subHeadings: doc.querySelectorAll('.doc__sub > h3').length,
    // Nothing about how much help the app gave may appear on a clinical record.
    appScaffolding: /Mức trợ giúp của ứng dụng|Chế độ rà soát nguy cơ|người học tự nêu|Đã hỏi và không có/.test(t),
    signedOff: /Sinh viên/.test(t) && /học viên/.test(t) && /Bác sĩ/.test(t) && /Ký và ghi rõ họ tên/.test(t),
    formTitle: /PHÒNG KHÁM THỰC HÀNH Y HỌC GIA ĐÌNH/.test(t),
    genogramSvg: !!doc.querySelector('svg') && doc.querySelectorAll('svg rect, svg circle').length > 4,
    attachmentList: /Hình ảnh đính kèm/i.test(t),
    // The attachment line must not state one privacy status and then contradict
    // it in the same sentence.
    attachmentSelfConsistent: !(/đã che thông tin định danh/i.test(t) && /CHƯA che thông tin định danh/.test(t)),
    figure: (() => {
      const img = doc.querySelector('.doc__figures img');
      if (!img) return null;
      const cs = getComputedStyle(img);
      return {
        // A blob: URL means the full sanitized derivative, not the 320px
        // list thumbnail that a data: URL would be.
        fromDerivative: img.src.startsWith('blob:'),
        natural: [img.naturalWidth, img.naturalHeight],
        rendered: [Math.round(img.getBoundingClientRect().width), Math.round(img.getBoundingClientRect().height)],
        objectFit: cs.objectFit,
        captioned: !!img.closest('figure')?.querySelector('figcaption')?.textContent?.trim(),
      };
    })(),
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
// A conventional Vietnamese chart, in Roman numerals, in the conventional
// order — not a dump of the app's twenty-one editing screens.
// The order and the wording of the department's own paper form
// (docs/reference/mau-benh-an-yhgd.pdf), not an order of this app's own making.
const FORM_ORDER = ['Hành chính', 'Lý do khám', 'Sinh hiệu', 'Bệnh sử (Redflag, SOCRATES, ICE)',
  'Các vấn đề đã và hiện có', 'Tiền sử gia đình', 'Cá nhân', 'Khám hệ cơ quan',
  'Đề nghị cận lâm sàng · Tóm tắt cận lâm sàng đã có', 'Xác định yếu tố nguy cơ',
  'Chẩn đoán (ICD-10, ICPC-2)', 'Kế hoạch quản lý', 'Toa thuốc',
  'Biện pháp duy trì sức khoẻ và tham vấn', 'Sơ đồ cây phả hệ']
// Blocks with nothing in them hide themselves, so what is asserted is the
// relative order: every block that did print must appear in the form's
// sequence, and no printed block may be one the form does not have.
const printed = content.sections.filter((x) => !/không có trong bệnh án giấy/.test(x))
const unknown = printed.filter((x) => !FORM_ORDER.includes(x) && !['Theo dõi', 'Hình ảnh đính kèm'].includes(x))
const positions = printed.filter((x) => FORM_ORDER.includes(x)).map((x) => FORM_ORDER.indexOf(x))
check('every printed block is one the paper form has', unknown.length === 0, unknown.join(', ') || 'no strays')
check('the blocks follow the order of the paper form',
  positions.every((n, i) => i === 0 || n > positions[i - 1]),
  printed.join(' | ').slice(0, 130))
check('the form title is the department heading', content.formTitle)
check('what the paper form does not have is marked as an addition',
  content.sections.some((x) => /không có trong bệnh án giấy/.test(x)),
  content.sections[content.sections.length - 1])
check('no trace of how much the app helped appears on the record', !content.appScaffolding)
check('the chart carries both signature lines from the form', content.signedOff)
check('genogram is printed as vector SVG', content.genogramSvg)
check('attachment list is printed', content.attachmentList)
check('the attachment line does not contradict its own privacy status', content.attachmentSelfConsistent)
const fig = content.figure
check('the attached image is printed at full resolution, not as a list thumbnail',
  !!fig && fig.fromDerivative && Math.max(...fig.natural) > 400,
  fig ? `${fig.natural[0]}×${fig.natural[1]}, ${fig.fromDerivative ? 'derivative' : 'thumbnail'}` : 'no image found')
// The bug this replaces: a square frame with object-fit:cover cut the head and
// the foot off a portrait lab slip, which is exactly where a slip is read.
check('the image is printed whole — proportions kept, nothing cropped', (() => {
  if (!fig) return false
  const wanted = fig.natural[0] / fig.natural[1]
  const got = fig.rendered[0] / fig.rendered[1]
  return fig.objectFit !== 'cover' && Math.abs(wanted - got) / wanted < 0.02
})(), fig ? `natural ${fig.natural.join('×')} → rendered ${fig.rendered.join('×')} (${fig.objectFit})` : '')
check('each printed image is captioned', !!fig && fig.captioned)
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
