/**
 * Targeted checks for local learner profiles: creation, switching, ownership,
 * and above all the migration of a device that already holds cases.
 */
import { spawn, execSync } from 'node:child_process'
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
const PORT = 9395, BASE = 'http://localhost:4191/clerkmate-yhgd/'
const PROFILE = `/tmp/clerkmate-prof-${process.pid}`
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const results = []
const check = (n, pass, d) => { results.push({ n, pass }); console.log(`  ${pass ? '✓' : '✗'} ${n}${d ? ' — ' + d : ''}`) }
try { execSync(`pkill -f "clerkmate-prof-" || true`) } catch {}
execSync(`rm -rf ${PROFILE}`)
process.on('exit', () => { try { execSync(`rm -rf ${PROFILE}`) } catch {} })
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
const send = (m, p = {}, sid) => new Promise((res, rej) => { const mid = ++id; pending.set(mid, { res, rej })
  ws.send(JSON.stringify({ id: mid, method: m, params: p, ...(sid ? { sessionId: sid } : {}) })) })
const { targetId } = await send('Target.createTarget', { url: 'about:blank' })
const { sessionId } = await send('Target.attachToTarget', { targetId, flatten: true })
const S = (m, p) => send(m, p, sessionId)
await S('Page.enable'); await S('Runtime.enable')
await S('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 2, mobile: true })
const ev = async (x) => { const r = await S('Runtime.evaluate', { expression: `(async () => { ${x} })()`, awaitPromise: true, returnByValue: true })
  if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description || r.exceptionDetails.text); return r.result.value }
const H = `window.__btn=(re)=>[...document.querySelectorAll('button, label')].find(b=>new RegExp(re).test(b.textContent));
  window.__set=(el,v)=>{Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(el,v);el.dispatchEvent(new Event('input',{bubbles:true}))};
  window.__db=()=>new Promise(r=>{const q=indexedDB.open('clerkmate');q.onsuccess=()=>r(q.result)});
  window.__cases=async()=>{const db=await window.__db();return new Promise(r=>{const t=db.transaction('cases').objectStore('cases').getAll();t.onsuccess=()=>r(t.result)})};
  window.__meta=async(k)=>{const db=await window.__db();return new Promise(r=>{const t=db.transaction('meta').objectStore('meta').get(k);t.onsuccess=()=>r(t.result)})};
  true;`
const go = async (h, w = 1400) => { await ev(`window.location.hash=${JSON.stringify(h)}; return true`); await sleep(w); await ev(H + ' return true') }

// ---------------------------------------------------- D. migration of old data
console.log('\nmigration of a device that already has cases')
await S('Page.navigate', { url: BASE }); await sleep(3000); await ev(H + ' return true')
// Plant the shape a previous version left behind: one profile at the old key,
// two cases with no owner at all.
await ev(`
  const db = await window.__db();
  await new Promise(r => { const t = db.transaction('meta','readwrite');
    t.objectStore('meta').put({ fullName:'Cũ', studentId:'OLD01', level:'Y5', classGroup:'', recallFirst:true,
      levelHistory:[], createdAt:'2026-01-01T00:00:00.000Z', updatedAt:'2026-01-01T00:00:00.000Z' }, 'learnerProfile');
    t.oncomplete = r });
  await new Promise(r => { const t = db.transaction('cases','readwrite'); const s = t.objectStore('cases');
    s.put({ id:'case_legacy_1', schemaVersion:1, createdAt:'2026-01-02T00:00:00.000Z', updatedAt:'2026-01-02T00:00:00.000Z',
      learnerLevel:'Y5', patient:{ name:'Ca cũ 1' }, attachments:[] });
    s.put({ id:'case_legacy_2', schemaVersion:1, createdAt:'2026-01-03T00:00:00.000Z', updatedAt:'2026-01-03T00:00:00.000Z',
      learnerLevel:'Y5', patient:{ name:'Ca cũ 2' }, attachments:[] });
    t.oncomplete = r });
  return true;
`)
await S('Page.reload'); await sleep(3200); await ev(H + ' return true')
const after = await ev(`
  const rows = await window.__cases();
  return { profiles: await window.__meta('learnerProfiles'), active: await window.__meta('activeProfileId'),
           owners: rows.map(r => r.ownerProfileId), ids: rows.map(r => r.id).sort(),
           listed: document.querySelectorAll('.list__item').length };
`)
check('the old single profile becomes the first profile in the list',
  Array.isArray(after.profiles) && after.profiles.length === 1 && after.profiles[0].studentId === 'OLD01')
check('it is made the active profile', !!after.active && after.active === after.profiles[0].id)
check('every existing case keeps its id', after.ids.join(',') === 'case_legacy_1,case_legacy_2', after.ids.join(','))
check('every existing case is adopted, none orphaned',
  after.owners.length === 2 && after.owners.every((o) => o === after.active), JSON.stringify(after.owners))
check('the adopted cases are still listed on the home screen', after.listed >= 2, String(after.listed))

// idempotence: running again must change nothing
const before = JSON.stringify(after.owners)
await S('Page.reload'); await sleep(3000); await ev(H + ' return true')
const again = await ev(`const rows = await window.__cases();
  return { owners: rows.map(r => r.ownerProfileId), profiles: (await window.__meta('learnerProfiles')).length };`)
check('running the migration again changes nothing',
  JSON.stringify(again.owners) === before && again.profiles === 1)

// ------------------------------------------------- A/B/C. add, switch, filter
console.log('\nadding and switching local profiles')
await go('#/')
await ev(`window.__btn('Đổi hồ sơ người học').click(); return true`); await sleep(900)
await ev(`window.__btn('Thêm hồ sơ người học').click(); return true`); await sleep(900)
await ev(`
  const i = [...document.querySelectorAll('.sheet input')];
  window.__set(i[0], 'Người thứ hai'); window.__set(i[1], 'NEW02');
  await new Promise(r => setTimeout(r, 400));
  [...document.querySelectorAll('.sheet .chip')].find(c => c.textContent.trim() === 'Y6')?.click();
  await new Promise(r => setTimeout(r, 300));
  window.__btn('^Tạo hồ sơ$').click(); return true;
`)
await sleep(1600); await ev(H + ' return true')
const two = await ev(`
  const profiles = await window.__meta('learnerProfiles');
  const activeId = await window.__meta('activeProfileId');
  return { profiles: profiles.map(p => p.studentId),
           active: profiles.find(p => p.id === activeId)?.studentId,
           listed: document.querySelectorAll('.list__item').length };
`)
check('a second profile can be added on the same device',
  two.profiles.length === 2 && two.profiles.includes('NEW02'), two.profiles.join(','))
check('the new profile becomes the active one', two.active === 'NEW02', two.active)
check('it starts with an empty case list, not somebody elses records', two.listed === 0, String(two.listed))

await ev(`window.__btn('Đổi hồ sơ người học').click(); return true`); await sleep(1000)
await ev(`[...document.querySelectorAll('.sheet .list__item')].find(b => /OLD01/.test(b.textContent)).click(); return true`)
await sleep(1600); await ev(H + ' return true')
const back = await ev(`
  const rows = await window.__cases();
  const profiles = await window.__meta('learnerProfiles');
  const activeId = await window.__meta('activeProfileId');
  return { listed: document.querySelectorAll('.list__item').length, total: rows.length,
           active: profiles.find(p => p.id === activeId)?.studentId };
`)
check('switching back shows that profiles cases again', back.listed >= 2 && back.active === 'OLD01',
  `${back.listed} listed, active ${back.active}`)
check('switching deleted nobodys data', back.total === 2, `${back.total} cases still stored`)

// ------------------------------------------- E/F. default level vs case level
console.log('\nchanging the default level')
await go('#/settings')
const levelChange = await ev(`
  const chip = [...document.querySelectorAll('.chip')].find(c => c.textContent.trim() === 'SDH');
  chip.click(); await new Promise(r => setTimeout(r, 700));
  const asked = /Đổi mức mặc định sang/.test(document.body.innerText);
  const before = (await window.__cases()).map(c => c.learnerLevel);
  window.__btn('^Đổi sang SDH$').click(); await new Promise(r => setTimeout(r, 1200));
  const after = (await window.__cases()).map(c => c.learnerLevel);
  const prof = (await window.__meta('learnerProfiles')).find(p => p.studentId === 'OLD01');
  return { asked, before, after, level: prof.level };
`)
check('changing the default level asks for confirmation first', levelChange.asked)
check('the profile default does change', levelChange.level === 'SDH', levelChange.level)
check('existing cases keep the level they were written at',
  JSON.stringify(levelChange.before) === JSON.stringify(levelChange.after),
  `${levelChange.before} → ${levelChange.after}`)

const failed = results.filter((r) => !r.pass)
console.log(`\n${results.length - failed.length}/${results.length} profile checks passed`)
if (failed.length) console.log('FAILED:\n' + failed.map((f) => ' - ' + f.n).join('\n'))
ws.close(); try { chrome.kill() } catch {}
process.exit(failed.length ? 1 : 0)
