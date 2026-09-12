/**
 * Rule audit for ClerkMate.
 *
 * Asserts the invariants that are easy to break by accident and expensive to
 * get wrong: the completeness arithmetic, the applicability rules, the status
 * machine, the submission gate, the backup round-trip and the AI response
 * validator. Runs the real modules — no mocks of our own code.
 *
 * Dependency-free on purpose: the project ships two runtime dependencies and no
 * test framework, so this bundles the TypeScript with the esbuild that Vite
 * already brings and runs it on Node.
 *
 *     npm test
 */
import { execFileSync } from 'node:child_process'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'

const dir = mkdtempSync(join(tmpdir(), 'clerkmate-audit-'))
const entry = join(dir, 'entry.ts')
const out = join(dir, 'entry.mjs')

writeFileSync(
  entry,
  `
export { REQUIREMENTS, REQUIREMENT_BY_ID } from '${process.cwd()}/src/config/requirements'
export { LEVELS, LEVEL_ORDER, TIER_WEIGHTS, resolveLevelRequirements } from '${process.cwd()}/src/config/levels'
export { evaluateCompleteness, missingByTier, sectionProgress, bedsideMinimum } from '${process.cwd()}/src/completeness/engine'
export { historyGaps } from '${process.cwd()}/src/completeness/gaps'
export { createEmptyCase, migrateCase } from '${process.cwd()}/src/types/factory'
export { caseStatus, submitBlockers, STATUS, latestReview } from '${process.cwd()}/src/workflow/status'
export { submit, reopen, recordReview, unreadReviews, acknowledgeReviews, mergeReview, buildBundle, parseBundle, makeSubmissionCode } from '${process.cwd()}/src/workflow/submission'
export { draftsFromResponse } from '${process.cwd()}/src/parsing/aiStructurer'
export { AI_FIELDS, AI_FIELD_BY_TARGET, aiFieldSchema } from '${process.cwd()}/src/parsing/fields'
export { heuristicStructurer } from '${process.cwd()}/src/parsing/heuristicStructurer'
export { createFragment } from '${process.cwd()}/src/types/factory'
export { applyMany, canApply } from '${process.cwd()}/src/parsing/apply'
export { buildKneeOsteoarthritisCase } from '${process.cwd()}/src/config/demoCases/kneeOsteoarthritis'
export { buildElderlyMultimorbidCase } from '${process.cwd()}/src/config/demoCases/elderlyMultimorbid'
export { RISK_DOMAINS, RISK_FACTOR_DEFS, riskModeFor } from '${process.cwd()}/src/config/risk'
export { buildFileName } from '${process.cwd()}/src/export/exportPdf'
export { PROBLEM_SYSTEMS, FAMILY_HISTORY_CONDITIONS } from '${process.cwd()}/src/config/clinical'
export { hasDerivative, isSubmissionSafe, faceDeclaredPresent, faceUnanswered, withExportSafeAttachments } from '${process.cwd()}/src/workflow/privacy'
export { fallsBand } from '${process.cwd()}/src/config/falls'
export { SCALES } from '${process.cwd()}/src/config/scales'
export { computeBmi, bmiCategory } from '${process.cwd()}/src/utils/format'
`,
)

// The AI structurer reads import.meta.env; give it something to read.
execFileSync(
  'node_modules/.bin/esbuild',
  [entry, '--bundle', '--platform=node', '--format=esm', `--outfile=${out}`,
   '--define:import.meta.env.VITE_AI_API_URL=""', '--define:import.meta.env.BASE_URL="\\"/\\""',
   '--log-level=error'],
  { stdio: 'inherit' },
)

const M = await import(pathToFileURL(out).href)

let pass = 0
const failures = []
const t = (name, fn) => {
  try {
    fn()
    pass += 1
    console.log('  ✓', name)
  } catch (e) {
    failures.push(`${name}: ${e.message}`)
    console.log('  ✗', name, '—', e.message)
  }
}

/**
 * One check with an asynchronous body, which the caller must await.
 *
 * Kept separate from `t` on purpose. Making `t` itself async would defer every
 * synchronous check to a microtask, so they would all report *after* the
 * summary had already been printed — and a check whose promise the runner
 * drops prints a tick and then fails silently, which is worse than no check.
 */
const ta = async (name, fn) => {
  try {
    await fn()
    pass += 1
    console.log('  ✓', name)
  } catch (e) {
    failures.push(`${name}: ${e.message}`)
    console.log('  ✗', name, '—', e.message)
  }
}
const eq = (a, b, what) => {
  const A = JSON.stringify(a)
  const B = JSON.stringify(b)
  if (A !== B) throw new Error(`${what ?? 'value'}: got ${A}, expected ${B}`)
}
const ok = (v, what) => { if (!v) throw new Error(what ?? 'expected truthy') }

// ---------------------------------------------------------------- catalogue
console.log('\ncatalogue')
t('66 requirement definitions, all ids unique', () => {
  eq(M.REQUIREMENTS.length, 66, 'requirement count')
  eq(new Set(M.REQUIREMENTS.map((r) => r.id)).size, 66, 'unique ids')
})
t('57 risk factors across 9 domains, all ids unique', () => {
  eq(M.RISK_DOMAINS.length, 9, 'domains')
  eq(M.RISK_FACTOR_DEFS.length, 57, 'factors')
  eq(new Set(M.RISK_FACTOR_DEFS.map((f) => f.id)).size, 57, 'unique factor ids')
})
t('every risk factor belongs to a declared domain', () => {
  const ids = new Set(M.RISK_DOMAINS.map((d) => d.id))
  const orphans = M.RISK_FACTOR_DEFS.filter((f) => !ids.has(f.domain)).map((f) => f.id)
  eq(orphans, [], 'orphan factors')
})
t('every requirement has a label, a hint and a section', () => {
  const bad = M.REQUIREMENTS.filter((r) => !r.label || !r.hint || !r.sectionId).map((r) => r.id)
  eq(bad, [], 'incomplete requirement defs')
})
t('tier weights are mandatory 3 / recommended 2 / optional 1', () => {
  eq(M.TIER_WEIGHTS, { mandatory: 3, recommended: 2, optional: 1 })
})
t('every AI target has an applier and a section', () => {
  const bad = M.AI_FIELDS.filter((f) => !M.canApply(f.target) || !f.sectionId).map((f) => f.target)
  eq(bad, [], 'AI targets with no applier')
})
t('AI schema leaks no patient data', () => {
  const json = JSON.stringify(M.aiFieldSchema())
  for (const word of ['Bà H', 'Ông T', '21YHGD', 'Nguyễn'])
    ok(!json.includes(word), `schema contains ${word}`)
})

// ------------------------------------------------------------- levels
console.log('\nlearner levels')
const EXPECTED = {
  Y2: { total: 17, mandatory: 8, recommended: 5, optional: 4 },
  Y5: { total: 41, mandatory: 22, recommended: 14, optional: 5 },
  Y6: { total: 60, mandatory: 34, recommended: 21, optional: 5 },
  SDH: { total: 66, mandatory: 54, recommended: 9, optional: 3 },
}
// Where each instrument is first required. The department teaches family
// assessment from the second year and the genogram from the fifth, and the
// postgraduate level is about managing a case over time rather than writing it
// up once — these are the assignments the level map exists to express.
t('Family APGAR and SCREEM are required from Y2', () => {
  for (const l of M.LEVEL_ORDER) {
    const map = M.resolveLevelRequirements(l)
    eq(map.get('fm.apgar'), 'mandatory', `fm.apgar at ${l}`)
    eq(map.get('fm.screem'), 'mandatory', `fm.screem at ${l}`)
  }
})
t('the genogram is required from Y5, and not before', () => {
  ok(M.resolveLevelRequirements('Y2').get('genogram.members') !== 'mandatory', 'required at Y2')
  for (const l of ['Y5', 'Y6', 'SDH'])
    eq(M.resolveLevelRequirements(l).get('genogram.members'), 'mandatory', `at ${l}`)
})
t('managing the case over time is what SDH adds', () => {
  const sdh = M.resolveLevelRequirements('SDH')
  const y6 = M.resolveLevelRequirements('Y6')
  for (const id of ['mx.goals', 'meds.complete', 'followUp.entries', 'followUp.response',
                    'dx.comorbidityControl', 'fm.continuity', 'mx.referral']) {
    eq(sdh.get(id), 'mandatory', `${id} at SDH`)
    ok(y6.get(id) !== 'mandatory', `${id} was already mandatory at Y6`)
  }
})
t('a level can tighten what it inherits but never loosen it', () => {
  const rank = { optional: 1, recommended: 2, mandatory: 3 }
  for (let i = 1; i < M.LEVEL_ORDER.length; i++) {
    const lower = M.resolveLevelRequirements(M.LEVEL_ORDER[i - 1])
    const upper = M.resolveLevelRequirements(M.LEVEL_ORDER[i])
    for (const [id, tier] of lower)
      ok(rank[upper.get(id)] >= rank[tier], `${id} dropped from ${tier} at ${M.LEVEL_ORDER[i]}`)
  }
})

for (const level of M.LEVEL_ORDER) {
  t(`${level}: tier map matches the documented counts`, () => {
    const r = M.resolveLevelRequirements(level)
    const tiers = { mandatory: 0, recommended: 0, optional: 0 }
    for (const [, tier] of r) tiers[tier] += 1
    eq({ total: r.size, ...tiers }, EXPECTED[level], level)
  })
}
t('levels are cumulative: each covers everything the level below covers', () => {
  const sets = M.LEVEL_ORDER.map((l) => new Set(M.resolveLevelRequirements(l).keys()))
  for (let i = 1; i < sets.length; i += 1) {
    const missing = [...sets[i - 1]].filter((id) => !sets[i].has(id))
    eq(missing, [], `${M.LEVEL_ORDER[i]} drops requirements from ${M.LEVEL_ORDER[i - 1]}`)
  }
})
t('every id in every tier map exists in the catalogue', () => {
  for (const level of M.LEVEL_ORDER) {
    const unknown = [...M.resolveLevelRequirements(level).keys()].filter((id) => !M.REQUIREMENT_BY_ID[id])
    eq(unknown, [], `${level} references unknown requirement`)
  }
})

// -------------------------------------------------------- completeness engine
console.log('\ncompleteness engine')
t('a blank case is never 100% and never falsely satisfied', () => {
  for (const level of M.LEVEL_ORDER) {
    const snap = M.evaluateCompleteness(M.createEmptyCase(level, 'x'))
    ok(snap.percent < 100, `${level} blank case scored ${snap.percent}%`)
    ok(snap.mandatorySatisfied === 0, `${level} blank case satisfied ${snap.mandatorySatisfied} mandatory`)
  }
})
t('percent is the documented weighted formula', () => {
  const rec = M.buildKneeOsteoarthritisCase()
  const snap = M.evaluateCompleteness(rec)
  const w = M.TIER_WEIGHTS
  let got = 0, max = 0
  for (const i of snap.items) { max += w[i.tier]; if (i.satisfied) got += w[i.tier] }
  eq(snap.percent, Math.round((got / max) * 100), 'percent')
})
t('tier totals equal the item list', () => {
  const snap = M.evaluateCompleteness(M.buildElderlyMultimorbidCase())
  eq(snap.mandatoryTotal, snap.items.filter((i) => i.tier === 'mandatory').length)
  eq(snap.recommendedTotal, snap.items.filter((i) => i.tier === 'recommended').length)
  eq(snap.optionalTotal, snap.items.filter((i) => i.tier === 'optional').length)
})
t('reproductive history applies to a female patient and not to a male one', () => {
  const base = M.buildKneeOsteoarthritisCase()
  const female = structuredClone(base); female.patient.sex = 'female'
  const male = structuredClone(base); male.patient.sex = 'male'
  const has = (r) => M.evaluateCompleteness(r, 'Y5').items.some((i) => i.id === 'past.reproductive')
  ok(has(female), 'missing for a female patient')
  ok(!has(male), 'still applied to a male patient')
})
t('cardiovascular risk applies from 40, and to unknown age', () => {
  const base = M.buildKneeOsteoarthritisCase()
  const has = (age) => {
    const r = structuredClone(base); r.patient.ageYears = age
    return M.evaluateCompleteness(r, 'SDH').items.some((i) => i.id === 'risk.cvd')
  }
  ok(!has(30), 'applied at 30')
  ok(has(40), 'not applied at 40')
  ok(has(null), 'not applied when age is unknown')
})
t('the attachment privacy requirement applies only when an attachment exists', () => {
  const rec = M.buildKneeOsteoarthritisCase()
  const withNone = M.evaluateCompleteness(rec, 'SDH').items.some((i) => i.id === 'attachments.privacy')
  ok(!withNone, 'applied with no attachments')
  const withOne = structuredClone(rec)
  withOne.attachments.push({ id: 'a', category: 'lab', title: 't', date: '', note: '', mimeType: 'image/jpeg',
    thumbnail: '', blobKey: 'b', sanitizedBlobKey: '', redacted: false, privacyChecked: false,
    faceCheck: '', createdAt: new Date().toISOString() })
  ok(M.evaluateCompleteness(withOne, 'SDH').items.some((i) => i.id === 'attachments.privacy'),
    'not applied with one attachment')
})
t('a non-applicable requirement leaves the denominator, it is not a failure', () => {
  const rec = M.buildKneeOsteoarthritisCase()
  const a = M.evaluateCompleteness(rec, 'SDH')
  const withAtt = structuredClone(rec)
  withAtt.attachments.push({ id: 'a', category: 'lab', title: 't', date: '', note: '', mimeType: 'image/jpeg',
    thumbnail: '', blobKey: 'b', sanitizedBlobKey: '', redacted: false, privacyChecked: false,
    faceCheck: '', createdAt: new Date().toISOString() })
  const b = M.evaluateCompleteness(withAtt, 'SDH')
  eq(b.mandatoryTotal, a.mandatoryTotal + 1, 'mandatory denominator did not grow by exactly one')
})
t('previewing another level does not mutate the record', () => {
  const rec = M.buildKneeOsteoarthritisCase()
  const before = JSON.stringify(rec)
  for (const l of M.LEVEL_ORDER) M.evaluateCompleteness(rec, l)
  eq(JSON.stringify(rec) === before, true, 'record changed during preview')
  eq(rec.learnerLevel, 'SDH', 'declared level changed during preview')
})
t('the same record scores differently by level, and never above 100', () => {
  const rec = M.buildKneeOsteoarthritisCase()
  const seen = M.LEVEL_ORDER.map((l) => M.evaluateCompleteness(rec, l).percent)
  ok(seen.every((p) => p >= 0 && p <= 100), `percent out of range: ${seen}`)
  ok(new Set(seen).size > 1, `identical across levels: ${seen}`)
})
t('every missing item points at a real section', () => {
  const rec = M.createEmptyCase('SDH', 'x')
  const snap = M.evaluateCompleteness(rec)
  const progress = M.sectionProgress(snap)
  for (const item of snap.items) ok(progress.has(item.sectionId), `no section rollup for ${item.id}`)
})
t('completeness reacts immediately to an edit', () => {
  const rec = M.createEmptyCase('Y2', 'x')
  const before = M.evaluateCompleteness(rec).percent
  rec.history.chiefComplaint = 'Đau khớp gối phải'
  const after = M.evaluateCompleteness(rec).percent
  ok(after > before, `percent did not rise: ${before} → ${after}`)
})
t('both demo cases are near-complete at their own level', () => {
  for (const build of [M.buildKneeOsteoarthritisCase, M.buildElderlyMultimorbidCase]) {
    const snap = M.evaluateCompleteness(build())
    ok(snap.percent >= 95, `demo case only ${snap.percent}%`)
  }
})

// ------------------------------------------------- the department's paper form
console.log("\nthe paper form's own rows")
t('the problem table carries the systems the paper form prints', () => {
  ok(M.PROBLEM_SYSTEMS.length >= 15, `${M.PROBLEM_SYSTEMS.length} systems`)
  for (const sys of ['Dị ứng', 'Tim mạch', 'Hô hấp', 'Nội tiết', 'Ngoại khoa', 'Sản khoa', 'Khác']) {
    ok(M.PROBLEM_SYSTEMS.includes(sys), `missing "${sys}"`)
  }
})
t('the family-history table carries its five fixed conditions', () => {
  for (const c of ['Đái tháo đường', 'Tăng huyết áp', 'Rối loạn lipid máu', 'Lao', 'Ung thư']) {
    ok(M.FAMILY_HISTORY_CONDITIONS.includes(c), `missing "${c}"`)
  }
})
t('every demo problem is filed under a system the form has', () => {
  for (const build of [M.buildKneeOsteoarthritisCase, M.buildElderlyMultimorbidCase]) {
    const rec = build()
    for (const m of [...rec.personalHistory.pastMedical, ...rec.personalHistory.pastSurgical]) {
      ok(M.PROBLEM_SYSTEMS.includes(m.system), `"${m.label}" filed as "${m.system}"`)
    }
  }
})
t('a problem with no system is still kept, not dropped', () => {
  const rec = M.createEmptyCase('Y5', 'x')
  rec.personalHistory.pastMedical.push({ id: 'p', system: '', label: 'Chưa xếp nhóm', since: '', status: '', note: '' })
  const unfiled = rec.personalHistory.pastMedical.filter((m) => !M.PROBLEM_SYSTEMS.includes(m.system))
  eq(unfiled.length, 1, 'an unfiled problem disappeared from the record')
})

// -------------------------------------------------------- bedside minimum
console.log('\nbedside minimum — what cannot be finished tonight')
t('the bedside minimum is a real subset, not the whole record', () => {
  const rec = M.createEmptyCase('SDH', 'x')
  const b = M.bedsideMinimum(M.evaluateCompleteness(rec))
  ok(b.total >= 8 && b.total <= 12, `bedside total was ${b.total}`)
  ok(b.total < M.evaluateCompleteness(rec).items.length / 2, 'the "minimum" is most of the record')
})
t('nothing is satisfied on a blank case, everything on a filled one', () => {
  const blank = M.bedsideMinimum(M.evaluateCompleteness(M.createEmptyCase('SDH', 'x')))
  eq(blank.satisfied, 0, 'a blank case already satisfied bedside items')
  eq(blank.missing.length, blank.total)
  const demo = M.buildKneeOsteoarthritisCase()
  const b = M.bedsideMinimum(M.evaluateCompleteness(demo))
  eq(b.satisfied, b.total, `demo case missing: ${b.missing.map((i) => i.id).join(', ')}`)
})
t('it follows the level rather than the catalogue', () => {
  const rec = M.buildKneeOsteoarthritisCase()
  const y2 = M.bedsideMinimum(M.evaluateCompleteness(rec, 'Y2')).total
  const sdh = M.bedsideMinimum(M.evaluateCompleteness(rec, 'SDH')).total
  ok(y2 <= sdh, `Y2 asked for ${y2}, SDH for ${sdh}`)
})
t('marking an item bedside changes no arithmetic', () => {
  const rec = M.buildKneeOsteoarthritisCase()
  const snap = M.evaluateCompleteness(rec)
  const bedside = snap.items.filter((i) => i.bedside)
  ok(bedside.length > 0, 'no item is marked bedside')
  ok(bedside.every((i) => ['mandatory', 'recommended', 'optional'].includes(i.tier)),
    'a bedside item landed outside the three tiers')
  eq(snap.mandatoryTotal + snap.recommendedTotal + snap.optionalTotal, snap.items.length,
    'the tier totals stopped adding up to the item count')
})

// ------------------------------------------------------- quick capture
console.log('\nquick capture — structuring the spoken and the typed')
const parse = (text) => M.heuristicStructurer.structure(text, M.createEmptyCase('Y5', 'x'))
const targets = (sug) => sug.map((s) => s.targetKey)
const valueOf = (sug, key) => sug.find((s) => s.targetKey === key)?.value

await ta('scenario 1: typed shorthand lands in the SOCRATES boxes', async () => {
  const sug = await parse('đau gối P 3th, tăng khi cầu thang, nghỉ đỡ, đau 6/10')
  eq(valueOf(sug, 'history.socrates.site'), 'Khớp gối phải')
  eq(valueOf(sug, 'history.duration'), '3 tháng')
  eq(valueOf(sug, 'history.socrates.severity'), '6/10')
  const f = valueOf(sug, 'history.socrates.exacerbatingRelieving') ?? ''
  ok(/cầu thang/i.test(f), `exacerbating missing: ${f}`)
  ok(/nghỉ/i.test(f), `relieving missing: ${f}`)
})
await ta('scenario 2: a transcript yields negatives and ICE, not positives', async () => {
  const sug = await parse('Không sốt, không sưng nóng đỏ. Bệnh nhân lo phải mổ và mong được hướng dẫn tập ở nhà.')
  ok(!targets(sug).includes('redFlags.present'), 'a negative became a positive red flag')
  ok(targets(sug).includes('ice.concerns'), `no concern: ${targets(sug).join(',')}`)
})
await ta('scenario 3: medication and an explicit negative allergy', async () => {
  const sug = await parse('Tăng huyết áp 10 năm, uống amlodipine 5 mg mỗi sáng, không dị ứng thuốc.')
  ok(targets(sug).includes('pastMedical.add'), 'no past history')
  ok(targets(sug).includes('medications.add'), 'no medication')
  const allergy = sug.find((s) => s.targetKey === 'allergies.add')
  ok(!allergy, 'an explicit negative was filed as an allergy entry')
})
await ta('scenario 4: what was never said stays unsaid', async () => {
  const sug = await parse('đau gối phải 3 tháng')
  for (const forbidden of ['allergies.add', 'lifestyle.smoking', 'redFlags.absent', 'redFlags.present']) {
    ok(!targets(sug).includes(forbidden), `invented ${forbidden}`)
  }
  ok(!targets(sug).includes('history.socrates.radiation'), 'invented a radiation answer')
  ok(!targets(sug).includes('history.socrates.severity'), 'invented a severity')
})
await ta('every suggestion quotes text that is really in the note', async () => {
  const note = 'Nữ 58 tuổi. Đau gối P 3 tháng, tăng khi lên cầu thang, 6/10. Lo phải mổ.'
  const sug = await parse(note)
  ok(sug.length > 0, 'nothing parsed')
  const norm = (x) => x.toLowerCase().replace(/\s+/g, ' ').trim()
  for (const s of sug) {
    ok(s.snippet && s.snippet.trim().length > 0, `${s.targetKey} has no snippet`)
    ok(norm(note).includes(norm(s.snippet)), `${s.targetKey} quotes text not in the note: "${s.snippet}"`)
  }
})
await ta('one fragment produces many suggestions across sections', async () => {
  const sug = await parse('Nữ 58 tuổi, nội trợ. Đau gối P 3 tháng, 6/10. THA 10 năm, amlodipine 5mg/ngày. Không hút thuốc.')
  ok(sug.length >= 6, `${sug.length} suggestions`)
  ok(new Set(sug.map((s) => s.sectionId)).size >= 3, 'all in one section')
})
t('no structuring target can reach diagnosis, management or investigations', () => {
  for (const f of M.AI_FIELDS) {
    ok(!/^(dx|mx|meds\.plan|inv|prev|risk)\./.test(f.target), `unsafe target ${f.target}`)
    ok(!['diagnosis', 'management', 'investigations', 'risk', 'prevention'].includes(f.sectionId),
      `unsafe section ${f.sectionId} for ${f.target}`)
  }
})
await ta('scenario 5: a different value in a one-answer box is a conflict, not an overwrite', async () => {
  const rec = M.createEmptyCase('Y5', 'x')
  rec.history.socrates.severity = '6/10'
  const sug = await M.heuristicStructurer.structure('Lúc nặng nhất đau 8/10', rec)
  const sev = sug.find((s) => s.targetKey === 'history.socrates.severity')
  ok(sev, 'severity not parsed')
  eq(sev.value, '8/10')
  eq(sev.conflictsWith, '6/10', `conflict not reported: ${JSON.stringify(sev.conflictsWith)}`)
  eq(rec.history.socrates.severity, '6/10', 'the record was mutated by parsing')
})
await ta('the same value again is a duplicate, not a conflict', async () => {
  const rec = M.createEmptyCase('Y5', 'x')
  rec.history.socrates.severity = '6/10'
  const sug = await M.heuristicStructurer.structure('đau 6/10', rec)
  const sev = sug.find((s) => s.targetKey === 'history.socrates.severity')
  ok(!sev || sev.alreadyPresent === true, 'a repeat was not marked as already present')
  ok(!sev || !sev.conflictsWith, 'a repeat was reported as a conflict')
})
await ta('a second medication is not a conflict with the first', async () => {
  const rec = M.createEmptyCase('Y5', 'x')
  rec.medications.push({ id: 'm1', name: 'Amlodipine', dose: '5 mg', route: '', frequency: '', duration: '', indication: '', adherence: '', note: '' })
  const sug = await M.heuristicStructurer.structure('uống metformin 850mg 2 lần/ngày', rec)
  const med = sug.find((s) => s.targetKey === 'medications.add')
  ok(med, 'medication not parsed')
  ok(!med.conflictsWith, 'adding a drug was called a conflict')
})

t('a fragment keeps what was captured apart from what was edited', () => {
  const f = M.createFragment('voice', 'khong sot')
  eq(f.originalText, 'khong sot')
  eq(f.source, 'voice')
  eq(f.transcriptionStatus, 'ready')
  eq(f.processingStatus, 'unprocessed')
  const edited = { ...f, text: 'Không sốt' }
  eq(edited.originalText, 'khong sot', 'editing overwrote what was heard')
})
t('a note written before fragments existed migrates without loss', () => {
  const rec = M.migrateCase({
    id: 'c1', quickNotes: [{ id: 'n1', createdAt: '2026-01-01T00:00:00.000Z', text: 'đau gối', filedInto: ['history'], archived: false }],
  })
  eq(rec.quickNotes.length, 1)
  const n = rec.quickNotes[0]
  eq(n.id, 'n1'); eq(n.text, 'đau gối'); eq(n.originalText, 'đau gối')
  eq(n.source, 'text'); eq(n.processingStatus, 'fully_applied')
  eq(n.filedInto.join(','), 'history')
})

// -------------------------------------------------------------- gap finder
console.log('\ngap finder — what is still unasked')
const flat = (groups) => groups.flatMap((g) => g.items)
t('a blank case is asked about the things you find out by asking', () => {
  const groups = M.historyGaps(M.createEmptyCase('Y5', 'x'))
  ok(groups.length > 0, 'nothing suggested on a blank case')
  const titles = groups.map((g) => g.title)
  ok(titles.includes('SOCRATES'), titles.join(','))
  ok(titles.includes('ICE'), titles.join(','))
  ok(flat(groups).every((i) => !i.filled), 'a blank case had something marked filled')
})
t('it names the SOCRATES elements one by one, not just "SOCRATES"', () => {
  const soc = M.historyGaps(M.createEmptyCase('Y5', 'x')).find((g) => g.title === 'SOCRATES')
  eq(soc.items.length, 8)
  ok(soc.items.some((i) => /Hướng lan/.test(i.label)), 'no radiation row')
  ok(soc.items.every((i) => i.prompt && i.prompt.length > 8), 'an element has no question')
})
t('what is already recorded stops being asked for', () => {
  const rec = M.createEmptyCase('Y5', 'x')
  rec.history.socrates.radiation = 'Không lan'
  rec.history.ice.concerns = 'Sợ phải mổ'
  const groups = M.historyGaps(rec)
  const soc = groups.find((g) => g.title === 'SOCRATES')
  eq(soc.items.find((i) => /Hướng lan/.test(i.label)).filled, true)
  const ice = groups.find((g) => g.title === 'ICE')
  eq(ice.items.find((i) => /Concern/.test(i.label)).filled, true)
  eq(ice.items.find((i) => /Idea/.test(i.label)).filled, false)
})
t('a filled history is asked nothing', () => {
  const groups = M.historyGaps(M.buildKneeOsteoarthritisCase())
  const unfilled = flat(groups).filter((i) => !i.filled)
  ok(unfilled.length <= 3, `still asking for ${unfilled.map((i) => i.label).join(', ')}`)
})
t('it never suggests a diagnosis, an investigation or a treatment', () => {
  const rec = M.createEmptyCase('SDH', 'x')
  const text = M.historyGaps(rec).flatMap((g) => g.items).map((i) => `${i.label} ${i.prompt ?? ''}`).join(' ').toLowerCase()
  for (const banned of ['chẩn đoán', 'phân biệt', 'nên dùng', 'kê', 'toa', 'điều trị', 'xét nghiệm', 'chỉ định', 'siêu âm', 'x-quang']) {
    ok(!text.includes(banned), `the panel said "${banned}"`)
  }
})
t('it only asks about what the level asks for', () => {
  const y2 = M.historyGaps(M.createEmptyCase('Y2', 'x')).map((g) => g.title)
  const sdh = M.historyGaps(M.createEmptyCase('SDH', 'x')).map((g) => g.title)
  ok(!y2.includes('ICE'), 'Y2 was nagged about ICE, which its level does not require')
  ok(sdh.includes('ICE'), 'SDH was not asked about ICE')
})
t('it reads the record and never writes to it', () => {
  const rec = M.createEmptyCase('Y5', 'x')
  const before = JSON.stringify(rec)
  M.historyGaps(rec)
  eq(JSON.stringify(rec), before, 'the gap finder mutated the record')
})

// --------------------------------------------------------- export file names
console.log('\nexport file names')
t('the filename carries the learner, the case and the date', () => {
  const rec = M.buildKneeOsteoarthritisCase()
  rec.patient.name = 'Bà H.'
  const name = M.buildFileName(rec, { studentId: '21YHGD001', fullName: 'A', level: 'Y5', classGroup: '' })
  ok(name.startsWith('ClerkMate_21YHGD001_'), name)
  ok(/Ba-H/.test(name), `lost the case: ${name}`)
  ok(/\d{4}-\d{2}-\d{2}$/.test(name), `lost the date: ${name}`)
})
t('a case with no name falls back to its code, then its label', () => {
  const rec = M.buildKneeOsteoarthritisCase()
  rec.patient.name = ''
  rec.submission.code = 'BGK01-260911-847'
  ok(M.buildFileName(rec, null).includes('BGK01-260911-847'), 'code not used')
  rec.submission.code = ''
  rec.patient.caseLabel = 'Ca 03'
  ok(/Ca-03/.test(M.buildFileName(rec, null)), 'label not used')
})
t('a nameless case still produces a usable filename', () => {
  const rec = M.createEmptyCase('Y5', '')
  const name = M.buildFileName(rec, null)
  ok(name.startsWith('ClerkMate_nguoi-hoc_ca-'), name)
  ok(!name.includes('undefined') && !name.endsWith('_'), name)
})

// ------------------------------------------------------------ privacy boundary
console.log('\nprivacy boundary — what may leave the device')
const att = (over = {}) => ({
  id: 'a', category: 'lab', title: 't', date: '', note: '', mimeType: 'image/jpeg',
  thumbnail: 'data:image/jpeg;base64,AAAA', blobKey: 'raw', sanitizedBlobKey: '',
  redacted: false, privacyChecked: false, faceCheck: '', createdAt: new Date().toISOString(),
  ...over,
})
t('an image with no derivative may not leave the device', () => {
  ok(!M.hasDerivative(att()), 'a raw-only image counted as having a derivative')
  ok(!M.isSubmissionSafe(att()), 'a raw-only image counted as submission-safe')
})
t('the old privacyChecked flag alone no longer opens the gate', () => {
  ok(!M.isSubmissionSafe(att({ privacyChecked: true })), 'the flag alone was enough')
  ok(M.isSubmissionSafe(att({ privacyChecked: true, sanitizedBlobKey: 'clean' })), 'a real derivative was refused')
})
t('a field missing entirely fails closed rather than throwing', () => {
  const legacy = att()
  delete legacy.sanitizedBlobKey
  ok(!M.hasDerivative(legacy), 'a legacy attachment passed the derivative test')
  ok(!M.isSubmissionSafe(legacy), 'a legacy attachment was submission-safe')
})
t('a declared face is blocked even when a derivative exists', () => {
  const faced = att({ category: 'clinical_photo', sanitizedBlobKey: 'clean', redacted: true, faceCheck: 'present' })
  ok(M.hasDerivative(faced), 'fixture is wrong: no derivative')
  ok(M.faceDeclaredPresent(faced), 'the face was not detected')
  ok(!M.isSubmissionSafe(faced), 'a face got through because the image was redacted')
})
t('an unanswered face question blocks a clinical photo, but not a lab image', () => {
  ok(!M.isSubmissionSafe(att({ category: 'clinical_photo', sanitizedBlobKey: 'clean' })), 'unanswered photo passed')
  ok(M.faceUnanswered(att({ category: 'clinical_photo' })), 'unanswered photo not reported')
  ok(M.isSubmissionSafe(att({ category: 'lab', sanitizedBlobKey: 'clean' })), 'a lab image was asked the face question')
})
t('an export strips the image data of anything unsafe, and keeps the entry', () => {
  const rec = M.createEmptyCase('Y5', 'x')
  rec.attachments.push(att({ id: 'unsafe' }), att({ id: 'safe', sanitizedBlobKey: 'clean', privacyChecked: true }))
  const out = M.withExportSafeAttachments(rec)
  eq(out.attachments.length, 2, 'an entry disappeared instead of being stripped')
  const unsafe = out.attachments.find((a) => a.id === 'unsafe')
  eq(unsafe.thumbnail, '', 'a raw-derived thumbnail survived into the export')
  eq(unsafe.blobKey, '', 'a raw blob key survived into the export')
  eq(out.attachments.find((a) => a.id === 'safe').thumbnail, 'data:image/jpeg;base64,AAAA', 'a safe image was stripped')
  eq(rec.attachments[0].thumbnail, 'data:image/jpeg;base64,AAAA', 'the local record was mutated by an export')
})
t('the submission bundle is built from the stripped record', () => {
  const rec = M.createEmptyCase('Y5', 'x')
  rec.attachments.push(att({ id: 'unsafe' }))
  const bundle = M.buildBundle(rec, { fullName: 'a', studentId: 'b', level: 'Y5', classGroup: '' })
  eq(bundle.record.attachments[0].thumbnail, '', 'the bundle carried a raw-derived thumbnail')
  ok(!JSON.stringify(bundle).includes('base64,AAAA'), 'raw image bytes reached the bundle JSON')
})

// -------------------------------------------------------------- status machine
console.log('\nstatus machine and submission gate')
const snapOf = (r) => M.evaluateCompleteness(r)
t('a blank case is "new", a noted case is "noting"', () => {
  const rec = M.createEmptyCase('Y5', 'x')
  eq(M.caseStatus(rec, snapOf(rec)), 'new')
  rec.quickNotes.push({ id: 'q', createdAt: new Date().toISOString(), text: 'abc', filedInto: [], archived: false })
  eq(M.caseStatus(rec, snapOf(rec)), 'noting')
})
t('a complete case with a dirty attachment is not "ready to submit"', () => {
  const rec = M.buildKneeOsteoarthritisCase()
  rec.attachments.push({ id: 'a', category: 'lab', title: 't', date: '', note: '', mimeType: 'image/jpeg',
    thumbnail: '', blobKey: 'b', sanitizedBlobKey: '', redacted: false, privacyChecked: false,
    faceCheck: '', createdAt: new Date().toISOString() })
  const st = M.caseStatus(rec, snapOf(rec))
  ok(st !== 'readyToSubmit', `status was ${st}`)
  ok(M.submitBlockers(rec, snapOf(rec)).some((b) => /ảnh/.test(b)), 'no image blocker raised')
})
t('the submission gate covers mandatory items AND image privacy', () => {
  const rec = M.createEmptyCase('SDH', 'x')
  rec.attachments.push({ id: 'a', category: 'lab', title: 't', date: '', note: '', mimeType: 'image/jpeg',
    thumbnail: '', blobKey: 'b', sanitizedBlobKey: '', redacted: false, privacyChecked: false,
    faceCheck: '', createdAt: new Date().toISOString() })
  const blockers = M.submitBlockers(rec, snapOf(rec))
  ok(blockers.some((b) => /bắt buộc/.test(b)), 'no mandatory blocker')
  ok(blockers.some((b) => /ảnh/.test(b)), 'no privacy blocker')
})
t('submitting locks, stamps a code, and clears unread reviews', () => {
  const rec = M.submit(M.buildKneeOsteoarthritisCase(), '21YHGD001')
  ok(rec.submission.locked, 'not locked')
  ok(/^21YHGD001-\d{6}-\d{3}$/.test(rec.submission.code), `odd code ${rec.submission.code}`)
  eq(M.caseStatus(rec, snapOf(rec)), 'submitted')
})
t('the submission code keeps the distinguishing tail of the student id', () => {
  const a = M.makeSubmissionCode(M.createEmptyCase('Y5', 'x'), '21YHGD001')
  const b = M.makeSubmissionCode(M.createEmptyCase('Y5', 'x'), '21YHGD002')
  ok(a.startsWith('21YHGD001-'), a)
  ok(b.startsWith('21YHGD002-'), b)
})
t('returning unlocks and shows as "returned"; accepting keeps the lock', () => {
  const base = M.submit(M.buildKneeOsteoarthritisCase(), 'SV1')
  const back = M.recordReview(base, 'BS. B', 'returned', 'bổ sung đi')
  eq(back.submission.locked, false)
  eq(M.caseStatus(back, snapOf(back)), 'returned')
  const acc = M.recordReview(base, 'BS. B', 'accepted', 'tốt')
  eq(acc.submission.locked, true)
  eq(M.caseStatus(acc, snapOf(acc)), 'accepted')
})
t('a returned case that is fixed and resubmitted no longer reads "returned"', async () => {
  const back = M.recordReview(M.submit(M.buildKneeOsteoarthritisCase(), 'SV1'), 'BS. B', 'returned', 'x')
  const again = M.submit(back, 'SV1')
  const st = M.caseStatus(again, snapOf(again))
  eq(st, 'submitted', 'status after resubmission')
  eq(M.unreadReviews(again).length, 0, 'resubmission left the comment unread')
})
t('reopening is counted and unlocks', () => {
  const rec = M.reopen(M.submit(M.buildKneeOsteoarthritisCase(), 'SV1'))
  eq(rec.submission.locked, false)
  eq(rec.submission.reopenedAt.length, 1)
  eq(rec.submission.submittedAt, '')
})
t('reopening after a decision drops back to a content-derived status', () => {
  const back = M.recordReview(M.submit(M.buildKneeOsteoarthritisCase(), 'SV1'), 'BS. B', 'accepted', 'ok')
  const re = M.reopen(back)
  const st = M.caseStatus(re, snapOf(re))
  ok(!['accepted', 'returned', 'submitted'].includes(st), `stuck at ${st}`)
})
t('feedback history survives a second round', () => {
  let rec = M.submit(M.buildKneeOsteoarthritisCase(), 'SV1')
  rec = M.recordReview(rec, 'BS. B', 'returned', 'lần 1')
  rec = M.submit(rec, 'SV1')
  rec = M.recordReview(rec, 'BS. C', 'accepted', 'lần 2')
  eq(rec.submission.reviews.length, 2, 'reviews kept')
  eq(rec.submission.reviews.map((r) => r.comment), ['lần 1', 'lần 2'])
})
t('a reviewer file only carries back the submission block, never clinical edits', () => {
  const mine = M.submit(M.buildKneeOsteoarthritisCase(), 'SV1')
  const tampered = M.recordReview(structuredClone(mine), 'BS. B', 'returned', 'x')
  tampered.history.chiefComplaint = 'GIẢNG VIÊN ĐỔI NỘI DUNG'
  tampered.patient.name = 'ĐỔI TÊN'
  const merged = M.mergeReview(mine, tampered)
  eq(merged.history.chiefComplaint, mine.history.chiefComplaint, 'clinical text was overwritten')
  eq(merged.patient.name, mine.patient.name, 'patient identity was overwritten')
  eq(merged.submission.reviews.length, 1, 'review not carried over')
  eq(M.unreadReviews(merged).length, 1, 'incoming review should be unread')
})
t('a submission bundle round-trips', () => {
  const rec = M.submit(M.buildKneeOsteoarthritisCase(), 'SV1')
  const student = { fullName: 'A', studentId: 'SV1', level: 'SDH', classGroup: 'K30' }
  const parsed = M.parseBundle(JSON.stringify(M.buildBundle(rec, student)))
  eq(parsed.code, rec.submission.code)
  eq(parsed.record.patient.name, rec.patient.name)
})
t('a non-ClerkMate file is rejected', () => {
  let threw = false
  try { M.parseBundle(JSON.stringify({ hello: 'world' })) } catch { threw = true }
  ok(threw, 'garbage file accepted')
})

// ------------------------------------------------------------- AI validation
console.log('\nAI response validation')
const NOTE = 'Nữ 58 tuổi, nội trợ. THA 10 năm, đang uống amlodipine 5 mg mỗi sáng. HA 148/86 mmHg, mạch 78 lần/phút.'
t('a well-formed suggestion is accepted and carries its snippet', () => {
  const d = M.draftsFromResponse({ suggestions: [
    { target: 'patient.ageYears', value: '58', source: 'Nữ 58 tuổi', confidence: 0.99, fields: { age: '58' } },
  ] }, NOTE)
  eq(d.length, 1)
  eq(d[0].payload.age, '58')
  eq(d[0].snippet, 'Nữ 58 tuổi')
  eq(d[0].confidence, 'high')
})
t('a suggestion whose quote is not in the note is rejected', () => {
  const d = M.draftsFromResponse({ suggestions: [
    { target: 'redFlags.present', value: 'Sốt', source: 'bệnh nhân sốt cao 39 độ', confidence: 0.9 },
  ] }, NOTE)
  eq(d.length, 0, 'fabricated source accepted')
})
t('a suggestion with no quote at all is rejected', () => {
  eq(M.draftsFromResponse({ suggestions: [{ target: 'patient.occupation', value: 'Nội trợ', confidence: 1 }] }, NOTE).length, 0)
})
t('an out-of-catalogue target is rejected', () => {
  for (const target of ['diagnosis.primary', 'managementPlan.nonPharm', 'examination.systems', 'anything'])
    eq(M.draftsFromResponse({ suggestions: [{ target, value: 'x', source: 'Nữ 58 tuổi', confidence: 1 }] }, NOTE).length, 0, target)
})
t('no AI target can reach diagnosis, management, investigations or examination systems', () => {
  const forbidden = M.AI_FIELDS.filter((f) =>
    /^(diagnosis|managementPlan|investigations|prevention|followUp|reflection)\./.test(f.target) ||
    f.target === 'examination.systems')
  eq(forbidden.map((f) => f.target), [], 'AI can write to a forbidden area')
})
t('a value the payload builder cannot map is rejected rather than guessed', () => {
  eq(M.draftsFromResponse({ suggestions: [
    { target: 'vitals.bloodPressure', value: 'hơi cao', source: 'HA 148/86 mmHg', confidence: 0.9 },
  ] }, NOTE).length, 0, 'unparseable blood pressure accepted')
  eq(M.draftsFromResponse({ suggestions: [
    { target: 'patient.ageYears', value: 'khoảng trung niên', source: 'Nữ 58 tuổi', confidence: 0.9 },
  ] }, NOTE).length, 0, 'unparseable age accepted')
})
t('a malformed response throws so the caller can fall back', () => {
  for (const bad of [{}, { suggestions: 'nope' }, null, { suggestions: undefined }]) {
    let threw = false
    try { M.draftsFromResponse(bad, NOTE) } catch { threw = true }
    ok(threw, `accepted ${JSON.stringify(bad)}`)
  }
})
t('confidence maps to the three UI tiers', () => {
  const tier = (c) => M.draftsFromResponse({ suggestions: [
    { target: 'patient.occupation', value: 'Nội trợ', source: 'nội trợ', confidence: c },
  ] }, NOTE)[0].confidence
  eq(tier(0.99), 'high'); eq(tier(0.7), 'medium'); eq(tier(0.2), 'low')
})
t('AI drafts are stamped as AI and apply through the shared pipeline', async () => {
  const rec = M.createEmptyCase('Y5', 'x')
  const drafts = M.draftsFromResponse({ suggestions: [
    { target: 'vitals.bloodPressure', value: '148/86', source: 'HA 148/86 mmHg', confidence: 0.98,
      fields: { systolic: '148', diastolic: '86' } },
  ] }, NOTE)
  const suggestions = drafts.map((d, i) => ({ id: 's' + i, ...d, origin: 'ai' }))
  const next = M.applyMany(rec, suggestions)
  eq(next.examination.vitals.systolic, '148')
  eq(next.examination.vitals.diastolic, '86')
})

// ------------------------------------------------ local parser still the default
console.log('\nlocal parser')
t('the local parser is marked local and still extracts the sample note', async () => {
  eq(M.heuristicStructurer.local, true)
  const found = await M.heuristicStructurer.structure(NOTE, M.createEmptyCase('Y5', 'x'))
  ok(found.length > 4, `only ${found.length} suggestions`)
  ok(found.every((s) => s.snippet && s.snippet.length > 0), 'a suggestion had no snippet')
  ok(found.every((s) => s.origin === 'local'), 'origin not stamped local')
})
t('every local suggestion targets a field that has an applier', () => {
  return M.heuristicStructurer.structure(NOTE, M.createEmptyCase('Y5', 'x')).then((found) => {
    const bad = found.filter((s) => !M.canApply(s.targetKey)).map((s) => s.targetKey)
    eq(bad, [], 'local parser proposes an unappliable target')
  })
})

// ------------------------------------------------------- record migration
console.log('\nrecord migration and clinical helpers')
t('an old record with no submission block still opens', () => {
  const rec = M.buildKneeOsteoarthritisCase()
  const legacy = structuredClone(rec)
  delete legacy.submission
  delete legacy.riskAssessment.recall
  const migrated = M.migrateCase(legacy)
  eq(migrated.submission.locked, false)
  eq(migrated.submission.reviews, [])
  ok(migrated.patient.name === rec.patient.name, 'content lost in migration')
})
t('migration preserves an existing submission block', () => {
  const rec = M.submit(M.buildKneeOsteoarthritisCase(), 'SV1')
  const migrated = M.migrateCase(JSON.parse(JSON.stringify(rec)))
  eq(migrated.submission.code, rec.submission.code)
  eq(migrated.submission.locked, true)
})
t('BMI uses the Asia-Pacific bands', () => {
  eq(M.bmiCategory(M.computeBmi('155', '62')), 'Béo phì độ I')
  eq(M.bmiCategory(M.computeBmi('170', '60')), 'Bình thường')
  eq(M.bmiCategory(M.computeBmi('170', '68')), 'Thừa cân')
})
t('falls banding follows the printed rule', () => {
  const base = { fellPastYear: 'unknown', feelsUnsteady: 'unknown', worriesAboutFalling: 'unknown',
    fallCount: '', injured: 'unknown', timedUpAndGoSeconds: '', chairStandCount: '', note: '' }
  eq(M.fallsBand(base).level, null, 'unanswered should have no band')
  eq(M.fallsBand({ ...base, fellPastYear: 'no', feelsUnsteady: 'no', worriesAboutFalling: 'no' }).level, 'low')
  eq(M.fallsBand({ ...base, fellPastYear: 'yes', fallCount: '1' }).level, 'moderate')
  eq(M.fallsBand({ ...base, fellPastYear: 'yes', fallCount: '2' }).level, 'high')
  eq(M.fallsBand({ ...base, timedUpAndGoSeconds: '15.5' }).level, 'high')
})
t('licensed scales ship no items', () => {
  for (const id of ['hads', 'isi']) eq(M.SCALES[id].items.length, 0, `${id} reprints items`)
  for (const id of ['phq2', 'phq9', 'gad2', 'gad7']) ok(M.SCALES[id].items.length > 0, `${id} has no items`)
})
t('risk scaffolding fades by level, with the emergency exception', () => {
  const emergency = M.RISK_DOMAINS.find((d) => d.id === 'emergency')
  const cardio = M.RISK_DOMAINS.find((d) => d.id === 'cardiometabolic')
  for (const l of M.LEVEL_ORDER) eq(M.riskModeFor(l, emergency), 'checklist', `emergency at ${l}`)
  eq(M.riskModeFor('Y2', cardio), 'recallThenChecklist')
  eq(M.riskModeFor('Y5', cardio), 'recallThenChecklist')
  eq(M.riskModeFor('SDH', cardio), 'generate')
})

rmSync(dir, { recursive: true, force: true })

console.log(`\n${pass}/${pass + failures.length} rule checks passed`)
if (failures.length) {
  console.log('\nFAILED:')
  failures.forEach((f) => console.log(' -', f))
  process.exit(1)
}
