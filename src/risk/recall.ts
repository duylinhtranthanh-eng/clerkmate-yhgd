/**
 * Matching a learner's own risk list against the catalogue.
 *
 * Deliberately reports **matches only**. Telling a learner they "missed" an
 * item on the strength of a keyword heuristic would be worse than saying
 * nothing: they may well have meant it in different words. Highlighting what
 * they did think of is safe, and comparing their own list against the full
 * checklist is left to them — which is the point of the exercise.
 */

import type { RiskFactorDef } from '../config/risk'
import { norm } from '../parsing/text'

/**
 * Words too generic to identify a factor on their own. Without this list
 * "giảm thị lực" would credit the learner for "suy yếu — giảm hoạt động chức
 * năng", because both contain "giam".
 */
const STOPWORDS = new Set([
  'nguy', 'yeu', 'benh', 'nhan', 'trong', 'ngoai', 'khong', 'hoac', 'cua', 'theo',
  'muc', 'tinh', 'trang', 'nhieu', 'chua', 'gian', 'hien', 'tien', 'phai', 'duoc',
  'tuoi', 'gioi', 'keo', 'dai', 'moi', 'cach', 'canh', 'luc', 'kem', 'lam', 'viec',
  'toi', 'tren', 'duoi', 'giua', 'cac', 'nhung', 'that', 'ban',
  'giam', 'tang', 'roi', 'loan', 'nguoi', 'cham', 'soc', 'hoat', 'dong', 'chuc',
  'nang', 'song', 'khoi', 'phat', 'hoi', 'dung', 'thuoc', 'gia', 'dinh', 'khac',
  'mang', 'luoi', 'tiep', 'can', 'tham', 'gia', 'cong', 'thuc', 'hanh',
])

/**
 * Keys for factors whose label words would cross-match something unrelated.
 *
 * A key with spaces matches when **all** of its words appear somewhere in the
 * learner's text, not necessarily together — so "gia dinh tim mach" still
 * matches "gia đình bị tim mạch".
 */
const EXPLICIT_KEYS: Record<string, string[]> = {
  'em.chestPain': ['dau nguc'],
  'em.dyspnoea': ['kho tho', 'spo2', 'suy ho hap'],
  'em.neuroDeficit': ['than kinh khu tru', 'yeu nua nguoi', 'meo mieng', 'dot quy', 'liet'],
  'em.severeHypertension': ['huyet ap cao', 'huyet ap 180', 'con tang huyet ap', 'tha cap cuu'],
  'em.sepsis': ['nhiem khuan huyet', 'sot tri giac', 'sepsis', 'sot tut huyet ap', 'soc nhiem'],
  'em.bleeding': ['xuat huyet', 'chay mau', 'non mau', 'phan den', 'ho ra mau'],
  'em.hypoglycaemia': ['ha duong huyet', 'hypoglycemia', 'tut duong'],
  'em.headTrauma': ['va dau', 'chan thuong dau', 'chan thuong so nao'],
  'bh.smoking': ['hut thuoc', 'thuoc la', 'khoi thuoc', 'goi-nam', 'goi nam'],
  'bh.secondhandSmoke': ['thu dong'],
  'ge.polypharmacy': ['nhieu thuoc', 'da thuoc', 'polypharmacy', 'so luong thuoc'],
  'cg.adherence': ['tuan thu', 'quen thuoc', 'quen uong'],
  'bh.alcohol': ['ruou', 'bia'],
  'bh.inactivity': ['van dong', 'the duc', 'the luc', 'ngoi nhieu'],
  'bh.diet': ['an man', 'che do an', 'dinh duong', 'rau', 'muoi', 'ngot'],
  'bh.sleep': ['giac ngu', 'mat ngu', 'ngu it'],
  'cm.obesity': ['beo phi', 'thua can', 'bmi', 'can nang'],
  'cm.centralObesity': ['vong eo', 'beo trung tam'],
  'ge.falls': ['te nga', 'nga'],
  'ge.homeHazard': ['nha o', 'cau thang', 'tron', 'tay vin', 'anh sang'],
  'em.suicidal': ['tu sat', 'tu tu', 'tu lam hai'],
  'so.domesticViolence': ['bao luc', 'bao hanh', 'danh dap'],
  'ge.frailty': ['suy yeu', 'frailty', 'yeu suc', 'di cham'],
  'ge.sensory': ['thi luc', 'thinh luc', 'mat mo', 'nghe kem', 'tai nghe'],
  'ge.malnutrition': ['suy dinh duong', 'sut can', 'an kem', 'bo bua'],
  'ge.incontinence': ['tieu khong tu chu', 'tieu dam', 'khong giu duoc'],
  'ge.osteoporosis': ['loang xuong', 'gay xuong', 'mat do xuong'],
  'cg.memoryComplaint': ['tri nho', 'hay quen', 'nho kem'],
  'cg.dementiaRisk': ['sa sut tri tue', 'dementia', 'alzheimer'],
  'cg.delirium': ['lu lan', 'me sang', 'delirium'],
  'ps.depression': ['tram cam', 'buon', 'phq'],
  'ps.anxiety': ['lo au', 'gad', 'lo lang'],
  'ps.chronicStress': ['cang thang', 'stress', 'ap luc'],
  'ps.grief': ['mat nguoi than', 'mat vo', 'mat chong', 'dau buon', 'goa'],
  'ps.caregiverBurden': ['ganh nang', 'kiet suc'],
  'ps.illnessBelief': ['niem tin', 'quan niem', 'hieu sai'],
  'em.dehydration': ['mat nuoc', 'khong an uong', 'bo bua'],
  'cm.hypertension': ['huyet ap', 'tha'],
  'cm.diabetes': ['dai thao duong', 'tieu duong', 'dtd', 'duong huyet'],
  'cm.dyslipidemia': ['lipid', 'mo mau', 'cholesterol'],
  'cm.ckd': ['than man', 'suy than', 'egfr', 'albumin nieu'],
  'cm.atrialFibrillation': ['rung nhi', 'mach khong deu'],
  'cm.familyCvd': ['gia dinh tim mach', 'tim mach som', 'di truyen tim'],
  'en.occupational': ['nghe nghiep', 'phoi nhiem', 'bui', 'hoa chat', 'tieng on', 'khoi han'],
  'en.indoorSmoke': ['bep than', 'bep cui', 'khoi bep'],
  'en.housing': ['nha o', 'chat', 'am', 'thong khi'],
  'en.waterSanitation': ['nuoc sach', 've sinh'],
}

function keysFor(def: RiskFactorDef): string[] {
  const explicit = EXPLICIT_KEYS[def.id]
  if (explicit) return explicit
  return norm(def.label)
    .split(/[^a-z0-9]+/)
    .filter((w) => w.length >= 4 && !STOPWORDS.has(w))
}

function keyMatches(haystack: string, key: string): boolean {
  const words = key.split(/\s+/).filter(Boolean)
  if (words.length === 0) return false
  if (words.length === 1) return haystack.includes(words[0])
  return words.every((w) => haystack.includes(w))
}

/** Ids of catalogue factors the learner's free text appears to mention. */
export function mentionedFactors(text: string, factors: RiskFactorDef[]): Set<string> {
  const haystack = norm(text)
  if (haystack.trim().length === 0) return new Set()
  const out = new Set<string>()
  for (const def of factors) {
    const keys = keysFor(def)
    if (keys.length > 0 && keys.some((k) => keyMatches(haystack, k))) out.add(def.id)
  }
  return out
}

/** Rough count of distinct items the learner listed, for their own self-audit. */
export function countListedItems(text: string): number {
  return text
    .split(/[\n;,•·]|(?:^|\s)-\s/)
    .map((x) => x.trim())
    .filter((x) => x.length >= 3).length
}
